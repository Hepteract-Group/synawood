/** Attribute an outcome to a publish record / Final, or leave unattributed (ADR-0035 / #243). */

export type MatchHit = {
  publishRecordId: string | null
  finalAssetId: string | null
  projectId: string | null
}

export type UnattributedMatch = {
  unattributed: true
  reason: 'no_match'
}

export type OutcomeMatch = MatchHit | UnattributedMatch

export const isUnattributed = (match: OutcomeMatch): match is UnattributedMatch =>
  'unattributed' in match && match.unattributed

export const matchOutcome = (input: {
  publishRecordId?: string
  finalAssetId?: string
  projectId?: string
  externalUrl?: string
  records: Array<{
    id: string
    finalAssetId: string
    projectId: string | null
    externalUrl: string | null
  }>
}): OutcomeMatch => {
  if (input.publishRecordId) {
    const row = input.records.find((item) => item.id === input.publishRecordId)
    if (row) {
      return {
        publishRecordId: row.id,
        finalAssetId: row.finalAssetId,
        projectId: row.projectId,
      }
    }
  }
  if (input.finalAssetId) {
    const row = input.records.find((item) => item.finalAssetId === input.finalAssetId)
    if (row) {
      return {
        publishRecordId: row.id,
        finalAssetId: row.finalAssetId,
        projectId: row.projectId,
      }
    }
  }
  if (input.externalUrl) {
    const needle = input.externalUrl.trim()
    const row = input.records.find((item) => item.externalUrl === needle)
    if (row) {
      return {
        publishRecordId: row.id,
        finalAssetId: row.finalAssetId,
        projectId: row.projectId,
      }
    }
  }
  return { unattributed: true, reason: 'no_match' }
}
