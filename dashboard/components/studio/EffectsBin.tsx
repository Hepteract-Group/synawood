'use client'

import { listTreatments, type TreatmentId } from '@synawood/creative/effects/treatments'
import { listMotionPresets, type MotionPresetId } from '@synawood/creative/effects'
import type { ClipTreatment } from '@synawood/creative/project/schema'
import { treatmentPreviewClass } from '@/lib/overlay-catalog'
import { LibraryAuthoring } from './LibraryAuthoring'
import { OverlayTile } from './OverlayTile'

type EffectsBinProps = {
  projectId: string
  disabled?: boolean
  busy?: boolean
  selectedClipId: string | null
  treatments: ClipTreatment[]
  onApply: (effectId: TreatmentId, intensity: number) => Promise<void>
  onClear: (effectId: TreatmentId) => Promise<void>
  onRegen?: (effectId: TreatmentId) => Promise<void>
  onApplyMotionPreset?: (presetId: MotionPresetId) => Promise<void>
}

export const EffectsBin = ({
  projectId,
  disabled = false,
  busy = false,
  selectedClipId,
  treatments,
  onApply,
  onClear,
  onRegen,
  onApplyMotionPreset,
}: EffectsBinProps) => {
  if (!selectedClipId) {
    return (
      <div className="asset-bin-body">
        <LibraryAuthoring projectId={projectId} kind="effect" disabled={disabled} />
        <p className="muted asset-bin-empty-hint">Looks (VHS, teal) live under Filters.</p>
        <p className="filters-scope-label" role="status">
          Select a clip on the timeline.
        </p>
      </div>
    )
  }

  return (
    <div className="asset-bin-body">
      <LibraryAuthoring
        projectId={projectId}
        kind="effect"
        disabled={disabled}
        clipTreatments={treatments}
      />
      <p className="muted asset-bin-empty-hint">Looks (VHS, teal) live under Filters.</p>
      <p className="filters-scope-label" role="status">
        Apply to selected clip
      </p>
      {busy ? (
        <div className="asset-bin-job-banner" role="status" aria-live="polite">
          Applying treatment…
        </div>
      ) : null}
      {onApplyMotionPreset ? (
        <>
          <p className="muted asset-bin-empty-hint">Punches for the hook or the ask.</p>
          <ul className="overlay-catalog-grid">
            {listMotionPresets().map((preset) => {
              const active = preset.steps.every((step) =>
                treatments.some(
                  (treatment) =>
                    treatment.id === step.effectId && treatment.intensity === step.intensity,
                ),
              )
              return (
                <li key={preset.id}>
                  <OverlayTile
                    label={preset.label}
                    selected={active}
                    disabled={disabled || busy}
                    title={preset.hint}
                    onClick={() => {
                      void onApplyMotionPreset(preset.id)
                    }}
                  >
                    <span className={treatmentPreviewClass(preset.id)} aria-hidden />
                  </OverlayTile>
                </li>
              )
            })}
          </ul>
        </>
      ) : null}
      <ul className="overlay-catalog-grid">
        {listTreatments().map((item) => {
          const active = treatments.find((entry) => entry.id === item.id)
          return (
            <li key={item.id} className="overlay-catalog-effect">
              <OverlayTile
                label={item.label}
                selected={Boolean(active)}
                disabled={disabled || busy}
                title={item.hint}
                onClick={() => {
                  if (active) {
                    void onClear(item.id)
                    return
                  }
                  void onApply(item.id, 1)
                }}
              >
                <span className={treatmentPreviewClass(item.id)} aria-hidden />
              </OverlayTile>
              {active ? (
                <>
                  <label className="effects-intensity is-compact">
                    Intensity
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={active.intensity}
                      disabled={disabled || busy}
                      aria-label={`${item.label} intensity`}
                      onChange={(event) => {
                        void onApply(item.id, Number(event.target.value))
                      }}
                    />
                  </label>
                  {onRegen ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm effects-regen"
                      disabled={disabled || busy}
                      onClick={() => {
                        void onRegen(item.id)
                      }}
                    >
                      Regenerate this
                    </button>
                  ) : null}
                </>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
