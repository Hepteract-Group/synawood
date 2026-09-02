/** Host only passes logoUrl / productUrl / plates. Agents invent bgHook — bind those to real stills. */

const HOST_PROP_KEYS = new Set([
  'motionSeed',
  'primaryColor',
  'accentColor',
  'fontFamily',
  'brandLabel',
  'logoSrc',
  'logoUrl',
  'disclaimer',
  'trialWatermark',
  'plates',
  'heroSrc',
  'productUrl',
  'proofStat',
  'audioClips',
  'durationInFrames',
  'fps',
  'width',
  'height',
])

export const authoredImgSrc = (src: unknown): string | null => {
  if (src instanceof String) return authoredImgSrc(String(src))
  if (src && typeof src === 'object' && 'src' in src) {
    return authoredImgSrc((src as { src: unknown }).src)
  }
  if (typeof src !== 'string' || src.trim().length === 0) return null
  const trimmed = src.trim()
  if (/^(https?:|data:|blob:|\/)/i.test(trimmed) && !/^javascript:/i.test(trimmed)) {
    return trimmed
  }
  return null
}

/** Host plates are URL strings. Agents write plates[i].src — both must work. */
export const toAuthoredPlate = (url: string): string & { src: string } =>
  ({
    src: url,
    toString: () => url,
    valueOf: () => url,
  }) as unknown as string & { src: string }

export const toAuthoredPlates = (urls: string[]): Array<string & { src: string }> =>
  urls.map(toAuthoredPlate)

export const inventedStillPropNames = (source: string): string[] => {
  const names = new Set<string>()
  const fromProps = /\bprops\.([A-Za-z_][A-Za-z0-9_]*)/g
  for (const match of source.matchAll(fromProps)) {
    const name = match[1]
    if (name && !HOST_PROP_KEYS.has(name)) names.add(name)
  }
  return [...names]
}

const pickStillUrl = (
  name: string,
  index: number,
  urls: { logo?: string; hero?: string; plates: string[] },
): string | undefined => {
  if (/logo/i.test(name) && urls.logo) return urls.logo
  if (/(product|hero|ui|device|app|card)/i.test(name) && urls.hero) return urls.hero
  const pool = [
    ...urls.plates,
    ...(urls.hero ? [urls.hero] : []),
    ...(urls.logo ? [urls.logo] : []),
  ]
  if (pool.length === 0) return undefined
  return pool[index % pool.length]
}

export const bindInventedStillProps = (
  source: string,
  urls: { logo?: string; hero?: string; plates: string[] },
): Record<string, string> => {
  const extra: Record<string, string> = {}
  inventedStillPropNames(source).forEach((name, index) => {
    const url = pickStillUrl(name, index, urls)
    if (url) extra[name] = url
  })
  return extra
}
