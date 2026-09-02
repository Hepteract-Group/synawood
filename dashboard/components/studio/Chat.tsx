'use client'

import { assetTokenFor, type AssetRefLike } from '@synawood/creative/project/asset-token'
import {
  implicitGroundedLabel,
  listGroundingChips,
  removeGroundingToken,
  resolveChatGrounding,
  stripGroundingTokens,
  type ChatGroundingPayload,
  type ClipRefLike,
  type OverlayRefLike,
} from '@synawood/creative/project/grounding-token'
import type { SceneRefLike } from '@synawood/creative/project/scene-token'
import type { SlideRefLike } from '@synawood/creative/project/slide-token'
import { shouldClearComposerDraft, syncComposerTextareaHeight } from '@/lib/studio-chat-composer'
import { groupChatHistory } from '@/lib/studio-chat-history'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  IconArrowUp,
  IconAudio,
  IconChevronLeft,
  IconChevronRight,
  IconClapperboard,
  IconClock,
  IconFile,
  IconFilm,
  IconImage,
  IconLayers,
  IconPlus,
  IconPresentation,
  IconStopSquare,
} from '../icons'
import {
  buildMentionRows,
  mentionHintFor,
  mentionQueryAt,
  type MentionCategoryId,
  type MentionItem,
  type MentionRow,
} from './chatMentions'
import { mcpDisplayLabel } from '@synawood/creative/mcp/inbound-copy'
import type { TurnMode } from '@synawood/creative/agent/turn-mode'
import type { StudioCraft } from '@synawood/creative/project/client'
import { ChatMarkdown } from './ChatMarkdown'
import { ModelRolePickers } from './ModelRolePickers'
import { AgentTurnPickers } from './AgentTurnPickers'
import { PaneCollapseControl } from './PaneChrome'
import { humanizeStudioError, leftoverConfirmSpendCopy } from '@/lib/humanize-studio-error'

export type ChatLiveThought = {
  id: string
  label: string
  detail: string
}

export type ChatActivityEntry = {
  id: string
  toolName: string
  outcome: { ok: boolean; summary?: string; error?: string }
}

export type StudioChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  /** Tool receipts for this turn (ADR-0019). */
  activity?: ChatActivityEntry[]
}

