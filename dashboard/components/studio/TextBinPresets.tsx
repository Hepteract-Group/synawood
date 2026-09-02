'use client'

import {
  encodeTextPresetDrag,
  TEXT_PRESET_MIME,
  TEXT_PRESETS,
  type TextPreset,
} from '@synawood/creative/overlays'

type TextBinPresetsProps = {
  disabled?: boolean
  onPlace: (preset: TextPreset) => void
}

export const TextBinPresets = ({ disabled = false, onPlace }: TextBinPresetsProps) => (
  <div className="asset-bin-body">
    <p className="muted asset-bin-empty-hint">
      Click to place at the playhead (hook at 0, CTA at the end). Drag onto the overlay lane.
    </p>
    <ul className="text-preset-list">
      {TEXT_PRESETS.map((preset) => (
        <li key={preset.id}>
          <button
            type="button"
            className="btn btn-ghost text-preset-card"
            disabled={disabled}
            draggable={!disabled}
            onClick={() => onPlace(preset)}
            onDragStart={(event) => {
              if (disabled) return
              event.dataTransfer.effectAllowed = 'copy'
              event.dataTransfer.setData(TEXT_PRESET_MIME, encodeTextPresetDrag(preset))
              event.dataTransfer.setData('text/plain', preset.label)
            }}
          >
            <strong>{preset.label}</strong>
            <span className="muted">{preset.text}</span>
          </button>
        </li>
      ))}
    </ul>
  </div>
)
