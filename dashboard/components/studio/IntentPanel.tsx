'use client'

import type { DirectorPlan, Intent } from '@synawood/creative/intent'
import type { StudioProject } from '@synawood/creative/project/client'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ageRangeFromInputs,
  hasIntentContent,
  INTENT_AWARENESS_STAGES,
  INTENT_EMOTIONS,
  INTENT_FUNNEL_STAGES,
  INTENT_GOALS,
  INTENT_PLATFORMS,
  audienceHasContent,
  awarenessStageLabel,
  funnelStageLabel,
  labelToken,
  styleFromIntent,
  summarizeIntentChip,
  supportingPointsFromSlots,
} from './intent-helpers'
import { useIntentAutosave } from './useIntentAutosave'

type IntentPanelProps = {
  projectId: string
  intent: Intent
  revision: number
  clipCount: number
  disabled?: boolean
  directorPlan?: DirectorPlan | null
  directorRebuildPrompt?: { diffs: string[]; atRevision: number } | null
  onProjectSaved: (project: StudioProject) => void
  onPreviewDirector: (input: { style?: string; intentOverrides?: Partial<Intent> }) => void
  onDismissRebuildPrompt: () => void
  onOpenDirectorPlan?: () => void
  onError: (message: string) => void
  onFlyoutOpenChange?: (open: boolean) => void
}

type RailPanel = 'none' | 'intent' | 'director'

