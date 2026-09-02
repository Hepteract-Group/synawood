import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  deriveBoardStatus,
  inferChannelFromDraftName,
  isoDateUtc,
  isoWeekIdFromDate,
  mondayOfIsoWeek,
  parseLabels,
  parseWeekPlanDays,
  plannedDateForWeekday,
  titleFromDraft,
  resolvePmColumn,
  weekdayFromIsoDate,
  weekOverlapsMonth,
  type MonthBoard,
  type PmColumn,
  type PostedLink,
  type ProductBoard,
  type SlotComment,
  type SlotPriority,
  type WeekBoard,
  type WeekBoardSlot,
} from './content-week-board-shared'

export type {
  BoardSlotStatus,
  MonthBoard,
  PmColumn,
  PostedLink,
  ProductBoard,
  SlotComment,
  SlotPriority,
  SlotPublishRecord,
  WeekBoard,
  WeekBoardSlot,
} from './content-week-board-shared'
export * from './content-week-board-shared'

export type ContentSlotRow = {
  id: string
  product_id: string
  week_id: string
  channel: string
  brief_path: string | null
  project_id: string | null
  status: string
  title: string | null
  description: string | null
  board_column: PmColumn
  priority: SlotPriority | null
  due_date: string | null
  planned_date: string | null
  labels: unknown
  assignee: string | null
}

type ProjectRow = { id: string; status: string }
type FinalRow = {
  id: string
  project_id: string
  content_slot_id: string | null
  thumbnail_asset_id: string | null
  attribution: { trial_export?: boolean } | null
}
type PublishRow = {
  id: string
  content_slot_id: string | null
  final_asset_id: string
  channel: string
  status: string
  scheduled_at: string | null
  external_url: string | null
}

const WEEK_DIR = /^(\d{4}-W\d{2})$/

export const repoRootFromCwd = (cwd = process.cwd()): string => {
  if (path.basename(cwd) === 'dashboard') return path.resolve(cwd, '..')
  return cwd
}

export const draftsRoot = (productId: string, repoRoot: string): string =>
  path.join(repoRoot, 'products', productId, 'content', 'drafts')

export const listWeekIds = async (productId: string, repoRoot: string): Promise<string[]> => {
  const root = draftsRoot(productId, repoRoot)
  try {
    const entries = await readdir(root, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory() && WEEK_DIR.test(entry.name))
      .map((entry) => entry.name)
      .sort()
      .reverse()
  } catch {
    return []
  }
}

type DraftFile = {
  weekId: string
  fileName: string
  draftPath: string
  channel: string
  title: string
  plannedWeekday: number
  plannedDate: string
}

export const listDraftFiles = async (
  productId: string,
  weekId: string,
  repoRoot: string,
): Promise<DraftFile[]> => {
  const weekDir = path.join(draftsRoot(productId, repoRoot), weekId)
  let names: string[] = []
  try {
    names = (await readdir(weekDir)).filter((name) => name.endsWith('.md') && name !== 'README.md')
  } catch {
    return []
  }
  names.sort()
  const readme = await readFile(path.join(weekDir, 'README.md'), 'utf8').catch(() => '')
  const planDays = parseWeekPlanDays(readme)
  const files: DraftFile[] = []
  for (const [index, fileName] of names.entries()) {
    const abs = path.join(weekDir, fileName)
    const markdown = await readFile(abs, 'utf8').catch(() => '')
    const draftPath = path
      .join('products', productId, 'content', 'drafts', weekId, fileName)
      .replaceAll('\\', '/')
    const weekday = planDays.get(fileName) ?? (index % 5) + 1
    files.push({
      weekId,
      fileName,
      draftPath,
      channel: inferChannelFromDraftName(fileName),
      title: titleFromDraft(fileName, markdown),
      plannedWeekday: weekday,
      plannedDate: plannedDateForWeekday(weekId, weekday),
    })
  }
  return files
}

