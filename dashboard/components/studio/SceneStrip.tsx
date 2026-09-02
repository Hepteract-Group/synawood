'use client'

import type { Scene, SceneRole } from '@synawood/creative/intent'
import type { StudioProject } from '@synawood/creative/project/client'
import { sceneTokenFor } from '@synawood/creative/project/scene-token'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconChevronLeft, IconChevronRight, IconCollapsePanel } from '../icons'
import { StudioTooltip } from '../StudioTooltip'
import { PaneCollapseControl } from './PaneChrome'
import { ScenePlanProgressBanner } from './ScenePlanProgressBanner'
import { labelToken } from './intent-helpers'

type ScenePlanUi = {
  phase: 'idle' | 'inferring' | 'preview' | 'applying' | 'failed'
  scenes: Scene[] | null
  error: string | null
  modalOpen: boolean
  busy: boolean
  onInfer: () => void
  onApply: () => Promise<boolean>
  onDismiss: () => void
  onOpenModal: () => void
  onCloseModal: () => void
}

type SceneStripProps = {
  project: StudioProject
  projectId: string
  revision: number
  currentFrame: number
  selectedSceneId: string | null
  /** Scene ids that own currently selected timeline clip(s). */
  relatedSceneIds?: ReadonlySet<string>
  onSelectScene: (sceneId: string | null) => void
  onProjectChanged: (project: StudioProject) => void
  onMentionScene?: (token: string) => void
  onCollapseScenes?: () => void
  onError: (message: string) => void
  disabled?: boolean
  /** Lifted Infer/Apply progress so the banner survives strip unmount. */
  scenePlan: ScenePlanUi
}

const ROLE_OPTIONS: SceneRole[] = [
  'hook',
  'problem',
  'context',
  'proof',
  'solution',
  'offer',
  'cta',
  'custom',
]

const nextRoleLabel = (role: SceneRole): string => {
  const next = ROLE_OPTIONS[(ROLE_OPTIONS.indexOf(role) + 1) % ROLE_OPTIONS.length]!
  return labelToken(next)
}

const clipAtFrame = (project: StudioProject, frame: number) =>
  [...project.clips]
    .sort((a, b) => a.from - b.from)
    .find((clip) => frame >= clip.from && frame < clip.from + clip.durationInFrames)

