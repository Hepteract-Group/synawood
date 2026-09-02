'use client'

import { CAPTION_STYLE_PRESETS, type CaptionStyleId } from '@synawood/creative/overlays'
import { ConfirmDialog } from './ConfirmDialog'

type CaptionsBinProps = {
  disabled?: boolean
  selectedClipId: string | null
  transcribeBusy?: boolean
  line: string
  onLineChange: (value: string) => void
  onTypeLine: () => void
  onFromTranscript: (confirmSpend: boolean) => void
  spendPrompt: string | null
  onDismissSpend: () => void
  styleId: CaptionStyleId
  onStyleId: (id: CaptionStyleId) => void
  highlightsOn?: boolean
  marksOn?: boolean
  hasCaptions?: boolean
  onToggleHighlights?: (on: boolean) => void
  onToggleMarks?: (on: boolean) => void
}

export const CaptionsBin = ({
  disabled = false,
  selectedClipId,
  transcribeBusy = false,
  line,
  onLineChange,
  onTypeLine,
  onFromTranscript,
  spendPrompt,
  onDismissSpend,
  styleId,
  onStyleId,
  highlightsOn = false,
  marksOn = false,
  hasCaptions = false,
  onToggleHighlights,
  onToggleMarks,
}: CaptionsBinProps) => (
  <div className="asset-bin-body">
    {transcribeBusy ? (
      <div className="asset-bin-job-banner" role="status" aria-live="polite">
        Transcribing this clip for captions… You can keep editing. Reload keeps this banner.
      </div>
    ) : null}
    <p className="muted asset-bin-empty-hint">
      Captions sit on the caption lane. Type a line at the playhead, or build from the selected
      clip’s transcript.
    </p>
    <div className="caption-style-chips" role="group" aria-label="Caption style">
      {CAPTION_STYLE_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className={styleId === preset.id ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
          disabled={disabled}
          onClick={() => onStyleId(preset.id)}
        >
          {preset.label}
        </button>
      ))}
    </div>
    {onToggleHighlights || onToggleMarks ? (
      <>
        <div className="caption-style-chips" role="group" aria-label="Keyword color and marks">
          {onToggleHighlights ? (
            <button
              type="button"
              className={highlightsOn ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
              disabled={disabled || !hasCaptions}
              aria-pressed={highlightsOn}
              onClick={() => onToggleHighlights(!highlightsOn)}
            >
              Highlights
            </button>
          ) : null}
          {onToggleMarks ? (
            <button
              type="button"
              className={marksOn ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
              disabled={disabled || !hasCaptions}
              aria-pressed={marksOn}
              onClick={() => onToggleMarks(!marksOn)}
            >
              Marks
            </button>
          ) : null}
        </div>
        <p className="muted asset-bin-empty-hint">
          {hasCaptions
            ? 'Highlights paint a keyword in your brand color. Marks add a small graphic after it. A few per clip — not every word.'
            : 'Place captions first. Then Highlights can paint a keyword, and Marks can add a small graphic after it.'}
        </p>
      </>
    ) : null}
    {styleId === 'karaoke' ? (
      <p className="muted asset-bin-empty-hint" role="status">
        Karaoke pops the spoken word from transcript timings. Typed lines stay as a band until they
        have word timings.
      </p>
    ) : null}
    <ul className="text-preset-list">
      <li>
        <button
          type="button"
          className="btn btn-ghost text-preset-card"
          disabled={disabled || !selectedClipId || transcribeBusy}
          onClick={() => onFromTranscript(false)}
        >
          <strong>From this clip’s transcript</strong>
          <span className="muted">
            {selectedClipId
              ? 'Uses word timings. Confirms spend if transcription is needed.'
              : 'Select a clip on the timeline first.'}
          </span>
        </button>
      </li>
    </ul>
    <form
      className="captions-type-line"
      onSubmit={(event) => {
        event.preventDefault()
        onTypeLine()
      }}
    >
      <label>
        <span>Type a line</span>
        <input
          type="text"
          value={line}
          disabled={disabled}
          placeholder="Caption at playhead"
          onChange={(event) => onLineChange(event.target.value)}
        />
      </label>
      <button type="submit" className="btn btn-primary" disabled={disabled || !line.trim()}>
        Place
      </button>
    </form>
    <ConfirmDialog
      open={Boolean(spendPrompt)}
      title="Transcribe this clip?"
      body={spendPrompt ?? ''}
      confirmLabel="Transcribe and caption"
      cancelLabel="Cancel"
      danger={false}
      onConfirm={() => onFromTranscript(true)}
      onCancel={onDismissSpend}
    />
  </div>
)