export const syncSlotsFromDrafts = async (
  supabase: SupabaseClient,
  productId: string,
  weekId: string,
  drafts: DraftFile[],
): Promise<ContentSlotRow[]> => {
  for (const draft of drafts) {
    const { data: existing } = await supabase
      .from('content_slots')
      .select('id, title, planned_date')
      .eq('product_id', productId)
      .eq('week_id', weekId)
      .eq('channel', draft.channel)
      .eq('brief_path', draft.draftPath)
      .maybeSingle()

    if (existing) {
      // Backfill PM fields for rows created before planned_date/title existed.
      const updates: { title?: string; planned_date?: string } = {}
      if (!existing.title?.trim()) updates.title = draft.title
      if (!existing.planned_date) updates.planned_date = draft.plannedDate
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('content_slots')
          .update(updates)
          .eq('id', existing.id)
        if (updateError) {
          throw new Error(`Failed to backfill content slot: ${updateError.message}`)
        }
      }
      continue
    }

    const { error } = await supabase.from('content_slots').insert({
      product_id: productId,
      week_id: weekId,
      channel: draft.channel,
      brief_path: draft.draftPath,
      status: 'planned',
      title: draft.title,
      board_column: 'planned',
      planned_date: draft.plannedDate,
    })
    if (error) {
      throw new Error(`Failed to sync content slot: ${error.message}`)
    }
  }

  const { data, error } = await supabase
    .from('content_slots')
    .select('*')
    .eq('product_id', productId)
    .eq('week_id', weekId)
    .order('planned_date', { ascending: true, nullsFirst: false })
  if (error) {
    throw new Error(`Failed to load content slots: ${error.message}`)
  }
  return (data as ContentSlotRow[] | null) ?? []
}

