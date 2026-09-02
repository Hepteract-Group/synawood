import { assertProjectMusicLicensesPublishable } from '../music/license-gate'
import { listAdReadyIssues, type AdReadyIssue } from '../project/ad-ready'
import type { StudioProject } from '../project/schema'
import type { SupabaseClient } from '@supabase/supabase-js'

export const collectApprovePreflight = async (
  supabase: SupabaseClient,
  project: StudioProject,
): Promise<AdReadyIssue[]> => {
  const issues = [...listAdReadyIssues(project)]
  try {
    await assertProjectMusicLicensesPublishable(
      supabase,
      project.id,
      project.assets.map((asset) => ({ id: asset.id, probe: asset.probe })),
    )
  } catch (error) {
    issues.push({
      code: 'music_license',
      message: error instanceof Error ? error.message : 'Music license blocked Approve.',
    })
  }
  return issues
}
