'use client'

import type { StudioMutation, StudioProject } from '@synawood/creative/project/client'
import {
  deleteCutsForWordRange,
  splitFrameForWord,
  trimCutsForWordRange,
  type ScriptWord,
  type TimedCut,
} from '@synawood/creative/voice/transcript-edit'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  briefTextFromProject,
  CLARITY_EMPTY_COPY,
  CLARITY_EMPTY_NO_BRIEF,
  clarityCutsForTranscript,
  PAUSE_EMPTY_COPY,
  RETAKE_EMPTY_COPY,
  needsClarityConfirm,
  pauseCutsForTranscript,
  pickTranscriptPaneView,
  readAssetTranscriptSegments,
  retakeCutsForTranscript,
} from '@/lib/studio/transcript-pane'
import { IconCollapsePanel } from '../icons'
import { ConfirmDialog } from './ConfirmDialog'
import { PaneCollapseControl } from './PaneChrome'
import type { GenerationJobSummary } from './useProjectGenerationJobs'

type TranscriptPaneProps = {
  project: StudioProject
  projectId: string
  currentFrame: number
  selectedClipId: string | null
  confirmSpend: boolean
  jobs: GenerationJobSummary[]
  disabled: boolean
  onCollapse: () => void
  onSeek: (frame: number) => void
  onMutate: (mutation: StudioMutation) => Promise<void>
  onProject: (project: StudioProject) => void
  onReload: () => Promise<void>
  onConfirmSpend: () => void
  onError: (message: string) => void
}

const framesToMs = (frames: number, fps: number): number =>
  Math.max(0, Math.round((frames / (fps > 0 ? fps : 30)) * 1000))

const removedMs = (cuts: readonly TimedCut[]): number =>
  cuts.reduce((sum, cut) => sum + Math.max(0, cut.endMs - cut.startMs), 0)

