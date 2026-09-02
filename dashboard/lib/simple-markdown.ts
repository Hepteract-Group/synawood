export type MdInline =
  | { type: 'text'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'em'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; value: string; href: string }

/** In-app Studio project links only — not javascript: or off-site. */
export const STUDIO_PROJECT_HREF =
  /^\/studio\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type MdBlock =
  | { type: 'h2' | 'h3'; inlines: MdInline[] }
  | { type: 'p'; inlines: MdInline[] }
  | { type: 'ul' | 'ol'; items: MdInline[][] }
  | { type: 'table'; headers: MdInline[][]; rows: MdInline[][][] }
  | { type: 'pre'; value: string; lang?: string }
  | { type: 'blockquote'; inlines: MdInline[] }
  | { type: 'hr' }

/** Inline tokens: **bold**, `code`, and [label](/studio/{uuid}). No HTML. */
export const parseInline = (text: string): MdInline[] => {
  const parts: MdInline[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(\/studio\/[0-9a-f-]+\)|\*[^*]+\*)/gi
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ type: 'text', value: text.slice(last, match.index) })
    }
    const token = match[0]
    if (token.startsWith('**')) {
      parts.push({ type: 'strong', value: token.slice(2, -2) })
    } else if (token.startsWith('`')) {
      parts.push({ type: 'code', value: token.slice(1, -1) })
    } else if (token.startsWith('*')) {
      parts.push({ type: 'em', value: token.slice(1, -1) })
    } else {
      const parsed = token.match(/^\[([^\]]+)\]\((\/studio\/[0-9a-f-]+)\)$/i)
      const href = parsed?.[2] ?? ''
      if (parsed && STUDIO_PROJECT_HREF.test(href)) {
        parts.push({ type: 'link', value: parsed[1]!, href })
      } else {
        parts.push({ type: 'text', value: token })
      }
    }
    last = match.index + token.length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts.length > 0 ? parts : [{ type: 'text', value: text }]
}

const splitTableCells = (line: string): string[] => {
  const trimmed = line.trim()
  const inner = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed
  const withoutEnd = inner.endsWith('|') ? inner.slice(0, -1) : inner
  return withoutEnd.split('|').map((cell) => cell.trim())
}

const isTableSeparator = (line: string): boolean => {
  const cells = splitTableCells(line)
  if (cells.length === 0) return false
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')))
}

const isTableLikePipeRow = (line: string): boolean => {
  const trimmed = line.trim()
  return trimmed.startsWith('|') && splitTableCells(trimmed).length >= 2
}

const isHr = (line: string): boolean => /^(?:-{3,}|\*{3,}|_{3,})$/.test(line.trim())

/** Headings, lists, GFM tables, fenced code, blockquotes. Safe subset for Studio chat. */
export const parseMarkdown = (markdown: string): MdBlock[] => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: MdBlock[] = []
  let paragraph: string[] = []
  let listKind: 'ul' | 'ol' | null = null
  let listItems: string[] = []
  let i = 0

  const flushParagraph = () => {
    if (!paragraph.length) return
    blocks.push({ type: 'p', inlines: parseInline(paragraph.join(' ').trim()) })
    paragraph = []
  }
  const flushList = () => {
    if (!listKind || !listItems.length) return
    blocks.push({
      type: listKind,
      items: listItems.map((item) => parseInline(item)),
    })
    listKind = null
    listItems = []
  }

  while (i < lines.length) {
    const rawLine = lines[i]!
    const trimmed = rawLine.trim()
    if (!trimmed) {
      flushParagraph()
      flushList()
      i += 1
      continue
    }
    if (trimmed.startsWith('```')) {
      flushParagraph()
      flushList()
      const lang = trimmed.slice(3).trim() || undefined
      const body: string[] = []
      i += 1
      while (i < lines.length && !lines[i]!.trim().startsWith('```')) {
        body.push(lines[i]!)
        i += 1
      }
      if (i < lines.length) i += 1
      blocks.push({ type: 'pre', value: body.join('\n'), ...(lang ? { lang } : {}) })
      continue
    }
    if (isTableLikePipeRow(trimmed) && !isTableSeparator(trimmed)) {
      const pipeLines: string[] = []
      let j = i
      while (j < lines.length && isTableLikePipeRow(lines[j]!)) {
        pipeLines.push(lines[j]!.trim())
        j += 1
      }
      const hasSeparator = pipeLines.length >= 2 && isTableSeparator(pipeLines[1]!)
      if (pipeLines.length >= 2) {
        flushParagraph()
        flushList()
        const headers = splitTableCells(pipeLines[0]!).map((cell) => parseInline(cell))
        const dataLines = hasSeparator ? pipeLines.slice(2) : pipeLines.slice(1)
        const rows: MdInline[][][] = dataLines
          .filter((line) => !isTableSeparator(line))
          .map((line) => {
            const cells = splitTableCells(line)
            return headers.map((_, index) => parseInline(cells[index] ?? ''))
          })
        blocks.push({ type: 'table', headers, rows })
        i = j
        continue
      }
    }
    if (isHr(trimmed)) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'hr' })
      i += 1
      continue
    }
    if (trimmed.startsWith('> ')) {
      flushParagraph()
      flushList()
      const quote: string[] = []
      while (i < lines.length && lines[i]!.trim().startsWith('> ')) {
        quote.push(lines[i]!.trim().slice(2))
        i += 1
      }
      blocks.push({ type: 'blockquote', inlines: parseInline(quote.join(' ')) })
      continue
    }
    if (trimmed.startsWith('### ')) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'h3', inlines: parseInline(trimmed.slice(4)) })
      i += 1
      continue
    }
    if (trimmed.startsWith('## ')) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'h2', inlines: parseInline(trimmed.slice(3)) })
      i += 1
      continue
    }
    if (trimmed.startsWith('# ')) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'h2', inlines: parseInline(trimmed.slice(2)) })
      i += 1
      continue
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushParagraph()
      if (listKind === 'ol') flushList()
      listKind = 'ul'
      listItems.push(trimmed.slice(2))
      i += 1
      continue
    }
    const numbered = trimmed.match(/^(\d+)\.\s+(.+)$/)
    if (numbered) {
      flushParagraph()
      if (listKind === 'ul') flushList()
      listKind = 'ol'
      listItems.push(numbered[2]!)
      i += 1
      continue
    }
    flushList()
    paragraph.push(trimmed)
    i += 1
  }
  flushParagraph()
  flushList()
  return blocks
}
