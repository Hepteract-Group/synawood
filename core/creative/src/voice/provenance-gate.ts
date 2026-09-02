/** Approve gate for Voice Studio provenance (ADR-0033 / #221). */

import type { StudioProject } from '../project/schema'
import { isMockVoiceModelId, readVoiceProvenance } from './schema'

export const assertVoiceProvenancePublishable = (project: StudioProject): void => {
  const blockers: string[] = []
  for (const asset of project.assets) {
    if (asset.kind !== 'audio' && asset.kind !== 'video') continue
    const read = readVoiceProvenance(asset.probe)
    if (read.status === 'none') continue
    const short = `${asset.id.slice(0, 8)}…`
    if (read.status === 'invalid') {
      blockers.push(`${short} unknown voice provenance`)
      continue
    }
    const provenance = read.value
    const mock = Boolean(provenance.stub) || isMockVoiceModelId(provenance.modelId)
    if (provenance.kind === 'clone' && !provenance.consentAt) {
      blockers.push(`${short} clone without consent`)
    }
    if (provenance.kind === 'lipsync' && mock) {
      blockers.push(`${short} mock lip-sync is not Final-eligible`)
    } else if (mock && provenance.kind === 'clone') {
      blockers.push(`${short} mock clone is not Final-eligible`)
    }
  }
  if (blockers.length === 0) return
  throw new Error(
    `Approve blocked: Voice Studio provenance failed. ${blockers.slice(0, 3).join('; ')}`,
  )
}
