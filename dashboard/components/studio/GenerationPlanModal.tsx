'use client'

import type { GenerationPlan, GenerationPlanScene } from '@synawood/creative/generation-plan/schema'
import {
  extractCostForPlanGbp,
  parseExtraExtractUrlLines,
} from '@synawood/creative/generation-plan/extract-on-confirm'
import { useEffect, useState } from 'react'
import { StudioSpinner } from './StudioSpinner'
import { IconX } from '../icons'

type GenerationPlanModalProps = {
  open: boolean
  plan: GenerationPlan | null
  productId?: string
  busy?: boolean
  error?: string | null
  onClose: () => void
  onMinimize: () => void
  onSaveDraft: (patch: GenerationPlanPatch) => void
  onDiscard: () => void
  onConfirm: (patch: GenerationPlanPatch) => void
}

export type GenerationPlanPatch = {
  goal?: string
  tone?: string
  runtimeSeconds?: number
  platform?: string
  scenes: GenerationPlanScene[]
  extraExtractUrls?: string[]
  reExtractThisTurn?: boolean
}

const formatGbp = (value: number): string =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value)

const canConfirm = (plan: GenerationPlan): boolean => {
  if (plan.costEstimateGbp === 0 && plan.scenes.length === 0) return false
  if (plan.videoModelId && plan.videoModelId.toLowerCase().includes('frozen')) return false
  return plan.status !== 'applied'
}

const missingConfirmReason = (plan: GenerationPlan): string | null => {
  if (plan.costEstimateGbp === 0 && plan.scenes.length === 0) {
    return 'Add at least one scene and a non-zero cost estimate before confirming.'
  }
  if (plan.videoModelId && plan.videoModelId.toLowerCase().includes('frozen')) {
    return 'Video model is frozen — update the model in Settings before confirming.'
  }
  if (plan.status === 'applied') {
    return 'This plan has already been applied.'
  }
  return null
}

const SceneCard = ({
  scene,
  index,
  onUpdate,
  onRemove,
  disabled,
}: {
  scene: GenerationPlanScene
  index: number
  onUpdate: (updated: GenerationPlanScene) => void
  onRemove: () => void
  disabled: boolean
}) => {
  const isVoiceover =
    scene.role?.toLowerCase().includes('vo') || scene.role?.toLowerCase().includes('voice')
  const dialogueLabel = isVoiceover ? 'Voiceover' : 'Dialogue'

  return (
    <div className="gen-plan-scene-card">
      <div className="gen-plan-scene-header">
        <span className="gen-plan-scene-index">Scene {index + 1}</span>
        {scene.role ? <span className="gen-plan-scene-role">{scene.role}</span> : null}
        <span className="gen-plan-scene-duration">
          {scene.durationSeconds != null ? `${scene.durationSeconds}s` : null}
        </span>
        <button
          type="button"
          className="gen-plan-scene-remove"
          aria-label={`Remove scene ${index + 1}`}
          disabled={disabled}
          onClick={onRemove}
        >
          <IconX />
        </button>
      </div>
      <label className="gen-plan-field-label">
        Description
        <textarea
          className="gen-plan-textarea"
          rows={2}
          maxLength={800}
          disabled={disabled}
          value={scene.description}
          onChange={(event) => onUpdate({ ...scene, description: event.target.value })}
        />
      </label>
      <label className="gen-plan-field-label">
        {dialogueLabel}
        <textarea
          className="gen-plan-textarea"
          rows={2}
          maxLength={800}
          disabled={disabled}
          value={scene.dialogue ?? ''}
          placeholder={`${dialogueLabel} (optional)`}
          onChange={(event) => onUpdate({ ...scene, dialogue: event.target.value || undefined })}
        />
      </label>
      {scene.onScreenText !== undefined ? (
        <label className="gen-plan-field-label">
          On-screen text
          <input
            type="text"
            className="gen-plan-input"
            maxLength={200}
            disabled={disabled}
            value={scene.onScreenText ?? ''}
            onChange={(event) =>
              onUpdate({ ...scene, onScreenText: event.target.value || undefined })
            }
          />
        </label>
      ) : null}
    </div>
  )
}

