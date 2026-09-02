'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  readActiveProductIdFromDocument,
  rememberActiveProductId,
} from '@/lib/active-product-cookie'
import { pickActiveProductId } from '@/lib/resolve-client-product-id'
import { readApiJson } from '@/lib/read-api-json'
import {
  isoDateUtc,
  isoWeekIdFromDate,
  mondayOfIsoWeek,
  monthLabel,
  pmColumnLabel,
  shiftIsoWeek,
  slotScheduledPublishes,
  weekdayLabels,
  weekRangeLabel,
  type MonthBoard,
  type PmColumn,
  type ProductBoard,
  type WeekBoard as WeekBoardData,
  type WeekBoardSlot,
} from '@/lib/content-week-board-shared'
import { WorkSlotCard } from '@/components/content/WorkSlotCard'
import { WorkSlotDetailModal } from '@/components/content/WorkSlotDetailModal'
import { SchedulePublishModal, type SchedulePhase } from '@/components/content/SchedulePublishModal'
import {
  scheduleFailureUi,
  postedNowBanner,
  postingNowBanner,
  scheduledBanner,
  schedulingBanner,
  type ScheduleEmptyKind,
} from '@/lib/schedule-publish-copy'

type BoardResponse = {
  productId: string
  board: WeekBoardData | null
  monthBoard: MonthBoard | null
  productBoard: ProductBoard | null
  error?: string
}

type ViewMode = 'week' | 'month' | 'board'

const PM_COLUMNS: PmColumn[] = ['planned', 'in_progress', 'done']

type ScheduleUi = {
  slot: WeekBoardSlot
  mode: 'schedule' | 'now'
  phase: SchedulePhase
  when: string
  error: string | null
  resultNote: string | null
  emptyKind: ScheduleEmptyKind
  minimized: boolean
}

const pad2 = (n: number) => String(n).padStart(2, '0')

