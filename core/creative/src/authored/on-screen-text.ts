/** Kit copy the critic and claim scanner can read without executing TSX. */

export const kitTagAttr = (source: string, tag: string, attr: string): string[] => {
  const out: string[] = []
  const quoted = new RegExp(`${tag}\\s[^>/]*${attr}=\\{?['"\`]([^'"\`]+)['"\`]`, 'g')
  for (const match of source.matchAll(quoted)) {
    if (match[1]) out.push(match[1])
  }
  return out
}

export const authoredHeadlineText = (source: string): string[] => [
  ...kitTagAttr(source, 'BrandText', 'text'),
  ...kitTagAttr(source, 'KineticType', 'text'),
]

export const authoredOnScreenText = (source: string): string[] => [
  ...authoredHeadlineText(source),
  ...kitTagAttr(source, 'CountUp', 'label'),
]

/** Literal JSX text nodes (3+ chars) without executing TSX. */
export const authoredJsxTextNodes = (source: string): string[] => {
  const out: string[] = []
  const re = />([^<{][^<]{2,})</g
  for (const match of source.matchAll(re)) {
    const text = match[1]?.trim() ?? ''
    if (text.length >= 3 && !/^\{/.test(text)) out.push(text)
  }
  return out
}

export const countUpValues = (source: string): number[] => {
  const out: number[] = []
  const numbered = /CountUp\s[^>/]*(?:value|to)=\{(\d+(?:\.\d+)?)/g
  for (const match of source.matchAll(numbered)) {
    if (match[1]) out.push(Number(match[1]))
  }
  return out
}
