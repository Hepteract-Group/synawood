/** Pick which product voice Studio should use (ADR-0060 / #762). */

import { isCloneProfileReady, type VoiceProfile } from './schema'

export const pickDefaultVoiceProfile = (profiles: VoiceProfile[]): VoiceProfile | null => {
  const active = profiles.filter((profile) => profile.status === 'active')
  const readyClone = active.find((profile) => isCloneProfileReady(profile))
  if (readyClone) return readyClone
  return active.find((profile) => profile.kind === 'synth') ?? active[0] ?? null
}

export const voiceClipLabel = (input: {
  assetLabel: string
  provenanceKind?: string | null
  profileName?: string | null
}): string => {
  const base = input.assetLabel.slice(0, 40)
  if (input.profileName?.trim()) {
    return `${base} · ${input.profileName.trim()}`
  }
  if (input.provenanceKind === 'clone') return `${base} · Clone`
  if (input.provenanceKind === 'synth') return `${base} · Synth`
  if (input.provenanceKind === 'dub') return `${base} · Dub`
  return base
}