const defaultScheduleInput = (): string => {
  const date = new Date(Date.now() + 60 * 60 * 1000)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

const currentMonth = () => {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

const formatDayHeading = (weekId: string, weekday: number): { label: string; date: string } => {
  const monday = mondayOfIsoWeek(weekId)
  const day = new Date(monday)
  day.setUTCDate(monday.getUTCDate() + (weekday - 1))
  const date = day.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
  return { label: weekdayLabels[weekday - 1] ?? `D${weekday}`, date }
}

const monthCells = (month: string): Array<{ iso: string; inMonth: boolean }> => {
  const [year, monthNum] = month.split('-').map(Number)
  const first = new Date(Date.UTC(year, monthNum - 1, 1))
  const startWeekday = first.getUTCDay() || 7
  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate()
  const cells: Array<{ iso: string; inMonth: boolean }> = []
  const lead = startWeekday - 1
  for (let i = 0; i < lead; i++) {
    const d = new Date(first)
    d.setUTCDate(first.getUTCDate() - (lead - i))
    cells.push({ iso: isoDateUtc(d), inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      iso: isoDateUtc(new Date(Date.UTC(year, monthNum - 1, day))),
      inMonth: true,
    })
  }
  while (cells.length % 7 !== 0) {
    const last = new Date(`${cells[cells.length - 1]!.iso}T12:00:00.000Z`)
    last.setUTCDate(last.getUTCDate() + 1)
    cells.push({ iso: isoDateUtc(last), inMonth: false })
  }
  return cells
}

export const WorkBoard = () => {
  const [productId, setProductId] = useState<string | null>(null)
  const [weekId, setWeekId] = useState(() => isoWeekIdFromDate(new Date()))
  const [month, setMonth] = useState(currentMonth)
  const [weekBoard, setWeekBoard] = useState<WeekBoardData | null>(null)
  const [monthBoard, setMonthBoard] = useState<MonthBoard | null>(null)
  const [productBoard, setProductBoard] = useState<ProductBoard | null>(null)
  const [view, setView] = useState<ViewMode>('board')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [backfillBusy, setBackfillBusy] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [focusPaste, setFocusPaste] = useState(false)
  const [dragOverColumn, setDragOverColumn] = useState<PmColumn | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createPending, setCreatePending] = useState(false)
  const [studioOpening, setStudioOpening] = useState(false)
  const [scheduleUi, setScheduleUi] = useState<ScheduleUi | null>(null)

  const slots =
    view === 'month'
      ? (monthBoard?.slots ?? [])
      : view === 'board'
        ? (productBoard?.slots ?? [])
        : (weekBoard?.slots ?? [])

  const reload = async (opts?: { weekId?: string; month?: string; view?: ViewMode }) => {
    if (!productId) return
    const activeView = opts?.view ?? view
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({ productId })
      if (activeView === 'board') {
        query.set('scope', 'board')
      } else if (activeView === 'month' || opts?.month) {
        query.set('month', opts?.month ?? month)
      } else {
        query.set('weekId', opts?.weekId ?? weekId)
      }
      const response = await fetch(`/api/content/board?${query}`)
      const body = (await response.json()) as BoardResponse
      if (!response.ok) throw new Error(body.error ?? 'Failed to load work board')
      if (body.board) {
        setWeekBoard(body.board)
        setWeekId(body.board.weekId)
      }
      if (body.monthBoard) setMonthBoard(body.monthBoard)
      if (body.productBoard) setProductBoard(body.productBoard)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load work board')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/products')
        const body = await readApiJson<{
          memberships?: Array<{ productId: string }>
          error?: string
        }>(response)
        if (!response.ok) throw new Error(body.error ?? 'Could not load Products.')
        const cookieId = readActiveProductIdFromDocument()
        const picked = pickActiveProductId(body.memberships ?? [], cookieId)
        if (picked && picked !== cookieId) rememberActiveProductId(picked)
        setProductId(picked)
        if (!picked) setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load Products.')
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!productId) return
    void reload({ view })
  }, [productId, view])

  const applyScheduleFailure = (status: number, message: string) => {
    const failure = scheduleFailureUi(status, message)
    setScheduleUi((current) =>
      current
        ? {
            ...current,
            phase: failure.phase,
            ...(failure.phase === 'empty'
              ? { emptyKind: failure.emptyKind, error: null }
              : { error: failure.error }),
            minimized: false,
          }
        : current,
    )
  }

  const runSchedule = async (slot: WeekBoardSlot, scheduledAt?: string) => {
    if (!productId) return
    setScheduleUi((current) =>
      current
        ? { ...current, phase: 'inflight', error: null, minimized: current.minimized }
        : {
            slot,
            mode: scheduledAt ? 'schedule' : 'now',
            phase: 'inflight',
            when: '',
            error: null,
            resultNote: null,
            emptyKind: 'not_configured',
            minimized: false,
          },
    )
    try {
      const response = await fetch('/api/studio/publish/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          projectId: slot.projectId,
          finalAssetId: slot.finalAssetId,
          channel: slot.channel,
          contentSlotId: slot.slotId,
          ...(scheduledAt ? { scheduledAt } : {}),
        }),
      })
      const body = (await response.json()) as {
        error?: string
        record?: { status?: string; scheduledAt?: string | null }
        instructions?: string
      }
      if (!response.ok) {
        applyScheduleFailure(response.status, body.error ?? 'Failed to schedule')
        return
      }
      const status = body.record?.status
      const note =
        status === 'posted'
          ? postedNowBanner(slot.channel)
          : scheduledBanner(slot.channel, body.record?.scheduledAt ?? scheduledAt ?? null)
      setScheduleUi((current) =>
        current ? { ...current, phase: 'done', resultNote: note, error: null } : current,
      )
      await reload()
    } catch (err) {
      applyScheduleFailure(0, err instanceof Error ? err.message : 'Failed to schedule')
    }
  }

  const onSchedule = (slot: WeekBoardSlot) => {
    setDetailId(null)
    setScheduleUi({
      slot,
      mode: 'schedule',
      phase: 'compose',
      when: defaultScheduleInput(),
      error: null,
      resultNote: null,
      emptyKind: 'not_configured',
      minimized: false,
    })
  }

  const onPostNow = (slot: WeekBoardSlot) => {
    setDetailId(null)
    setScheduleUi({
      slot,
      mode: 'now',
      phase: 'inflight',
      when: '',
      error: null,
      resultNote: null,
      emptyKind: 'not_configured',
      minimized: false,
    })
    void runSchedule(slot)
  }

  const onCancelPublish = (slot: WeekBoardSlot) => {
    const target = (slot.publishes ?? []).find(
      (row) => row.status === 'failed' || row.status === 'scheduled',
    )
    if (!target) return
    setError(null)
    void (async () => {
      try {
        const response = await fetch(`/api/studio/publish/${target.id}`, { method: 'DELETE' })
        const body = (await response.json()) as { error?: string }
        if (!response.ok) throw new Error(body.error ?? 'Failed to cancel')
        await reload()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to cancel')
      }
    })()
  }

  const onPasteUrl = (slot: WeekBoardSlot) => {
    setFocusPaste(true)
    setDetailId(slot.slotId)
  }

  const cardScheduleProps = {
    onSchedule,
    onPostNow,
    onCancelPublish,
    onPasteUrl,
  }

  const onOpenStudio = (slot: WeekBoardSlot) => {
    if (slot.studioHref) {
      setStudioOpening(true)
      window.location.href = slot.studioHref
      return
    }
    setStudioOpening(true)
    setError(null)
    void (async () => {
      try {
        const response = await fetch(`/api/content/slots/${slot.slotId}/studio`, { method: 'POST' })
        const body = (await response.json()) as { href?: string; error?: string }
        if (!response.ok || !body.href) throw new Error(body.error ?? 'Failed to open Studio')
        window.location.href = body.href
      } catch (err) {
        setStudioOpening(false)
        setError(err instanceof Error ? err.message : 'Failed to open Studio')
      }
    })()
  }

  const moveToColumn = async (slotId: string, boardColumn: PmColumn) => {
    setError(null)
    const target = slots.find((slot) => slot.slotId === slotId)
    if (boardColumn === 'done' && target && target.postedLinks.length === 0) {
      setError('Paste the live post URL on the card to move to Done.')
      setFocusPaste(true)
      setDetailId(slotId)
      return
    }

    const apply = (list: WeekBoardSlot[]) =>
      list.map((slot) => (slot.slotId === slotId ? { ...slot, pmColumn: boardColumn } : slot))
    if (weekBoard) setWeekBoard({ ...weekBoard, slots: apply(weekBoard.slots) })
    if (monthBoard) setMonthBoard({ ...monthBoard, slots: apply(monthBoard.slots) })
    if (productBoard) setProductBoard({ ...productBoard, slots: apply(productBoard.slots) })
    try {
      const response = await fetch(`/api/content/slots/${slotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardColumn }),
      })
      if (!response.ok) {
        const body = (await response.json()) as { error?: string }
        throw new Error(body.error ?? 'Failed to move task')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move task')
      void reload()
    }
  }

  const onCreate = () => {
    const title = createTitle.trim()
    if (!productId || !title || createPending) return
    setError(null)
    setCreatePending(true)
    void (async () => {
      try {
        const createWeekId = view === 'week' ? weekId : isoWeekIdFromDate(new Date())
        const plannedDate =
          view === 'month'
            ? `${month}-01`
            : view === 'week'
              ? isoDateUtc(mondayOfIsoWeek(weekId))
              : isoDateUtc(new Date())
        const response = await fetch('/api/content/slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId,
            title,
            weekId: createWeekId,
            plannedDate,
          }),
        })
        const body = (await response.json()) as { slot?: WeekBoardSlot; error?: string }
        if (!response.ok || !body.slot) throw new Error(body.error ?? 'Failed to create task')
        setCreateTitle('')
        setCreateOpen(false)
        setFocusPaste(false)
        setDetailId(body.slot.slotId)
        await reload()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create task')
      } finally {
        setCreatePending(false)
      }
    })()
  }

  const byColumn = useMemo(() => {
    const groups: Record<PmColumn, WeekBoardSlot[]> = {
      planned: [],
      in_progress: [],
      done: [],
    }
    for (const slot of slots) groups[slot.pmColumn].push(slot)
    return groups
  }, [slots])

  const byWeekday = useMemo(() => {
    const groups: Record<number, WeekBoardSlot[]> = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
    }
    for (const slot of weekBoard?.slots ?? []) {
      const day =
        slot.plannedWeekday && slot.plannedWeekday >= 1 && slot.plannedWeekday <= 7
          ? slot.plannedWeekday
          : 1
      groups[day].push(slot)
    }
    return groups
  }, [weekBoard])

  const byDate = useMemo(() => {
    const map = new Map<string, WeekBoardSlot[]>()
    for (const slot of monthBoard?.slots ?? []) {
      if (!slot.plannedDate) continue
      const list = map.get(slot.plannedDate) ?? []
      list.push(slot)
      map.set(slot.plannedDate, list)
    }
    return map
  }, [monthBoard])

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1 + delta, 1))
    const next = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    setMonth(next)
    void reload({ month: next, view: 'month' })
  }

  const shiftWeek = (delta: number) => {
    const next = shiftIsoWeek(weekId, delta)
    setWeekId(next)
    void reload({ weekId: next, view: 'week' })
  }

  const inflight = scheduleUi?.phase === 'inflight'
  const serverScheduled = slotScheduledPublishes(slots)
  const scheduleBannerCopy =
    scheduleUi && inflight
      ? scheduleUi.mode === 'now'
        ? postingNowBanner(scheduleUi.slot.channel)
        : schedulingBanner(scheduleUi.slot.channel)
      : serverScheduled[0]
        ? scheduledBanner(serverScheduled[0].channel, serverScheduled[0].scheduledAt)
        : null

  return (
    <div className="work-board">
      <div className="work-board-toolbar">
        {view === 'month' ? (
          <div className="work-board-week">
            <button type="button" className="work-nav-btn" onClick={() => shiftMonth(-1)}>
              ←
            </button>
            <strong>{monthLabel(month)}</strong>
            <button type="button" className="work-nav-btn" onClick={() => shiftMonth(1)}>
              →
            </button>
          </div>
        ) : view === 'week' ? (
          <div className="work-board-week">
            <button type="button" className="work-nav-btn" onClick={() => shiftWeek(-1)}>
              ←
            </button>
            <strong>{weekRangeLabel(weekId)}</strong>
            <button type="button" className="work-nav-btn" onClick={() => shiftWeek(1)}>
              →
            </button>
          </div>
        ) : (
          <div className="work-board-week">
            <strong>All tasks</strong>
          </div>
        )}

        <div className="work-board-views" role="tablist" aria-label="Work board view">
          {(['week', 'month', 'board'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={view === mode}
              className={view === mode ? 'is-active' : undefined}
              onClick={() => setView(mode)}
            >
              {mode === 'week' ? 'Week' : mode === 'month' ? 'Month' : 'Board'}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="work-nav-btn"
          disabled={backfillBusy || !productId}
          onClick={() => {
            if (!productId) return
            setBackfillBusy(true)
            setError(null)
            setNotice(null)
            void (async () => {
              const response = await fetch(
                `/api/products/${encodeURIComponent(productId)}/structure/backfill`,
                { method: 'POST' },
              )
              const body = (await response.json().catch(() => null)) as {
                error?: string
                scanned?: number
                updated?: number
                skipped?: number
              } | null
              if (!response.ok) throw new Error(body?.error ?? 'Could not tag structure.')
              setNotice(
                `Tagged ${body?.updated ?? 0} project(s). Scanned ${body?.scanned ?? 0}, skipped ${body?.skipped ?? 0}.`,
              )
            })()
              .catch((err) =>
                setError(err instanceof Error ? err.message : 'Could not tag structure.'),
              )
              .finally(() => setBackfillBusy(false))
          }}
        >
          {backfillBusy ? 'Tagging…' : 'Tag empty structure'}
        </button>
        <button
          type="button"
          className="work-new-btn"
          disabled={!productId}
          onClick={() => setCreateOpen((open) => !open)}
        >
          New task
        </button>
      </div>

      {createOpen ? (
        <div className="work-create-row">
          <input
            value={createTitle}
            placeholder="Task title"
            onChange={(event) => setCreateTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onCreate()
            }}
          />
          <button type="button" onClick={onCreate} disabled={!createTitle.trim() || createPending}>
            {createPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      ) : null}

      {studioOpening || createPending ? (
        <p className="work-status-banner" role="status" aria-live="polite">
          {studioOpening ? 'Opening Studio…' : 'Creating task…'}
        </p>
      ) : null}

      {scheduleBannerCopy ? (
        <div className="render-status-banner is-active work-schedule-banner" role="status">
          <p>{scheduleBannerCopy}</p>
          {scheduleUi?.minimized ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                setScheduleUi((current) => (current ? { ...current, minimized: false } : current))
              }
            >
              Details
            </button>
          ) : null}
        </div>
      ) : null}

      {!productId && !loading ? (
        <div className="settings-empty" role="alert">
          <h2 className="settings-empty-title">No active Product</h2>
          <p className="page-lede">Choose a Product before opening the work board.</p>
          <Link href="/products" className="btn btn-primary">
            Open Products
          </Link>
        </div>
      ) : null}

      {loading ? <p className="muted">Loading work board…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {backfillBusy ? (
        <div className="settings-alert" role="status">
          <p>Tagging empty structure on Studio projects…</p>
        </div>
      ) : null}
      {notice ? (
        <div className="settings-alert is-ok" role="status">
          <p>{notice}</p>
        </div>
      ) : null}

      {productId && !loading && slots.length === 0 ? (
        <p className="muted">
          {view === 'board'
            ? 'No work yet. Create a task to get started.'
            : 'No work yet for this period. Create a task or switch views.'}
        </p>
      ) : null}

      {productId && !loading && view === 'week' && weekBoard ? (
        <div className="work-calendar" role="region" aria-label="Week calendar">
          {[1, 2, 3, 4, 5, 6, 7].map((weekday) => {
            const heading = formatDayHeading(weekBoard.weekId, weekday)
            const daySlots = byWeekday[weekday] ?? []
            return (
              <section key={weekday} className="work-calendar-day">
                <header className="work-calendar-day-header">
                  <strong>{heading.label}</strong>
                  <span className="muted">{heading.date}</span>
                </header>
                <div className="work-calendar-day-body">
                  {daySlots.length === 0 ? (
                    <p className="work-calendar-empty muted">—</p>
                  ) : (
                    daySlots.map((slot) => (
                      <WorkSlotCard
                        key={slot.slotId}
                        slot={slot}
                        compact
                        onChanged={() => void reload()}
                        onOpen={(item) => {
                          setFocusPaste(false)
                          setDetailId(item.slotId)
                        }}
                        {...cardScheduleProps}
                      />
                    ))
                  )}
                </div>
              </section>
            )
          })}
        </div>
      ) : null}

      {productId && !loading && view === 'month' && monthBoard ? (
        <div className="work-month" role="region" aria-label="Month calendar">
          <div className="work-month-head">
            {weekdayLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="work-month-grid">
            {monthCells(month).map((cell) => (
              <section
                key={cell.iso}
                className={`work-month-cell${cell.inMonth ? '' : ' is-outside'}`}
              >
                <header>{Number(cell.iso.slice(-2))}</header>
                <div className="work-month-cell-body">
                  {(byDate.get(cell.iso) ?? []).map((slot) => (
                    <button
                      key={slot.slotId}
                      type="button"
                      className="work-month-chip"
                      onClick={() => {
                        setFocusPaste(false)
                        setDetailId(slot.slotId)
                      }}
                    >
                      {slot.title}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : null}

      {productId && !loading && view === 'board' ? (
        <div className="work-kanban" role="region" aria-label="Product board">
          {PM_COLUMNS.map((column) => (
            <section
              key={column}
              className={`work-kanban-column is-${column}${dragOverColumn === column ? ' is-drop' : ''}`}
              onDragOver={(event) => {
                event.preventDefault()
                setDragOverColumn(column)
              }}
              onDragLeave={() =>
                setDragOverColumn((current) => (current === column ? null : current))
              }
              onDrop={(event) => {
                event.preventDefault()
                setDragOverColumn(null)
                const slotId = event.dataTransfer.getData('text/slot-id')
                if (slotId) void moveToColumn(slotId, column)
              }}
            >
              <header className="work-kanban-column-header">
                <h3>{pmColumnLabel(column)}</h3>
                <span className="work-kanban-count">{byColumn[column].length}</span>
              </header>
              <div className="work-kanban-column-body">
                {byColumn[column].length === 0 ? (
                  <p className="muted work-kanban-empty">Drop tasks here</p>
                ) : (
                  byColumn[column].map((slot) => (
                    <WorkSlotCard
                      key={slot.slotId}
                      slot={slot}
                      draggable
                      onChanged={() => void reload()}
                      onOpen={(item) => {
                        setFocusPaste(false)
                        setDetailId(item.slotId)
                      }}
                      {...cardScheduleProps}
                    />
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {detailId && productId ? (
        <WorkSlotDetailModal
          slotId={detailId}
          productId={productId}
          open
          focusPaste={focusPaste}
          onClose={() => {
            setDetailId(null)
            setFocusPaste(false)
          }}
          onChanged={() => void reload()}
          onOpenStudio={onOpenStudio}
          {...cardScheduleProps}
        />
      ) : null}

      {scheduleUi && !scheduleUi.minimized ? (
        <SchedulePublishModal
          slot={scheduleUi.slot}
          mode={scheduleUi.mode}
          phase={scheduleUi.phase}
          when={scheduleUi.when}
          error={scheduleUi.error}
          resultNote={scheduleUi.resultNote}
          emptyKind={scheduleUi.emptyKind}
          onWhenChange={(value) =>
            setScheduleUi((current) => (current ? { ...current, when: value } : current))
          }
          onConfirm={() => {
            const iso = new Date(scheduleUi.when).toISOString()
            void runSchedule(scheduleUi.slot, iso)
          }}
          onMinimize={() =>
            setScheduleUi((current) => (current ? { ...current, minimized: true } : current))
          }
          onDismiss={() => {
            const slotId = scheduleUi.slot.slotId
            const paste = scheduleUi.phase === 'empty' || scheduleUi.phase === 'error'
            setScheduleUi(null)
            if (paste) {
              setFocusPaste(true)
              setDetailId(slotId)
            }
          }}
        />
      ) : null}
    </div>
  )
}
