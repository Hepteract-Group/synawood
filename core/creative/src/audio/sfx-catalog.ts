/** First-party whoosh / hit pack (ADR-0073 / #885). Client-safe — no Node. */

export const SFX_PACK_IDS = ['whoosh', 'hit'] as const

export type SfxPackId = (typeof SFX_PACK_IDS)[number]

export type SfxPackItem = {
  id: SfxPackId
  label: string
  hint: string
  durationSeconds: number
  license: 'first-party'
}

export const SFX_PACK: readonly SfxPackItem[] = [
  {
    id: 'whoosh',
    label: 'Whoosh',
    hint: 'Soft sweep for the opening hook',
    durationSeconds: 0.4,
    license: 'first-party',
  },
  {
    id: 'hit',
    label: 'Hit',
    hint: 'Short punch for the call to action',
    durationSeconds: 0.22,
    license: 'first-party',
  },
]

export const isSfxPackId = (value: string): value is SfxPackId =>
  (SFX_PACK_IDS as readonly string[]).includes(value)

export const getSfxPackItem = (id: string): SfxPackItem | undefined =>
  SFX_PACK.find((item) => item.id === id)

export const listSfxPack = (): readonly SfxPackItem[] => SFX_PACK