export const SceneStrip = ({
  project,
  projectId,
  revision,
  currentFrame,
  selectedSceneId,
  relatedSceneIds,
  onSelectScene,
  onProjectChanged,
  onMentionScene,
  onCollapseScenes,
  onError,
  disabled = false,
  scenePlan,
}: SceneStripProps) => {
  const scenes = project.scenes ?? []
  const [busyLocal, setBusyLocal] = useState(false)
  const [menuSceneId, setMenuSceneId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [statusNote, setStatusNote] = useState<string | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [scenesOverflow, setScenesOverflow] = useState(false)
  const stripRef = useRef<HTMLDivElement | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const menuBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const busy = busyLocal || scenePlan.busy
  const locked = disabled || busy

  const updateScrollHints = useCallback(() => {
    const el = scrollerRef.current
    if (!el) {
      setCanScrollLeft(false)
      setCanScrollRight(false)
      setScenesOverflow(false)
      return
    }
    const max = el.scrollWidth - el.clientWidth
    const overflow = max > 2
    setScenesOverflow(overflow)
    setCanScrollLeft(overflow && el.scrollLeft > 2)
    setCanScrollRight(overflow && el.scrollLeft < max - 2)
  }, [])

  const scrollScenesBy = (direction: -1 | 1) => {
    const el = scrollerRef.current
    if (!el) return
    const step = Math.max(160, Math.round(el.clientWidth * 0.7))
    el.scrollBy({ left: direction * step, behavior: 'smooth' })
  }

  useLayoutEffect(() => {
    updateScrollHints()
  }, [scenes.length, updateScrollHints])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    updateScrollHints()
    el.addEventListener('scroll', updateScrollHints, { passive: true })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScrollHints) : null
    ro?.observe(el)
    window.addEventListener('resize', updateScrollHints)
    return () => {
      el.removeEventListener('scroll', updateScrollHints)
      ro?.disconnect()
      window.removeEventListener('resize', updateScrollHints)
    }
  }, [scenes.length, updateScrollHints])

  const acceptProject = useCallback(
    (body: { project?: StudioProject; error?: string }, fallback: string) => {
      if (!body.project) {
        onError(body.error ?? fallback)
        return false
      }
      onProjectChanged(body.project)
      return true
    },
    [onError, onProjectChanged],
  )

  const runJson = async (
    url: string,
    init: RequestInit,
    fallback: string,
  ): Promise<StudioProject | null> => {
    setBusyLocal(true)
    try {
      const response = await fetch(url, init)
      const body = (await response.json()) as { project?: StudioProject; error?: string }
      if (!response.ok) {
        onError(body.error ?? fallback)
        return null
      }
      if (!acceptProject(body, fallback)) return null
      return body.project ?? null
    } finally {
      setBusyLocal(false)
    }
  }

  const closeMenu = () => {
    setMenuSceneId(null)
    setMenuPos(null)
  }

  const openMenu = (sceneId: string) => {
    setMenuSceneId((id) => (id === sceneId ? null : sceneId))
  }

  useLayoutEffect(() => {
    if (!menuSceneId) {
      setMenuPos(null)
      return
    }
    const btn = menuBtnRefs.current[menuSceneId]
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const menuWidth = 220
    const menuHeight = 200
    const left = Math.min(window.innerWidth - menuWidth - 8, Math.max(8, rect.right - menuWidth))
    const openUp = rect.bottom + menuHeight > window.innerHeight - 8
    const top = openUp ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4
    setMenuPos({ top, left })
  }, [menuSceneId, scenes.length])

  useEffect(() => {
    if (!menuSceneId) return
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node
      if (stripRef.current?.contains(target)) return
      const menu = document.querySelector('.scene-strip-menu')
      if (menu?.contains(target)) return
      closeMenu()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    window.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', closeMenu)
    return () => {
      window.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', closeMenu)
    }
  }, [menuSceneId])

  const onAdd = () => {
    if (locked) return
    void runJson(
      `/api/studio/projects/${projectId}/scenes`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRevision: revision,
          role: 'custom',
          label: `Scene ${scenes.length + 1}`,
        }),
      },
      'Failed to add scene',
    )
  }

  const onInfer = () => {
    if (locked) return
    scenePlan.onInfer()
  }

  const onApplyPlan = async () => {
    if (locked || !scenePlan.scenes?.length) return
    const planScenes = scenePlan.scenes
    const clipCount = planScenes.reduce((sum, scene) => sum + scene.clipIds.length, 0)
    const ok = await scenePlan.onApply()
    if (!ok) return
    setStatusNote(
      clipCount > 0
        ? `Applied ${planScenes.length} scene(s) · ${clipCount} clip(s) linked by beat. Clips stay on the Video track.`
        : `Applied ${planScenes.length} scene(s). Assign clips via ··· → Link playhead clip.`,
    )
  }

  const onToggleLock = (scene: Scene) => {
    if (locked) return
    void runJson(
      `/api/studio/projects/${projectId}/scenes/${scene.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: revision, locked: !scene.locked }),
      },
      'Failed to update scene',
    )
    closeMenu()
  }

  const onAssignPlayhead = (sceneId: string) => {
    const clip = clipAtFrame(project, currentFrame)
    if (!clip) {
      onError('Move the playhead onto a Video-track clip, then link it to this scene.')
      closeMenu()
      return
    }
    const owner = scenes.find((scene) => scene.clipIds.includes(clip.id))
    if (owner?.id === sceneId) {
      setStatusNote('That clip is already linked to this scene.')
      closeMenu()
      return
    }
    void runJson(
      `/api/studio/projects/${projectId}/scenes/assign-clip`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRevision: revision,
          clipId: clip.id,
          sceneId,
        }),
      },
      'Failed to assign clip',
    ).then((saved) => {
      if (saved) {
        setStatusNote(
          owner
            ? `Moved clip from ${labelToken(owner.role)} onto this scene. Still on the Video track.`
            : 'Linked playhead clip to this scene. Still on the Video track.',
        )
      }
    })
    closeMenu()
  }

  const onDelete = (sceneId: string) => {
    if (locked) return
    void runJson(
      `/api/studio/projects/${projectId}/scenes/${sceneId}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: revision }),
      },
      'Failed to remove scene',
    )
    if (selectedSceneId === sceneId) onSelectScene(null)
    closeMenu()
  }

  const moveScene = async (fromId: string, toId: string) => {
    if (fromId === toId || locked) return
    const ids = scenes.map((scene) => scene.id)
    const from = ids.indexOf(fromId)
    const to = ids.indexOf(toId)
    if (from < 0 || to < 0) return
    const next = [...ids]
    const [moved] = next.splice(from, 1)
    if (!moved) return
    next.splice(to, 0, moved)
    await runJson(
      `/api/studio/projects/${projectId}/scenes/reorder`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: revision, sceneIds: next }),
      },
      'Failed to reorder scenes',
    )
  }

  const allHaveTargets =
    scenes.length > 0 && scenes.every((scene) => scene.targetDurationFrames != null)
  const totalTarget = scenes.reduce((sum, scene) => sum + (scene.targetDurationFrames ?? 0), 0)
  const drift =
    allHaveTargets &&
    project.durationFrames > 0 &&
    Math.abs(totalTarget - project.durationFrames) > project.fps
  const driftSeconds = Math.abs(totalTarget - project.durationFrames) / Math.max(1, project.fps)
  const timelineSeconds = project.durationFrames / Math.max(1, project.fps)
  const targetSeconds = totalTarget / Math.max(1, project.fps)
  const driftMeta = `Beats ${targetSeconds.toFixed(1)}s · Timeline ${timelineSeconds.toFixed(1)}s · Δ ${driftSeconds.toFixed(1)}s`

  const activeMenuScene = scenes.find((scene) => scene.id === menuSceneId) ?? null
  const collapseControl = onCollapseScenes ? (
    <PaneCollapseControl title="Minimize scenes" onClick={onCollapseScenes}>
      <IconCollapsePanel />
    </PaneCollapseControl>
  ) : null

  const menuPortal =
    activeMenuScene && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="scene-strip-menu"
            role="menu"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <button
              type="button"
              role="menuitem"
              title="Link the Video-track clip under the playhead to this story beat"
              onClick={() => onAssignPlayhead(activeMenuScene.id)}
            >
              Link playhead clip
            </button>
            <button
              type="button"
              role="menuitem"
              title={
                activeMenuScene.locked
                  ? 'Allow Director to edit this beat again'
                  : 'Keep this beat as-is when Director rebalances the cut'
              }
              onClick={() => onToggleLock(activeMenuScene)}
            >
              {activeMenuScene.locked ? 'Unlock for Director' : 'Lock for Director'}
            </button>
            <button
              type="button"
              role="menuitem"
              title="Insert @scene:… into the Studio Agent chat so you can talk about this beat"
              onClick={() => {
                onMentionScene?.(sceneTokenFor(activeMenuScene))
                closeMenu()
              }}
            >
              Mention in chat
            </button>
            <button
              type="button"
              role="menuitem"
              title="Advance story role: Hook → Problem → Context → … → Custom"
              onClick={() => {
                const nextRole =
                  ROLE_OPTIONS[
                    (ROLE_OPTIONS.indexOf(activeMenuScene.role) + 1) % ROLE_OPTIONS.length
                  ]!
                void runJson(
                  `/api/studio/projects/${projectId}/scenes/${activeMenuScene.id}`,
                  {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      expectedRevision: revision,
                      role: nextRole,
                    }),
                  },
                  'Failed to update scene role',
                )
                closeMenu()
              }}
            >
              Role → {nextRoleLabel(activeMenuScene.role)}
            </button>
            <button
              type="button"
              role="menuitem"
              className="is-danger"
              onClick={() => onDelete(activeMenuScene.id)}
            >
              Delete scene
            </button>
          </div>,
          document.body,
        )
      : null

  const planDialog =
    scenePlan.modalOpen &&
    (scenePlan.phase === 'inferring' ||
      scenePlan.phase === 'applying' ||
      scenePlan.phase === 'preview' ||
      scenePlan.phase === 'failed') ? (
      <ScenePlanDialog
        scenes={scenePlan.scenes ?? []}
        phase={scenePlan.phase}
        error={scenePlan.error}
        busy={scenePlan.busy}
        onCancel={() => scenePlan.onCloseModal()}
        onApply={() => void onApplyPlan()}
        onDismiss={scenePlan.onDismiss}
      />
    ) : null

  const planBanner =
    scenePlan.phase !== 'idle' ? (
      <ScenePlanProgressBanner
        phase={scenePlan.phase}
        sceneCount={scenePlan.scenes?.length ?? 0}
        error={scenePlan.error}
        onReview={() => scenePlan.onOpenModal()}
        onDismiss={scenePlan.onDismiss}
        onApply={scenePlan.phase === 'preview' ? () => void onApplyPlan() : undefined}
        applyDisabled={locked || (scenePlan.scenes?.length ?? 0) === 0}
      />
    ) : null

  if (scenes.length === 0) {
    return (
      <div className="scene-strip scene-strip-empty-bar" ref={stripRef} tabIndex={-1}>
        {planBanner}
        <div className="scene-strip-empty-row">
          <span className="scene-strip-label">Scenes</span>
          <StudioTooltip
            label="Add scene"
            body="Create a blank story beat on the strip. Link clips afterward with ··· → Link playhead clip."
            meta="Manual beat · optional"
            placement="up"
          >
            <button
              type="button"
              className="scene-strip-action is-add"
              disabled={locked}
              onClick={onAdd}
            >
              <span className="scene-strip-action-mark" aria-hidden>
                +
              </span>
              Add scene
            </button>
          </StudioTooltip>
          <StudioTooltip
            label="Infer scenes"
            body={
              project.clips.length === 0
                ? 'Needs clips on the Video track first — upload media or run the Ad Generator, then Infer will draft Hook → Problem → … beats.'
                : 'Draft story beats from your Video-track clip order. You’ll review a plan before anything is applied.'
            }
            meta={
              project.clips.length === 0
                ? 'Blocked · no clips'
                : scenePlan.phase === 'inferring'
                  ? 'Working…'
                  : 'Preview first · no spend until Apply'
            }
            placement="up"
          >
            <button
              type="button"
              className="scene-strip-action is-infer"
              disabled={locked || project.clips.length === 0}
              onClick={() => void onInfer()}
            >
              {scenePlan.phase === 'inferring' ? 'Inferring…' : 'Infer scenes'}
            </button>
          </StudioTooltip>
          <p className="scene-strip-hint">Story outline — Infer to draft beats from clips.</p>
          <span className="scene-strip-toolbar-spacer" />
          {collapseControl}
        </div>
        {planDialog}
        {menuPortal}
      </div>
    )
  }

  return (
    <div className="scene-strip" ref={stripRef} tabIndex={-1} aria-label="Scene strip">
      {planBanner}
      <div className="scene-strip-toolbar">
        <span className="scene-strip-label">Scenes</span>
        {drift ? (
          <StudioTooltip
            className="scene-strip-drift-tip"
            label="Duration drift"
            body="Story-beat target lengths don’t add up to the timeline, so cards won’t line up with the playhead. There’s no duration field on the cards yet — ask the Studio Agent (e.g. “set the Hook beat to 3s”), or re-run Infer to rebuild targets from clip order."
            meta={driftMeta}
            placement="up"
          >
            <span className="scene-strip-drift" tabIndex={0} aria-label="Duration drift">
              drift
            </span>
          </StudioTooltip>
        ) : null}
        <StudioTooltip
          label="Add scene"
          body="Create a blank story beat on the strip. Link clips afterward with ··· → Link playhead clip."
          meta="Manual beat · optional"
          placement="up"
        >
          <button
            type="button"
            className="scene-strip-action is-add"
            disabled={locked}
            onClick={onAdd}
          >
            <span className="scene-strip-action-mark" aria-hidden>
              +
            </span>
            Add
          </button>
        </StudioTooltip>
        <StudioTooltip
          label="Infer scenes"
          body={
            project.clips.length === 0
              ? 'Needs clips on the Video track first — upload media or run the Ad Generator, then Infer will draft Hook → Problem → … beats.'
              : 'Rebuild story beats from current Video-track clip order. You’ll review a plan before anything is applied.'
          }
          meta={
            project.clips.length === 0
              ? 'Blocked · no clips'
              : scenePlan.phase === 'inferring'
                ? 'Working…'
                : 'Preview first · no spend until Apply'
          }
          placement="up"
        >
          <button
            type="button"
            className="scene-strip-action is-infer"
            disabled={locked || project.clips.length === 0}
            onClick={() => void onInfer()}
          >
            {scenePlan.phase === 'inferring' ? 'Inferring…' : 'Infer'}
          </button>
        </StudioTooltip>
        <span className="scene-strip-toolbar-spacer" />
        {collapseControl}
      </div>
      {statusNote ? (
        <p className="scene-strip-hint" role="status">
          {statusNote}
        </p>
      ) : (
        <p className="scene-strip-hint">
          Select a beat to light its clips. Empty? ··· → Link playhead clip.
        </p>
      )}
      <div
        className={`scene-strip-rail${scenesOverflow ? ' is-overflowing' : ''}${canScrollLeft ? ' can-scroll-left' : ''}${canScrollRight ? ' can-scroll-right' : ''}`}
      >
        {scenesOverflow ? (
          <button
            type="button"
            className="scene-strip-nav is-left"
            aria-label="Scroll scenes left"
            disabled={!canScrollLeft}
            onClick={() => scrollScenesBy(-1)}
          >
            <IconChevronLeft />
          </button>
        ) : null}
        <div className="scene-strip-scroller" role="list" ref={scrollerRef}>
          {scenes.map((scene) => {
            const widthPct =
              allHaveTargets && totalTarget > 0
                ? Math.max(8, ((scene.targetDurationFrames ?? 0) / totalTarget) * 100)
                : undefined
            return (
              <div
                key={scene.id}
                role="listitem"
                className={`scene-strip-card role-${scene.role}${selectedSceneId === scene.id ? ' is-selected' : ''}${relatedSceneIds?.has(scene.id) && selectedSceneId !== scene.id ? ' is-related' : ''}`}
                style={widthPct ? { flexBasis: `${widthPct}%`, maxWidth: '12rem' } : undefined}
                draggable={!locked}
                onDragStart={() => setDraggingId(scene.id)}
                onDragEnd={() => setDraggingId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggingId) void moveScene(draggingId, scene.id)
                  setDraggingId(null)
                }}
              >
                <button
                  type="button"
                  className="scene-strip-card-main"
                  aria-pressed={selectedSceneId === scene.id}
                  disabled={locked}
                  title={
                    scene.clipIds.length === 0
                      ? 'No clips linked — ··· → Link playhead clip'
                      : `Select to highlight ${scene.clipIds.length} linked clip${scene.clipIds.length === 1 ? '' : 's'} on the timeline`
                  }
                  onClick={() => {
                    const next = selectedSceneId === scene.id ? null : scene.id
                    onSelectScene(next)
                  }}
                >
                  <span className="scene-strip-role">{labelToken(scene.role)}</span>
                  <span className="scene-strip-title">{scene.label}</span>
                  <span className="scene-strip-meta">
                    {`${scene.clipIds.length} clip${scene.clipIds.length === 1 ? '' : 's'}`}
                    {scene.targetDurationFrames ? ` · ${scene.targetDurationFrames}f` : ''}
                    {scene.locked ? ' · locked' : ''}
                  </span>
                </button>
                <button
                  type="button"
                  className="scene-strip-menu-btn"
                  aria-label={`Scene menu ${scene.label}`}
                  aria-expanded={menuSceneId === scene.id}
                  disabled={locked}
                  ref={(node) => {
                    menuBtnRefs.current[scene.id] = node
                  }}
                  onClick={(event) => {
                    event.stopPropagation()
                    openMenu(scene.id)
                  }}
                >
                  ···
                </button>
              </div>
            )
          })}
        </div>
        {scenesOverflow ? (
          <button
            type="button"
            className="scene-strip-nav is-right"
            aria-label="Scroll scenes right"
            disabled={!canScrollRight}
            onClick={() => scrollScenesBy(1)}
          >
            <IconChevronRight />
          </button>
        ) : null}
      </div>
      {planDialog}
      {menuPortal}
    </div>
  )
}