export const IntentPanel = ({
  projectId,
  intent,
  revision,
  clipCount,
  disabled = false,
  directorPlan = null,
  directorRebuildPrompt = null,
  onProjectSaved,
  onPreviewDirector,
  onDismissRebuildPrompt,
  onOpenDirectorPlan,
  onError,
  onFlyoutOpenChange,
}: IntentPanelProps) => {
  const populated = hasIntentContent(intent)
  const [started, setStarted] = useState(populated)
  const [skippedEmpty, setSkippedEmpty] = useState(false)
  const [openPanel, setOpenPanel] = useState<RailPanel>(populated ? 'none' : 'intent')
  const [draft, setDraft] = useState<Intent>(() => ({ ...intent, keywords: intent.keywords ?? [] }))
  const baselineRef = useRef<Intent>({ ...intent, keywords: intent.keywords ?? [] })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [keywordInput, setKeywordInput] = useState('')
  const [ageFrom, setAgeFrom] = useState(() =>
    intent.audience?.ageRange ? String(intent.audience.ageRange[0]) : '',
  )
  const [ageTo, setAgeTo] = useState(() =>
    intent.audience?.ageRange ? String(intent.audience.ageRange[1]) : '',
  )
  const lastSyncedRevision = useRef(revision)

  const rebuildAvailable = Boolean(directorRebuildPrompt?.diffs?.length)
  const rebuildDiffs = directorRebuildPrompt?.diffs ?? []

  const { status, resetBaseline } = useIntentAutosave({
    projectId,
    revision,
    draft,
    enabled: !disabled && (started || populated),
    onSaved: (project) => {
      const next = { ...(project.intent ?? {}), keywords: project.intent?.keywords ?? [] }
      baselineRef.current = next
      lastSyncedRevision.current = project.revision
      onProjectSaved(project)
    },
    onError,
  })

  useEffect(() => {
    if (revision === lastSyncedRevision.current) return
    const next = { ...intent, keywords: intent.keywords ?? [] }
    setDraft(next)
    baselineRef.current = next
    resetBaseline(next)
    lastSyncedRevision.current = revision
    setAgeFrom(intent.audience?.ageRange ? String(intent.audience.ageRange[0]) : '')
    setAgeTo(intent.audience?.ageRange ? String(intent.audience.ageRange[1]) : '')
    if (hasIntentContent(intent)) setStarted(true)
  }, [intent, resetBaseline, revision])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'i' && event.key !== 'I') return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      setStarted(true)
      setOpenPanel((panel) => (panel === 'intent' ? 'none' : 'intent'))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const patch = (partial: Partial<Intent>) => {
    setDraft((prev) => ({ ...prev, ...partial }))
  }

  const syncAgeRange = (fromRaw: string, toRaw: string) => {
    const ageRange = ageRangeFromInputs(fromRaw, toRaw)
    setDraft((prev) => {
      const audience = { ...(prev.audience ?? {}) }
      if (ageRange) audience.ageRange = ageRange
      else delete audience.ageRange
      return { ...prev, audience: audienceHasContent(audience) ? audience : undefined }
    })
  }

  const showEmptyCta = !populated && !skippedEmpty && !started && openPanel === 'intent'
  const intentOpen = openPanel === 'intent'
  const directorOpen = openPanel === 'director'
  const chipSummary = useMemo(() => summarizeIntentChip(draft), [draft])
  const pendingEdits =
    directorPlan && (directorPlan.status === 'draft' || directorPlan.status === 'stale')
      ? directorPlan.edits.filter((edit) => edit.status !== 'rejected').length
      : 0

  const flyoutOpen = intentOpen || directorOpen || showEmptyCta

  useEffect(() => {
    onFlyoutOpenChange?.(flyoutOpen)
  }, [flyoutOpen, onFlyoutOpenChange])

  return (
    <>
      <section className="intent-rail" aria-label="Intent and Director">
        <div className="intent-rail-toolbar">
          <button
            type="button"
            className={`intent-rail-tab${intentOpen ? ' is-active' : ''}`}
            aria-expanded={intentOpen}
            disabled={disabled}
            onClick={() => {
              setStarted(true)
              setOpenPanel((panel) => (panel === 'intent' ? 'none' : 'intent'))
            }}
          >
            <span className="intent-rail-tab-title">Intent</span>
            <span className="intent-rail-tab-meta">
              {status === 'saving' ? 'Saving…' : status === 'error' ? 'Error' : chipSummary}
            </span>
          </button>
          <button
            type="button"
            className={`intent-rail-tab intent-rail-tab-director${directorOpen ? ' is-active' : ''}`}
            aria-expanded={directorOpen}
            disabled={disabled}
            onClick={() => setOpenPanel((panel) => (panel === 'director' ? 'none' : 'director'))}
          >
            <span className="intent-rail-tab-title">
              <DirectorIcon />
              Director
              {pendingEdits > 0 ? (
                <span className="intent-rail-badge" aria-label={`${pendingEdits} pending changes`}>
                  {pendingEdits}
                </span>
              ) : null}
              {rebuildAvailable && pendingEdits === 0 ? (
                <span className="intent-rail-dot" aria-label="Rebuild available" />
              ) : null}
            </span>
          </button>
        </div>
      </section>

      {flyoutOpen ? (
        <div
          className="intent-rail-flyout"
          role="dialog"
          aria-modal="true"
          aria-label="Intent or Director"
        >
          {rebuildAvailable && (intentOpen || directorOpen) ? (
            <div className="intent-change-banner" role="status">
              <p>
                <strong>Intent changed</strong>
                {rebuildDiffs.length > 0 ? (
                  <span className="muted"> — {rebuildDiffs.join('; ')}</span>
                ) : null}
              </p>
              <p className="muted intent-change-banner-hint">AI Director can rebuild the cut.</p>
              <div className="intent-change-banner-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={disabled || clipCount === 0 || status === 'saving'}
                  title={clipCount === 0 ? 'Add clips before previewing a plan' : undefined}
                  onClick={() => {
                    onPreviewDirector({
                      style: styleFromIntent(draft),
                      intentOverrides: draft,
                    })
                  }}
                >
                  Preview changes
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={disabled}
                  onClick={onDismissRebuildPrompt}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          {showEmptyCta ? (
            <div className="intent-sheet intent-sheet-empty">
              <div className="intent-sheet-header">
                <strong>Set intent</strong>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm intent-done-btn"
                  onClick={() => {
                    setSkippedEmpty(true)
                    setOpenPanel('none')
                  }}
                >
                  Skip
                </button>
              </div>
              <p className="muted intent-sheet-lede">
                Goal, funnel, KPI, and CTA so the Director can rebuild the cut when you ask.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={disabled}
                onClick={() => setStarted(true)}
              >
                Start
              </button>
            </div>
          ) : null}

          {intentOpen && !showEmptyCta ? (
            <div className="intent-sheet">
              <div className="intent-sheet-header">
                <strong>Intent</strong>
                <div className="intent-sheet-header-actions">
                  <span className="intent-save-status" aria-live="polite">
                    {status === 'saving'
                      ? 'Saving…'
                      : status === 'saved'
                        ? 'Saved'
                        : status === 'error'
                          ? 'Error'
                          : ''}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm intent-done-btn"
                    onClick={() => setOpenPanel('none')}
                  >
                    Done
                  </button>
                </div>
              </div>

              <div className="intent-sheet-body">
                <label className="intent-field">
                  <span>Goal</span>
                  <div className="intent-segmented" role="group" aria-label="Goal">
                    {INTENT_GOALS.map((goal) => (
                      <button
                        key={goal}
                        type="button"
                        className={draft.goal === goal ? 'is-selected' : undefined}
                        disabled={disabled}
                        onClick={() =>
                          patch({
                            goal,
                            ...(goal !== 'custom' ? { goalNote: undefined } : {}),
                          })
                        }
                      >
                        {labelToken(goal)}
                      </button>
                    ))}
                  </div>
                </label>

                {draft.goal === 'custom' ? (
                  <label className="intent-field">
                    <span>Custom goal</span>
                    <input
                      type="text"
                      value={draft.goalNote ?? ''}
                      disabled={disabled}
                      maxLength={240}
                      placeholder="Describe the outcome you want"
                      onChange={(event) => patch({ goalNote: event.target.value || undefined })}
                    />
                  </label>
                ) : null}

                <label className="intent-field">
                  <span>Funnel</span>
                  <div className="intent-segmented" role="group" aria-label="Funnel">
                    {INTENT_FUNNEL_STAGES.map((stage) => (
                      <button
                        key={stage}
                        type="button"
                        className={draft.funnelStage === stage ? 'is-selected' : undefined}
                        disabled={disabled}
                        onClick={() => patch({ funnelStage: stage })}
                      >
                        {funnelStageLabel(stage)}
                      </button>
                    ))}
                  </div>
                </label>

                <label className="intent-field">
                  <span>KPI</span>
                  <input
                    type="text"
                    value={draft.kpi ?? ''}
                    disabled={disabled}
                    maxLength={80}
                    placeholder="What number should this move?"
                    onChange={(event) => patch({ kpi: event.target.value || undefined })}
                  />
                </label>

                <label className="intent-field">
                  <span>Desired behaviour</span>
                  <input
                    type="text"
                    value={draft.desiredBehaviour ?? ''}
                    disabled={disabled}
                    maxLength={160}
                    placeholder="Start a trial, book a demo…"
                    onChange={(event) =>
                      patch({ desiredBehaviour: event.target.value || undefined })
                    }
                  />
                </label>

                <label className="intent-field">
                  <span>Audience</span>
                  <input
                    type="text"
                    value={draft.audience?.persona ?? ''}
                    disabled={disabled}
                    maxLength={120}
                    placeholder="Who is this for?"
                    onChange={(event) =>
                      patch({
                        audience: { ...draft.audience, persona: event.target.value || undefined },
                      })
                    }
                  />
                </label>

                <div className="intent-field intent-field-row">
                  <label>
                    <span>Age from</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={120}
                      value={ageFrom}
                      disabled={disabled}
                      placeholder="25"
                      onChange={(event) => {
                        const next = event.target.value
                        setAgeFrom(next)
                        syncAgeRange(next, ageTo)
                      }}
                    />
                  </label>
                  <label>
                    <span>Age to</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={120}
                      value={ageTo}
                      disabled={disabled}
                      placeholder="40"
                      onChange={(event) => {
                        const next = event.target.value
                        setAgeTo(next)
                        syncAgeRange(ageFrom, next)
                      }}
                    />
                  </label>
                </div>

                <label className="intent-field">
                  <span>Context</span>
                  <input
                    type="text"
                    value={draft.audience?.context ?? ''}
                    disabled={disabled}
                    maxLength={240}
                    placeholder="Where / when they see this"
                    onChange={(event) =>
                      patch({
                        audience: { ...draft.audience, context: event.target.value || undefined },
                      })
                    }
                  />
                </label>

                <label className="intent-field">
                  <span>Awareness</span>
                  <div className="intent-segmented" role="group" aria-label="Awareness">
                    {INTENT_AWARENESS_STAGES.map((stage) => (
                      <button
                        key={stage}
                        type="button"
                        className={
                          draft.audience?.awarenessStage === stage ? 'is-selected' : undefined
                        }
                        disabled={disabled}
                        onClick={() =>
                          patch({
                            audience: { ...draft.audience, awarenessStage: stage },
                          })
                        }
                      >
                        {awarenessStageLabel(stage)}
                      </button>
                    ))}
                  </div>
                </label>

                <label className="intent-field">
                  <span>Language they use</span>
                  <input
                    type="text"
                    value={draft.audience?.language ?? ''}
                    disabled={disabled}
                    maxLength={160}
                    placeholder="How they would say it"
                    onChange={(event) =>
                      patch({
                        audience: { ...draft.audience, language: event.target.value || undefined },
                      })
                    }
                  />
                </label>

                <label className="intent-field">
                  <span>Primary pain</span>
                  <input
                    type="text"
                    value={draft.audience?.primaryPain ?? ''}
                    disabled={disabled}
                    maxLength={160}
                    placeholder="What hurts today"
                    onChange={(event) =>
                      patch({
                        audience: {
                          ...draft.audience,
                          primaryPain: event.target.value || undefined,
                        },
                      })
                    }
                  />
                </label>

                <fieldset className="intent-field">
                  <legend>Platform</legend>
                  <div className="intent-chips">
                    {INTENT_PLATFORMS.map((platform) => (
                      <button
                        key={platform}
                        type="button"
                        className={draft.platform === platform ? 'is-selected' : undefined}
                        aria-pressed={draft.platform === platform}
                        disabled={disabled}
                        onClick={() => patch({ platform })}
                      >
                        {labelToken(platform)}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="intent-field">
                  <legend>Emotion</legend>
                  <div className="intent-chips">
                    {INTENT_EMOTIONS.map((emotion) => (
                      <button
                        key={emotion}
                        type="button"
                        className={draft.emotion === emotion ? 'is-selected' : undefined}
                        aria-pressed={draft.emotion === emotion}
                        disabled={disabled}
                        onClick={() => patch({ emotion })}
                      >
                        {emotion}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <label className="intent-field">
                  <span>Primary message</span>
                  <input
                    type="text"
                    value={draft.primaryMessage ?? ''}
                    disabled={disabled}
                    maxLength={160}
                    placeholder="The one thing to remember"
                    onChange={(event) => patch({ primaryMessage: event.target.value || undefined })}
                  />
                </label>

                <div className="intent-field intent-field-row">
                  <label>
                    <span>Support 1</span>
                    <input
                      type="text"
                      value={draft.supportingPoints?.[0] ?? ''}
                      disabled={disabled}
                      maxLength={160}
                      placeholder="Optional"
                      onChange={(event) =>
                        patch({
                          supportingPoints: supportingPointsFromSlots(
                            event.target.value,
                            draft.supportingPoints?.[1] ?? '',
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Support 2</span>
                    <input
                      type="text"
                      value={draft.supportingPoints?.[1] ?? ''}
                      disabled={disabled}
                      maxLength={160}
                      placeholder="Optional"
                      onChange={(event) =>
                        patch({
                          supportingPoints: supportingPointsFromSlots(
                            draft.supportingPoints?.[0] ?? '',
                            event.target.value,
                          ),
                        })
                      }
                    />
                  </label>
                </div>

                <div className="intent-field intent-field-row">
                  <label>
                    <span>Length (sec)</span>
                    <input
                      type="number"
                      min={1}
                      max={600}
                      step={1}
                      value={draft.lengthSeconds ?? ''}
                      disabled={disabled}
                      onChange={(event) =>
                        patch({
                          lengthSeconds:
                            event.target.value === '' ? undefined : Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>CTA</span>
                    <input
                      type="text"
                      value={draft.cta ?? ''}
                      disabled={disabled}
                      maxLength={120}
                      placeholder="Download today"
                      onChange={(event) => patch({ cta: event.target.value || undefined })}
                    />
                  </label>
                </div>

                <label className="intent-field">
                  <span>Tone note</span>
                  <input
                    type="text"
                    value={draft.brandVoice ?? ''}
                    disabled={disabled}
                    maxLength={120}
                    placeholder="Optional — e.g. warm, witty, no jargon"
                    onChange={(event) => patch({ brandVoice: event.target.value || undefined })}
                  />
                  <span className="intent-field-hint">
                    Free-text tone for this video. Leave blank to lean on your Brand kit voice.
                  </span>
                </label>

                <button
                  type="button"
                  className="intent-advanced-toggle"
                  onClick={() => setShowAdvanced((value) => !value)}
                >
                  {showAdvanced ? 'Hide keywords' : 'Keywords (optional)'}
                </button>

                {showAdvanced ? (
                  <div className="intent-field">
                    <div className="intent-keyword-row">
                      <input
                        type="text"
                        value={keywordInput}
                        disabled={disabled}
                        maxLength={40}
                        placeholder="Add keyword"
                        onChange={(event) => setKeywordInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return
                          event.preventDefault()
                          const next = keywordInput.trim()
                          if (!next) return
                          const keywords = [...(draft.keywords ?? [])]
                          if (!keywords.includes(next) && keywords.length < 24) keywords.push(next)
                          patch({ keywords })
                          setKeywordInput('')
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={disabled || !keywordInput.trim()}
                        onClick={() => {
                          const next = keywordInput.trim()
                          if (!next) return
                          const keywords = [...(draft.keywords ?? [])]
                          if (!keywords.includes(next) && keywords.length < 24) keywords.push(next)
                          patch({ keywords })
                          setKeywordInput('')
                        }}
                      >
                        Add
                      </button>
                    </div>
                    <div className="intent-chips">
                      {(draft.keywords ?? []).map((word) => (
                        <button
                          key={word}
                          type="button"
                          className="is-selected"
                          disabled={disabled}
                          aria-label={`Remove keyword ${word}`}
                          onClick={() =>
                            patch({
                              keywords: (draft.keywords ?? []).filter((item) => item !== word),
                            })
                          }
                        >
                          {word} ×
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {directorOpen ? (
            <div className="intent-sheet intent-sheet-director">
              <div className="intent-sheet-header">
                <strong>Director</strong>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm intent-done-btn"
                  onClick={() => setOpenPanel('none')}
                >
                  Done
                </button>
              </div>
              <div className="intent-sheet-body">
                <p className="muted intent-sheet-lede">
                  Preview a rebuild from your current Intent. Nothing applies until you confirm.
                </p>
                {rebuildAvailable ? (
                  <p className="intent-rebuild-note" role="status">
                    Intent changed — preview to update the cut.
                  </p>
                ) : null}
                <div className="intent-director-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={disabled || clipCount === 0 || status === 'saving'}
                    title={clipCount === 0 ? 'Add clips before previewing a plan' : undefined}
                    onClick={() => {
                      onPreviewDirector({
                        style: styleFromIntent(draft),
                        intentOverrides: draft,
                      })
                    }}
                  >
                    Preview rebuild
                  </button>
                  {pendingEdits > 0 && onOpenDirectorPlan ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={disabled}
                      onClick={onOpenDirectorPlan}
                    >
                      Open plan ({pendingEdits}){directorPlan?.status === 'stale' ? ' · stale' : ''}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

const DirectorIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden className="intent-rail-icon">
    <path
      fill="currentColor"
      d="M8 1.5a2 2 0 0 1 1.9 1.37l.1.38.38.1A2 2 0 0 1 12.5 6l-.1.38-.38.1A2 2 0 0 1 10 9.5l-.38.1-.1.38A2 2 0 0 1 8 11.5a2 2 0 0 1-1.9-1.37l-.1-.38-.38-.1A2 2 0 0 1 3.5 6l.1-.38.38-.1A2 2 0 0 1 6 2.98l.38-.1.1-.38A2 2 0 0 1 8 1.5Zm0 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM3.2 11.3c.4-.3.95-.25 1.3.1L8 14.4l3.5-3c.35-.35.9-.4 1.3-.1.4.3.45.85.15 1.25L9 15.7a1.5 1.5 0 0 1-2 0l-3.95-3.15a.9.9 0 0 1 .15-1.25Z"
    />
  </svg>
)
