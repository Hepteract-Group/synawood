/**
 * Pure `@asset:` token helpers — no Node or schema imports.
 * Safe for both client components and server/agent code.
 * The asset shape is structural so this module never imports the zod schema
 * (which would drag Node-only modules into the browser bundle).
 */

export type AssetRefLike = {
  id: string
  kind: string
  source: string
  blobKey?: string
  probe?: Record<string, unknown>
}

export type ResolvedAssetReference = {
  token: string
  assetId: string
  kind: string
  source: string
  label: string
}

const ASSET_TOKEN = /@(?:asset:)?([a-zA-Z0-9][^\s@]*)/g
const ID_SUFFIX = /^(.+)-([a-f0-9]{8})$/i

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

const fileNameFromBlobKey = (blobKey: string | undefined): string | null => {
  if (!blobKey) return null
  const base = blobKey.split('/').filter(Boolean).pop()
  if (!base) return null
  // upload keys are often `${uuid}-${originalName}`
  const stripped = base.replace(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
    '',
  )
  return stripped || base
}

export const assetLabel = (asset: AssetRefLike): string => {
  const named = asset.probe?.name ?? asset.probe?.prompt ?? asset.probe?.brandKitPath
  if (named != null && String(named).trim()) return String(named).trim()
  const fromKey = fileNameFromBlobKey(asset.blobKey)
  if (fromKey) return fromKey
  return asset.kind
}

export const assetTokenFor = (asset: AssetRefLike): string =>
  `@asset:${slugify(assetLabel(asset)) || asset.kind}-${asset.id.slice(0, 8)}`

const idPrefix = (asset: AssetRefLike): string => asset.id.toLowerCase().slice(0, 8)

/**
 * Match priority:
 * 1. Exact token body (`slug-id8`)
 * 2. Trailing 8-char id suffix (disambiguates long truncated prompts)
 * 3. Full uuid / uuid prefix
 * 4. Exact slug label (no fuzzy prefix — that collided across similar gens)
 */
const findAssetForToken = (raw: string, assets: AssetRefLike[]): AssetRefLike | undefined => {
  const needle = raw.toLowerCase()

  const exact = assets.find(
    (asset) => assetTokenFor(asset).slice('@asset:'.length).toLowerCase() === needle,
  )
  if (exact) return exact

  const suffixMatch = ID_SUFFIX.exec(needle)
  if (suffixMatch) {
    const id8 = suffixMatch[2].toLowerCase()
    const byId = assets.find((asset) => idPrefix(asset) === id8)
    if (byId) return byId
  }

  const byUuid = assets.find(
    (asset) => asset.id.toLowerCase() === needle || asset.id.toLowerCase().startsWith(needle),
  )
  if (byUuid) return byUuid

  if (needle.length >= 8) {
    const byLabel = assets.find((asset) => {
      const label = slugify(assetLabel(asset))
      return label === needle || label === needle.replace(/-[a-f0-9]{8}$/i, '')
    })
    if (byLabel) return byLabel
  }

  return undefined
}

/** Resolve `@asset:<slug>` tokens in a user message to concrete project assets. */
export const resolveAssetReferences = (
  userMessage: string,
  assets: AssetRefLike[],
): ResolvedAssetReference[] => {
  const resolved: ResolvedAssetReference[] = []
  const seen = new Set<string>()
  for (const match of userMessage.matchAll(ASSET_TOKEN)) {
    const raw = match[1]
    const asset = findAssetForToken(raw, assets)
    if (!asset || seen.has(asset.id)) continue
    seen.add(asset.id)
    resolved.push({
      token: match[0],
      assetId: asset.id,
      kind: asset.kind,
      source: asset.source,
      label: assetLabel(asset),
    })
  }
  return resolved
}