const hydrateSlots = async (
  supabase: SupabaseClient,
  slots: ContentSlotRow[],
): Promise<WeekBoardSlot[]> => {
  if (slots.length === 0) return []

  const projectIds = slots.map((slot) => slot.project_id).filter((id): id is string => Boolean(id))
  const slotIds = slots.map((slot) => slot.id)

  const projectsById = new Map<string, ProjectRow>()
  if (projectIds.length > 0) {
    const { data, error } = await supabase
      .from('studio_projects')
      .select('id, status')
      .in('id', projectIds)
    if (error) throw new Error(`Failed to load projects: ${error.message}`)
    for (const row of (data as ProjectRow[] | null) ?? []) projectsById.set(row.id, row)
  }

  const finalsBySlot = new Map<string, FinalRow>()
  const finalsByProject = new Map<string, FinalRow>()
  {
    let query = supabase
      .from('final_assets')
      .select('id, project_id, content_slot_id, thumbnail_asset_id, attribution')
    if (slotIds.length > 0 && projectIds.length > 0) {
      query = query.or(
        `content_slot_id.in.(${slotIds.join(',')}),project_id.in.(${projectIds.join(',')})`,
      )
    } else if (slotIds.length > 0) {
      query = query.in('content_slot_id', slotIds)
    } else if (projectIds.length > 0) {
      query = query.in('project_id', projectIds)
    }
    if (slotIds.length > 0 || projectIds.length > 0) {
      const { data, error } = await query
      if (error) throw new Error(`Failed to load Final assets: ${error.message}`)
      for (const row of (data as FinalRow[] | null) ?? []) {
        if (row.content_slot_id) finalsBySlot.set(row.content_slot_id, row)
        finalsByProject.set(row.project_id, row)
      }
    }
  }

  const publishesBySlot = new Map<string, PublishRow[]>()
  const { data: publishRows, error: publishError } = await supabase
    .from('publish_records')
    .select('id, content_slot_id, final_asset_id, channel, status, scheduled_at, external_url')
    .in('content_slot_id', slotIds)
    .order('created_at', { ascending: false })
  if (publishError) throw new Error(`Failed to load publish records: ${publishError.message}`)
  for (const row of (publishRows as PublishRow[] | null) ?? []) {
    if (!row.content_slot_id) continue
    const list = publishesBySlot.get(row.content_slot_id) ?? []
    list.push(row)
    publishesBySlot.set(row.content_slot_id, list)
  }

  // Also attach publishes linked only via final asset.
  const finalIds = Array.from(
    new Set([...finalsBySlot.values(), ...finalsByProject.values()].map((row) => row.id)),
  )
  if (finalIds.length > 0) {
    const { data, error } = await supabase
      .from('publish_records')
      .select('id, content_slot_id, final_asset_id, channel, status, scheduled_at, external_url')
      .in('final_asset_id', finalIds)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`Failed to load publish records: ${error.message}`)
    for (const row of (data as PublishRow[] | null) ?? []) {
      // Map project final → slot via content_slot_id, final's slot, or owning project.
      let resolvedSlotId = row.content_slot_id
      if (!resolvedSlotId) {
        const final =
          [...finalsBySlot.values()].find((item) => item.id === row.final_asset_id) ??
          [...finalsByProject.values()].find((item) => item.id === row.final_asset_id)
        if (final?.content_slot_id) resolvedSlotId = final.content_slot_id
        else if (final) {
          const owner = slots.find((slot) => slot.project_id === final.project_id)
          resolvedSlotId = owner?.id ?? null
        }
      }
      if (!resolvedSlotId) continue
      const list = publishesBySlot.get(resolvedSlotId) ?? []
      if (!list.some((item) => item.id === row.id)) {
        list.push(row)
        publishesBySlot.set(resolvedSlotId, list)
      }
    }
  }

  const commentCounts = new Map<string, number>()
  const { data: commentRows, error: commentError } = await supabase
    .from('content_slot_comments')
    .select('slot_id')
    .in('slot_id', slotIds)
  if (!commentError) {
    for (const row of (commentRows as Array<{ slot_id: string }> | null) ?? []) {
      commentCounts.set(row.slot_id, (commentCounts.get(row.slot_id) ?? 0) + 1)
    }
  }

  return slots.map((slot) => {
    const project = slot.project_id ? projectsById.get(slot.project_id) : undefined
    const final =
      finalsBySlot.get(slot.id) ??
      (slot.project_id ? finalsByProject.get(slot.project_id) : undefined)
    const publishes = (publishesBySlot.get(slot.id) ?? []).map((row) => ({
      id: row.id,
      channel: row.channel,
      status: row.status,
      scheduledAt: row.scheduled_at,
      externalUrl: row.external_url,
    }))
    const postedLinks: PostedLink[] = publishes
      .filter((row) => row.externalUrl)
      .map((row) => ({
        id: row.id,
        channel: row.channel,
        url: row.externalUrl!,
        status: row.status,
      }))
    const hasFinal = Boolean(final)
    const postedPublish = publishes.find(
      (row) => row.status === 'manual_posted' || row.status === 'posted',
    )
    const boardStatus = deriveBoardStatus({
      projectStatus: project?.status ?? null,
      hasFinal,
      publishStatus: postedPublish?.status ?? publishes[0]?.status ?? null,
    })
    const plannedDate = slot.planned_date
    return {
      slotId: slot.id,
      weekId: slot.week_id,
      channel: slot.channel,
      title: slot.title?.trim() || slot.brief_path?.split('/').pop() || slot.channel,
      description: slot.description,
      draftPath: slot.brief_path,
      projectId: slot.project_id,
      projectStatus: project?.status ?? null,
      boardStatus,
      pmColumn: resolvePmColumn(boardStatus, slot.board_column),
      priority: slot.priority,
      dueDate: slot.due_date,
      plannedDate,
      plannedWeekday: plannedDate ? weekdayFromIsoDate(plannedDate) : null,
      labels: parseLabels(slot.labels),
      assignee: slot.assignee,
      hasFinal,
      finalAssetId: final?.id ?? null,
      trialExport: Boolean(final?.attribution?.trial_export),
      thumbnailAssetId: final?.thumbnail_asset_id ?? null,
      postedLinks,
      publishes,
      studioHref: slot.project_id ? `/studio/${slot.project_id}` : null,
      commentCount: commentCounts.get(slot.id) ?? 0,
    }
  })
}

export const buildWeekBoard = async (input: {
  supabase: SupabaseClient
  productId: string
  weekId: string
  repoRoot: string
}): Promise<WeekBoard> => {
  const drafts = await listDraftFiles(input.productId, input.weekId, input.repoRoot)
  const slots = await syncSlotsFromDrafts(input.supabase, input.productId, input.weekId, drafts)
  const hydrated = await hydrateSlots(input.supabase, slots)
  return {
    productId: input.productId,
    weekId: input.weekId,
    weekStartIso: isoDateUtc(mondayOfIsoWeek(input.weekId)),
    slots: hydrated,
  }
}

