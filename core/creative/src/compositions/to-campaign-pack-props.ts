import type { StudioProject } from '../project/schema'
import type { AssetUrlResolver } from './to-talking-head-props'
import type { CampaignPackStillProps } from './campaign-pack-still'

const DEFAULT_MARGINS = { top: 64, right: 64, bottom: 96, left: 64 }

/** Map project → Remotion props for one creative (default: first by order). */
export const toCampaignPackStillProps = (
  project: StudioProject,
  resolveUrl: AssetUrlResolver,
  creativeId?: string,
  options?: { trialWatermark?: boolean },
): CampaignPackStillProps & { durationInFrames: number } => {
  const creatives = [...(project.campaignPack?.creatives ?? [])].sort((a, b) => a.order - b.order)
  const creative =
    (creativeId ? creatives.find((row) => row.id === creativeId) : undefined) ?? creatives[0]

  const bg = creative?.backgroundAssetId
    ? project.assets.find((asset) => asset.id === creative.backgroundAssetId)
    : undefined
  const logoAsset = project.brand?.logoAssetId
    ? project.assets.find((item) => item.id === project.brand?.logoAssetId)
    : undefined

  return {
    headline: creative?.headline ?? '',
    body: creative?.body,
    cta: creative?.cta ?? project.brand?.defaultCta,
    backgroundSrc: bg ? resolveUrl(bg.blobKey) : undefined,
    backgroundColor: project.brand?.primaryColor ? undefined : '#0f1410',
    primaryColor: project.brand?.primaryColor,
    accentColor: project.brand?.accentColor,
    fontFamily: project.brand?.fontFamily,
    logoSrc: logoAsset ? resolveUrl(logoAsset.blobKey) : undefined,
    logoCorner: project.brand?.chrome?.corner,
    logoScale: project.brand?.chrome?.scale,
    safeMargins: DEFAULT_MARGINS,
    durationInFrames: 1,
    trialWatermark: Boolean(options?.trialWatermark),
  }
}