export const GenerationPlanModal = ({
  open,
  plan,
  productId,
  busy = false,
  error = null,
  onClose,
  onMinimize,
  onSaveDraft,
  onDiscard,
  onConfirm,
}: GenerationPlanModalProps) => {
  const [goal, setGoal] = useState('')
  const [tone, setTone] = useState('')
  const [runtimeSeconds, setRuntimeSeconds] = useState<number | ''>('')
  const [platform, setPlatform] = useState('')
  const [scenes, setScenes] = useState<GenerationPlanScene[]>([])
  const [extraUrls, setExtraUrls] = useState('')
  const [reExtract, setReExtract] = useState(false)
  const [costOpen, setCostOpen] = useState(false)
  const [existingSourceUrls, setExistingSourceUrls] = useState<string[]>([])

  useEffect(() => {
    if (!open || !plan) return
    setGoal(plan.goal ?? '')
    setTone(plan.tone ?? '')
    setRuntimeSeconds(plan.runtimeSeconds ?? '')
    setPlatform(plan.platform ?? '')
    setScenes(plan.scenes)
    setExtraUrls((plan.extraExtractUrls ?? []).join('\n'))
    setReExtract(plan.reExtractThisTurn ?? false)
    setCostOpen(false)
  }, [open, plan?.id])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onMinimize()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onMinimize])

  useEffect(() => {
    if (!open || !productId) {
      setExistingSourceUrls([])
      return
    }
    let cancelled = false
    void fetch(`/api/products/${encodeURIComponent(productId)}/extracts`)
      .then((response) => response.json().catch(() => ({})))
      .then((body: { extracts?: Array<{ sourceUrl?: string }> }) => {
        if (cancelled) return
        const urls = (body.extracts ?? [])
          .map((entry) => entry.sourceUrl?.trim())
          .filter((url): url is string => Boolean(url))
        setExistingSourceUrls([...new Set(urls)])
      })
      .catch(() => {
        if (!cancelled) setExistingSourceUrls([])
      })
    return () => {
      cancelled = true
    }
  }, [open, productId])

  const extraExtractUrls = parseExtraExtractUrlLines(extraUrls)
  const extractGbp = extractCostForPlanGbp({
    reExtractThisTurn: reExtract,
    extraExtractUrls,
    existingSourceUrls,
  })
  const displayCostGbp = (plan?.costEstimateGbp ?? 0) + extractGbp

  const buildPatch = (): GenerationPlanPatch => ({
    goal: goal.trim() || undefined,
    tone: tone.trim() || undefined,
    runtimeSeconds: typeof runtimeSeconds === 'number' ? runtimeSeconds : undefined,
    platform: platform.trim() || undefined,
    scenes,
    extraExtractUrls,
    reExtractThisTurn: reExtract,
  })

  const updateScene = (index: number, updated: GenerationPlanScene) => {
    setScenes((current) => current.map((scene, i) => (i === index ? updated : scene)))
  }

  const removeScene = (index: number) => {
    setScenes((current) => current.filter((_, i) => i !== index))
  }

  const addScene = () => {
    const id = crypto.randomUUID()
    setScenes((current) => [
      ...current,
      { id, description: '', dialogue: undefined, onScreenText: undefined },
    ])
  }

  if (!open) return null

  if (!plan) {
    return (
      <div className="dialog-root gen-plan-root" role="presentation">
        <button
          type="button"
          className="dialog-backdrop"
          aria-label="Minimize"
          onClick={onMinimize}
        />
        <div
          className="dialog-panel gen-plan-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gen-plan-title"
        >
          <p className="gen-plan-eyebrow">Plan</p>
          <h2 id="gen-plan-title" className="dialog-title">
            Generation plan
          </h2>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : (
            <>
              {busy ? <StudioSpinner size="sm" /> : null}
              <p className="muted" role="status">
                {busy ? 'Loading plan…' : 'No plan yet.'}
              </p>
            </>
          )}
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={onMinimize}>
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  const blockReason = missingConfirmReason(plan)
  const confirmAllowed = canConfirm(plan) && !busy

  return (
    <div className="dialog-root gen-plan-root" role="presentation">
      <button
        type="button"
        className="dialog-backdrop"
        aria-label="Minimize"
        onClick={onMinimize}
      />
      <div
        className="dialog-panel gen-plan-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gen-plan-title"
      >
        <header className="gen-plan-header">
          <p className="gen-plan-eyebrow">Plan</p>
          <h2 id="gen-plan-title" className="dialog-title">
            Generation plan
          </h2>
          {plan.status === 'stale' ? (
            <span className="gen-plan-stale-badge">Out of date</span>
          ) : null}
          <button
            type="button"
            className="gen-plan-close-btn"
            aria-label="Minimize plan"
            onClick={onMinimize}
          >
            <IconX />
          </button>
        </header>

        <div className="gen-plan-body">
          <label className="gen-plan-field-label">
            Goal
            <textarea
              className="gen-plan-textarea"
              rows={2}
              maxLength={240}
              disabled={busy}
              value={goal}
              placeholder="What this ad is meant to do"
              onChange={(event) => setGoal(event.target.value)}
            />
          </label>

          <label className="gen-plan-field-label">
            Tone
            <input
              type="text"
              className="gen-plan-input"
              maxLength={120}
              disabled={busy}
              value={tone}
              placeholder="e.g. Confident and warm"
              onChange={(event) => setTone(event.target.value)}
            />
          </label>

          <div className="gen-plan-row">
            <label className="gen-plan-field-label gen-plan-field-half">
              Runtime (seconds)
              <input
                type="number"
                className="gen-plan-input"
                min={1}
                max={600}
                disabled={busy}
                value={runtimeSeconds}
                placeholder="e.g. 15"
                onChange={(event) =>
                  setRuntimeSeconds(event.target.value ? Number(event.target.value) : '')
                }
              />
            </label>
            <label className="gen-plan-field-label gen-plan-field-half">
              Platform
              <input
                type="text"
                className="gen-plan-input"
                maxLength={80}
                disabled={busy}
                value={platform}
                placeholder="e.g. TikTok, Instagram"
                onChange={(event) => setPlatform(event.target.value)}
              />
            </label>
          </div>

          {plan.reasonerModelId || plan.imageModelId || plan.videoModelId ? (
            <div className="gen-plan-models">
              {plan.reasonerModelId ? (
                <span className="gen-plan-model-chip">Reason: {plan.reasonerModelId}</span>
              ) : null}
              {plan.imageModelId ? (
                <span className="gen-plan-model-chip">Pictures: {plan.imageModelId}</span>
              ) : null}
              {plan.videoModelId ? (
                <span
                  className={`gen-plan-model-chip${plan.videoModelId.toLowerCase().includes('frozen') ? ' is-frozen' : ''}`}
                >
                  Video: {plan.videoModelId}
                </span>
              ) : null}
            </div>
          ) : null}

          <section className="gen-plan-scenes">
            <h3 className="gen-plan-section-title">
              {scenes.length} scene{scenes.length === 1 ? '' : 's'}
            </h3>
            {scenes.map((scene, index) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                index={index}
                disabled={busy}
                onUpdate={(updated) => updateScene(index, updated)}
                onRemove={() => removeScene(index)}
              />
            ))}
            <button type="button" className="gen-plan-add-scene" disabled={busy} onClick={addScene}>
              + Add scene
            </button>
          </section>

          <label className="gen-plan-field-label">
            Extra extract URLs (one per line)
            <textarea
              className="gen-plan-textarea"
              rows={2}
              disabled={busy}
              value={extraUrls}
              placeholder="https://…"
              onChange={(event) => setExtraUrls(event.target.value)}
            />
          </label>
          <label className="gen-plan-checkbox-label">
            <input
              type="checkbox"
              checked={reExtract}
              disabled={busy}
              onChange={(event) => setReExtract(event.target.checked)}
            />
            Re-extract this turn
          </label>

          <div className="gen-plan-cost-block">
            <button
              type="button"
              className="gen-plan-cost-summary"
              onClick={() => setCostOpen((isOpen) => !isOpen)}
              aria-expanded={costOpen}
            >
              <span className="gen-plan-cost-total">{formatGbp(displayCostGbp)}</span>
              <span className="gen-plan-cost-label">estimated spend</span>
              <span className="gen-plan-cost-toggle">{costOpen ? '▲' : '▼'} per scene</span>
            </button>
            {extractGbp > 0 ? (
              <p className="gen-plan-extract-cost muted">
                Includes extract crawl {formatGbp(extractGbp)}
              </p>
            ) : null}
            {costOpen && (plan.scenes.length > 0 || extractGbp > 0) ? (
              <table className="gen-plan-cost-table" aria-label="Cost breakdown by scene">
                <tbody>
                  {plan.scenes.map((scene, index) => (
                    <tr key={scene.id}>
                      <td>Scene {index + 1}</td>
                      <td className="muted">
                        {scene.durationSeconds != null ? `${scene.durationSeconds}s` : '—'}
                      </td>
                    </tr>
                  ))}
                  {extractGbp > 0 ? (
                    <tr>
                      <td>Extract crawl</td>
                      <td className="muted">{formatGbp(extractGbp)}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            ) : null}
          </div>

          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}

          {blockReason && !error ? (
            <p className="gen-plan-block-reason muted" role="status">
              {blockReason}
            </p>
          ) : null}
        </div>

        <div className="dialog-actions gen-plan-actions">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy || plan.status === 'applied'}
            onClick={onDiscard}
          >
            Discard plan
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onMinimize}>
            Minimize
          </button>
          <span className="gen-plan-actions-spacer" />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => onSaveDraft(buildPatch())}
          >
            {busy ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!confirmAllowed}
            title={blockReason ?? undefined}
            onClick={() => onConfirm(buildPatch())}
          >
            {busy ? 'Confirming…' : 'Confirm spend and generate'}
          </button>
        </div>
      </div>
    </div>
  )
}
