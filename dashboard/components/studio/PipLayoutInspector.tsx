'use client'

import {
  PIP_LAYOUT_PRESETS,
  type PipLayout,
  type PipPresetId,
} from '@synawood/creative/project/pip-layout'

type PipLayoutInspectorProps = {
  layout: PipLayout
  disabled?: boolean
  onPreset: (id: PipPresetId) => void
  onChange: (next: PipLayout) => void
}

const pct = (value: number): string => `${Math.round(value * 100)}%`

export const PipLayoutInspector = ({
  layout,
  disabled = false,
  onPreset,
  onChange,
}: PipLayoutInspectorProps) => (
  <div className="pip-layout-inspector" aria-label="Picture layout">
    <span className="pip-layout-inspector-label">Picture layout</span>
    <div className="pip-layout-presets" role="group" aria-label="Layout presets">
      {PIP_LAYOUT_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className="pip-layout-preset"
          title={preset.hint}
          disabled={disabled}
          onClick={() => onPreset(preset.id)}
        >
          {preset.label}
        </button>
      ))}
    </div>
    {layout.mode === 'split' ? (
      <>
        <button
          type="button"
          className="pip-layout-preset"
          title="Put the main picture on the other side"
          disabled={disabled}
          onClick={() =>
            onChange({
              ...layout,
              mode: 'split',
              mainSide: (layout.mainSide ?? 'start') === 'start' ? 'end' : 'start',
            })
          }
        >
          Swap sides
        </button>
        <label className="pip-layout-slider">
          <span>Main {pct(layout.mainPct ?? 0.5)}</span>
          <input
            type="range"
            min={20}
            max={80}
            value={Math.round((layout.mainPct ?? 0.5) * 100)}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...layout, mode: 'split', mainPct: Number(event.target.value) / 100 })
            }
            aria-label="Main picture width"
          />
        </label>
      </>
    ) : (
      <div className="pip-layout-sliders">
        <label className="pip-layout-slider">
          <span>X {pct(layout.x)}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(layout.x * 100)}
            disabled={disabled}
            onChange={(event) => onChange({ ...layout, x: Number(event.target.value) / 100 })}
            aria-label="Inset left"
          />
        </label>
        <label className="pip-layout-slider">
          <span>Y {pct(layout.y)}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(layout.y * 100)}
            disabled={disabled}
            onChange={(event) => onChange({ ...layout, y: Number(event.target.value) / 100 })}
            aria-label="Inset top"
          />
        </label>
        <label className="pip-layout-slider">
          <span>W {pct(layout.width)}</span>
          <input
            type="range"
            min={8}
            max={100}
            value={Math.round(layout.width * 100)}
            disabled={disabled}
            onChange={(event) => onChange({ ...layout, width: Number(event.target.value) / 100 })}
            aria-label="Inset width"
          />
        </label>
        <label className="pip-layout-slider">
          <span>H {pct(layout.height)}</span>
          <input
            type="range"
            min={8}
            max={100}
            value={Math.round(layout.height * 100)}
            disabled={disabled}
            onChange={(event) => onChange({ ...layout, height: Number(event.target.value) / 100 })}
            aria-label="Inset height"
          />
        </label>
      </div>
    )}
  </div>
)
