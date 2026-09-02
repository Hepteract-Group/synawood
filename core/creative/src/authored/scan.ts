import ts from 'typescript'
import { blockedAuthoredImportMessage, isAllowlistedAuthoredImport } from './allowlist'

export type AuthoredScanFailure = {
  ok: false
  compileError: string
  line: number
}

export type AuthoredScanSuccess = { ok: true }

export type AuthoredScanResult = AuthoredScanFailure | AuthoredScanSuccess

const CSS_MOTION_HINT =
  'CSS transitions flicker on encode. Use `interpolate` / `spring` (or kit `fadeIn`). Same look, tied to the frame.'

const RANDOM_HINT =
  'Math.random() is forbidden in composition source. Use Remotion random(`${motionSeed}-…`) so preview and export match.'

const lineOf = (source: string, pos: number): number => source.slice(0, pos).split('\n').length

const fail = (source: string, pos: number, compileError: string): AuthoredScanFailure => ({
  ok: false,
  compileError: `Line ${lineOf(source, pos)}: ${compileError}`,
  line: lineOf(source, pos),
})

const IDENTIFIER_BANS: Array<{ name: string; hint: string }> = [
  { name: 'eval', hint: 'eval is blocked in authored compositions.' },
  { name: 'process', hint: 'process is blocked. Authored compositions cannot read env or Node.' },
  { name: 'WebSocket', hint: 'WebSocket is blocked in authored compositions.' },
  { name: 'Worker', hint: 'Worker is blocked in authored compositions.' },
]

const looksLikeCssMotion = (text: string): boolean =>
  /(?:^|[;{\s])transition\s*:/.test(text) ||
  /(?:^|[;{\s])animation\s*:/.test(text) ||
  /@keyframes\b/.test(text)

export const scanAuthoredSource = (source: string): AuthoredScanResult => {
  if (source.trim().length === 0) {
    return {
      ok: false,
      compileError:
        'This motion ad has no composition source yet. Ask the agent to write the motion.',
      line: 1,
    }
  }

  const sourceFile = ts.createSourceFile(
    'authored.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )

  const visit = (node: ts.Node): AuthoredScanFailure | null => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const spec = node.moduleSpecifier
      if (spec && ts.isStringLiteral(spec)) {
        if (!isAllowlistedAuthoredImport(spec.text)) {
          return fail(source, spec.getStart(sourceFile), blockedAuthoredImportMessage(spec.text))
        }
      }
    }

    if (ts.isCallExpression(node)) {
      const expr = node.expression
      if (ts.isIdentifier(expr) && expr.text === 'require' && node.arguments[0]) {
        const arg = node.arguments[0]
        if (ts.isStringLiteral(arg) && !isAllowlistedAuthoredImport(arg.text)) {
          return fail(
            source,
            arg.getStart(sourceFile),
            blockedAuthoredImportMessage(arg.text, 'require'),
          )
        }
      }
      if (
        ts.isPropertyAccessExpression(expr) &&
        ts.isIdentifier(expr.expression) &&
        expr.expression.text === 'Math' &&
        expr.name.text === 'random'
      ) {
        return fail(source, expr.getStart(sourceFile), RANDOM_HINT)
      }
      if (ts.isIdentifier(expr) && expr.text === 'eval') {
        return fail(source, expr.getStart(sourceFile), 'eval is blocked in authored compositions.')
      }
    }

    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === 'Function') {
        return fail(
          source,
          node.expression.getStart(sourceFile),
          'new Function is blocked in authored compositions.',
        )
      }
      if (node.expression.text === 'Worker') {
        return fail(
          source,
          node.expression.getStart(sourceFile),
          'Worker is blocked in authored compositions.',
        )
      }
      if (node.expression.text === 'WebSocket') {
        return fail(
          source,
          node.expression.getStart(sourceFile),
          'WebSocket is blocked in authored compositions.',
        )
      }
    }

    if (ts.isIdentifier(node)) {
      const banned = IDENTIFIER_BANS.find((item) => item.name === node.text)
      if (banned) {
        const parent = node.parent
        if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
          // `foo.process` is fine; only the identifier `process` as a value.
        } else if (ts.isImportSpecifier(parent) || ts.isImportClause(parent)) {
          // Import names handled via module specifier.
        } else {
          return fail(source, node.getStart(sourceFile), banned.hint)
        }
      }
      if (node.text === 'fs' || node.text === 'child_process') {
        return fail(
          source,
          node.getStart(sourceFile),
          `${node.text} is blocked. Authored compositions cannot touch the filesystem.`,
        )
      }
    }

    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'document' &&
      node.name.text === 'cookie'
    ) {
      return fail(
        source,
        node.getStart(sourceFile),
        'document.cookie is blocked in authored compositions.',
      )
    }

    if (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'document' &&
      ts.isStringLiteral(node.argumentExpression) &&
      node.argumentExpression.text === 'cookie'
    ) {
      return fail(
        source,
        node.getStart(sourceFile),
        'document.cookie is blocked in authored compositions.',
      )
    }

    if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
      const name = ts.isPropertyAssignment(node) ? node.name : node.name
      const key = ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : ''
      if (key === 'transition' || key === 'animation') {
        return fail(source, name.getStart(sourceFile), CSS_MOTION_HINT)
      }
    }

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (looksLikeCssMotion(node.text)) {
        return fail(source, node.getStart(sourceFile), CSS_MOTION_HINT)
      }
    }

    if (ts.isTemplateExpression(node)) {
      const raw = node.getText(sourceFile)
      if (looksLikeCssMotion(raw)) {
        return fail(source, node.getStart(sourceFile), CSS_MOTION_HINT)
      }
    }

    for (const child of node.getChildren(sourceFile)) {
      const nested = visit(child)
      if (nested) return nested
    }
    return null
  }

  const astFail = visit(sourceFile)
  if (astFail) return astFail

  if (!/\bexport\s+default\b/.test(source)) {
    return {
      ok: false,
      compileError:
        'Export a default React component from the composition source (export default function …).',
      line: 1,
    }
  }

  return { ok: true }
}