/** Kanban: every content slot for the product (syncs known draft weeks first). */
export const buildProductBoard = async (input: {
  supabase: SupabaseClient
  productId: string
  repoRoot: string
}): Promise<ProductBoard> => {
  const draftWeeks = await listWeekIds(input.productId, input.repoRoot)
  for (const weekId of draftWeeks) {
    const drafts = await listDraftFiles(input.productId, weekId, input.repoRoot)
    await syncSlotsFromDrafts(input.supabase, input.productId, weekId, drafts)
  }

  const { data, error } = await input.supabase
    .from('content_slots')
    .select('*')
    .eq('product_id', input.productId)
    .order('planned_date', { ascending: true, nullsFirst: false })
  if (error) throw new Error(`Failed to load product board: ${error.message}`)

  const slots = await hydrateSlots(input.supabase, (data as ContentSlotRow[] | null) ?? [])
  return { productId: input.productId, slots }
}

export const buildMonthBoard = async (input: {
  supabase: SupabaseClient
  productId: string
  month: string
  repoRoot: string
}): Promise<MonthBoard> => {
  const [year, monthNum] = input.month.split('-').map(Number)
  const start = `${input.month}-01`
  const endDate = new Date(Date.UTC(year, monthNum, 0))
  const end = isoDateUtc(endDate)

  // Sync draft weeks that intersect this month (also backfills planned_date/title).
  const draftWeeks = await listWeekIds(input.productId, input.repoRoot)
  const intersectingDraftWeeks = draftWeeks.filter((weekId) =>
    weekOverlapsMonth(weekId, input.month),
  )
  for (const weekId of intersectingDraftWeeks) {
    const drafts = await listDraftFiles(input.productId, weekId, input.repoRoot)
    await syncSlotsFromDrafts(input.supabase, input.productId, weekId, drafts)
  }

  // Include slots dated in the month, plus any still missing planned_date whose week overlaps.
  const { data: datedRows, error: datedError } = await input.supabase
    .from('content_slots')
    .select('*')
    .eq('product_id', input.productId)
    .gte('planned_date', start)
    .lte('planned_date', end)
  if (datedError) throw new Error(`Failed to load month slots: ${datedError.message}`)

  const { data: weekIdRows, error: weekIdError } = await input.supabase
    .from('content_slots')
    .select('week_id')
    .eq('product_id', input.productId)
  if (weekIdError) throw new Error(`Failed to load week ids: ${weekIdError.message}`)

  const intersectingWeeks = [
    ...new Set(
      ((weekIdRows as Array<{ week_id: string }> | null) ?? [])
        .map((row) => row.week_id)
        .filter((weekId) => weekOverlapsMonth(weekId, input.month)),
    ),
  ]

  let undatedRows: ContentSlotRow[] = []
  if (intersectingWeeks.length > 0) {
    const { data, error } = await input.supabase
      .from('content_slots')
      .select('*')
      .eq('product_id', input.productId)
      .in('week_id', intersectingWeeks)
      .is('planned_date', null)
    if (error) throw new Error(`Failed to load undated month slots: ${error.message}`)
    undatedRows = ((data as ContentSlotRow[] | null) ?? []).map((row) => ({
      ...row,
      // Place undated week slots on that week's Monday so the month grid can render them.
      planned_date: plannedDateForWeekday(row.week_id, 1),
    }))
  }

  const byId = new Map<string, ContentSlotRow>()
  for (const row of (datedRows as ContentSlotRow[] | null) ?? []) byId.set(row.id, row)
  for (const row of undatedRows) {
    if (!byId.has(row.id)) byId.set(row.id, row)
  }

  const merged = [...byId.values()].sort((a, b) =>
    (a.planned_date ?? '').localeCompare(b.planned_date ?? ''),
  )
  const slots = await hydrateSlots(input.supabase, merged)
  return { productId: input.productId, month: input.month, slots }
}

