/** First-party clip treatments (ADR-0058). Client-safe — no Node. */

export const TREATMENT_IDS = ['shake', 'glow', 'flash', 'zoom_punch'] as const

export type TreatmentId = (typeof TREATMENT_IDS)[number]

export type TreatmentPrimitive = {
  id: TreatmentId
  label: string
  hint: string
}

export const TREATMENT_PRIMITIVES: readonly TreatmentPrimitive[] = [
  { id: 'shake', label: 'Shake', hint: 'Camera shake; intensity is amplitude' },
  { id: 'glow', label: 'Glow', hint: 'Bloom on highlights' },
  { id: 'flash', label: 'Flash', hint: 'White flash at clip in' },
  { id: 'zoom_punch', label: 'Zoom punch', hint: 'Scale up over the first 12 frames' },
]

export const isTreatmentId = (value: string): value is TreatmentId =>
  (TREATMENT_IDS as readonly string[]).includes(value)

export const listTreatments = (): readonly TreatmentPrimitive[] => TREATMENT_PRIMITIVES

export const getTreatment = (id: string): TreatmentPrimitive | undefined =>
  TREATMENT_PRIMITIVES.find((item) => item.id === id)

export const assertTreatmentsPublishable = (
  treatments: ReadonlyArray<{ id: string }> | undefined,
): void => {
  for (const item of treatments ?? []) {
    if (!isTreatmentId(item.id)) {
      throw new Error(
        `Approve blocked: unknown treatment "${item.id}". Clear it or pick shake, glow, flash, or zoom punch.`,
      )
    }
  }
}
