import type { ProductExtract } from '../extract/product-extract-schema'

const INJECTABLE_QUALITY = new Set(['usable', 'weak'])

/** Product-scoped Extracts the agent may auto-use this turn. Rejected stay out. */
export const productExtractContextBlock = (extracts: readonly ProductExtract[]): string => {
  const injectable = extracts.filter(
    (extract) =>
      extract.kind !== 'text' &&
      Boolean(extract.blobKey) &&
      INJECTABLE_QUALITY.has(extract.quality),
  )
  if (injectable.length === 0) return ''
  const lines = injectable.map((extract) => {
    const note = extract.qualityNote ? ` note="${extract.qualityNote}"` : ''
    return `- extractId=${extract.id} quality=${extract.quality} kind=${extract.kind} sourceUrl=${extract.sourceUrl}${note}`
  })
  return [
    '## Product Extracts (this Product)',
    'Usable and weak public-page stills on this Product. Use these extractIds — do not invent ids. Rejected stills are omitted; the operator can Place them from the Extracts bin. Other Products’ extracts are not listed.',
    ...lines,
  ].join('\n')
}
