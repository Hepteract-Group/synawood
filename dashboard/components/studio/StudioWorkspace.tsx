'use client'

import type { PlayerRef } from '@remotion/player'
import {
  DEFAULT_MODEL_PROFILE_ID,
  isPaidHostedVideoModel,
  isVideoOffModelId,
} from '@synawood/creative/model-profiles'
import type {
  OverlayLayout,
  PipLayout,
  StudioCraft,
  StudioMutation,
  StudioProject,
} from '@synawood/creative/project/client'
import {
  BROLL_TRACK_ID,
  defaultOverlayLayout,
  isAuthoredComposition,
  layoutFromPreset,
  listAdReadyIssues,
  normalizePipLayout,
} from '@synawood/creative/project/client'
import { DEFAULT_TURN_MODE, parseTurnMode, type TurnMode } from '@synawood/creative/agent/turn-mode'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { STUDIO_STACK_MEDIA_QUERY, studioLayoutModeForWidth } from '@/lib/studio/studio-layout'
import { AssetBin } from './AssetBin'
import { AdGeneratorWizard } from './AdGeneratorWizard'
import { BrandStudio } from './BrandStudio'
import { BranchSwitcher } from './BranchSwitcher'
import { LocaleMissingBanner, LocaleSwitcher, useLocaleProjectActions } from './LocaleSwitcher'
import { Chat, type ChatLiveThought, type ChatThreadSummary, type StudioChatMessage } from './Chat'
import { StudioErrorBanner } from './StudioErrorBanner'
import { DirectorPreviewModal } from './DirectorPreviewModal'
import { GenerationPlanModal, type GenerationPlanPatch } from './GenerationPlanModal'
import { ContextualDrawer } from './ContextualDrawer'
import { IntentPanel } from './IntentPanel'
import { CreativeStructurePanel } from './CreativeStructurePanel'
import { PathCStatus } from './PathCStatus'
import { PlayerPane } from './PlayerPane'
import { PipFrameOverlay } from './PipFrameOverlay'
import { OverlayFrameOverlay } from './OverlayFrameOverlay'
import { isCaptionStyleId, type CaptionStyleId } from '@synawood/creative/overlays'
import {
  formatTimeToken,
  type ChatGroundingPayload,
} from '@synawood/creative/project/grounding-token'
import { PublishPanel } from './PublishPanel'
import { StudioPageLoading } from './StudioSpinner'
import { ExtractProgress } from './ExtractProgress'
import { EditsPanel } from './EditsPanel'
import { RenderProgress } from './RenderProgress'
import { ReviewBar, type ExportTargets } from './ReviewBar'
import { ThumbnailPicker } from './ThumbnailPicker'
import { SceneStrip } from './SceneStrip'
import { ScenePlanProgressBanner } from './ScenePlanProgressBanner'
import { SessionSpend } from './SessionSpend'
import { SlideEditor } from './SlideEditor'
import { SlideStrip } from './SlideStrip'
import { Timeline } from './Timeline'
import { Transport } from './Transport'
import { useDragResize } from './useDragResize'
import { usePaneCollapse } from './usePaneCollapse'
import {
  formatUploadBytes,
  isStudioUploadOverLimit,
  STUDIO_UPLOAD_MAX_LABEL,
} from '@/lib/studio-upload-limits'
import { useScenePlanProgress } from './useScenePlanProgress'
import { PaneCollapseControl, PaneExpandRail } from './PaneChrome'
import { IconCollapsePanel } from '../icons'
import { fontFallbackWarning, missingTranslationChips } from '@synawood/creative/locale/resolve'
import { MusicPanel } from './MusicPanel'
import { VoicePanel } from './VoicePanel'
import { TranscriptPane } from './TranscriptPane'
import { AdReadyChip, CutReviewNotesBanner, WorkspaceStatusBanners } from './WorkspaceStatusBanners'
import { ModelCatalogueDialog } from '@/components/settings/ModelCatalogueDialog'
import { useBillingSummary } from '@/lib/use-billing-summary'
import { useProjectGenerationJobs } from './useProjectGenerationJobs'
import { SignOffCard } from './SignOffCard'
import { VariantGrid } from './VariantGrid'
import { VariantChildEditor } from './VariantChildEditor'
import { StudioLinkMenu } from './StudioLinkMenu'
import { useVariantSiblings } from './useVariantSiblings'
import type { DirectorPlan, Intent } from '@synawood/creative/intent'
import { isStudioChromeDismissed, markStudioChromeDismissed } from '@/lib/studio-chrome-dismiss'
import {
  loadConfirmSpendPreference,
  persistConfirmSpendPreference,
} from '@/lib/confirm-spend-preference'
import {
  loadDismissedFailedGenerationJobs,
  persistDismissedFailedGenerationJobs,
} from '@/lib/dismissed-failed-generation-jobs'
import {
  appliedBriefIdFromProjectJson,
  searchWithoutWizard,
  shouldFocusExtractsBin,
  shouldOpenAdGeneratorWizard,
  shouldRestoreExtractChrome,
} from '@/lib/extract-chrome'
import { humanizeStudioError } from '../../lib/humanize-studio-error'
import { decideChatSpendSend, type ChatSpendBlockReason } from '../../lib/chat-spend-send'
import { sessionGbpFromCostsPayload } from '../../lib/session-spend'
import { workspaceOwnedBy } from '../../lib/product-scope-copy'
import { useActiveProduct } from '../../lib/use-active-product'
import { measureHtmlMediaDurationFrames } from '../../lib/measure-media-duration'
import type { PlaceAssetOptions } from './story-preview-helpers'
import { PLAN_CONFIRMED_GENERATE_MESSAGE } from '@synawood/creative/agent/plan-confirmed-message'
import {
  markRenderJobDismissed,
  readDismissedRenderJob,
  shouldHydrateLatestRenderJob,
  videoDownloadUrlFromOutputs,
} from '../../lib/studio-render-job'

type ProjectResponse = {
  project: StudioProject & {
    assets: Array<StudioProject['assets'][number] & { signedUrl?: string }>
  }
  summary: { headline: string }
  history?: { canUndo: boolean; canRedo: boolean; historyTip: number }
  row?: {
    modelProfileId?: string
    reasonerModelId?: string | null
    videoModelId?: string | null
    parentProjectId?: string | null
    historyTip?: number
  }
  error?: string
}

type HistoryState = {
  canUndo: boolean
  canRedo: boolean
  historyTip: number
}

type RenderResponse = {
  job?: { id: string; status: string; errorMessage?: string | null }
  error?: string
}

type RenderStatusResponse = {
  job?: { id: string; status: string; errorMessage?: string | null }
  outputs?: Array<{ kind: string; signedUrl: string }>
  error?: string
}

type ExtractJobState = {
  id: string
  status: string
  errorMessage?: string | null
  estimatedGbp?: number | null
}

type ExtractBriefPreview = {
  id: string
  productName?: string
  oneLiner?: string
  hooks?: string[]
}

type ExtractStatusResponse = {
  job?: ExtractJobState | null
  brief?: {
    id: string
    brief: {
      product?: { name?: string; oneLiner?: string }
      messaging?: { hookCandidates?: string[] }
    }
  } | null
  estimatedGbp?: number
  inlineLocal?: boolean
  workerHint?: string | null
  applied?: boolean
  error?: string
}

const briefPreviewFromResponse = (
  payload: ExtractStatusResponse['brief'],
): ExtractBriefPreview | null => {
  if (!payload) return null
  return {
    id: payload.id,
    productName: payload.brief.product?.name,
    oneLiner: payload.brief.product?.oneLiner,
    hooks: payload.brief.messaging?.hookCandidates,
  }
}

type QueuedTimelineMutation = {
  mutation: StudioMutation
  resolve: () => void
}

const isSlideshowCompositionId = (compositionId: string): boolean =>
  compositionId === 'social-carousel' || compositionId === 'vertical-slideshow'