const ScenePlanDialog = ({
  scenes,
  phase,
  error,
  busy,
  onCancel,
  onApply,
  onDismiss,
}: {
  scenes: Scene[]
  phase: 'inferring' | 'preview' | 'applying' | 'failed'
  error: string | null
  busy: boolean
  onCancel: () => void
  onApply: () => void
  onDismiss: () => void
}) => {
  const linked = scenes.reduce((sum, scene) => sum + scene.clipIds.length, 0)
  const title =
    phase === 'inferring'
      ? 'Inferring story scenes…'
      : phase === 'applying'
        ? 'Applying story scenes…'
        : phase === 'failed'
          ? 'Scene plan interrupted'
          : 'Infer story scenes'
  return (
    <div className="dialog-root" role="presentation">
      <button type="button" className="dialog-backdrop" aria-label="Minimize" onClick={onCancel} />
      <div
        className="dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scene-plan-title"
        aria-busy={busy}
      >
        <h2 id="scene-plan-title" className="dialog-title">
          {title}
        </h2>
        {phase === 'inferring' || phase === 'applying' ? (
          <p className="muted" role="status">
            {phase === 'inferring'
              ? 'Drafting story beats from clip order. This stays visible if you close the dialog.'
              : 'Writing beats onto the scene strip…'}
          </p>
        ) : null}
        {phase === 'failed' ? (
          <p className="error" role="alert">
            {error ?? 'Scene plan was interrupted. Run Infer again.'}
          </p>
        ) : null}
        {phase === 'preview' || (phase === 'applying' && scenes.length > 0) ? (
          <>
            <p className="muted">
              Groups Video-track clips into story beats on the scene strip (Hook → Problem →
              Solution → CTA when possible). Clips stay on the timeline — this only links each clip
              to a beat for the Director and chat.
            </p>
            <ol className="scene-plan-list">
              {scenes.map((scene) => (
                <li key={scene.id}>
                  <strong>{labelToken(scene.role)}</strong> — {scene.label}
                  {scene.clipIds.length
                    ? ` · ${scene.clipIds.length} clip${scene.clipIds.length === 1 ? '' : 's'}`
                    : ' · no clips yet'}
                </li>
              ))}
            </ol>
            <p className="muted">
              {linked > 0
                ? `${linked} clip(s) will be linked when you apply.`
                : 'No clips on the Video track yet — you’ll get an empty skeleton.'}
            </p>
          </>
        ) : null}
        <div className="dialog-actions">
          {busy ? (
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Minimize
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-ghost" onClick={onDismiss}>
                Dismiss
              </button>
              {phase === 'preview' ? (
                <button type="button" className="btn btn-primary" onClick={onApply}>
                  Apply to scene strip
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
