import type { ExtractedBrief } from '@synawood/creative/brief/extracted-brief'

/**
 * Keep in-progress Review edits when the wizard re-hydrates from the server.
 * Server wins only when there is no local draft yet (first load / after clear).
 */
export const keepLocalBriefDraft = (
  local: ExtractedBrief | null,
  server: ExtractedBrief,
): ExtractedBrief => local ?? server

export const sameExtractJob = (
  a: { id: string; status: string; errorMessage?: string | null } | null,
  b: { id: string; status: string; errorMessage?: string | null } | null,
): boolean => {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.id === b.id && a.status === b.status && (a.errorMessage ?? null) === (b.errorMessage ?? null)
  )
}

/**
 * Brand Studio may fix the logo on the project before Apply. Prefer that logo on the
 * brief so Apply does not resurrect the wrong extract asset.
 */
export const adoptProjectLogoIfCorrected = (
  brief: ExtractedBrief,
  projectLogoAssetId: string | null | undefined,
): ExtractedBrief => {
  if (!projectLogoAssetId) return brief
  if (brief.brandCandidates.logoAssetId === projectLogoAssetId) return brief
  return {
    ...brief,
    brandCandidates: {
      ...brief.brandCandidates,
      logoAssetId: projectLogoAssetId,
    },
  }
}