export const TranscriptPane = ({
  project,
  projectId,
  currentFrame,
  selectedClipId,
  confirmSpend,
  jobs,
  disabled,
  onCollapse,
  onSeek,
  onMutate,
  onProject,
  onReload,
  onConfirmSpend,
  onError,
}: TranscriptPaneProps) => {
  const clip = project.clips.find((item) => item.id === selectedClipId) ?? null
  const asset = clip ? project.assets.find((item) => item.id === clip.assetId) : undefined
  const fps = project.fps > 0 ? project.fps : 30
  const trimStartMs = clip ? framesToMs(clip.trim.startFrames ?? 0, fps) : 0
  const durationMs = clip ? framesToMs(clip.durationInFrames, fps) : 0
  const transcribing = jobs.some(
    (job) => job.role === 'transcribe' && (job.status === 'queued' || job.status === 'generating'),
  )
  const enhancing = jobs.some(
    (job) =>
      job.role === 'speech_enhance' && (job.status === 'queued' || job.status === 'generating'),
  )
  const reframing = jobs.some(
    (job) => job.role === 'reframe' && (job.status === 'queued' || job.status === 'generating'),
  )
  const reframeAspect =
    jobs.find(
      (job) => job.role === 'reframe' && (job.status === 'queued' || job.status === 'generating'),
    )?.aspect ?? '9:16'
  const view = pickTranscriptPaneView({
    collapsed: false,
    clipId: clip?.id ?? null,
    segments: readAssetTranscriptSegments(asset?.probe as Record<string, unknown> | undefined),
    trimStartMs,
    durationMs,
    playheadFrame: clip ? Math.max(0, currentFrame - clip.from) : 0,
    fps,
    transcribing,
  })

  const [fromIndex, setFromIndex] = useState<number | null>(null)
  const [toIndex, setToIndex] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [spendPrompt, setSpendPrompt] = useState<{
    kind: 'transcribe' | 'enhance'
    message: string
  } | null>(null)
  const [clarityCuts, setClarityCuts] = useState<TimedCut[] | null>(null)
  const [pauseNotice, setPauseNotice] = useState<string | null>(null)
  const wasTranscribing = useRef(transcribing)
  const wasEnhancing = useRef(enhancing)
  const wasReframing = useRef(reframing)

  useEffect(() => {
    setFromIndex(null)
    setToIndex(null)
    setPauseNotice(null)
  }, [clip?.id])

  useEffect(() => {
    if (wasTranscribing.current && !transcribing) {
      void onReload()
    }
    wasTranscribing.current = transcribing
  }, [onReload, transcribing])

  useEffect(() => {
    if (wasEnhancing.current && !enhancing) {
      void onReload()
    }
    wasEnhancing.current = enhancing
  }, [enhancing, onReload])

  useEffect(() => {
    if (wasReframing.current && !reframing) {
      void onReload()
    }
    wasReframing.current = reframing
  }, [onReload, reframing])

  useEffect(() => {
    const stop = () => setDragging(false)
    window.addEventListener('pointerup', stop)
    return () => window.removeEventListener('pointerup', stop)
  }, [])

  const selectedRange = useMemo(() => {
    if (fromIndex === null || toIndex === null) return null
    return {
      fromIndex: Math.min(fromIndex, toIndex),
      toIndex: Math.max(fromIndex, toIndex),
    }
  }, [fromIndex, toIndex])

  const postVoice = useCallback(
    async (payload: Record<string, unknown>) => {
      const response = await fetch(`/api/studio/projects/${projectId}/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRevision: project.revision,
          confirmSpend,
          ...payload,
        }),
      })
      const body = (await response.json().catch(() => null)) as {
        project?: StudioProject
        error?: string
      } | null
      if (!response.ok) {
        const message = body?.error ?? 'Transcript action failed.'
        if (/confirmSpend/i.test(message)) {
          const kind = payload.action === 'enhance' ? 'enhance' : 'transcribe'
          setSpendPrompt({ kind, message })
          return false
        }
        throw new Error(message)
      }
      if (body?.project) onProject(body.project)
      else await onReload()
      return true
    },
    [confirmSpend, onProject, onReload, project.revision, projectId],
  )

  const applyCuts = useCallback(
    async (cuts: TimedCut[]) => {
      if (!clip || cuts.length === 0) return
      setBusy(true)
      try {
        await postVoice({ action: 'apply_cuts', clipId: clip.id, cuts })
        setFromIndex(null)
        setToIndex(null)
        onSeek(clip.from)
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Could not apply transcript cuts.')
      } finally {
        setBusy(false)
      }
    },
    [clip, onError, onSeek, postVoice],
  )

  const requestCuts = useCallback(
    (cuts: TimedCut[]) => {
      if (!clip || cuts.length === 0) return
      if (needsClarityConfirm(removedMs(cuts), durationMs)) {
        setClarityCuts(cuts)
        return
      }
      void applyCuts(cuts)
    },
    [applyCuts, clip, durationMs],
  )

  const onTranscribe = useCallback(
    async (spendConfirmed: boolean) => {
      if (!clip) return
      setBusy(true)
      setSpendPrompt(null)
      try {
        const ok = await postVoice({
          action: 'transcribe',
          clipId: clip.id,
          confirmSpend: spendConfirmed || confirmSpend,
        })
        if (ok && spendConfirmed) onConfirmSpend()
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Could not transcribe this take.')
      } finally {
        setBusy(false)
      }
    },
    [clip, confirmSpend, onConfirmSpend, onError, postVoice],
  )

  const onEnhance = useCallback(
    async (spendConfirmed: boolean) => {
      if (!clip) return
      setBusy(true)
      setSpendPrompt(null)
      try {
        const ok = await postVoice({
          action: 'enhance',
          clipId: clip.id,
          confirmSpend: spendConfirmed || confirmSpend,
        })
        if (ok && spendConfirmed) onConfirmSpend()
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Could not enhance this take.')
      } finally {
        setBusy(false)
      }
    },
    [clip, confirmSpend, onConfirmSpend, onError, postVoice],
  )

  const onReframe = useCallback(async () => {
    if (!clip) return
    setBusy(true)
    try {
      await postVoice({
        action: 'reframe',
        clipId: clip.id,
        aspect: '9:16',
      })
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not reframe this take.')
    } finally {
      setBusy(false)
    }
  }, [clip, onError, postVoice])

  const onDeleteSelection = useCallback(() => {
    if (!clip || view.kind !== 'script' || !selectedRange) return
    requestCuts(
      deleteCutsForWordRange({
        words: view.words,
        fromIndex: selectedRange.fromIndex,
        toIndex: selectedRange.toIndex,
        trimStartMs,
      }),
    )
  }, [clip, requestCuts, selectedRange, trimStartMs, view])

  const onTrimSelection = useCallback(() => {
    if (!clip || view.kind !== 'script' || !selectedRange) return
    requestCuts(
      trimCutsForWordRange({
        words: view.words,
        fromIndex: selectedRange.fromIndex,
        toIndex: selectedRange.toIndex,
        trimStartMs,
      }),
    )
  }, [clip, requestCuts, selectedRange, trimStartMs, view])

  const onShortenPauses = useCallback(() => {
    if (!clip || view.kind !== 'script') return
    setPauseNotice(null)
    const cuts = pauseCutsForTranscript({
      segments: readAssetTranscriptSegments(asset?.probe as Record<string, unknown> | undefined),
      trimStartMs,
      durationMs,
    })
    if (cuts.length === 0) {
      setPauseNotice(PAUSE_EMPTY_COPY)
      return
    }
    void applyCuts(cuts)
  }, [applyCuts, asset?.probe, clip, durationMs, trimStartMs, view.kind])

  const onRemoveFalseStarts = useCallback(() => {
    if (!clip || view.kind !== 'script') return
    setPauseNotice(null)
    const cuts = retakeCutsForTranscript({
      segments: readAssetTranscriptSegments(asset?.probe as Record<string, unknown> | undefined),
      trimStartMs,
      durationMs,
    })
    if (cuts.length === 0) {
      setPauseNotice(RETAKE_EMPTY_COPY)
      return
    }
    void applyCuts(cuts)
  }, [applyCuts, asset?.probe, clip, durationMs, trimStartMs, view.kind])

  const onCutRambling = useCallback(() => {
    if (!clip || view.kind !== 'script') return
    setPauseNotice(null)
    const briefText = briefTextFromProject(project.brief)
    if (!briefText) {
      setPauseNotice(CLARITY_EMPTY_NO_BRIEF)
      return
    }
    const cuts = clarityCutsForTranscript({
      segments: readAssetTranscriptSegments(asset?.probe as Record<string, unknown> | undefined),
      briefText,
      trimStartMs,
      durationMs,
    })
    if (cuts.length === 0) {
      setPauseNotice(CLARITY_EMPTY_COPY)
      return
    }
    requestCuts(cuts)
  }, [asset?.probe, clip, durationMs, project.brief, requestCuts, trimStartMs, view.kind])

  const onSplitSelection = useCallback(() => {
    if (!clip || view.kind !== 'script' || !selectedRange) return
    const word = view.words[selectedRange.fromIndex]
    if (!word) return
    const atFrame = splitFrameForWord({
      word,
      fps,
      clipFrom: clip.from,
      trimStartMs,
    })
    void onMutate({ type: 'split_clip', clipId: clip.id, atFrame })
    setFromIndex(null)
    setToIndex(null)
  }, [clip, fps, onMutate, selectedRange, trimStartMs, view])

  const seekWord = useCallback(
    (word: ScriptWord) => {
      if (!clip) return
      onSeek(splitFrameForWord({ word, fps, clipFrom: clip.from, trimStartMs }))
    },
    [clip, fps, onSeek, trimStartMs],
  )

  const locked = disabled || busy || transcribing || enhancing || reframing
  const alreadyEnhanced =
    (asset?.probe as Record<string, unknown> | undefined)?.speechEnhanced === true
  const alreadyReframed = clip?.reframe?.aspect === '9:16'
  const showMenu = view.kind === 'script' && selectedRange !== null && !locked

  return (
    <div
      className="transcript-pane"
      tabIndex={0}
      aria-label="Transcript"
      onKeyDown={(event) => {
        if (locked || view.kind !== 'script') return
        if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault()
          onDeleteSelection()
        }
      }}
    >
      <header className="transcript-pane-header">
        <p className="transcript-pane-label">Transcript</p>
        <PaneCollapseControl title="Hide transcript" onClick={onCollapse}>
          <IconCollapsePanel />
        </PaneCollapseControl>
      </header>
      {transcribing ? (
        <div className="transcript-pane-banner" role="status">
          Transcribing this take… You can keep editing. Reload keeps this banner.
        </div>
      ) : null}
      {enhancing ? (
        <div className="transcript-pane-banner" role="status">
          Enhancing speech on this take… You can keep editing. Reload keeps this banner.
        </div>
      ) : null}
      {reframing ? (
        <div className="transcript-pane-banner" role="status">
          Reframing take to {reframeAspect}… You can keep editing. Reload keeps this banner.
        </div>
      ) : null}
      {disabled ? (
        <p className="transcript-pane-lock">
          Chat is editing the timeline — wait to cut the script.
        </p>
      ) : null}
      {view.kind === 'no-clip' ? (
        <p className="transcript-pane-empty">Select a talking-head clip to edit the script.</p>
      ) : null}
      {view.kind === 'transcribe' ? (
        <div className="transcript-pane-empty-actions">
          <p className="transcript-pane-empty">No transcript on this take yet.</p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={locked || !clip}
            onClick={() => void onTranscribe(confirmSpend)}
          >
            Transcribe this take
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={locked || !clip || alreadyEnhanced}
            onClick={() => void onEnhance(confirmSpend)}
          >
            {alreadyEnhanced ? 'Speech enhanced' : 'Enhance speech'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={locked || !clip || alreadyReframed}
            onClick={() => void onReframe()}
          >
            {alreadyReframed ? 'Reframed to 9:16' : 'Reframe to 9:16'}
          </button>
        </div>
      ) : null}
      {view.kind === 'script' ? (
        <div className="transcript-pane-script">
          <div className="transcript-pane-toolbar">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={locked || !clip || alreadyEnhanced}
              onClick={() => void onEnhance(confirmSpend)}
            >
              {alreadyEnhanced ? 'Speech enhanced' : 'Enhance speech'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={locked || !clip || alreadyReframed}
              onClick={() => void onReframe()}
            >
              {alreadyReframed ? 'Reframed to 9:16' : 'Reframe to 9:16'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={locked || !clip}
              onClick={onShortenPauses}
            >
              Shorten pauses
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={locked || !clip}
              onClick={onRemoveFalseStarts}
            >
              Remove false starts
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={locked || !clip}
              onClick={onCutRambling}
            >
              Cut rambling
            </button>
          </div>
          {pauseNotice ? (
            <p className="transcript-pane-notice" role="status">
              {pauseNotice}
            </p>
          ) : null}
          {view.words.map((word) => {
            const selected =
              selectedRange !== null &&
              word.index >= selectedRange.fromIndex &&
              word.index <= selectedRange.toIndex
            return (
              <button
                key={`${word.index}-${word.startMs}`}
                type="button"
                className={`transcript-pane-word${word.index === view.activeIndex ? ' is-active' : ''}${
                  selected ? ' is-selected' : ''
                }`}
                disabled={locked}
                onPointerDown={(event) => {
                  if (event.button !== 0) return
                  setDragging(true)
                  setFromIndex(word.index)
                  setToIndex(word.index)
                  seekWord(word)
                }}
                onPointerEnter={() => {
                  if (!dragging) return
                  setToIndex(word.index)
                }}
                onPointerUp={() => setDragging(false)}
              >
                {word.text}
              </button>
            )
          })}
        </div>
      ) : null}
      {showMenu ? (
        <div className="transcript-pane-menu" role="menu" aria-label="Cut selection">
          <button type="button" role="menuitem" onClick={onDeleteSelection}>
            Delete
          </button>
          <button type="button" role="menuitem" onClick={onSplitSelection}>
            Split
          </button>
          <button type="button" role="menuitem" onClick={onTrimSelection}>
            Trim
          </button>
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(spendPrompt)}
        title={spendPrompt?.kind === 'enhance' ? 'Enhance this take?' : 'Transcribe this take?'}
        body={spendPrompt?.message ?? ''}
        confirmLabel={spendPrompt?.kind === 'enhance' ? 'Enhance' : 'Transcribe'}
        cancelLabel="Cancel"
        danger={false}
        onConfirm={() => {
          if (spendPrompt?.kind === 'enhance') void onEnhance(true)
          else void onTranscribe(true)
        }}
        onCancel={() => setSpendPrompt(null)}
      />
      <ConfirmDialog
        open={Boolean(clarityCuts)}
        title="Cut this rambling?"
        body={`This removes ${Math.round(removedMs(clarityCuts ?? []) / 1000)}s — more than 15% of the take.`}
        confirmLabel="Cut"
        cancelLabel="Keep"
        danger
        onConfirm={() => {
          const cuts = clarityCuts
          setClarityCuts(null)
          if (cuts) void applyCuts(cuts)
        }}
        onCancel={() => setClarityCuts(null)}
      />
    </div>
  )
}
