import type { ResolvedAssetReference } from '../project/asset-token'

/** Human-readable grounding block injected into the system prompt so the agent can act on the right asset. */
export const assetReferenceBlock = (refs: ResolvedAssetReference[]): string => {
  if (refs.length === 0) return ''
  const lines = refs.map(
    (ref) =>
      `- ${ref.token} → assetId=${ref.assetId} kind=${ref.kind} source=${ref.source} label="${ref.label}"`,
  )
  return [
    '## Referenced assets (resolved from @asset: tokens)',
    'The user referenced these assets explicitly. Ground operations on these assetIds (UUIDs below) — pass assetId to add_clip/remove_clip, every mentioned still to generate_video_clip as sourceImageAssetIds, and every mentioned video clip as a generate_video_clip ref. Do not invent ids, silently drop a tagged @asset, or claim it is missing when listed here.',
    ...lines,
  ].join('\n')
}