const costFromToolPayload = (payload: Record<string, unknown>): number => {
  const outcome = payload.outcome as
    { ok?: boolean; data?: { actualGbp?: number; estimatedGbp?: number } } | undefined
  if (!outcome?.ok || !outcome.data) return 0
  const value = outcome.data.actualGbp ?? outcome.data.estimatedGbp ?? 0
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

const workspaceStatusLabel = (status: string): string => {
  switch (status) {
    case 'drafting':
      return 'Draft'
    case 'rendering':
      return 'Exporting'
    case 'needs_review':
      return 'Needs review'
    case 'approved':
      return 'Approved'
    case 'killed':
      return 'Discarded'
    default:
      return status
  }
}

const parseSseChunks = function* (buffer: string): Generator<{ event: string; data: string }> {
  const parts = buffer.split('\n\n')
  for (const part of parts) {
    if (!part.trim()) continue
    let event = 'message'
    const dataLines: string[] = []
    for (const line of part.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
    }
    if (dataLines.length) {
      yield { event, data: dataLines.join('\n') }
    }
  }
}

export const StudioWorkspace = ({ projectId }: { projectId: string }) => {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const { products } = useActiveProduct()
  const [project, setProject] = useState<ProjectResponse['project'] | null>(null)
  const [headline, setHeadline] = useState('')
  const [messages, setMessages] = useState<StudioChatMessage[]>([])
  const [chatThreads, setChatThreads] = useState<ChatThreadSummary[]>([])
  const [error, setErrorRaw] = useState<string | null>(null)
  const setError = useCallback((message: string | null) => {
    setErrorRaw(message ? humanizeStudioError(message) : null)
  }, [])
  const [chatError, setChatError] = useState<string | null>(null)
  const [renderJob, setRenderJob] = useState<RenderResponse['job'] | null>(null)
  const [renderDownloadUrl, setRenderDownloadUrl] = useState<string | null>(null)
  const [renderReadyDismissed, setRenderReadyDismissed] = useState(false)
  const [renderModalOpen, setRenderModalOpen] = useState(false)
  const [cancelRenderPending, setCancelRenderPending] = useState(false)
  const [extractJob, setExtractJob] = useState<ExtractJobState | null>(null)
  const [extractBrief, setExtractBrief] = useState<ExtractBriefPreview | null>(null)
  const [extractApplied, setExtractApplied] = useState(false)
  const [extractHydrated, setExtractHydrated] = useState(false)
  const [extractModalOpen, setExtractModalOpen] = useState(false)
  const [extractUrl, setExtractUrl] = useState('')
  const [extractPending, setExtractPending] = useState(false)
  const [extractWorkerHint, setExtractWorkerHint] = useState<string | null>(null)
  const [extractFormError, setExtractFormError] = useState<string | null>(null)
  const [applyBriefPending, setApplyBriefPending] = useState(false)
  const [modelProfileId, setModelProfileId] = useState<string>(DEFAULT_MODEL_PROFILE_ID)
  const [reasonerModelId, setReasonerModelId] = useState<string | null>(null)
  const [videoModelId, setVideoModelId] = useState<string | null>(null)
  const [turnMode, setTurnMode] = useState<TurnMode>(DEFAULT_TURN_MODE)
  // Derived: plan modal and banner are only relevant when video generation is enabled.
  const videoGenEnabled = Boolean(videoModelId) && !isVideoOffModelId(videoModelId!)
  const [reasonerSaving, setReasonerSaving] = useState(false)
  const [confirmSpend, setConfirmSpend] = useState(() => loadConfirmSpendPreference(projectId))
  const [modelCatalogueOpen, setModelCatalogueOpen] = useState(false)
  const [stylePackBusy, setStylePackBusy] = useState(false)
  const [dismissedFailedJobIds, setDismissedFailedJobIds] = useState<Set<string>>(() => new Set())
  const [dismissalsReady, setDismissalsReady] = useState(false)
  const { jobs: generationJobs } = useProjectGenerationJobs(projectId)

  useEffect(() => {
    setConfirmSpend(loadConfirmSpendPreference(projectId))
  }, [projectId])

  const onConfirmSpendChange = useCallback(
    (allowed: boolean) => {
      setConfirmSpend(allowed)
      persistConfirmSpendPreference(projectId, allowed)
    },
    [projectId],
  )

  useEffect(() => {
    setDismissalsReady(false)
    setDismissedFailedJobIds(loadDismissedFailedGenerationJobs(projectId))
    setDismissalsReady(true)
  }, [projectId])

  const rememberDismissedFailed = (jobIds: string[]) => {
    setDismissedFailedJobIds((current) => {
      const next = new Set(current)
      for (const id of jobIds) next.add(id)
      persistDismissedFailedGenerationJobs(projectId, next)
      return next
    })
  }
  const [sessionGbp, setSessionGbp] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const response = await fetch(`/api/studio/projects/${projectId}/costs`)
      if (!response.ok || cancelled) return
      const body: unknown = await response.json().catch(() => null)
      if (cancelled) return
      setSessionGbp(sessionGbpFromCostsPayload(body))
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])
  const [brandStudioOpen, setBrandStudioOpen] = useState(false)
  const [adGeneratorOpen, setAdGeneratorOpen] = useState(false)
  const [firstCutMode, setFirstCutMode] = useState<string | null>(null)
  const [variantGridOpen, setVariantGridOpen] = useState(false)
  const [musicPanelOpen, setMusicPanelOpen] = useState(false)
  const [voicePanelOpen, setVoicePanelOpen] = useState(false)
  const [signOffOpen, setSignOffOpen] = useState(false)
  const [approvalStages, setApprovalStages] = useState<
    Array<{ key: string; label: string; minRole: string }>
  >([])
  const [approvalStageIndex, setApprovalStageIndex] = useState(0)
  const [approvalStatus, setApprovalStatus] = useState('open')
  const [variantChildEditorOpen, setVariantChildEditorOpen] = useState(false)
  const [parentProjectId, setParentProjectId] = useState<string | null>(null)
  const { siblings: variantSiblings, reload: reloadVariantSiblings } = useVariantSiblings({
    projectId,
    parentProjectId,
  })
  const [reviewPending, setReviewPending] = useState(false)
  const [pending, startTransition] = useTransition()
  const [chatPending, setChatPending] = useState(false)
  const [mutationPending, setMutationPending] = useState(false)
  const [queuedEditPending, setQueuedEditPending] = useState(false)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [previewZoom, setPreviewZoom] = useState(1)
  const [playerFullscreen, setPlayerFullscreen] = useState(false)
  const [history, setHistory] = useState<HistoryState>({
    canUndo: false,
    canRedo: false,
    historyTip: 1,
  })
  const [brandOpen, setBrandOpen] = useState(false)
  const [editsOpen, setEditsOpen] = useState(false)
  const [binDragOver, setBinDragOver] = useState(false)
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null)
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [timelineSelectedClipIds, setTimelineSelectedClipIds] = useState<string[]>([])
  const [timelineSelectedOverlayIds, setTimelineSelectedOverlayIds] = useState<string[]>([])
  const [captionLine, setCaptionLine] = useState('')
  const [captionSpendPrompt, setCaptionSpendPrompt] = useState<string | null>(null)
  const [captionStyleId, setCaptionStyleId] = useState<CaptionStyleId>('band')
  const [stickerBusy, setStickerBusy] = useState(false)
  const [sfxBusy, setSfxBusy] = useState(false)
  const [directorPlan, setDirectorPlan] = useState<DirectorPlan | null>(null)
  const [directorModalOpen, setDirectorModalOpen] = useState(false)
  const [directorBusy, setDirectorBusy] = useState(false)
  const [directorError, setDirectorError] = useState<string | null>(null)
  const [genPlanModalOpen, setGenPlanModalOpen] = useState(false)
  const [genPlanBusy, setGenPlanBusy] = useState(false)
  const [genPlanError, setGenPlanError] = useState<string | null>(null)
  const genPlanIdSeenRef = useRef<string | null>(null)
  const [genPlanGeneratePending, setGenPlanGeneratePending] = useState(false)
  const [chromeDismissEpoch, setChromeDismissEpoch] = useState(0)
  const [contextualOpen, setContextualOpen] = useState(false)
  const [pipDraft, setPipDraft] = useState<PipLayout | null>(null)
  const [overlayLayoutDraft, setOverlayLayoutDraft] = useState<OverlayLayout | null>(null)
  const [suggestionsDismissedClipIds, setSuggestionsDismissedClipIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [chatSpendBlock, setChatSpendBlock] = useState<ChatSpendBlockReason | null>(null)

  const billing = useBillingSummary(project?.productId ?? null)
  const showTrialWatermark =
    billing.billingEnabled && !billing.loading && billing.watermarkExports === true

  const pipSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const projectRef = useRef<ProjectResponse['project'] | null>(null)
  const playerRef = useRef<PlayerRef | null>(null)
  const chatPendingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const queuedMutationsRef = useRef<QueuedTimelineMutation[]>([])
  const mutationChainRef = useRef<Promise<void>>(Promise.resolve())
  const [liveToolNames, setLiveToolNames] = useState<string[]>([])
  const [liveThoughts, setLiveThoughts] = useState<ChatLiveThought[]>([])
  const insertTokenRef = useRef<((token: string) => void) | null>(null)
  const pendingMentionRef = useRef<string | null>(null)

  const acceptProject = useCallback((next: ProjectResponse['project']) => {
    projectRef.current = next
    setProject(next)
    setCurrentFrame((frame) => Math.min(frame, Math.max(0, next.durationFrames - 1)))
    setTurnMode((current) => parseTurnMode(next.turnMode ?? current))
  }, [])

  const patchProjectFields = useCallback(
    (body: { turnMode?: TurnMode; craft?: StudioCraft }) => {
      void fetch(`/api/studio/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (response) => {
        const payload = (await response.json().catch(() => null)) as {
          project?: StudioProject
        } | null
        if (response.ok && payload?.project) acceptProject(payload.project)
      })
    },
    [acceptProject, projectId],
  )

  const acceptProjectPreservingAssets = useCallback(
    (next: StudioProject) => {
      const current = projectRef.current
      acceptProject({
        ...next,
        assets: current?.assets ?? next.assets,
      } as ProjectResponse['project'])
    },
    [acceptProject],
  )

  const scenePlan = useScenePlanProgress({
    projectId,
    revision: project?.revision ?? 0,
    onProjectChanged: acceptProjectPreservingAssets,
    onError: setError,
  })

  const loadDirectorDraft = useCallback(async () => {
    try {
      const response = await fetch(`/api/studio/projects/${projectId}/director`)
      const body = (await response.json()) as { plan?: DirectorPlan | null; error?: string }
      if (!response.ok) return
      if (body.plan && (body.plan.status === 'draft' || body.plan.status === 'stale')) {
        setDirectorPlan(body.plan)
      }
    } catch {
      /* reload pill is best-effort */
    }
  }, [projectId])

  useEffect(() => {
    void loadDirectorDraft()
  }, [loadDirectorDraft])

  useEffect(() => {
    const caption = project?.overlays.find((overlay) => overlay.kind === 'caption')
    const presetId = caption?.style?.presetId
    if (isCaptionStyleId(presetId)) setCaptionStyleId(presetId)
  }, [project?.id, project?.revision, project?.overlays])

  const clearDirectorRebuildPrompt = useCallback(
    async (opts?: {
      rebindPlanId?: string
    }): Promise<{ ok: boolean; plan?: DirectorPlan | null }> => {
      const current = projectRef.current
      if (!current?.directorRebuildPrompt && !opts?.rebindPlanId) return { ok: true }
      try {
        const response = await fetch(`/api/studio/projects/${projectId}/director/rebuild-prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedRevision: current?.revision,
            rebindPlanId: opts?.rebindPlanId,
          }),
        })
        const body = (await response.json()) as {
          project?: StudioProject
          plan?: DirectorPlan | null
          error?: string
        }
        if (!response.ok) {
          setError(body.error ?? 'Failed to clear rebuild prompt')
          return { ok: false }
        }
        if (body.project) acceptProjectPreservingAssets(body.project)
        return { ok: true, plan: body.plan ?? null }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to clear rebuild prompt')
        return { ok: false }
      }
    },
    [acceptProjectPreservingAssets, projectId],
  )

  const onPreviewDirector = useCallback(
    async (input: {
      style?: string
      intentOverrides?: Partial<Intent>
      scope?: DirectorPlan['scope']
      refinement?: { priorPlanId: string; note: string }
    }) => {
      const current = projectRef.current
      if (!current) return
      setDirectorBusy(true)
      setDirectorError(null)
      setDirectorModalOpen(true)
      try {
        const response = await fetch(`/api/studio/projects/${projectId}/director`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedRevision: current.revision,
            dryRun: true,
            style: input.style,
            intentOverrides: input.intentOverrides,
            scope: input.scope,
            refinement: input.refinement,
          }),
        })
        const body = (await response.json()) as {
          plan?: DirectorPlan
          error?: string
          project?: StudioProject
        }
        if (!response.ok || !body.plan) {
          setDirectorError(body.error ?? 'Director preview failed')
          return
        }
        setDirectorPlan(body.plan)
        if (body.project) acceptProjectPreservingAssets(body.project)

        const cleared = await clearDirectorRebuildPrompt({ rebindPlanId: body.plan.id })
        if (cleared.ok && cleared.plan) {
          setDirectorPlan(cleared.plan)
        } else if (cleared.ok) {
          const next = projectRef.current
          if (next) {
            setDirectorPlan({ ...body.plan, projectRevision: next.revision, status: 'draft' })
          }
        }
      } catch (err) {
        setDirectorError(err instanceof Error ? err.message : 'Director preview failed')
      } finally {
        setDirectorBusy(false)
      }
    },
    [acceptProjectPreservingAssets, clearDirectorRebuildPrompt, projectId],
  )

  const onCommitDirector = useCallback(
    async (excludeMutationIds: string[]) => {
      const current = projectRef.current
      if (!current || !directorPlan) return
      setDirectorBusy(true)
      setDirectorError(null)
      try {
        const response = await fetch(`/api/studio/projects/${projectId}/director/commit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedRevision: current.revision,
            planId: directorPlan.id,
            excludeMutationIds,
          }),
        })
        const body = (await response.json()) as {
          plan?: DirectorPlan
          error?: string
          project?: StudioProject
        }
        if (!response.ok || !body.project) {
          setDirectorError(body.error ?? 'Failed to apply Director plan')
          return
        }
        acceptProjectPreservingAssets(body.project)
        setDirectorPlan(null)
        setDirectorModalOpen(false)
      } catch (err) {
        setDirectorError(err instanceof Error ? err.message : 'Failed to apply Director plan')
      } finally {
        setDirectorBusy(false)
      }
    },
    [acceptProjectPreservingAssets, directorPlan, projectId],
  )

  const onRejectDirector = useCallback(async () => {
    const current = projectRef.current
    if (!current || !directorPlan) return
    setDirectorBusy(true)
    setDirectorError(null)
    try {
      const response = await fetch(`/api/studio/projects/${projectId}/director/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRevision: current.revision,
          planId: directorPlan.id,
        }),
      })
      const body = (await response.json()) as {
        plan?: DirectorPlan
        error?: string
        project?: StudioProject
      }
      if (!response.ok) {
        setDirectorError(body.error ?? 'Failed to reject Director plan')
        return
      }
      if (body.project) acceptProjectPreservingAssets(body.project)
      setDirectorPlan(null)
      setDirectorModalOpen(false)
    } catch (err) {
      setDirectorError(err instanceof Error ? err.message : 'Failed to reject Director plan')
    } finally {
      setDirectorBusy(false)
    }
  }, [acceptProjectPreservingAssets, directorPlan, projectId])

  const onRefineDirector = useCallback(
    (note: string) => {
      if (!directorPlan) return
      void onPreviewDirector({
        style: directorPlan.style,
        refinement: { priorPlanId: directorPlan.id, note },
      })
    },
    [directorPlan, onPreviewDirector],
  )

  chatPendingRef.current = chatPending

  const mediaPane = usePaneCollapse('mos.studio.mediaCollapsed')
  const chatPane = usePaneCollapse('mos.studio.chatCollapsed')
  const [railOverlayOpen, setRailOverlayOpen] = useState(false)
  const timelinePane = usePaneCollapse('mos.studio.timelineCollapsed')
  const scenesPane = usePaneCollapse('mos.studio.scenesCollapsed')
  const transcriptPane = usePaneCollapse('mos.studio.transcriptCollapsed')

  const mentionInChat = useCallback(
    (token: string) => {
      if (chatPane.collapsed) {
        pendingMentionRef.current = token
        chatPane.expand()
        return
      }
      insertTokenRef.current?.(token)
    },
    [chatPane.collapsed, chatPane.expand],
  )

  useEffect(() => {
    if (chatPane.collapsed) return
    const token = pendingMentionRef.current
    if (!token) return
    pendingMentionRef.current = null
    const id = window.setTimeout(() => insertTokenRef.current?.(token), 0)
    return () => window.clearTimeout(id)
  }, [chatPane.collapsed])

  const [layoutMode, setLayoutMode] = useState<'wide' | 'stack'>('wide')
  const [stackTab, setStackTab] = useState<'preview' | 'media' | 'chat'>('preview')
  const leftPane = useDragResize({
    storageKey: 'mos.studio.leftPane',
    initial: 280,
    min: 200,
    max: 420,
    direction: 'horizontal',
    enabled: !mediaPane.collapsed,
  })
  const rightPane = useDragResize({
    storageKey: 'mos.studio.rightPane',
    initial: 340,
    min: 280,
    max: 560,
    direction: 'horizontal',
    invert: true,
    enabled: !chatPane.collapsed,
  })
  const timelineHeight = useDragResize({
    storageKey: 'mos.studio.timelineHeight',
    initial: 220,
    min: 140,
    max: 520,
    direction: 'vertical',
    invert: true,
    enabled: !timelinePane.collapsed,
  })

  useEffect(() => {
    const stack = window.matchMedia(STUDIO_STACK_MEDIA_QUERY)
    const sync = () => {
      setLayoutMode(studioLayoutModeForWidth(window.innerWidth))
    }
    sync()
    stack.addEventListener('change', sync)
    return () => {
      stack.removeEventListener('change', sync)
    }
  }, [])

  const expandMedia = useCallback(() => {
    sessionStorage.setItem('mos.studio.keepMediaOpen', '1')
    mediaPane.expand()
  }, [mediaPane])

  const panesGridColumns = [
    mediaPane.collapsed ? '40px' : `minmax(0, ${leftPane.size}px)`,
    mediaPane.collapsed ? '0' : '5px',
    'minmax(200px, 1fr)',
  ].join(' ')

  const loadLatestRender = useCallback(async () => {
    const response = await fetch(`/api/studio/projects/${projectId}/render`)
    if (!response.ok) return
    const body = (await response.json()) as RenderStatusResponse
    if (body.job && shouldHydrateLatestRenderJob(body.job)) {
      setRenderJob(body.job)
      setRenderDownloadUrl(videoDownloadUrlFromOutputs(body.outputs))
      setRenderReadyDismissed(
        body.job.status === 'completed' && readDismissedRenderJob(body.job.id),
      )
      if (body.job.status === 'queued' || body.job.status === 'rendering') {
        setRenderModalOpen(true)
      }
    }
  }, [projectId])

  const loadLatestExtract = useCallback(async () => {
    setExtractHydrated(false)
    try {
      const response = await fetch(`/api/studio/projects/${projectId}/extract`)
      if (!response.ok) return
      const body = (await response.json()) as ExtractStatusResponse
      if (body.job) {
        setExtractJob(body.job)
        setExtractBrief(briefPreviewFromResponse(body.brief ?? null))
        setExtractApplied(Boolean(body.applied))
        setExtractWorkerHint(body.workerHint ?? null)
        if (body.job.status === 'queued' || body.job.status === 'generating') {
          setExtractModalOpen(true)
        }
      } else {
        setExtractApplied(false)
      }
    } finally {
      setExtractHydrated(true)
    }
  }, [projectId])

  const loadProject = useCallback(async () => {
    setError(null)
    const response = await fetch(`/api/studio/projects/${projectId}`)
    const body = (await response.json()) as ProjectResponse
    if (!response.ok) {
      setError(body.error ?? 'Failed to load project')
      return
    }
    acceptProject(body.project)
    if (body.history) setHistory(body.history)
    setHeadline(body.summary.headline)
    if (body.row?.modelProfileId) {
      setModelProfileId(body.row.modelProfileId)
    }
    if (body.row && 'reasonerModelId' in body.row) {
      setReasonerModelId(body.row.reasonerModelId ?? null)
    }
    if (body.row && 'videoModelId' in body.row) {
      setVideoModelId(body.row.videoModelId ?? null)
    }
    if (body.row && 'parentProjectId' in body.row) {
      setParentProjectId(body.row.parentProjectId ?? null)
    }
    // Auto-open generation plan modal when agent drafts a new plan (plan id changes).
    const loadedPlan = body.project.generationPlan
    const rawVideoModelId =
      body.row && 'videoModelId' in body.row ? (body.row.videoModelId ?? null) : null
    const videoOnInResponse = Boolean(rawVideoModelId) && !isVideoOffModelId(rawVideoModelId!)
    if (
      loadedPlan &&
      videoOnInResponse &&
      (loadedPlan.status === 'draft' || loadedPlan.status === 'ready') &&
      loadedPlan.id !== genPlanIdSeenRef.current
    ) {
      genPlanIdSeenRef.current = loadedPlan.id
      setGenPlanModalOpen(true)
      setGenPlanError(null)
    }
    try {
      const govRes = await fetch(`/api/studio/projects/${projectId}/approvals`)
      const gov = (await govRes.json()) as {
        policy?: { body?: { stages?: Array<{ key: string; label: string; minRole: string }> } }
        run?: {
          stages?: Array<{ key: string; label: string; minRole: string }>
          currentStageIndex?: number
          status?: string
        } | null
      }
      if (govRes.ok) {
        setApprovalStages(gov.run?.stages ?? gov.policy?.body?.stages ?? [])
        setApprovalStageIndex(gov.run?.currentStageIndex ?? 0)
        setApprovalStatus(gov.run?.status ?? 'open')
      }
    } catch {
      /* governance chip is best-effort */
    }
  }, [acceptProject, projectId])

  const onGenPlanSaveDraft = useCallback(
    async (patch: GenerationPlanPatch) => {
      const current = projectRef.current
      if (!current?.generationPlan) return
      setGenPlanBusy(true)
      setGenPlanError(null)
      try {
        const response = await fetch(
          `/api/studio/projects/${encodeURIComponent(projectId)}/generation-plan`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expectedRevision: current.revision, ...patch }),
          },
        )
        const body = (await response.json()) as {
          plan?: unknown
          revision?: number
          error?: string
        }
        if (!response.ok) {
          setGenPlanError(body.error ?? 'Failed to save plan')
          return
        }
        await loadProject()
      } catch (err) {
        setGenPlanError(err instanceof Error ? err.message : 'Failed to save plan')
      } finally {
        setGenPlanBusy(false)
      }
    },
    [loadProject, projectId],
  )

  const onGenPlanDiscard = useCallback(async () => {
    const current = projectRef.current
    if (!current?.generationPlan) return
    setGenPlanBusy(true)
    setGenPlanError(null)
    try {
      const response = await fetch(
        `/api/studio/projects/${encodeURIComponent(projectId)}/generation-plan`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedRevision: current.revision,
            scenes: current.generationPlan.scenes,
          }),
        },
      )
      if (!response.ok) {
        const body = (await response.json()) as { error?: string }
        setGenPlanError(body.error ?? 'Failed to discard plan')
        return
      }
      setGenPlanModalOpen(false)
      genPlanIdSeenRef.current = null
      await loadProject()
    } catch (err) {
      setGenPlanError(err instanceof Error ? err.message : 'Failed to discard plan')
    } finally {
      setGenPlanBusy(false)
    }
  }, [loadProject, projectId])

  const onGenPlanConfirm = useCallback(
    async (patch: GenerationPlanPatch) => {
      const current = projectRef.current
      if (!current?.generationPlan) return
      setGenPlanBusy(true)
      setGenPlanError(null)
      try {
        const patchResponse = await fetch(
          `/api/studio/projects/${encodeURIComponent(projectId)}/generation-plan`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expectedRevision: current.revision, ...patch }),
          },
        )
        if (!patchResponse.ok) {
          const body = (await patchResponse.json()) as { error?: string }
          setGenPlanError(body.error ?? 'Failed to save plan edits')
          return
        }
        await loadProject()
        const updated = projectRef.current
        if (!updated?.generationPlan) return
        const confirmResponse = await fetch(
          `/api/studio/projects/${encodeURIComponent(projectId)}/generation-plan`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              expectedRevision: updated.revision,
              planId: updated.generationPlan.id,
            }),
          },
        )
        if (!confirmResponse.ok) {
          const body = (await confirmResponse.json()) as { error?: string }
          setGenPlanError(body.error ?? 'Failed to confirm plan')
          return
        }
        setGenPlanModalOpen(false)
        await loadProject()
        // Signal the generate turn (ADR-0055/0086): plan is now 'ready';
        // the next send with confirmSpend=true will force generate_video_clip.
        setGenPlanGeneratePending(true)
      } catch (err) {
        setGenPlanError(err instanceof Error ? err.message : 'Failed to confirm plan')
      } finally {
        setGenPlanBusy(false)
      }
    },
    [loadProject, projectId],
  )

  const localeActions = useLocaleProjectActions({
    projectId,
    project,
    confirmSpend,
    onProjectChanged: (next) => acceptProjectPreservingAssets(next as ProjectResponse['project']),
    onError: setError,
    onRevisionConflict: loadProject,
  })

  const onSaveDirectorAsBranch = useCallback(
    async (excludeMutationIds: string[], input: { branchName: string; switchAfter: boolean }) => {
      const current = projectRef.current
      if (!current || !directorPlan) return
      setDirectorBusy(true)
      setDirectorError(null)
      try {
        const response = await fetch(`/api/studio/projects/${projectId}/director/save-as-branch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedRevision: current.revision,
            planId: directorPlan.id,
            branchName: input.branchName,
            excludeMutationIds,
            switchAfter: input.switchAfter,
          }),
        })
        const body = (await response.json()) as {
          plan?: DirectorPlan
          error?: string
          project?: StudioProject
        }
        if (!response.ok || !body.project) {
          if (response.status === 409) await loadProject()
          setDirectorError(body.error ?? 'Failed to save Director plan as branch')
          return
        }
        acceptProjectPreservingAssets(body.project)
        setDirectorPlan(null)
        setDirectorModalOpen(false)
      } catch (err) {
        setDirectorError(
          err instanceof Error ? err.message : 'Failed to save Director plan as branch',
        )
      } finally {
        setDirectorBusy(false)
      }
    },
    [acceptProjectPreservingAssets, directorPlan, loadProject, projectId],
  )

  const executeMutation = useCallback(
    async (mutation: StudioMutation) => {
      const current = projectRef.current
      if (!current) return
      setMutationPending(true)
      setError(null)
      try {
        const response = await fetch(`/api/studio/projects/${projectId}/mutations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedRevision: current.revision, mutation }),
        })
        const body = (await response.json()) as {
          project?: StudioProject
          history?: HistoryState
          error?: string
          traceWarning?: string
        }
        if (response.status === 409) {
          // Sync to the server revision before the mutation chain continues.
          await loadProject()
          throw new Error(body.error ?? 'Timeline edit failed')
        }
        if (!response.ok || !body.project) {
          throw new Error(body.error ?? 'Timeline edit failed')
        }
        const signedUrlById = new Map(
          current.assets.map((asset) => [
            asset.id,
            'signedUrl' in asset && typeof asset.signedUrl === 'string'
              ? asset.signedUrl
              : undefined,
          ]),
        )
        acceptProject({
          ...body.project,
          assets: body.project.assets.map((asset) => ({
            ...asset,
            signedUrl: signedUrlById.get(asset.id),
          })),
        })
        if (body.history) setHistory(body.history)
        if (body.traceWarning) setError(`Edit saved; trace warning: ${body.traceWarning}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Timeline edit failed')
        throw err
      } finally {
        setMutationPending(false)
      }
    },
    [acceptProject, loadProject, projectId],
  )

  const persistPipLayout = useCallback(
    async (patch: Record<string, unknown>) => {
      const current = projectRef.current
      if (!current) return
      setError(null)
      try {
        const response = await fetch(`/api/studio/projects/${projectId}/pip-layout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedRevision: current.revision, ...patch }),
        })
        const body = (await response.json().catch(() => null)) as {
          project?: StudioProject
          error?: string
        } | null
        if (response.status === 409) {
          await loadProject()
          setPipDraft(null)
          return
        }
        if (!response.ok) {
          throw new Error(body?.error ?? 'Could not update picture layout.')
        }
        if (body?.project) {
          acceptProjectPreservingAssets(body.project)
        } else {
          await loadProject()
        }
        setPipDraft(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update picture layout.')
      }
    },
    [acceptProjectPreservingAssets, loadProject, projectId],
  )

  const onSetStylePack = useCallback(
    async (packId: string | null) => {
      const current = projectRef.current
      if (!current) return
      setStylePackBusy(true)
      setError(null)
      try {
        const response = await fetch(`/api/studio/projects/${projectId}/style-pack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedRevision: current.revision, packId }),
        })
        const body = (await response.json().catch(() => null)) as {
          project?: StudioProject
          error?: string
        } | null
        if (response.status === 409) {
          await loadProject()
          return
        }
        if (!response.ok) {
          throw new Error(body?.error ?? 'Could not apply look.')
        }
        if (body?.project) {
          acceptProjectPreservingAssets(body.project)
        } else {
          await loadProject()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not apply look.')
        throw err
      } finally {
        setStylePackBusy(false)
      }
    },
    [acceptProjectPreservingAssets, loadProject, projectId, setError],
  )

  const onPlaceSfx = useCallback(
    async (packId: string, from?: number) => {
      const current = projectRef.current
      if (!current) return
      setSfxBusy(true)
      setError(null)
      try {
        const response = await fetch(`/api/studio/projects/${projectId}/sfx`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedRevision: current.revision,
            packId,
            from: from ?? currentFrame,
          }),
        })
        const body = (await response.json().catch(() => null)) as {
          project?: StudioProject
          error?: string
        } | null
        if (response.status === 409) {
          await loadProject()
          setError('The cut changed. Place the sound again.')
          return
        }
        if (!response.ok) {
          throw new Error(body?.error ?? 'Could not place that sound.')
        }
        if (body?.project) {
          acceptProjectPreservingAssets(body.project)
        } else {
          await loadProject()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not place that sound.')
      } finally {
        setSfxBusy(false)
      }
    },
    [acceptProjectPreservingAssets, currentFrame, loadProject, projectId, setError],
  )

  const onPlaceSticker = useCallback(
    async (stickerId: string, from?: number) => {
      const current = projectRef.current
      if (!current) return
      setStickerBusy(true)
      setError(null)
      try {
        const response = await fetch(`/api/studio/projects/${projectId}/stickers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedRevision: current.revision,
            stickerId,
            from: from ?? currentFrame,
            durationInFrames: 90,
          }),
        })
        const body = (await response.json().catch(() => null)) as {
          project?: StudioProject
          error?: string
        } | null
        if (response.status === 409) {
          await loadProject()
          return
        }
        if (!response.ok) {
          throw new Error(body?.error ?? 'Could not place sticker.')
        }
        if (body?.project) {
          acceptProjectPreservingAssets(body.project)
        } else {
          await loadProject()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not place sticker.')
      } finally {
        setStickerBusy(false)
      }
    },
    [acceptProjectPreservingAssets, currentFrame, loadProject, projectId, setError],
  )

  const onCommitPipLayout = useCallback(
    (layout: PipLayout) => {
      setPipDraft(layout)
      if (pipSaveTimerRef.current) clearTimeout(pipSaveTimerRef.current)
      void persistPipLayout({
        mode: layout.mode,
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height,
        axis: layout.axis,
        mainPct: layout.mainPct,
        mainSide: layout.mainSide,
      })
    },
    [persistPipLayout],
  )

  const onPreviewPipLayout = useCallback((layout: PipLayout) => {
    setPipDraft(layout)
  }, [])

  const onPipLayoutSlider = useCallback(
    (layout: PipLayout) => {
      setPipDraft(layout)
      if (pipSaveTimerRef.current) clearTimeout(pipSaveTimerRef.current)
      pipSaveTimerRef.current = setTimeout(() => {
        void persistPipLayout({
          mode: layout.mode,
          x: layout.x,
          y: layout.y,
          width: layout.width,
          height: layout.height,
          axis: layout.axis,
          mainPct: layout.mainPct,
          mainSide: layout.mainSide,
        })
      }, 180)
    },
    [persistPipLayout],
  )

  const onTimelineMutate = useCallback(
    async (mutation: StudioMutation) => {
      let nextMutation = mutation
      if (mutation.type === 'add_clip' && mutation.durationInFrames == null && projectRef.current) {
        const current = projectRef.current
        const asset = current.assets.find((entry) => entry.id === mutation.assetId)
        const probed =
          typeof asset?.probe?.durationFrames === 'number' && asset.probe.durationFrames > 0
            ? asset.probe.durationFrames
            : null
        if (!probed && asset && (asset.kind === 'video' || asset.kind === 'audio')) {
          const frames = await measureHtmlMediaDurationFrames(
            `/api/studio/projects/${projectId}/assets/${asset.id}/content`,
            current.fps,
            asset.kind,
          )
          if (frames) {
            nextMutation = { ...mutation, durationInFrames: frames }
          }
        }
      }
      if (chatPendingRef.current) {
        setQueuedEditPending(true)
        try {
          await new Promise<void>((resolve) => {
            queuedMutationsRef.current.push({ mutation: nextMutation, resolve })
          })
        } finally {
          setQueuedEditPending(false)
        }
        return
      }
      const task = mutationChainRef.current
        .catch(() => undefined)
        .then(() => executeMutation(nextMutation))
      mutationChainRef.current = task.then(
        () => undefined,
        () => undefined,
      )
      await task
    },
    [executeMutation, projectId],
  )

  const postCaptionFromTranscript = useCallback(
    async (confirmSpend: boolean) => {
      const current = projectRef.current
      const clipId = timelineSelectedClipIds[0]
      if (!current || !clipId) return
      setMutationPending(true)
      setError(null)
      try {
        const response = await fetch(`/api/studio/projects/${projectId}/captions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'from_transcript',
            expectedRevision: current.revision,
            clipId,
            confirmSpend,
          }),
        })
        const body = (await response.json()) as { project?: StudioProject; error?: string }
        if (!response.ok) {
          const message = body.error ?? 'Could not build captions from transcript'
          if (/confirmSpend/i.test(message)) {
            setCaptionSpendPrompt(message)
            return
          }
          throw new Error(message)
        }
        setCaptionSpendPrompt(null)
        if (body.project) acceptProjectPreservingAssets(body.project)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not build captions from transcript')
      } finally {
        setMutationPending(false)
      }
    },
    [acceptProjectPreservingAssets, projectId, timelineSelectedClipIds],
  )

  // Collapse hour-scale dead air left by grow-only duration (ADR-0014 clarification).
  const autoFitAppliedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!project) return
    if (autoFitAppliedRef.current === project.id) return
    const contentEnd = Math.max(
      0,
      ...project.clips.map((clip) => clip.from + clip.durationInFrames),
      ...project.overlays.map((overlay) => overlay.from + overlay.durationInFrames),
    )
    const deadAirFrames = project.durationFrames - contentEnd
    // Fit when more than ~2s of blank remains after content (60s presets often dwarf short cuts).
    if (contentEnd > 0 && deadAirFrames > project.fps * 2) {
      autoFitAppliedRef.current = project.id
      void onTimelineMutate({ type: 'fit_duration' })
    }
  }, [project, onTimelineMutate])

  const onHistoryAction = useCallback(
    async (action: 'undo' | 'redo') => {
      const current = projectRef.current
      if (!current || chatPendingRef.current) return
      setMutationPending(true)
      setError(null)
      try {
        const response = await fetch(`/api/studio/projects/${projectId}/history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedRevision: current.revision, action }),
        })
        const body = (await response.json()) as {
          project?: StudioProject
          history?: HistoryState
          error?: string
        }
        if (response.status === 409) {
          await loadProject()
          throw new Error(body.error ?? `${action} failed`)
        }
        if (!response.ok || !body.project) {
          throw new Error(body.error ?? `${action} failed`)
        }
        const signedUrlById = new Map(
          current.assets.map((asset) => [
            asset.id,
            'signedUrl' in asset && typeof asset.signedUrl === 'string'
              ? asset.signedUrl
              : undefined,
          ]),
        )
        acceptProject({
          ...body.project,
          assets: body.project.assets.map((asset) => ({
            ...asset,
            signedUrl: signedUrlById.get(asset.id),
          })),
        })
        if (body.history) setHistory(body.history)
      } catch (err) {
        setError(err instanceof Error ? err.message : `${action} failed`)
      } finally {
        setMutationPending(false)
      }
    },
    [acceptProject, loadProject, projectId],
  )

  useEffect(() => {
    if (chatPending || queuedMutationsRef.current.length === 0) return
    let cancelled = false
    void (async () => {
      while (!cancelled && !chatPendingRef.current && queuedMutationsRef.current.length > 0) {
        const queued = queuedMutationsRef.current.shift()
        if (queued) {
          await onTimelineMutate(queued.mutation)
          queued.resolve()
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [chatPending, onTimelineMutate])

  const loadChat = useCallback(
    async (opts?: { ignorePending?: boolean }) => {
      if (!opts?.ignorePending && chatPendingRef.current) return
      const response = await fetch(`/api/studio/chat?projectId=${projectId}`)
      if (!response.ok) return
      const body = (await response.json()) as {
        messages?: StudioChatMessage[]
        threads?: ChatThreadSummary[]
      }
      setMessages(
        (body.messages ?? []).map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          ...(message.activity?.length ? { activity: message.activity } : {}),
        })),
      )
      if (body.threads) setChatThreads(body.threads)
    },
    [projectId],
  )

  useEffect(() => {
    loadProject()
    void loadChat()
    void loadLatestRender()
    void loadLatestExtract()
  }, [loadProject, loadChat, loadLatestRender, loadLatestExtract])

  const stripAdGeneratorQuery = useCallback(() => {
    if (searchParams.get('wizard') !== 'ad-generator') return
    const next = `${pathname}${searchWithoutWizard(searchParams.toString())}`
    window.history.replaceState(window.history.state, '', next)
    router.replace(next, { scroll: false })
  }, [pathname, router, searchParams])

  useEffect(() => {
    if (!extractHydrated) return
    const briefApplied =
      extractApplied || Boolean(project && appliedBriefIdFromProjectJson(project))
    if (
      shouldOpenAdGeneratorWizard({
        wizardQuery: searchParams.get('wizard'),
        briefApplied,
      })
    ) {
      setAdGeneratorOpen(true)
      return
    }
    if (searchParams.get('wizard') === 'ad-generator') {
      stripAdGeneratorQuery()
    }
  }, [extractApplied, extractHydrated, project, searchParams, stripAdGeneratorQuery])

  useEffect(() => {
    if (!project || searchParams.get('upload') !== '1') return
    expandMedia()
    const tryClick = (attempts: number) => {
      const input = document.getElementById('studio-media-upload')
      if (input instanceof HTMLInputElement) {
        input.click()
        const params = new URLSearchParams(searchParams.toString())
        params.delete('upload')
        const query = params.toString()
        const next = query ? `${pathname}?${query}` : pathname
        window.history.replaceState(window.history.state, '', next)
        router.replace(next, { scroll: false })
        return
      }
      if (attempts <= 0) return
      window.requestAnimationFrame(() => tryClick(attempts - 1))
    }
    window.requestAnimationFrame(() => tryClick(12))
  }, [project, searchParams, pathname, router, expandMedia])

  useEffect(() => {
    const job = renderJob
    if (!job || (job.status !== 'queued' && job.status !== 'rendering')) return
    let cancelled = false
    let sawCompleted = false

    const tick = async () => {
      const response = await fetch(`/api/studio/render/${job.id}`)
      const body = (await response.json()) as RenderStatusResponse
      if (cancelled) return
      if (!response.ok || !body.job) {
        setError(body.error ?? 'Failed to load render status')
        return
      }
      setRenderJob(body.job)
      setRenderDownloadUrl(videoDownloadUrlFromOutputs(body.outputs))
      if (body.job.status === 'completed' || body.job.status === 'failed') {
        await loadProject()
        if (body.job.status === 'completed' && !sawCompleted) {
          sawCompleted = true
          setRenderModalOpen(true)
        }
      }
    }

    void tick()
    const interval = window.setInterval(() => {
      void tick()
    }, 2000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [loadProject, renderJob?.id, renderJob?.status])

  useEffect(() => {
    const job = renderJob
    if (!job || job.status !== 'completed' || renderDownloadUrl) return
    const jobId = job.id
    void (async () => {
      const response = await fetch(`/api/studio/render/${jobId}`)
      const body = (await response.json()) as RenderStatusResponse
      if (!response.ok) return
      const url = videoDownloadUrlFromOutputs(body.outputs)
      if (!url) return
      setRenderDownloadUrl((prev) => prev ?? url)
    })()
  }, [renderJob?.id, renderJob?.status, renderDownloadUrl])

  useEffect(() => {
    const job = extractJob
    if (!job || (job.status !== 'queued' && job.status !== 'generating')) return
    let cancelled = false
    let sawReady = false

    const tick = async () => {
      const response = await fetch(`/api/studio/generation/${job.id}`)
      const body = (await response.json()) as ExtractStatusResponse
      if (cancelled) return
      if (!response.ok || !body.job) {
        setError(body.error ?? 'Failed to load extract status')
        return
      }
      setExtractJob(body.job)
      if (body.brief) {
        setExtractBrief(briefPreviewFromResponse(body.brief))
      }
      if (body.job.status === 'ready' || body.job.status === 'failed') {
        setExtractPending(false)
        if (body.job.status === 'ready' && !sawReady) {
          sawReady = true
          setExtractModalOpen(true)
          const gbp = body.job.estimatedGbp
          if (typeof gbp === 'number' && gbp > 0) {
            setSessionGbp((prev) => prev + gbp)
          }
        }
      }
    }

    void tick()
    const interval = window.setInterval(() => {
      void tick()
    }, 2000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [extractJob?.id, extractJob?.status])

  const onUpload = (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file || !project) return
    if (isStudioUploadOverLimit(file.size)) {
      setError(
        `“${file.name}” is ${formatUploadBytes(file.size)} — max upload is ${STUDIO_UPLOAD_MAX_LABEL}.`,
      )
      return
    }
    startTransition(async () => {
      setError(null)
      const form = new FormData()
      form.set('projectId', project.id)
      form.set('expectedRevision', String(project.revision))
      form.set('file', file)
      const response = await fetch('/api/studio/assets', { method: 'POST', body: form })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(humanizeStudioError(body.error ?? 'Upload failed'))
        return
      }
      loadProject()
    })
  }

  const onAddFromUrl = async (url: string) => {
    if (!project) {
      throw new Error('Project is not loaded yet.')
    }
    setError(null)
    const response = await fetch('/api/studio/assets/from-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: project.id,
        expectedRevision: project.revision,
        url,
        addAsClip: false,
      }),
    })
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    if (!response.ok) {
      const message = humanizeStudioError(body.error ?? 'Add from URL failed')
      setError(message)
      throw new Error(message)
    }
    loadProject()
  }

  const onClearBrand = () => {
    if (!project) return
    setError(null)
    void (async () => {
      try {
        const response = await fetch(`/api/studio/projects/${projectId}/brand-kit`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedRevision: project.revision }),
        })
        const body = (await response.json()) as { error?: string }
        if (!response.ok) {
          throw new Error(body.error ?? 'Failed to clear brand')
        }
        loadProject()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to clear brand')
      }
    })()
  }

  const onRemoveAsset = async (assetId: string) => {
    if (!project) return
    const response = await fetch(`/api/studio/projects/${projectId}/assets/${assetId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedRevision: project.revision }),
    })
    const body = (await response.json()) as { error?: string }
    if (!response.ok) {
      throw new Error(body.error ?? 'Remove failed')
    }
    loadProject()
  }

  const onRenameAsset = async (assetId: string, name: string) => {
    if (!project) return
    const response = await fetch(`/api/studio/projects/${projectId}/assets/${assetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedRevision: project.revision, name }),
    })
    const body = (await response.json()) as { error?: string }
    if (!response.ok) {
      throw new Error(body.error ?? 'Rename failed')
    }
    loadProject()
  }

  const onPlaceAsset = async (assetId: string, options?: PlaceAssetOptions) => {
    const current = projectRef.current
    if (!current) return
    setMutationPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/studio/projects/${projectId}/assets/${assetId}/place`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRevision: current.revision,
          startMs: options?.startMs,
          endMs: options?.endMs,
        }),
      })
      const body = (await response.json()) as {
        project?: StudioProject
        error?: string
      }
      if (response.status === 409) {
        await loadProject()
        throw new Error(body.error ?? 'Place failed')
      }
      if (!response.ok || !body.project) {
        throw new Error(body.error ?? 'Place failed')
      }
      const signedUrlById = new Map(
        current.assets.map((asset) => [
          asset.id,
          'signedUrl' in asset && typeof asset.signedUrl === 'string' ? asset.signedUrl : undefined,
        ]),
      )
      acceptProject({
        ...body.project,
        assets: body.project.assets.map((asset) => {
          const signedUrl = signedUrlById.get(asset.id)
          return signedUrl ? { ...asset, signedUrl } : asset
        }),
      } as ProjectResponse['project'])
    } finally {
      setMutationPending(false)
    }
  }

  const onPlaceExtract = async (extractId: string) => {
    const current = projectRef.current
    if (!current) return
    setMutationPending(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/studio/projects/${projectId}/extracts/${extractId}/place`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedRevision: current.revision }),
        },
      )
      const body = (await response.json()) as {
        project?: StudioProject
        error?: string
      }
      if (response.status === 409) {
        await loadProject()
        throw new Error(body.error ?? 'Place failed')
      }
      if (!response.ok || !body.project) {
        throw new Error(body.error ?? 'Place failed')
      }
      acceptProject(body.project as ProjectResponse['project'])
    } finally {
      setMutationPending(false)
    }
  }

  const onEnsureAsset = async (assetId: string) => {
    const current = projectRef.current
    if (!current) throw new Error('Project not loaded')
    const already = current.assets.find((asset) => asset.id === assetId)
    if (already) return already
    setMutationPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/studio/projects/${projectId}/assets/${assetId}/place`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: current.revision, addToTimeline: false }),
      })
      const body = (await response.json()) as {
        project?: StudioProject
        error?: string
      }
      if (response.status === 409) {
        await loadProject()
        throw new Error(body.error ?? 'Attach failed')
      }
      if (!response.ok || !body.project) {
        throw new Error(body.error ?? 'Attach failed')
      }
      acceptProject(body.project as ProjectResponse['project'])
      const attached = body.project.assets.find((asset) => asset.id === assetId)
      if (!attached) throw new Error('Asset attach did not land on project')
      return attached
    } finally {
      setMutationPending(false)
    }
  }

  const onReferenceAsset = (token: string) => {
    insertTokenRef.current?.(token)
  }

  const onTranscribeAsset = (prompt: string) => {
    insertTokenRef.current?.(prompt)
  }

  const onFrameUpdate = useCallback((frame: number) => setCurrentFrame(frame), [])
  const onPlayingChange = useCallback((playing: boolean) => setIsPlaying(playing), [])
  const onSeek = useCallback((frame: number) => {
    const clamped = Number.isFinite(frame) ? Math.max(0, Math.floor(frame)) : 0
    setCurrentFrame(clamped)
    // Seek after state update flush so a parent re-render (e.g. slide select)
    // cannot rebuild Player inputProps and snap back to frame 0 before seek lands.
    requestAnimationFrame(() => {
      playerRef.current?.seekTo(clamped)
    })
  }, [])
  const onTogglePlay = useCallback(() => playerRef.current?.toggle(), [])

  /** Seek the Player to a readable frame inside the slide (past fade-in). */
  const seekToSlide = useCallback(
    (slideId: string) => {
      const slides = [...(projectRef.current?.slideshow?.slides ?? [])].sort(
        (a, b) => a.order - b.order,
      )
      let from = 0
      for (const slide of slides) {
        if (slide.id === slideId) {
          const duration = Number(slide.durationFrames)
          const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 1
          const fadeInset =
            slide.transition === 'fade'
              ? Math.min(10, Math.max(0, safeDuration - 2))
              : Math.min(1, Math.max(0, safeDuration - 1))
          onSeek(from + fadeInset)
          return
        }
        const step = Number(slide.durationFrames)
        from += Number.isFinite(step) && step > 0 ? step : 1
      }
    },
    [onSeek],
  )
  // Contained fullscreen: fill the player pane, never the OS screen.
  const onToggleFullscreen = useCallback(() => setPlayerFullscreen((open) => !open), [])

  useEffect(() => {
    if (!playerFullscreen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPlayerFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [playerFullscreen])

  const onExport = (targets: ExportTargets = 'both') => {
    if (!project) return
    startTransition(async () => {
      setError(null)
      const response = await fetch('/api/studio/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, targets }),
      })
      const body = (await response.json()) as RenderResponse
      if (!response.ok || !body.job) {
        setError(body.error ?? 'Failed to enqueue render')
        return
      }
      setRenderJob(body.job)
      setRenderDownloadUrl(null)
      setRenderReadyDismissed(false)
      setRenderModalOpen(true)
    })
  }

  const onCancelExport = () => {
    const job = renderJob
    if (!job || (job.status !== 'queued' && job.status !== 'rendering')) return
    setCancelRenderPending(true)
    setError(null)
    void (async () => {
      try {
        const response = await fetch(`/api/studio/render/${job.id}/cancel`, { method: 'POST' })
        const body = (await response.json()) as RenderStatusResponse
        if (!response.ok || !body.job) {
          throw new Error(body.error ?? 'Failed to cancel export')
        }
        setRenderJob(body.job)
        setRenderModalOpen(true)
        await loadProject()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to cancel export')
      } finally {
        setCancelRenderPending(false)
      }
    })()
  }

  const enqueueExtract = () => {
    if (!project || !extractUrl.trim()) return
    setExtractPending(true)
    setError(null)
    setExtractFormError(null)
    setExtractWorkerHint(null)
    setBrandStudioOpen(true)
    void (async () => {
      try {
        const response = await fetch(`/api/studio/projects/${project.id}/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceKind: 'url',
            url: extractUrl.trim(),
          }),
        })
        const body = (await response.json()) as ExtractStatusResponse
        if (!response.ok || !body.job) {
          throw new Error(body.error ?? 'Failed to enqueue extract')
        }
        setExtractJob(body.job)
        setExtractBrief(null)
        setExtractModalOpen(true)
        setExtractWorkerHint(body.workerHint ?? null)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to enqueue extract'
        setExtractPending(false)
        setExtractFormError(message)
        setError(message)
      }
    })()
  }

  const onExtractReasonerChange = (nextReasonerId: string) => {
    if (!project) return
    setReasonerSaving(true)
    setError(null)
    void (async () => {
      try {
        const response = await fetch(`/api/studio/projects/${project.id}/profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reasonerModelId: nextReasonerId }),
        })
        const body = (await response.json()) as {
          error?: string
          reasonerModelId?: string | null
          modelProfileId?: string
        }
        if (!response.ok) {
          throw new Error(body.error ?? 'Failed to save Reason model')
        }
        setReasonerModelId(body.reasonerModelId ?? nextReasonerId)
        if (body.modelProfileId) setModelProfileId(body.modelProfileId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save Reason model')
      } finally {
        setReasonerSaving(false)
      }
    })()
  }

  const onExtract = () => {
    if (!project || !extractUrl.trim()) return
    enqueueExtract()
  }

  const onAdGeneratorJobChange = useCallback((job: ExtractJobState | null) => {
    setExtractJob(job)
    if (job && (job.status === 'queued' || job.status === 'generating')) {
      setExtractBrief(null)
    }
  }, [])

  const onAdGeneratorProjectRevision = useCallback((revision: number) => {
    setProject((prev) => (prev ? { ...prev, revision } : prev))
  }, [])

  const onAdGeneratorApplied = useCallback(
    (next: StudioProject, modeUsed: string) => {
      acceptProject(next as ProjectResponse['project'])
      setFirstCutMode(modeUsed)
      setExtractJob(null)
      setExtractBrief(null)
      setExtractModalOpen(false)
      setExtractApplied(true)
      stripAdGeneratorQuery()
      setBrandStudioOpen(true)
    },
    [acceptProject, stripAdGeneratorQuery],
  )

  const onApplyBrief = () => {
    if (!project || !extractBrief) return
    setApplyBriefPending(true)
    setError(null)
    void (async () => {
      try {
        const response = await fetch(`/api/studio/projects/${project.id}/apply-brief`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            briefId: extractBrief.id,
            firstCutMode: 'minimal',
            expectedRevision: project.revision,
          }),
        })
        const body = (await response.json()) as {
          project?: StudioProject
          modeUsed?: string
          warning?: string | null
          error?: string
        }
        if (!response.ok || !body.project) {
          throw new Error(body.error ?? 'Failed to apply brief')
        }
        acceptProject(body.project)
        setFirstCutMode(body.modeUsed ?? 'minimal')
        setBrandStudioOpen(true)
        setExtractModalOpen(false)
        setExtractJob(null)
        setExtractBrief(null)
        setExtractWorkerHint(null)
        if (body.warning) {
          setError(body.warning)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to apply brief')
      } finally {
        setApplyBriefPending(false)
      }
    })()
  }

  const onReview = (action: 'approve' | 'kill' | 'regenerate') => {
    if (!project) return
    if (action === 'approve') {
      setSignOffOpen(true)
      return
    }
    setReviewPending(true)
    setError(null)
    void (async () => {
      try {
        const response = await fetch(`/api/studio/projects/${projectId}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, expectedRevision: project.revision }),
        })
        const body = (await response.json()) as { error?: string }
        if (!response.ok) {
          throw new Error(body.error ?? `Failed to ${action}`)
        }
        loadProject()
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to ${action}`)
      } finally {
        setReviewPending(false)
      }
    })()
  }

  const applyThreadPayload = (body: {
    messages?: StudioChatMessage[]
    threads?: ChatThreadSummary[]
  }) => {
    setMessages(
      (body.messages ?? []).map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        ...(message.activity?.length ? { activity: message.activity } : {}),
      })),
    )
    if (body.threads) setChatThreads(body.threads)
  }

  const onChatThreadAction = async (
    action: 'new' | 'switch' | 'rename',
    threadId?: string,
    title?: string,
  ) => {
    if (!project || chatPending) return
    setChatError(null)
    const response = await fetch('/api/studio/chat/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        productId: project.productId,
        action,
        threadId,
        title,
      }),
    })
    const body = (await response.json().catch(() => ({}))) as {
      error?: string
      messages?: StudioChatMessage[]
      threads?: ChatThreadSummary[]
    }
    if (!response.ok) {
      setChatError(body.error ?? 'Could not switch chat')
      return
    }
    applyThreadPayload(body)
  }

  const doSendChat = async (
    message: string,
    grounding: ChatGroundingPayload | undefined,
    confirmSpendVal: boolean,
  ) => {
    if (!project) return
    setChatPending(true)
    setChatError(null)
    setLiveToolNames([])
    setLiveThoughts([{ id: 'model', label: 'Calling model', detail: 'Waiting for a tool choice…' }])
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: message }])
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/studio/chat', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          productId: project.productId,
          message,
          confirmSpend: confirmSpendVal,
          grounding,
          turnMode,
        }),
        signal: controller.signal,
      })
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Chat request failed')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assistant = ''
      const assistantId = crypto.randomUUID()
      const turnActivity: StudioChatMessage['activity'] = []

      const upsertAssistant = (content: string, activity = turnActivity) => {
        setMessages((prev) => {
          const without = prev.filter((item) => item.id !== assistantId)
          return [
            ...without,
            {
              id: assistantId,
              role: 'assistant',
              content,
              ...(activity.length > 0 ? { activity: [...activity] } : {}),
            },
          ]
        })
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() ?? ''
        for (const chunk of chunks) {
          for (const { event, data } of parseSseChunks(`${chunk}\n\n`)) {
            const payload = JSON.parse(data) as Record<string, unknown>
            if (event === 'status' || event === 'model') {
              setLiveThoughts((prev) => {
                const next = prev.filter((row) => row.id !== 'model')
                return [
                  ...next,
                  { id: 'model', label: 'Calling model', detail: 'Waiting for a tool choice…' },
                ]
              })
              upsertAssistant(assistant || 'Working…', turnActivity)
            }
            if (event === 'step') {
              const stepNumber = Number(payload.stepNumber ?? 0)
              const id = `step-${stepNumber}`
              setLiveThoughts((prev) => [
                ...prev.filter((row) => row.id !== id && row.id !== 'model'),
                {
                  id,
                  label: `Step ${stepNumber + 1}`,
                  detail: 'Calling model',
                },
              ])
            }
            if (event === 'tool_choice') {
              const name = String(payload.toolName ?? '')
              if (name) {
                const id = `choice-${name}`
                setLiveThoughts((prev) => [
                  ...prev.filter((row) => row.id !== id && row.id !== 'model'),
                  {
                    id,
                    label: name.replaceAll('_', ' '),
                    detail: 'Chose this tool',
                  },
                ])
              }
            }
            if (event === 'text') {
              assistant += String(payload.delta ?? '')
              upsertAssistant(assistant)
            }
            if (event === 'tool_start') {
              const name = String(payload.toolName ?? '')
              if (name) {
                setLiveToolNames((prev) => (prev.includes(name) ? prev : [...prev, name]))
                setLiveThoughts((prev) => [
                  ...prev.filter(
                    (row) =>
                      row.id !== 'model' && row.id !== `choice-${name}` && row.id !== `run-${name}`,
                  ),
                  { id: `run-${name}`, label: name.replaceAll('_', ' '), detail: 'Running…' },
                ])
                upsertAssistant(assistant || 'Working…', turnActivity)
              }
            }
            if (event === 'tool') {
              const add = costFromToolPayload(payload)
              if (add > 0) {
                setSessionGbp((prev) => prev + add)
              }
              const outcome = payload.outcome as
                { ok: boolean; summary?: string; error?: string } | undefined
              if (typeof payload.toolName === 'string' && outcome) {
                turnActivity.push({
                  id: String(payload.id ?? crypto.randomUUID()),
                  toolName: payload.toolName,
                  outcome,
                })
                const doneName = payload.toolName
                setLiveToolNames((prev) => {
                  const idx = prev.indexOf(doneName)
                  if (idx < 0) return prev
                  return [...prev.slice(0, idx), ...prev.slice(idx + 1)]
                })
                setLiveThoughts((prev) =>
                  prev.filter(
                    (row) => row.id !== `run-${doneName}` && row.id !== `choice-${doneName}`,
                  ),
                )
                upsertAssistant(assistant || 'Working…', turnActivity)
              }
            }
            if (event === 'project') {
              const next = payload.project as StudioProject
              const current = projectRef.current
              if (current) {
                acceptProject({
                  ...current,
                  ...next,
                  assets: current.assets,
                })
              }
              loadProject()
            }
            if (event === 'done') {
              if (Array.isArray(payload.messages)) {
                setMessages(payload.messages as StudioChatMessage[])
              }
              if (Array.isArray(payload.threads)) {
                setChatThreads(payload.threads as ChatThreadSummary[])
              }
              const reasonerGbp = Number(
                (payload.reasonerSpend as { estimatedGbp?: number } | undefined)?.estimatedGbp ?? 0,
              )
              if (reasonerGbp > 0) {
                setSessionGbp((prev) => prev + reasonerGbp)
              }
            }
            if (event === 'error') {
              throw new Error(String(payload.error ?? 'Chat failed'))
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setChatError('Turn cancelled')
      } else {
        setChatError(err instanceof Error ? err.message : 'Chat failed')
      }
    } finally {
      chatPendingRef.current = false
      setChatPending(false)
      setLiveToolNames([])
      setLiveThoughts([])
    }
    if (!controller.signal.aborted) {
      await loadChat({ ignorePending: true })
    }
    billing.refresh()
  }

  const onSend = (message: string, grounding?: ChatGroundingPayload): void | false => {
    if (!project) return
    const liveVideoSelected = Boolean(videoModelId) && isPaidHostedVideoModel(videoModelId!)
    const decision = decideChatSpendSend({
      confirmSpendAllowed: confirmSpend,
      billingEnabled: billing.billingEnabled,
      billingLoading: billing.loading,
      generationFrozen: billing.generationFrozen,
      walletBalanceGbp: billing.walletBalanceGbp,
      paidHostedVideo: billing.paidHostedVideo !== false,
      liveVideoSelected,
    })
    if (decision.action === 'block') {
      setChatSpendBlock(decision.reason)
      return false
    }
    setChatSpendBlock(null)
    void doSendChat(message, grounding, decision.confirmSpend)
  }

  // After plan confirm, trigger the generate turn with confirmSpend=true (ADR-0055/0086).
  useEffect(() => {
    if (!genPlanGeneratePending) return
    setGenPlanGeneratePending(false)
    void doSendChat(PLAN_CONFIRMED_GENERATE_MESSAGE, undefined, true)
  }, [genPlanGeneratePending]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!project && !error) {
    return <StudioPageLoading message="Opening Studio…" />
  }

  if (!project) {
    return (
      <div className="studio-editor studio-editor-status">
        <p className="error">{error}</p>
      </div>
    )
  }

  const extractDismissed =
    chromeDismissEpoch >= 0 && isStudioChromeDismissed('extract', projectId, extractJob?.id)
  const extractSuppressed = Boolean(
    extractJob &&
    !shouldRestoreExtractChrome({
      status: extractJob.status,
      applied: extractApplied,
      dismissed: extractDismissed,
    }),
  )

  const isSlideshow = isSlideshowCompositionId(project.compositionId)
  const isAuthored = isAuthoredComposition(project.compositionId)
  const sortedSlides = [...(project.slideshow?.slides ?? [])].sort((a, b) => a.order - b.order)
  const activeSlideId =
    selectedSlideId && sortedSlides.some((slide) => slide.id === selectedSlideId)
      ? selectedSlideId
      : (sortedSlides[0]?.id ?? null)
  const playerDurationFrames = isSlideshow
    ? Math.max(
        project.durationFrames,
        sortedSlides.reduce((sum, slide) => sum + slide.durationFrames, 0),
        1,
      )
    : project.durationFrames
  const pipLayout = pipDraft ?? normalizePipLayout(project.pipLayout)
  const hasPipClips = project.clips.some((clip) => clip.trackId === BROLL_TRACK_ID)
  const pipClipOnScreen = project.clips.some(
    (clip) =>
      clip.trackId === BROLL_TRACK_ID &&
      currentFrame >= clip.from &&
      currentFrame < clip.from + clip.durationInFrames,
  )
  const selectedOverlay = project.overlays.find(
    (overlay) => overlay.id === timelineSelectedOverlayIds[0],
  )
  const selectedTextOverlay =
    selectedOverlay && selectedOverlay.kind !== 'caption' ? selectedOverlay : undefined
  const textOverlayOnScreen = Boolean(
    selectedTextOverlay &&
    currentFrame >= selectedTextOverlay.from &&
    currentFrame < selectedTextOverlay.from + selectedTextOverlay.durationInFrames,
  )
  const overlayLayout =
    overlayLayoutDraft ??
    selectedTextOverlay?.layout ??
    (selectedTextOverlay ? defaultOverlayLayout(selectedTextOverlay.kind) : null)
  const adReadyIssues = listAdReadyIssues(project)
  const showAdReady = project.status === 'needs_review'
  const projectOrgLine = workspaceOwnedBy(
    products.find((row) => row.productId === project.productId)?.name ?? null,
  )

  return (
    <div
      className="studio-editor"
      data-layout={layoutMode}
      data-stack-tab={layoutMode === 'stack' ? stackTab : undefined}
    >
      <header className="studio-workspace-bar">
        <div className="studio-workspace-title">
          <p className="eyebrow">Creative Studio</p>
          <h1>{headline}</h1>
          {projectOrgLine ? <p className="studio-workspace-product">{projectOrgLine}</p> : null}
        </div>
        <nav className="studio-workspace-actions" aria-label="Project chrome">
          <div className="studio-bar-cluster" role="group" aria-label="Status and branch">
            {showTrialWatermark ? (
              <span
                className="studio-trial-chip"
                role="status"
                title="Exports include a trial mark. Upgrade to remove it."
              >
                Trial export
              </span>
            ) : null}
            <span
              className={`studio-project-status is-${project.status}`}
              title="Project lifecycle status"
            >
              <span className="studio-bar-chip-dot" aria-hidden />
              {workspaceStatusLabel(project.status)}
            </span>
            {!parentProjectId ? (
              <BranchSwitcher
                projectId={projectId}
                expectedRevision={project.revision}
                onProjectChanged={(next) =>
                  acceptProjectPreservingAssets(next as ProjectResponse['project'])
                }
                onError={setError}
                onRevisionConflict={loadProject}
              />
            ) : null}
          </div>
          <div className="studio-bar-cluster" role="group" aria-label="Cut tools">
            <button
              type="button"
              className="studio-brand-chip"
              onClick={() => setBrandOpen((open) => !open)}
              aria-expanded={brandOpen}
              title={project.brand ? 'Project brand' : 'No brand on this project'}
            >
              <span
                className={`studio-brand-dot ${project.brand ? 'is-attached' : ''}`}
                aria-hidden
              />
              Brand
            </button>
            <button
              type="button"
              className="studio-brand-chip"
              onClick={() => setEditsOpen(true)}
              aria-expanded={editsOpen}
              title="Why this cut changed"
            >
              Edits
            </button>
            {!parentProjectId ? (
              <button
                type="button"
                className="studio-brand-chip"
                onClick={() => setAdGeneratorOpen(true)}
                title={
                  project.brief
                    ? 'Re-open Ad Generator to re-extract or review another brief'
                    : 'Extract a brief from a URL or PDF and seed this cut'
                }
              >
                Ad Generator
              </button>
            ) : null}
            {firstCutMode || project.brief ? (
              <span
                className="studio-brand-chip is-static"
                title="How the first cut was seeded from the brief"
              >
                First cut: {firstCutMode ?? 'minimal'}
              </span>
            ) : null}
            {!parentProjectId ? (
              <button
                type="button"
                className="studio-brand-chip"
                onClick={() => setVariantGridOpen(true)}
                disabled={!project.brief}
                title={
                  project.brief
                    ? 'Create platform and messaging versions of this cut'
                    : 'Apply an extracted brief before creating ad versions'
                }
              >
                Ad versions{variantSiblings.length > 0 ? ` · ${variantSiblings.length}` : ''}
              </button>
            ) : (
              <>
                <a
                  className="studio-brand-chip"
                  href={`/studio/${parentProjectId}`}
                  title="Back to the main cut"
                >
                  ← Main cut
                </a>
                {variantSiblings.length > 0 ? (
                  <StudioLinkMenu
                    compact
                    ariaLabel="Switch ad version"
                    triggerLabel={
                      variantSiblings.find((sibling) => sibling.id === project.id)?.label ??
                      'Ad version'
                    }
                    activeId={project.id}
                    options={variantSiblings.map((sibling) => ({
                      id: sibling.id,
                      label: sibling.label,
                      meta: sibling.status === 'drafting' ? 'Draft' : sibling.status,
                      href: `/studio/${sibling.id}`,
                    }))}
                  />
                ) : null}
                <button
                  type="button"
                  className="studio-brand-chip"
                  onClick={() => setVariantChildEditorOpen(true)}
                  title="Edit opening line / CTA for this ad version, or promote to the main cut"
                >
                  Edit version
                </button>
              </>
            )}
          </div>
          <div className="studio-bar-cluster" role="group" aria-label="Locale and posting">
            <PublishPanel
              projectId={project.id}
              productId={project.productId}
              visible={project.status === 'approved'}
            />
            <LocaleSwitcher
              project={project}
              busy={localeActions.busy}
              onError={setError}
              onAction={localeActions.run}
            />
          </div>
        </nav>
      </header>
      {layoutMode === 'stack' ? (
        <div className="studio-stack-tabs" role="tablist" aria-label="Studio panes">
          {(
            [
              ['preview', 'Preview'],
              ['media', 'Media'],
              ['chat', 'Chat'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={stackTab === id}
              className={stackTab === id ? 'is-active' : undefined}
              onClick={() => {
                setStackTab(id)
                if (id === 'media') expandMedia()
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      <LocaleMissingBanner
        chips={missingTranslationChips(project)}
        fontWarning={fontFallbackWarning({
          locale: project.localization.activeLocale,
          fontFamily: project.brand?.fontFamily,
        })}
        confirmSpend={confirmSpend}
        busy={localeActions.busy}
        onTranslate={() => {
          void localeActions.run('translate', { locale: project.localization.activeLocale })
        }}
        onDub={() => {
          void localeActions.run('dub', { locale: project.localization.activeLocale })
        }}
      />

      {brandOpen ? (
        <div className="studio-brand-popover">
          <PathCStatus
            project={project}
            onOpenStudio={() => {
              setBrandOpen(false)
              setBrandStudioOpen(true)
            }}
            onClearBrand={onClearBrand}
          />
        </div>
      ) : null}

      <BrandStudio
        project={project}
        open={brandStudioOpen}
        onClose={() => setBrandStudioOpen(false)}
        onChanged={loadProject}
        extractUrl={extractUrl}
        extractPending={
          extractPending || extractJob?.status === 'queued' || extractJob?.status === 'generating'
        }
        reasonerModelId={reasonerModelId}
        reasonerSaving={reasonerSaving}
        onExtractUrlChange={setExtractUrl}
        onReasonerChange={onExtractReasonerChange}
        onExtract={onExtract}
        extractError={extractFormError}
      />

      <AdGeneratorWizard
        projectId={project.id}
        projectRevision={project.revision}
        projectAssets={project.assets}
        projectLogoAssetId={project.brand?.logoAssetId}
        reasonerModelId={reasonerModelId}
        reasonerSaving={reasonerSaving}
        open={adGeneratorOpen}
        onClose={() => {
          setAdGeneratorOpen(false)
          stripAdGeneratorQuery()
        }}
        onReasonerChange={onExtractReasonerChange}
        onJobChange={onAdGeneratorJobChange}
        onWorkerHint={setExtractWorkerHint}
        onProjectRevision={onAdGeneratorProjectRevision}
        onProjectChanged={loadProject}
        onApplied={onAdGeneratorApplied}
        initialUrl={searchParams.get('extractUrl') ?? undefined}
        initialSource={searchParams.get('extractSource') === 'pdf' ? 'pdf' : 'url'}
      />

      <VariantGrid
        project={project}
        open={variantGridOpen}
        onClose={() => {
          setVariantGridOpen(false)
          reloadVariantSiblings()
        }}
        onParentChanged={loadProject}
      />

      <VoicePanel
        projectId={projectId}
        revision={project.revision}
        confirmSpend={confirmSpend}
        onConfirmSpendChange={onConfirmSpendChange}
        open={voicePanelOpen}
        onClose={() => setVoicePanelOpen(false)}
        onGenerated={async () => {
          await loadProject()
        }}
      />
      <MusicPanel
        projectId={project.id}
        revision={project.revision}
        confirmSpend={confirmSpend}
        onConfirmSpendChange={onConfirmSpendChange}
        open={musicPanelOpen}
        onClose={() => setMusicPanelOpen(false)}
        onGenerated={async () => {
          await loadProject()
        }}
      />
      <EditsPanel
        open={editsOpen}
        entries={project.whyLog ?? []}
        clips={project.clips}
        regenBusy={mutationPending}
        onRegenEffect={async (clipId, effectId) => {
          await onTimelineMutate({ type: 'regen_effect', clipId, effectId })
        }}
        onClose={() => setEditsOpen(false)}
      />
      <SignOffCard
        projectId={project.id}
        revision={project.revision}
        open={signOffOpen}
        onClose={() => setSignOffOpen(false)}
        onCompleted={async () => {
          await loadProject()
        }}
      />

      {parentProjectId ? (
        <VariantChildEditor
          project={project}
          parentProjectId={parentProjectId}
          open={variantChildEditorOpen}
          onClose={() => setVariantChildEditorOpen(false)}
          onChanged={loadProject}
        />
      ) : null}

      <RenderProgress
        job={renderJob ?? null}
        projectStatus={project.status}
        durationFrames={project.durationFrames}
        fps={project.fps}
        modalOpen={renderModalOpen}
        cancelPending={cancelRenderPending}
        downloadUrl={renderDownloadUrl}
        persistDismissed={renderReadyDismissed}
        onDismissModal={() => setRenderModalOpen(false)}
        onReopenModal={() => setRenderModalOpen(true)}
        onCancel={onCancelExport}
        onPersistDismiss={() => {
          if (renderJob?.id) markRenderJobDismissed(renderJob.id)
          setRenderReadyDismissed(true)
        }}
        onClearTerminal={() => {
          if (renderJob?.id) markRenderJobDismissed(renderJob.id)
          setRenderJob(null)
          setRenderDownloadUrl(null)
        }}
      />

      <DirectorPreviewModal
        open={directorModalOpen}
        plan={directorPlan}
        scenes={project.scenes ?? []}
        busy={directorBusy}
        error={directorError}
        allowSaveAsBranch={!parentProjectId}
        onClose={() => setDirectorModalOpen(false)}
        onApply={(excludeMutationIds) => void onCommitDirector(excludeMutationIds)}
        onSaveAsBranch={(excludeMutationIds, input) =>
          void onSaveDirectorAsBranch(excludeMutationIds, input)
        }
        onReject={() => void onRejectDirector()}
        onRefine={onRefineDirector}
        onRefresh={() =>
          void onPreviewDirector({
            style: directorPlan?.style,
          })
        }
      />

      <GenerationPlanModal
        open={genPlanModalOpen}
        plan={project.generationPlan ?? null}
        productId={project.productId}
        busy={genPlanBusy}
        error={genPlanError}
        onClose={() => setGenPlanModalOpen(false)}
        onMinimize={() => setGenPlanModalOpen(false)}
        onSaveDraft={(patch: GenerationPlanPatch) => void onGenPlanSaveDraft(patch)}
        onDiscard={() => void onGenPlanDiscard()}
        onConfirm={(patch: GenerationPlanPatch) => void onGenPlanConfirm(patch)}
      />

      {/* When Ad Generator is open it owns extract UX. Banner still shows if wizard is closed mid-job. */}
      {!adGeneratorOpen ? (
        <ExtractProgress
          job={extractJob}
          brief={extractBrief}
          modalOpen={extractModalOpen}
          workerHint={extractWorkerHint}
          applyPending={applyBriefPending}
          suppressed={extractSuppressed}
          onPersistDismiss={(jobId) => {
            markStudioChromeDismissed('extract', projectId, jobId)
            setExtractModalOpen(false)
            setChromeDismissEpoch((epoch) => epoch + 1)
          }}
          onDismissModal={() => setExtractModalOpen(false)}
          onReopenModal={() => {
            // Prefer wizard review so brief edits are not skipped (F3).
            setAdGeneratorOpen(true)
            setExtractModalOpen(false)
          }}
          onRetry={() => {
            setAdGeneratorOpen(true)
          }}
          onApply={() => {
            setAdGeneratorOpen(true)
            setExtractModalOpen(false)
          }}
          onClearTerminal={() => {
            setExtractJob(null)
            setExtractBrief(null)
            setExtractWorkerHint(null)
          }}
        />
      ) : null}

      <div
        className={`studio-editor-body${chatPane.collapsed ? ' is-chat-collapsed' : ''}${mediaPane.collapsed ? ' is-media-collapsed' : ''}`}
      >
        <div className="studio-editor-main">
          <div
            className={`studio-editor-panes${mediaPane.collapsed ? ' is-media-collapsed' : ''}`}
            style={{
              gridTemplateColumns: panesGridColumns,
            }}
          >
            <aside
              className={`studio-pane studio-pane-left${mediaPane.collapsed ? ' is-pane-collapsed' : ''}`}
            >
              {mediaPane.collapsed ? (
                <PaneExpandRail
                  label="Media"
                  title="Show media bin"
                  orientation="vertical"
                  onClick={expandMedia}
                />
              ) : (
                <AssetBin
                  projectId={project.id}
                  productId={project.productId}
                  assets={project.assets}
                  revision={project.revision}
                  pending={pending || chatPending}
                  timelineDragDisabled={pending || mutationPending || queuedEditPending}
                  dragOver={binDragOver}
                  onDragStateChange={setBinDragOver}
                  onDropFiles={(files) => onUpload(files)}
                  onUpload={onUpload}
                  onAddFromUrl={onAddFromUrl}
                  onRemoved={loadProject}
                  onRemoveAsset={onRemoveAsset}
                  onRenameAsset={onRenameAsset}
                  onPlaceAsset={onPlaceAsset}
                  onPlaceExtract={onPlaceExtract}
                  extractInFlight={shouldFocusExtractsBin(generationJobs)}
                  onEnsureAsset={onEnsureAsset}
                  onReferenceAsset={onReferenceAsset}
                  onTranscribeAsset={onTranscribeAsset}
                  onCollapse={mediaPane.collapse}
                  onOpenMusic={() => setMusicPanelOpen(true)}
                  onOpenVoice={() => setVoicePanelOpen(true)}
                  planStatus={project.generationPlan?.status ?? null}
                  onOpenPlan={() => setGenPlanModalOpen(true)}
                  stylePackId={project.stylePackId ?? null}
                  stylePackBusy={stylePackBusy}
                  onSetStylePack={onSetStylePack}
                  filterSelectedClipId={timelineSelectedClipIds[0] ?? null}
                  clipFilterId={
                    project.clips.find((clip) => clip.id === timelineSelectedClipIds[0])
                      ?.filterId ?? null
                  }
                  onApplyClipFilter={async (clipId, packId) => {
                    await onTimelineMutate(
                      packId
                        ? { type: 'apply_filter', clipId, filterId: packId, intensity: 1 }
                        : { type: 'clear_filter', clipId },
                    )
                  }}
                  clipTreatments={
                    project.clips.find((clip) => clip.id === timelineSelectedClipIds[0])
                      ?.treatments ?? []
                  }
                  onApplyEffect={async (clipId, effectId, intensity) => {
                    await onTimelineMutate({
                      type: 'apply_effect',
                      clipId,
                      effectId,
                      intensity,
                    })
                  }}
                  onClearEffect={async (clipId, effectId) => {
                    await onTimelineMutate({ type: 'clear_effect', clipId, effectId })
                  }}
                  onRegenEffect={async (clipId, effectId) => {
                    await onTimelineMutate({ type: 'regen_effect', clipId, effectId })
                  }}
                  onApplyMotionPreset={async (clipId, presetId) => {
                    await onTimelineMutate({ type: 'apply_motion_preset', clipId, presetId })
                  }}
                  stickerBusy={stickerBusy}
                  sfxBusy={sfxBusy}
                  confirmSpend={confirmSpend}
                  onPlaceSticker={(stickerId) => {
                    void onPlaceSticker(stickerId)
                  }}
                  onPlaceSfx={(packId) => {
                    void onPlaceSfx(packId)
                  }}
                  onPlaceTextPreset={(preset) => {
                    void onTimelineMutate({
                      type: 'add_text',
                      kind: preset.kind,
                      text: preset.text,
                      ...(preset.place === 'playhead'
                        ? { from: currentFrame, durationInFrames: preset.durationInFrames }
                        : {}),
                    })
                  }}
                  captions={{
                    selectedClipId: timelineSelectedClipIds[0] ?? null,
                    transcribeBusy: generationJobs.some(
                      (job) =>
                        job.role === 'transcribe' &&
                        (job.status === 'queued' || job.status === 'generating'),
                    ),
                    line: captionLine,
                    onLineChange: setCaptionLine,
                    onTypeLine: () => {
                      const text = captionLine.trim()
                      if (!text) return
                      void onTimelineMutate({
                        type: 'add_captions',
                        text,
                        from: currentFrame,
                        durationInFrames: 90,
                        style: { presetId: captionStyleId },
                      })
                      setCaptionLine('')
                    },
                    onFromTranscript: (confirmSpend) => {
                      void postCaptionFromTranscript(confirmSpend)
                    },
                    spendPrompt: captionSpendPrompt,
                    onDismissSpend: () => setCaptionSpendPrompt(null),
                    styleId: captionStyleId,
                    onStyleId: (id) => {
                      setCaptionStyleId(id)
                      const captions = project.overlays.filter(
                        (overlay) => overlay.kind === 'caption',
                      )
                      for (const caption of captions) {
                        void onTimelineMutate({
                          type: 'update_overlay',
                          overlayId: caption.id,
                          style: { ...caption.style, presetId: id },
                        })
                      }
                    },
                    highlightsOn: project.overlays.some(
                      (overlay) =>
                        overlay.kind === 'caption' && (overlay.style?.emphasis?.length ?? 0) > 0,
                    ),
                    marksOn: project.overlays.some(
                      (overlay) =>
                        overlay.kind === 'caption' && (overlay.style?.emoji?.length ?? 0) > 0,
                    ),
                    hasCaptions: project.overlays.some((overlay) => overlay.kind === 'caption'),
                    onToggleHighlights: (on) => {
                      void onTimelineMutate({ type: 'set_caption_style', highlight: on })
                    },
                    onToggleMarks: (on) => {
                      void onTimelineMutate({ type: 'set_caption_style', emoji: on })
                    },
                  }}
                />
              )}
            </aside>
            {mediaPane.collapsed ? (
              <div className="studio-splitter is-disabled" aria-hidden />
            ) : (
              <div
                className="studio-splitter"
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize media bin"
                title="Drag to resize media"
                {...leftPane.handleProps}
              />
            )}
            <section
              className={`studio-pane studio-pane-center ${playerFullscreen ? 'is-player-fullscreen' : ''}`}
            >
              <div className="player-stage-wrap">
                <PlayerPane
                  project={project}
                  playerRef={playerRef}
                  previewZoom={playerFullscreen ? 1 : previewZoom}
                  onFrameUpdate={onFrameUpdate}
                  onPlayingChange={onPlayingChange}
                  pipLayoutOverride={pipDraft}
                  overlay={
                    !isSlideshow && !isAuthored ? (
                      <>
                        {pipClipOnScreen ? (
                          <PipFrameOverlay
                            layout={pipLayout}
                            disabled={chatPending || mutationPending || queuedEditPending}
                            onPreview={onPreviewPipLayout}
                            onCommit={onCommitPipLayout}
                          />
                        ) : null}
                        {textOverlayOnScreen && overlayLayout && selectedTextOverlay ? (
                          <OverlayFrameOverlay
                            layout={overlayLayout}
                            label={selectedTextOverlay.kind.replace('_', ' ')}
                            disabled={chatPending || mutationPending || queuedEditPending}
                            onPreview={(next) => setOverlayLayoutDraft(next)}
                            onCommit={(next) => {
                              setOverlayLayoutDraft(null)
                              void onTimelineMutate({
                                type: 'update_overlay',
                                overlayId: selectedTextOverlay.id,
                                layout: next,
                              })
                            }}
                          />
                        ) : null}
                      </>
                    ) : null
                  }
                  trialWatermark={showTrialWatermark}
                />
                <AdReadyChip
                  adReadyIssues={adReadyIssues}
                  showAdReady={showAdReady}
                  onOpenApprove={
                    project.status === 'needs_review' && adReadyIssues.length === 0
                      ? () => setSignOffOpen(true)
                      : undefined
                  }
                  onInspectCut={() => {
                    if (chatPending) return
                    onSend('Inspect this cut. If the review passes, I will Approve.')
                  }}
                  inspectPending={chatPending}
                />
                <CutReviewNotesBanner projectId={project.id} cutReview={project.cutReview} />
              </div>
              {error ? (
                <StudioErrorBanner message={error} onDismiss={() => setError(null)} />
              ) : null}
              <WorkspaceStatusBanners
                jobs={generationJobs}
                dismissedFailedIds={dismissedFailedJobIds}
                dismissalsReady={dismissalsReady}
                onDismissFailed={rememberDismissedFailed}
                showPlanBanner={
                  videoGenEnabled &&
                  !genPlanModalOpen &&
                  !!project.generationPlan &&
                  (project.generationPlan.status === 'draft' ||
                    project.generationPlan.status === 'ready')
                }
                onOpenPlan={() => setGenPlanModalOpen(true)}
                generationFrozen={
                  billing.billingEnabled && !billing.loading && billing.generationFrozen
                }
                spendBlock={chatSpendBlock}
                onClearSpendBlock={() => setChatSpendBlock(null)}
              />
              <ModelCatalogueDialog
                open={modelCatalogueOpen}
                onClose={() => setModelCatalogueOpen(false)}
              />
              <div className="player-chrome" aria-label="Player controls">
                <Transport
                  currentFrame={currentFrame}
                  durationFrames={playerDurationFrames}
                  isPlaying={isPlaying}
                  previewZoom={previewZoom}
                  isFullscreen={playerFullscreen}
                  onTogglePlay={onTogglePlay}
                  onSeek={onSeek}
                  onFullscreen={onToggleFullscreen}
                  onPreviewZoomChange={setPreviewZoom}
                  onInsertTime={() => {
                    insertTokenRef.current?.(formatTimeToken(currentFrame / project.fps))
                  }}
                />
                {project.status === 'needs_review' ||
                project.status === 'approved' ||
                (project.thumbnailCandidateIds?.length ?? 0) > 0 ? (
                  <ThumbnailPicker
                    projectId={project.id}
                    revision={project.revision}
                    selectedId={project.thumbnailAssetId ?? null}
                    candidateIds={project.thumbnailCandidateIds ?? []}
                    stills={project.assets
                      .filter((asset) => asset.kind === 'image')
                      .map((asset) => ({
                        assetId: asset.id,
                        url: `/api/studio/projects/${project.id}/assets/${asset.id}/content`,
                      }))}
                    jobs={generationJobs}
                    disabled={mutationPending}
                    onChanged={loadProject}
                  />
                ) : null}
                <ReviewBar
                  status={project.status}
                  renderActive={renderJob?.status === 'queued' || renderJob?.status === 'rendering'}
                  onExport={onExport}
                  onReview={onReview}
                  pending={pending || chatPending}
                  reviewPending={reviewPending}
                  showExportTargets={isSlideshow}
                  downloadUrl={renderDownloadUrl}
                  approveEnabled={project.status === 'needs_review' && adReadyIssues.length === 0}
                  approveHint={
                    project.status === 'needs_review'
                      ? adReadyIssues.length > 0
                        ? adReadyIssues[0]?.message
                        : 'Open approval sign-off'
                      : 'Export a candidate first'
                  }
                  approvalStages={approvalStages}
                  approvalStageIndex={approvalStageIndex}
                  approvalStatus={approvalStatus}
                />
              </div>
              {!isSlideshow && !transcriptPane.collapsed ? (
                <TranscriptPane
                  project={project}
                  projectId={project.id}
                  currentFrame={currentFrame}
                  selectedClipId={timelineSelectedClipIds[0] ?? null}
                  confirmSpend={confirmSpend}
                  jobs={generationJobs}
                  disabled={chatPending || mutationPending || queuedEditPending}
                  onCollapse={transcriptPane.collapse}
                  onSeek={onSeek}
                  onMutate={onTimelineMutate}
                  onProject={acceptProjectPreservingAssets}
                  onReload={loadProject}
                  onConfirmSpend={() => setConfirmSpend(true)}
                  onError={setError}
                />
              ) : null}
              {directorPlan &&
              (directorPlan.status === 'draft' || directorPlan.status === 'stale') ? (
                <button
                  type="button"
                  className={`director-plan-pill${directorPlan.status === 'stale' ? ' is-stale' : ''}`}
                  onClick={() => setDirectorModalOpen(true)}
                >
                  Director plan pending ·{' '}
                  {directorPlan.edits.filter((edit) => edit.status !== 'rejected').length} change
                  {directorPlan.edits.filter((edit) => edit.status !== 'rejected').length === 1
                    ? ''
                    : 's'}{' '}
                  · £{directorPlan.costEstimateGbp.toFixed(2)}
                  {directorPlan.status === 'stale' ? ' · out of date' : ''}
                </button>
              ) : null}
              {extractJob?.status === 'ready' && extractDismissed && !extractApplied ? (
                <button
                  type="button"
                  className="director-plan-pill"
                  onClick={() => setAdGeneratorOpen(true)}
                >
                  Brief ready
                </button>
              ) : null}
            </section>
          </div>
          {timelinePane.collapsed ? (
            <div className="studio-timeline-collapsed-bar">
              <PaneExpandRail
                label={isSlideshow ? 'Slides' : 'Timeline'}
                title={isSlideshow ? 'Show slide strip' : 'Show timeline'}
                orientation="horizontal"
                onClick={timelinePane.expand}
              />
              {!isSlideshow && transcriptPane.collapsed ? (
                <PaneExpandRail
                  label="Transcript"
                  title="Show transcript"
                  orientation="horizontal"
                  onClick={transcriptPane.expand}
                />
              ) : null}
              {!isSlideshow && scenePlan.active && scenePlan.state.phase !== 'idle' ? (
                <ScenePlanProgressBanner
                  phase={scenePlan.state.phase}
                  sceneCount={scenePlan.state.scenes?.length ?? 0}
                  error={scenePlan.state.error}
                  onReview={() => {
                    timelinePane.expand()
                    scenesPane.expand()
                    scenePlan.openModal()
                  }}
                  onDismiss={scenePlan.dismiss}
                  onApply={
                    scenePlan.state.phase === 'preview'
                      ? () => {
                          timelinePane.expand()
                          scenesPane.expand()
                          void scenePlan.runApply()
                        }
                      : undefined
                  }
                  applyDisabled={
                    chatPending ||
                    mutationPending ||
                    queuedEditPending ||
                    (scenePlan.state.scenes?.length ?? 0) === 0
                  }
                />
              ) : null}
            </div>
          ) : (
            <>
              <div
                className="studio-splitter studio-splitter-horizontal"
                role="separator"
                aria-orientation="horizontal"
                aria-label={isSlideshow ? 'Resize slide strip' : 'Resize timeline'}
                title="Drag to resize timeline"
                {...timelineHeight.handleProps}
              />
              <div className="studio-editor-timeline" style={{ height: timelineHeight.size }}>
                {isSlideshow ? (
                  <div className="studio-slideshow-bottom">
                    <div className="studio-slideshow-bottom-toolbar">
                      <span className="studio-slideshow-bottom-label">Slides</span>
                      <PaneCollapseControl title="Minimize slides" onClick={timelinePane.collapse}>
                        <IconCollapsePanel />
                      </PaneCollapseControl>
                    </div>
                    <div className="studio-slideshow-bottom-body">
                      <div className="studio-slideshow-strip-col">
                        <SlideStrip
                          project={project}
                          selectedSlideId={activeSlideId}
                          onSelectSlide={(slideId) => {
                            setSelectedSlideId(slideId)
                            seekToSlide(slideId)
                          }}
                          onMutate={onTimelineMutate}
                          onMentionSlide={onReferenceAsset}
                          canUndo={history.canUndo}
                          canRedo={history.canRedo}
                          onUndo={() => void onHistoryAction('undo')}
                          onRedo={() => void onHistoryAction('redo')}
                          disabled={chatPending || mutationPending || queuedEditPending}
                        />
                      </div>
                      <div className="studio-slideshow-editor-col">
                        <SlideEditor
                          project={project}
                          projectId={project.id}
                          slideId={activeSlideId}
                          onMutate={onTimelineMutate}
                          onProjectRefresh={loadProject}
                          disabled={chatPending || mutationPending || queuedEditPending}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="studio-timeline-with-scenes">
                    {!isSlideshow && transcriptPane.collapsed ? (
                      <PaneExpandRail
                        label="Transcript"
                        title="Show transcript"
                        orientation="horizontal"
                        onClick={transcriptPane.expand}
                      />
                    ) : null}
                    {scenesPane.collapsed ? (
                      <div className="studio-scenes-collapsed-bar">
                        <PaneExpandRail
                          label="Scenes"
                          title="Show story beats (scene strip)"
                          orientation="horizontal"
                          onClick={scenesPane.expand}
                        />
                        {scenePlan.active && scenePlan.state.phase !== 'idle' ? (
                          <ScenePlanProgressBanner
                            phase={scenePlan.state.phase}
                            sceneCount={scenePlan.state.scenes?.length ?? 0}
                            error={scenePlan.state.error}
                            onReview={() => {
                              scenesPane.expand()
                              scenePlan.openModal()
                            }}
                            onDismiss={scenePlan.dismiss}
                            onApply={
                              scenePlan.state.phase === 'preview'
                                ? () => {
                                    scenesPane.expand()
                                    void scenePlan.runApply()
                                  }
                                : undefined
                            }
                            applyDisabled={
                              chatPending ||
                              mutationPending ||
                              queuedEditPending ||
                              (scenePlan.state.scenes?.length ?? 0) === 0
                            }
                          />
                        ) : null}
                      </div>
                    ) : (
                      <SceneStrip
                        project={project}
                        projectId={project.id}
                        revision={project.revision}
                        currentFrame={currentFrame}
                        selectedSceneId={selectedSceneId}
                        relatedSceneIds={
                          new Set(
                            (project.scenes ?? [])
                              .filter((scene) =>
                                scene.clipIds.some((id) => timelineSelectedClipIds.includes(id)),
                              )
                              .map((scene) => scene.id),
                          )
                        }
                        onSelectScene={setSelectedSceneId}
                        onProjectChanged={acceptProjectPreservingAssets}
                        onMentionScene={mentionInChat}
                        onCollapseScenes={scenesPane.collapse}
                        onError={setError}
                        disabled={chatPending || mutationPending || queuedEditPending}
                        scenePlan={{
                          phase: scenePlan.state.phase,
                          scenes: scenePlan.state.scenes,
                          error: scenePlan.state.error,
                          modalOpen: scenePlan.state.modalOpen,
                          busy: scenePlan.busy,
                          onInfer: () => void scenePlan.runInfer(),
                          onApply: scenePlan.runApply,
                          onDismiss: scenePlan.dismiss,
                          onOpenModal: scenePlan.openModal,
                          onCloseModal: scenePlan.closeModal,
                        }}
                      />
                    )}
                    <div className="studio-timeline-host">
                      <Timeline
                        project={project}
                        projectId={project.id}
                        currentFrame={currentFrame}
                        locked={chatPending}
                        mutationPending={mutationPending || queuedEditPending}
                        canUndo={history.canUndo}
                        canRedo={history.canRedo}
                        focusedSceneId={selectedSceneId}
                        onClipSelectionChange={(clipIds) => {
                          setTimelineSelectedClipIds(clipIds)
                          if (
                            clipIds.length === 1 &&
                            clipIds[0] &&
                            !suggestionsDismissedClipIds.has(clipIds[0])
                          ) {
                            setContextualOpen(true)
                          }
                        }}
                        onOverlaySelectionChange={(overlayIds) => {
                          setTimelineSelectedOverlayIds(overlayIds)
                          setOverlayLayoutDraft(null)
                        }}
                        onSeek={onSeek}
                        onMutate={onTimelineMutate}
                        onPlaceSticker={(stickerId, from) => {
                          void onPlaceSticker(stickerId, from)
                        }}
                        onUndo={() => void onHistoryAction('undo')}
                        onRedo={() => void onHistoryAction('redo')}
                        onCollapse={timelinePane.collapse}
                        onRequestSuggestions={() => {
                          const clipId = timelineSelectedClipIds[0]
                          if (clipId) {
                            setSuggestionsDismissedClipIds((prev) => {
                              const next = new Set(prev)
                              next.delete(clipId)
                              return next
                            })
                          }
                          setContextualOpen(true)
                        }}
                        pipLayout={pipLayout}
                        hasPipClips={hasPipClips}
                        onPipLayoutPreset={(id) => {
                          const next = layoutFromPreset(id)
                          setPipDraft(next)
                          if (pipSaveTimerRef.current) clearTimeout(pipSaveTimerRef.current)
                          void persistPipLayout({ preset: id })
                        }}
                        onPipLayoutChange={onPipLayoutSlider}
                        onRequestVoiceover={(script) => {
                          void onSend(`generate voiceover: ${script}`)
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        {chatPane.collapsed ? (
          <div className="studio-splitter is-disabled" aria-hidden />
        ) : (
          <div
            className="studio-splitter"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize chat"
            title="Drag to resize chat"
            {...rightPane.handleProps}
          />
        )}
        <aside
          className={`studio-pane studio-pane-right${chatPane.collapsed ? ' is-pane-collapsed' : ''}`}
          style={
            chatPane.collapsed
              ? undefined
              : {
                  flex: `0 0 ${rightPane.size}px`,
                  width: rightPane.size,
                  minWidth: rightPane.size,
                  maxWidth: rightPane.size,
                }
          }
        >
          {chatPane.collapsed ? (
            <PaneExpandRail
              label="Agent"
              title="Show Director and Studio Agent"
              orientation="vertical"
              onClick={chatPane.expand}
            />
          ) : (
            <div className="studio-chat-stack">
              <div className="studio-chat-stack-toolbar">
                <span className="studio-chat-stack-toolbar-label">Director + Agent</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditsOpen(true)}
                >
                  Edits
                </button>
                <PaneCollapseControl
                  title="Hide Director and chat"
                  onClick={chatPane.collapse}
                  glyph="›"
                />
              </div>
              <div className="studio-chat-stack-body">
                {contextualOpen && timelineSelectedClipIds.length === 1 ? (
                  <ContextualDrawer
                    open
                    projectId={project.id}
                    project={project}
                    clipId={timelineSelectedClipIds[0]!}
                    disabled={chatPending || mutationPending}
                    onClose={() => {
                      const clipId = timelineSelectedClipIds[0]
                      if (clipId) {
                        setSuggestionsDismissedClipIds((prev) => new Set(prev).add(clipId))
                      }
                      setContextualOpen(false)
                    }}
                    onProjectApplied={(next) => {
                      acceptProjectPreservingAssets(next)
                      setDirectorPlan((prev) =>
                        prev && prev.status === 'draft' && prev.projectRevision !== next.revision
                          ? { ...prev, status: 'stale' }
                          : prev,
                      )
                    }}
                    onError={setError}
                  />
                ) : null}
                <IntentPanel
                  projectId={project.id}
                  intent={project.intent ?? { keywords: [] }}
                  revision={project.revision}
                  clipCount={project.clips.length}
                  disabled={chatPending || mutationPending}
                  directorPlan={directorPlan}
                  directorRebuildPrompt={project.directorRebuildPrompt ?? null}
                  onProjectSaved={acceptProjectPreservingAssets}
                  onPreviewDirector={(input) => void onPreviewDirector(input)}
                  onDismissRebuildPrompt={() => {
                    void clearDirectorRebuildPrompt()
                  }}
                  onOpenDirectorPlan={() => setDirectorModalOpen(true)}
                  onError={(message) => {
                    setError(message)
                    if (/reloading/i.test(message)) void loadProject()
                  }}
                  onFlyoutOpenChange={setRailOverlayOpen}
                />
                <CreativeStructurePanel
                  projectId={project.id}
                  revision={project.revision}
                  structure={project.creativeStructure}
                  sceneCount={(project.scenes ?? []).length}
                  fps={project.fps}
                  disabled={chatPending || mutationPending}
                  onProjectSaved={acceptProjectPreservingAssets}
                  onError={setError}
                />
                <Chat
                  messages={messages}
                  pending={chatPending}
                  liveToolNames={liveToolNames}
                  liveThoughts={liveThoughts}
                  error={chatError}
                  railOverlayOpen={railOverlayOpen}
                  onSend={onSend}
                  onCancel={() => abortRef.current?.abort()}
                  threads={chatThreads}
                  onNewChat={() => void onChatThreadAction('new')}
                  onSwitchThread={(threadId) => void onChatThreadAction('switch', threadId)}
                  onRenameThread={(threadId, title) =>
                    void onChatThreadAction('rename', threadId, title)
                  }
                  insertTokenRef={insertTokenRef}
                  assets={project.assets.filter((asset) => asset.source !== 'brand_kit')}
                  slides={isSlideshow ? (project.slideshow?.slides ?? []) : []}
                  scenes={(project.scenes ?? []).map((scene) => ({
                    id: scene.id,
                    role: scene.role,
                    label: scene.label,
                  }))}
                  clips={project.clips.map((clip) => ({ id: clip.id, assetId: clip.assetId }))}
                  overlays={project.overlays.map((overlay) => ({
                    id: overlay.id,
                    kind: overlay.kind,
                    text: overlay.text,
                  }))}
                  implicitClipId={timelineSelectedClipIds[0] ?? null}
                  implicitOverlayId={timelineSelectedOverlayIds[0] ?? null}
                  durationSeconds={project.durationFrames / project.fps}
                  projectId={project.id}
                  modelProfileId={modelProfileId}
                  reasonerModelId={reasonerModelId}
                  videoModelId={videoModelId}
                  onModelRolesChanged={(next) => {
                    setModelProfileId(next.modelProfileId)
                    setReasonerModelId(next.reasonerModelId)
                    setVideoModelId(next.videoModelId)
                  }}
                  turnMode={turnMode}
                  onTurnModeChange={(mode) => {
                    setTurnMode(mode)
                    patchProjectFields({ turnMode: mode })
                  }}
                  compositionId={project.compositionId}
                  onCraftChange={(craft: StudioCraft) => {
                    patchProjectFields({ craft, turnMode })
                  }}
                  footer={
                    <SessionSpend
                      sessionGbp={sessionGbp}
                      confirmSpend={confirmSpend}
                      onConfirmSpendChange={onConfirmSpendChange}
                      disabled={chatPending}
                      onOpenModelChoices={() => setModelCatalogueOpen(true)}
                    />
                  }
                />
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