export const loadSlotDetail = async (
  supabase: SupabaseClient,
  slotId: string,
): Promise<{ slot: WeekBoardSlot; comments: SlotComment[] } | null> => {
  const { data, error } = await supabase
    .from('content_slots')
    .select('*')
    .eq('id', slotId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const [slot] = await hydrateSlots(supabase, [data as ContentSlotRow])
  const { data: comments, error: commentError } = await supabase
    .from('content_slot_comments')
    .select('*')
    .eq('slot_id', slotId)
    .order('created_at', { ascending: true })
  if (commentError) throw new Error(commentError.message)
  return {
    slot: slot!,
    comments: (
      (comments as Array<{
        id: string
        author: string
        body: string
        created_at: string
      }> | null) ?? []
    ).map((row) => ({
      id: row.id,
      author: row.author,
      body: row.body,
      createdAt: row.created_at,
    })),
  }
}

export const createSlot = async (
  supabase: SupabaseClient,
  input: {
    productId: string
    title: string
    channel?: string
    weekId?: string
    plannedDate?: string
    boardColumn?: PmColumn
    priority?: SlotPriority | null
    dueDate?: string | null
    labels?: string[]
    assignee?: string | null
    description?: string | null
  },
): Promise<WeekBoardSlot> => {
  const plannedDate = input.plannedDate ?? isoDateUtc(new Date())
  const weekId = input.weekId ?? isoWeekIdFromDate(new Date(`${plannedDate}T12:00:00.000Z`))
  const { data, error } = await supabase
    .from('content_slots')
    .insert({
      product_id: input.productId,
      week_id: weekId,
      channel: input.channel ?? 'linkedin_founder',
      brief_path: null,
      status: 'planned',
      title: input.title.trim(),
      description: input.description ?? null,
      board_column: input.boardColumn ?? 'planned',
      priority: input.priority ?? null,
      due_date: input.dueDate ?? null,
      planned_date: plannedDate,
      labels: input.labels ?? [],
      assignee: input.assignee ?? null,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  const [slot] = await hydrateSlots(supabase, [data as ContentSlotRow])
  return slot!
}

export const updateSlot = async (
  supabase: SupabaseClient,
  slotId: string,
  patch: Partial<{
    title: string
    description: string | null
    channel: string
    boardColumn: PmColumn
    priority: SlotPriority | null
    dueDate: string | null
    plannedDate: string | null
    labels: string[]
    assignee: string | null
    weekId: string
  }>,
): Promise<WeekBoardSlot> => {
  if (patch.boardColumn === 'done') {
    const detail = await loadSlotDetail(supabase, slotId)
    if (!detail?.slot.postedLinks.length) {
      throw new Error('Paste a live post URL before moving to Done')
    }
  }

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.title !== undefined) row.title = patch.title.trim()
  if (patch.description !== undefined) row.description = patch.description
  if (patch.channel !== undefined) row.channel = patch.channel
  if (patch.boardColumn !== undefined) row.board_column = patch.boardColumn
  if (patch.priority !== undefined) row.priority = patch.priority
  if (patch.dueDate !== undefined) row.due_date = patch.dueDate
  if (patch.plannedDate !== undefined) {
    row.planned_date = patch.plannedDate
    if (patch.plannedDate) {
      row.week_id = isoWeekIdFromDate(new Date(`${patch.plannedDate}T12:00:00.000Z`))
    }
  }
  if (patch.weekId !== undefined) row.week_id = patch.weekId
  if (patch.labels !== undefined) row.labels = patch.labels
  if (patch.assignee !== undefined) row.assignee = patch.assignee

  const { data, error } = await supabase
    .from('content_slots')
    .update(row)
    .eq('id', slotId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  const [slot] = await hydrateSlots(supabase, [data as ContentSlotRow])
  return slot!
}

export const deleteSlot = async (supabase: SupabaseClient, slotId: string): Promise<void> => {
  const { error } = await supabase.from('content_slots').delete().eq('id', slotId)
  if (error) throw new Error(error.message)
}

export const addComment = async (
  supabase: SupabaseClient,
  input: { slotId: string; body: string; author?: string },
): Promise<SlotComment> => {
  const { data, error } = await supabase
    .from('content_slot_comments')
    .insert({
      slot_id: input.slotId,
      body: input.body.trim(),
      author: input.author?.trim() || 'founder',
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  const row = data as { id: string; author: string; body: string; created_at: string }
  return { id: row.id, author: row.author, body: row.body, createdAt: row.created_at }
}
