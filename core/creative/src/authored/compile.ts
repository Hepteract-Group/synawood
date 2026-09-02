import ts from 'typescript'
import { MOTION_KIT_VALUE_EXPORTS } from '../motion-kit/catalog'
import { injectMissingMotionKitImports } from './inject-kit-imports'
import { missingMotionKitExports } from './load-component'
import { scanAuthoredSource } from './scan'

export type AuthoredCompileFailure = {
  ok: false
  compileError: string
  line: number
  code?: undefined
}

export type AuthoredCompileSuccess = {
  ok: true
  code: string
  compileError: null
}

export type AuthoredCompileResult = AuthoredCompileFailure | AuthoredCompileSuccess

const SECRET_LEAK = /\b(AZURE|SUPABASE|POSTIZ)[_A-Z0-9]*\b/

/** Scan + transpile. Safe to call from a Next.js API route (no Remotion webpack).
 * Runtime undefined-component checks stay in the Player iframe via loadAuthoredComponent. */
export const compileAuthoredComposition = (source: string): AuthoredCompileResult => {
  const withKit = injectMissingMotionKitImports(source)
  const scanned = scanAuthoredSource(withKit)
  if (!scanned.ok) {
    return { ok: false, compileError: scanned.compileError, line: scanned.line }
  }

  const missing = missingMotionKitExports(withKit, MOTION_KIT_VALUE_EXPORTS)
  if (missing.length > 0) {
    return {
      ok: false,
      compileError: `Motion kit has no export named ${missing.join(', ')}. Check list_motion_kit and patch the import.`,
      line: 1,
    }
  }

  const transpiled = ts.transpileModule(withKit, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      strict: true,
    },
    fileName: 'authored.tsx',
    reportDiagnostics: true,
  })

  const firstError = transpiled.diagnostics?.find(
    (item) => item.category === ts.DiagnosticCategory.Error,
  )
  if (firstError) {
    const message = ts.flattenDiagnosticMessageText(firstError.messageText, '\n')
    const line =
      firstError.start !== undefined ? withKit.slice(0, firstError.start).split('\n').length : 1
    return { ok: false, compileError: `Line ${line}: ${message}`, line }
  }

  const code = transpiled.outputText
  if (SECRET_LEAK.test(code)) {
    return {
      ok: false,
      compileError: 'Compile refused: the bundle would contain a cloud secret name.',
      line: 1,
    }
  }

  return { ok: true, code, compileError: null }
}