const formatToolName = (toolName: string): string => {
  const raw = mcpDisplayLabel(toolName) ?? toolName
  const spaced = raw.replaceAll('_', ' ').trim()
  if (!spaced) return toolName
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const isMcpEntry = (toolName: string): boolean => mcpDisplayLabel(toolName) !== null

const UserGroundingMessage = ({
  text,
  clips,
  overlays,
  assets,
}: {
  text: string
  clips: readonly ClipRefLike[]
  overlays: readonly OverlayRefLike[]
  assets: readonly AssetRefLike[]
}) => {
  const chips = listGroundingChips({ text, clips, overlays, assets })
  const stripped = stripGroundingTokens(text)
  return (
    <div className="chat-user-grounding">
      {chips.length > 0 ? (
        <ul className="chat-grounding-chips is-readonly" aria-label="Grounded">
          {chips.map((chip) => (
            <li key={`${chip.kind}-${chip.start}`}>
              <span className="chat-grounding-chip">{chip.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {stripped ? <p>{stripped}</p> : chips.length === 0 ? <p>{text}</p> : null}
    </div>
  )
}

const ChatActivity = ({
  entries,
  liveToolNames = [],
  liveThoughts = [],
}: {
  entries: ChatActivityEntry[]
  liveToolNames?: string[]
  liveThoughts?: ChatLiveThought[]
}) => {
  const failedCount = entries.filter((entry) => !entry.outcome.ok).length
  const liveCount = liveThoughts.length + liveToolNames.length
  const working = liveCount > 0
  const stepCount = entries.length + liveCount
  const latestLive = liveThoughts.at(-1)?.label ?? formatToolName(liveToolNames.at(-1) ?? '')
  const [open, setOpen] = useState(true)
  useEffect(() => {
    if (failedCount > 0 || liveCount > 0) setOpen(true)
  }, [failedCount, entries.length, liveCount])

  return (
    <div className={`chat-activity ${failedCount > 0 ? 'has-failure' : ''}`}>
      <button
        type="button"
        className="chat-activity-toggle"
        aria-expanded={open}
        aria-label="Thoughts"
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          {working ? 'Working' : 'Thoughts'} · {stepCount} step
          {stepCount === 1 ? '' : 's'}
          {failedCount > 0 ? ` · ${failedCount} failed` : ''}
          {latestLive ? ` · ${latestLive}` : ''}
        </span>
        <span className="chat-activity-caret" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? (
        <ul className="chat-activity-list">
          {entries.map((entry) => {
            const raw = entry.outcome.ok ? entry.outcome.summary : entry.outcome.error
            const body = entry.outcome.ok ? raw : humanizeStudioError(raw)
            const long = Boolean(body && body.length > 180)
            const mcp = isMcpEntry(entry.toolName)
            return (
              <li
                key={entry.id}
                className={`chat-activity-row ${entry.outcome.ok ? 'is-ok' : 'is-bad'}`}
              >
                <span className="chat-activity-name">
                  {formatToolName(entry.toolName)}
                  {mcp ? (
                    <span
                      className="chat-activity-mcp-badge"
                      title="This call went to your connected MCP server. Project and brand data may have been sent."
                    >
                      MCP
                    </span>
                  ) : null}
                </span>
                {long ? (
                  <details className="chat-activity-details">
                    <summary>Show detail</summary>
                    <span className="chat-activity-outcome">{body}</span>
                  </details>
                ) : (
                  <span className="chat-activity-outcome">{body}</span>
                )}
              </li>
            )
          })}
          {liveThoughts.map((thought) => (
            <li key={thought.id} className="chat-activity-row is-live">
              <span className="chat-activity-name">{thought.label}</span>
              <span className="chat-activity-outcome">{thought.detail}</span>
            </li>
          ))}
          {liveToolNames.map((name, index) => (
            <li key={`live-${name}-${index}`} className="chat-activity-row is-live">
              <span className="chat-activity-name">{formatToolName(name)}</span>
              <span className="chat-activity-outcome">Running…</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

const mentionItemIcon = (item: MentionItem) => {
  if (item.kind === 'slide') return <IconPresentation />
  if (item.kind === 'scene') return <IconClapperboard />
  switch (item.asset.kind) {
    case 'image':
      return <IconImage />
    case 'video':
      return <IconFilm />
    case 'audio':
      return <IconAudio />
    default:
      return <IconFile />
  }
}

const mentionCategoryIcon = (id: MentionCategoryId) => {
  switch (id) {
    case 'images':
      return <IconImage />
    case 'videos':
      return <IconFilm />
    case 'audio':
      return <IconAudio />
    case 'slides':
      return <IconPresentation />
    case 'scenes':
      return <IconLayers />
    default:
      return <IconFile />
  }
}

const MentionIcon = ({
  tone,
  children,
}: {
  tone: 'image' | 'video' | 'audio' | 'slide' | 'scene' | 'other' | 'back' | 'folder'
  children: ReactNode
}) => <span className={`chat-mention-icon tone-${tone}`}>{children}</span>

const toneForItem = (
  item: MentionItem,
): 'image' | 'video' | 'audio' | 'slide' | 'scene' | 'other' => {
  if (item.kind === 'slide') return 'slide'
  if (item.kind === 'scene') return 'scene'
  if (item.asset.kind === 'image') return 'image'
  if (item.asset.kind === 'video') return 'video'
  if (item.asset.kind === 'audio') return 'audio'
  return 'other'
}

const toneForCategory = (
  id: MentionCategoryId,
): 'image' | 'video' | 'audio' | 'slide' | 'scene' | 'other' | 'folder' => {
  if (id === 'images') return 'image'
  if (id === 'videos') return 'video'
  if (id === 'audio') return 'audio'
  if (id === 'slides') return 'slide'
  if (id === 'scenes') return 'scene'
  return 'folder'
}

export type ChatThreadSummary = {
  id: string
  title: string
  createdAt: string
  active: boolean
}

type ChatProps = {
  messages: StudioChatMessage[]
  pending: boolean
  error: string | null
  /**
   * Called when the user submits a message. Return `false` to keep the draft
   * in the composer (e.g. when a confirmation modal intercepts the send).
   */
  onSend: (message: string, grounding?: ChatGroundingPayload) => void | false
  onCancel?: () => void
  threads?: ChatThreadSummary[]
  onNewChat?: () => void
  onSwitchThread?: (threadId: string) => void
  onRenameThread?: (threadId: string, title: string) => void
  /** Insert a token (e.g. @asset:… / @slide:… / @scene:…) into the composer without sending. */
  insertTokenRef?: React.MutableRefObject<((token: string) => void) | null>
  onCollapse?: () => void
  /** Project assets for @mention autocomplete + drag-drop. */
  assets?: AssetRefLike[]
  /** Slideshow slides for @slide: autocomplete. */
  slides?: SlideRefLike[]
  /** Story beats for @scene: autocomplete. */
  scenes?: SceneRefLike[]
  /** Timeline clips for @clip: chips and implicit grounding. */
  clips?: ClipRefLike[]
  /** Overlays for @overlay: chips and implicit grounding. */
  overlays?: OverlayRefLike[]
  implicitClipId?: string | null
  implicitOverlayId?: string | null
  durationSeconds?: number
  projectId?: string
  modelProfileId?: string
  reasonerModelId?: string | null
  videoModelId?: string | null
  onModelRolesChanged?: (next: {
    modelProfileId: string
    reasonerModelId: string | null
    videoModelId: string | null
  }) => void
  turnMode?: TurnMode
  onTurnModeChange?: (mode: TurnMode) => void
  compositionId?: string | null
  onCraftChange?: (craft: StudioCraft) => void
  /** Optional footer (session spend) kept inside the chat grid so it cannot overlap. */
  footer?: ReactNode
  /** Tool names currently executing (SSE tool_start). */
  liveToolNames?: string[]
  /** Live model/tool-choice rows while the turn runs (#1274). */
  liveThoughts?: ChatLiveThought[]
  /** Intent/Director overlay is open: hide chrome and skip tab (#1313). */
  railOverlayOpen?: boolean
}

export const Chat = ({
  messages,
  pending,
  error,
  onSend,
  onCancel,
  threads = [],
  onNewChat,
  onSwitchThread,
  onRenameThread,
  insertTokenRef,
  onCollapse,
  assets = [],
  slides = [],
  scenes = [],
  clips = [],
  overlays = [],
  implicitClipId = null,
  implicitOverlayId = null,
  durationSeconds,
  projectId,
  modelProfileId,
  reasonerModelId,
  videoModelId,
  onModelRolesChanged,
  turnMode,
  onTurnModeChange,
  compositionId,
  onCraftChange,
  footer,
  liveToolNames = [],
  liveThoughts = [],
  railOverlayOpen = false,
}: ChatProps) => {
  const [draft, setDraft] = useState('')
  const [cursor, setCursor] = useState(0)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionBrowse, setMentionBrowse] = useState<MentionCategoryId | null>(null)
  const [dropActive, setDropActive] = useState(false)
  const [composerError, setComposerError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const historyRootRef = useRef<HTMLDivElement | null>(null)
  const historySearchRef = useRef<HTMLInputElement | null>(null)
  const historyListId = useId()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyQuery, setHistoryQuery] = useState('')
  const activeThread = threads.find((thread) => thread.active) ?? threads[0]
  const [titleDraft, setTitleDraft] = useState(activeThread?.title ?? '')

  const clearComposer = useCallback(() => {
    setDraft('')
    setMentionOpen(false)
    setMentionBrowse(null)
  }, [])

  useEffect(() => {
    setTitleDraft(activeThread?.title ?? '')
  }, [activeThread?.id, activeThread?.title])

  const commitTitle = () => {
    if (!onRenameThread || !activeThread) return
    const next = titleDraft.trim()
    if (!next || next === activeThread.title) {
      setTitleDraft(activeThread.title)
      return
    }
    onRenameThread(activeThread.id, next)
  }

  const mention = mentionQueryAt(draft, cursor)
  const rows = useMemo(
    () =>
      mention && mentionOpen
        ? buildMentionRows({
            assets,
            slides,
            scenes,
            query: mention.query,
            browse: mentionBrowse,
          })
        : [],
    [assets, slides, scenes, mention, mentionOpen, mentionBrowse],
  )

  const implicit = useMemo(
    () => ({ clipId: implicitClipId, overlayId: implicitOverlayId }),
    [implicitClipId, implicitOverlayId],
  )
  const groundingChips = useMemo(
    () => listGroundingChips({ text: draft, clips, overlays, assets }),
    [draft, clips, overlays, assets],
  )
  const groundedName = useMemo(
    () =>
      implicitGroundedLabel({
        text: draft,
        clips,
        overlays,
        assets,
        implicit,
      }),
    [draft, clips, overlays, assets, implicit],
  )
  const historyGroups = useMemo(
    () => groupChatHistory(threads, historyQuery, Date.now()),
    [threads, historyQuery],
  )
  const closeHistory = useCallback(() => {
    setHistoryOpen(false)
    setHistoryQuery('')
  }, [])

  const trySend = () => {
    const value = draft.trim()
    if (!value || pending) return
    const resolved = resolveChatGrounding({
      text: value,
      clips,
      overlays,
      assets,
      implicit,
      durationSeconds,
    })
    if (resolved.error) {
      setComposerError(resolved.error)
      return
    }
    setComposerError(null)
    const result = onSend(
      value,
      Object.keys(resolved.payload).length > 0 ? resolved.payload : undefined,
    )
    if (
      !shouldClearComposerDraft({
        sendAccepted: result !== false,
        turnPending: false,
      })
    ) {
      return
    }
    clearComposer()
  }

  useEffect(() => {
    if (!shouldClearComposerDraft({ sendAccepted: false, turnPending: pending })) return
    clearComposer()
  }, [pending, clearComposer])

  const insertAtCursor = (token: string, replaceFrom?: number, replaceTo?: number) => {
    const el = textareaRef.current
    const start = replaceFrom ?? el?.selectionStart ?? draft.length
    const end = replaceTo ?? el?.selectionEnd ?? draft.length
    const next = `${draft.slice(0, start)}${token}${draft.slice(end)}`
    const caret = start + token.length
    setDraft(next)
    setMentionOpen(false)
    setMentionBrowse(null)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(caret, caret)
      setCursor(caret)
    })
  }

  useEffect(() => {
    if (!insertTokenRef) return
    insertTokenRef.current = (token: string) => {
      setDraft((current) => (current.trim() ? `${current.trimEnd()} ${token} ` : `${token} `))
      textareaRef.current?.focus()
    }
    return () => {
      insertTokenRef.current = null
    }
  }, [insertTokenRef])

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    syncComposerTextareaHeight(el)
  }, [draft])

  useEffect(() => {
    if (!historyOpen) return
    historySearchRef.current?.focus()
    // Not a native <dialog>: close on outside click / Escape like BranchSwitcher.
    const onPointerDown = (event: MouseEvent) => {
      if (!historyRootRef.current?.contains(event.target as Node)) closeHistory()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeHistory()
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [historyOpen, closeHistory])

  useEffect(() => {
    if (railOverlayOpen) closeHistory()
  }, [railOverlayOpen, closeHistory])

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    endRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  }, [messages, pending, liveToolNames, liveThoughts])

  useEffect(() => {
    if (!mention) {
      setMentionOpen(false)
      setMentionBrowse(null)
      return
    }
    setMentionOpen(true)
    setMentionIndex(0)
  }, [mention?.start, mention?.query])

  useEffect(() => {
    setMentionIndex(0)
  }, [mentionBrowse])

  const acceptItem = (item: MentionItem) => {
    if (!mention) return
    insertAtCursor(`${item.token} `, mention.start, cursor)
  }

  const activateRow = (row: MentionRow) => {
    if (row.type === 'item') {
      acceptItem(row.item)
      return
    }
    if (row.type === 'category') {
      setMentionBrowse(row.category.id)
      setMentionIndex(0)
      return
    }
    setMentionBrowse(null)
    setMentionIndex(0)
  }

  const onDropAsset = (assetId: string) => {
    const asset = assets.find((item) => item.id === assetId)
    if (!asset) return
    insertAtCursor(draft.trim() ? ` ${assetTokenFor(asset)} ` : `${assetTokenFor(asset)} `)
  }

  const mentionHint = mentionHintFor({
    hasSlides: slides.length > 0,
    hasScenes: scenes.length > 0,
  })
  const lastUserIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'user') return i
    }
    return -1
  })()
  const liveAssistant =
    pending && lastUserIndex >= 0
      ? messages.slice(lastUserIndex + 1).find((item) => item.role === 'assistant')
      : undefined

  return (
    <div
      className="studio-chat"
      aria-labelledby="studio-chat-title"
      inert={railOverlayOpen || undefined}
    >
      <div className="studio-chat-chrome">
        <header className={`studio-chat-header${messages.length === 0 ? ' is-compact' : ''}`}>
          <div className="studio-chat-heading">
            {onRenameThread && activeThread ? (
              <input
                id="studio-chat-title"
                className="studio-chat-title-input"
                value={titleDraft}
                aria-label="Chat name"
                disabled={pending}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={commitTitle}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    event.currentTarget.blur()
                  }
                  if (event.key === 'Escape') {
                    setTitleDraft(activeThread.title)
                    event.currentTarget.blur()
                  }
                }}
              />
            ) : messages.length > 0 ? (
              <strong id="studio-chat-title">{activeThread?.title ?? 'Studio Agent'}</strong>
            ) : (
              <strong id="studio-chat-title" className="sr-only">
                Studio Agent
              </strong>
            )}
          </div>
          <div className="studio-chat-header-tools">
            {onNewChat ? (
              <button
                type="button"
                className="studio-chat-icon-btn"
                onClick={onNewChat}
                disabled={pending || messages.length === 0}
                title="New chat"
                aria-label="New chat"
              >
                <IconPlus />
              </button>
            ) : null}
            {onSwitchThread && threads.length > 1 ? (
              <div className="studio-chat-history-wrap" ref={historyRootRef}>
                <button
                  type="button"
                  className={`studio-chat-icon-btn${historyOpen ? ' is-active' : ''}`}
                  onClick={() =>
                    setHistoryOpen((open) => {
                      if (open) setHistoryQuery('')
                      return !open
                    })
                  }
                  disabled={pending}
                  title="Previous chats"
                  aria-label="Previous chats"
                  aria-expanded={historyOpen}
                  aria-haspopup="dialog"
                  aria-controls={historyListId}
                  data-guide="studio-chat-history"
                >
                  <IconClock />
                </button>
                {historyOpen ? (
                  <div
                    id={historyListId}
                    className="studio-chat-history-popover"
                    role="dialog"
                    aria-label="Previous chats"
                  >
                    <input
                      ref={historySearchRef}
                      type="search"
                      className="studio-chat-history-search"
                      value={historyQuery}
                      onChange={(event) => setHistoryQuery(event.target.value)}
                      placeholder="Search chats"
                      aria-label="Search chats"
                    />
                    {historyGroups.length === 0 ? (
                      <p className="studio-chat-history-empty">No chats match that search.</p>
                    ) : (
                      <div className="studio-chat-history-body">
                        {historyGroups.map((group) => (
                          <section key={group.id} className="studio-chat-history-group">
                            <h3 className="studio-chat-history-heading">{group.label}</h3>
                            <ul className="studio-chat-history-list">
                              {group.threads.map((thread) => (
                                <li key={thread.id}>
                                  <button
                                    type="button"
                                    className={`studio-chat-history-item${thread.active ? ' is-active' : ''}`}
                                    disabled={pending}
                                    onClick={() => {
                                      if (!thread.active) onSwitchThread(thread.id)
                                      closeHistory()
                                    }}
                                  >
                                    {thread.title}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </section>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
            {pending ? (
              <span className="studio-chat-live" role="status" aria-live="polite">
                Working
              </span>
            ) : null}
            {onCollapse ? (
              <PaneCollapseControl title="Hide chat" onClick={onCollapse} glyph="›" />
            ) : null}
          </div>
        </header>
      </div>
      <div className="studio-chat-log" role="log" aria-relevant="additions" aria-busy={pending}>
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p className="chat-empty-brand">Studio Agent</p>
            <p className="chat-empty-lede muted">{mentionHint}</p>
            <p className="chat-empty-title">Try something like</p>
            <ul>
              <li>add captions “Edit PDFs without the Adobe headache”</li>
              <li>set hook “Stuck on a PDF?”</li>
              {slides.length > 0 ? (
                <li>shorten @slide:1 headline</li>
              ) : (
                <li>@still-image at 5 seconds</li>
              )}
            </ul>
          </div>
        ) : (
          messages.map((message) => {
            const isLiveAssistant = Boolean(liveAssistant && message.id === liveAssistant.id)
            const activity = message.activity ?? []
            const showActivity =
              message.role === 'assistant' && activity.length > 0 && !isLiveAssistant
            const hidePlaceholder =
              isLiveAssistant && (message.content === 'Working…' || message.content === '')
            return (
              <div key={message.id} className={`chat-bubble chat-${message.role}`}>
                <span className="chat-role">{message.role}</span>
                {showActivity ? <ChatActivity entries={activity} /> : null}
                {message.content && !hidePlaceholder ? (
                  message.role === 'assistant' ? (
                    <ChatMarkdown
                      content={
                        leftoverConfirmSpendCopy.test(message.content)
                          ? humanizeStudioError(message.content)
                          : message.content
                      }
                    />
                  ) : (
                    <UserGroundingMessage
                      text={message.content}
                      clips={clips}
                      overlays={overlays}
                      assets={assets}
                    />
                  )
                ) : null}
              </div>
            )
          })
        )}
        {pending ? (
          <ChatActivity
            entries={liveAssistant?.activity ?? []}
            liveToolNames={liveToolNames}
            liveThoughts={liveThoughts}
          />
        ) : null}
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div ref={endRef} />
      </div>
      <form
        className={`studio-chat-form${dropActive ? ' is-drop-target' : ''}`}
        onSubmit={(event) => {
          event.preventDefault()
          trySend()
        }}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes('application/x-mos-asset-id')) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
          setDropActive(true)
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDropActive(false)
          const assetId = event.dataTransfer.getData('application/x-mos-asset-id')
          if (assetId) onDropAsset(assetId)
        }}
      >
        <div className="studio-chat-composer">
          {groundingChips.length > 0 ? (
            <ul className="chat-grounding-chips" aria-label="Grounding">
              {groundingChips.map((chip) => (
                <li key={`${chip.kind}-${chip.start}`}>
                  <span className="chat-grounding-chip">
                    {chip.label}
                    <button
                      type="button"
                      className="chat-grounding-chip-remove"
                      aria-label={`Remove ${chip.label}`}
                      onClick={() => setDraft(removeGroundingToken(draft, chip))}
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <label className="sr-only" htmlFor="studio-chat-input">
            Message to Studio Agent
          </label>
          <textarea
            id="studio-chat-input"
            ref={textareaRef}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              setCursor(event.target.selectionStart)
              if (composerError) setComposerError(null)
            }}
            onSelect={(event) => setCursor(event.currentTarget.selectionStart)}
            onKeyDown={(event) => {
              if (mentionOpen && rows.length > 0) {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setMentionIndex((index) => (index + 1) % rows.length)
                  return
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  setMentionIndex((index) => (index - 1 + rows.length) % rows.length)
                  return
                }
                if (event.key === 'Enter' || event.key === 'Tab') {
                  event.preventDefault()
                  activateRow(rows[mentionIndex] ?? rows[0]!)
                  return
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  if (mentionBrowse) {
                    setMentionBrowse(null)
                    return
                  }
                  setMentionOpen(false)
                  return
                }
                if (event.key === 'Backspace' && mentionBrowse && mention?.query === '') {
                  // Let delete happen; stay in browse until Esc
                }
              }
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            rows={1}
            placeholder="Instruct the Studio Agent… (@ for media, scenes, slides)"
            disabled={pending}
          />
          {mentionOpen && rows.length > 0 ? (
            <ul className="chat-mention-list" role="listbox" aria-label="Mentions">
              {rows.map((row, index) => (
                <li key={row.key} className={`chat-mention-row is-${row.type}`}>
                  {row.type === 'item' ? (
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === mentionIndex}
                      className={`chat-mention-option${index === mentionIndex ? ' is-active' : ''}`}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        activateRow(row)
                      }}
                    >
                      <MentionIcon tone={toneForItem(row.item)}>
                        {mentionItemIcon(row.item)}
                      </MentionIcon>
                      <span className="chat-mention-copy">
                        <span className="chat-mention-label">{row.item.label}</span>
                        <span className="chat-mention-kind">{row.item.meta}</span>
                      </span>
                    </button>
                  ) : row.type === 'category' ? (
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === mentionIndex}
                      className={`chat-mention-option chat-mention-category${index === mentionIndex ? ' is-active' : ''}`}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        activateRow(row)
                      }}
                    >
                      <MentionIcon tone={toneForCategory(row.category.id)}>
                        {mentionCategoryIcon(row.category.id)}
                      </MentionIcon>
                      <span className="chat-mention-copy">
                        <span className="chat-mention-label">{row.category.label}</span>
                        <span className="chat-mention-kind">{row.count}</span>
                      </span>
                      <span className="chat-mention-chevron" aria-hidden>
                        <IconChevronRight />
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === mentionIndex}
                      className={`chat-mention-option chat-mention-back${index === mentionIndex ? ' is-active' : ''}`}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        activateRow(row)
                      }}
                    >
                      <MentionIcon tone="back">
                        <IconChevronLeft />
                      </MentionIcon>
                      <span className="chat-mention-copy">
                        <span className="chat-mention-label">All mentions</span>
                        <span className="chat-mention-kind">Back</span>
                      </span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          {dropActive ? (
            <p className="chat-drop-hint muted">Drop to insert @asset reference</p>
          ) : null}
          <div className="studio-chat-inline-bar">
            {projectId && modelProfileId && onModelRolesChanged ? (
              <ModelRolePickers
                projectId={projectId}
                modelProfileId={modelProfileId}
                reasonerModelId={reasonerModelId}
                videoModelId={videoModelId}
                disabled={pending}
                onChanged={onModelRolesChanged}
                leading={
                  turnMode && onTurnModeChange ? (
                    <AgentTurnPickers
                      turnMode={turnMode}
                      onTurnModeChange={onTurnModeChange}
                      compositionId={compositionId}
                      onCraftChange={onCraftChange}
                      disabled={pending}
                    />
                  ) : null
                }
              />
            ) : (
              <span />
            )}
            <div className="studio-chat-send">
              {pending && onCancel ? (
                <button
                  type="button"
                  className="studio-chat-send-btn is-stop"
                  onClick={onCancel}
                  title="Stop"
                  aria-label="Stop"
                >
                  <IconStopSquare />
                </button>
              ) : (
                <button
                  type="submit"
                  className="studio-chat-send-btn"
                  disabled={!draft.trim()}
                  title="Send"
                  aria-label="Send"
                >
                  <IconArrowUp />
                </button>
              )}
            </div>
          </div>
          {composerError ? (
            <p className="chat-grounding-error" role="alert">
              {composerError}
            </p>
          ) : null}
          {!composerError && groundedName ? (
            <p className="chat-grounding-implicit">Grounded: {groundedName}</p>
          ) : null}
          {turnMode && turnMode !== 'execute' ? (
            <p className="chat-grounding-implicit" role="status">
              {turnMode === 'plan'
                ? 'Plan cannot write the Player. Switch to Execute to make the ad.'
                : turnMode === 'inspect'
                  ? 'Inspect watches the player. Switch to Execute to make the change.'
                  : 'Ask is read-only. Switch to Execute to make the ad.'}
            </p>
          ) : null}
        </div>
      </form>
      {footer ? <div className="studio-chat-footer">{footer}</div> : null}
    </div>
  )
}
