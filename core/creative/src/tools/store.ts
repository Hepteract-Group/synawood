import { saveProject } from '../project/save'
import type { StudioProject } from '../project/schema'
import { dropSurplusConfirmSpendInPlace } from './accept-surplus-confirm-spend'
import { assertProjectChanged } from './project-change'
import type { StudioToolContext, ToolOutcome, ToolTraceEntry } from './types'
import { plainToolError, toolFail } from './types'

// The AI SDK executes parallel tool calls concurrently. All tools in a turn
// share one StudioToolContext, so unserialized saves race on the optimistic
// revision check ("Project revision conflict"). Queue mutations per context.
const mutationQueues = new WeakMap<StudioToolContext, Promise<unknown>>()

/** Serialize work that mutates `ctx.project` / revision (branch switch, saves). */
export const runSerializedOnContext = async <T>(
  ctx: StudioToolContext,
  fn: () => Promise<T>,
): Promise<T> => {
  const prior = mutationQueues.get(ctx) ?? Promise.resolve()
  const task = prior.catch(() => undefined).then(fn)
  mutationQueues.set(ctx, task)
  return task as Promise<T>
}

export const syncToolContextProject = (ctx: StudioToolContext, project: StudioProject): void => {
  ctx.project = project
  ctx.expectedRevision = project.revision
}

export const applyProjectMutation = async (
  ctx: StudioToolContext,
  mutate: (project: StudioProject) => StudioProject,
  label = 'Tool',
): Promise<{ project: StudioProject }> =>
  runSerializedOnContext(ctx, async () => {
    const before = ctx.project
    const next = mutate(ctx.project)
    assertProjectChanged(before, next, label)
    if (ctx.persist) {
      const saved = await saveProject(ctx.supabase, next, ctx.expectedRevision)
      syncToolContextProject(ctx, saved.project)
      return { project: saved.project }
    }
    syncToolContextProject(ctx, next)
    return { project: next }
  })

export const recordToolTrace = (
  ctx: StudioToolContext,
  toolName: string,
  input: Record<string, unknown>,
  outcome: ToolOutcome,
): ToolTraceEntry => {
  const entry: ToolTraceEntry = {
    id: crypto.randomUUID(),
    toolName,
    input,
    outcome,
    at: new Date().toISOString(),
  }
  ctx.toolTrace.push(entry)
  ctx.onTool?.(entry)
  return entry
}

export const wrapTool = async (
  ctx: StudioToolContext,
  toolName: string,
  input: Record<string, unknown>,
  run: () => Promise<ToolOutcome>,
): Promise<ToolOutcome> => {
  dropSurplusConfirmSpendInPlace(toolName, input)
  try {
    await ctx.onToolStart?.(toolName)
    const outcome = await run()
    recordToolTrace(ctx, toolName, input, outcome)
    // Let SSE onTool flush before generateText starts the next model step.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    return outcome
  } catch (error) {
    const outcome = toolFail(plainToolError(error))
    recordToolTrace(ctx, toolName, input, outcome)
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    return outcome
  }
}
