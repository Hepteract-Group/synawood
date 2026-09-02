import { z } from 'zod'

export const pipModeSchema = z.enum(['pip', 'split'])
export const pipAxisSchema = z.enum(['horizontal', 'vertical'])
export const pipMainSideSchema = z.enum(['start', 'end'])
export const pipPresetIdSchema = z.enum([
  'bottom-right',
  'top-right',
  'bottom-left',
  'top-left',
  'side-by-side',
  'news',
])

export type PipMode = z.infer<typeof pipModeSchema>
export type PipPresetId = z.infer<typeof pipPresetIdSchema>

/** 0–1 fractions of the composition frame. */
export const pipLayoutSchema = z
  .object({
    mode: pipModeSchema.default('pip'),
    x: z.number().min(0).max(1).default(0.58),
    y: z.number().min(0).max(1).default(0.68),
    width: z.number().min(0.08).max(1).default(0.38),
    height: z.number().min(0.08).max(1).default(0.22),
    axis: pipAxisSchema.optional(),
    mainPct: z.number().min(0.2).max(0.8).optional(),
    mainSide: pipMainSideSchema.optional(),
  })
  .strict()

export type PipLayout = z.infer<typeof pipLayoutSchema>

export type LayoutRect = { x: number; y: number; width: number; height: number }

/** ADR-0051: readable overlay — news/split, not a postage-stamp corner. */
export const NEWS_SPLIT_LAYOUT: PipLayout = pipLayoutSchema.parse({
  mode: 'split',
  axis: 'horizontal',
  mainPct: 0.58,
  mainSide: 'start',
  x: 0.58,
  y: 0,
  width: 0.42,
  height: 1,
})

export const DEFAULT_PIP_LAYOUT: PipLayout = NEWS_SPLIT_LAYOUT

export const PIP_LAYOUT_PRESETS: ReadonlyArray<{
  id: PipPresetId
  label: string
  hint: string
  layout: PipLayout
}> = [
  {
    id: 'bottom-right',
    label: 'Bottom right',
    hint: 'Small inset',
    layout: pipLayoutSchema.parse({
      mode: 'pip',
      x: 0.56,
      y: 0.7,
      width: 0.4,
      height: 0.24,
    }),
  },
  {
    id: 'top-right',
    label: 'Top right',
    hint: 'Small inset',
    layout: pipLayoutSchema.parse({
      mode: 'pip',
      x: 0.56,
      y: 0.06,
      width: 0.4,
      height: 0.24,
    }),
  },
  {
    id: 'bottom-left',
    label: 'Bottom left',
    hint: 'Small inset',
    layout: pipLayoutSchema.parse({
      mode: 'pip',
      x: 0.04,
      y: 0.7,
      width: 0.4,
      height: 0.24,
    }),
  },
  {
    id: 'top-left',
    label: 'Top left',
    hint: 'Small inset',
    layout: pipLayoutSchema.parse({
      mode: 'pip',
      x: 0.04,
      y: 0.06,
      width: 0.4,
      height: 0.24,
    }),
  },
  {
    id: 'side-by-side',
    label: 'Side by side',
    hint: 'Main left, overlay right',
    layout: pipLayoutSchema.parse({
      mode: 'split',
      axis: 'horizontal',
      mainPct: 0.5,
      mainSide: 'start',
      x: 0.5,
      y: 0,
      width: 0.5,
      height: 1,
    }),
  },
  {
    id: 'news',
    label: 'News split',
    hint: 'Presenter left, graphic right',
    layout: NEWS_SPLIT_LAYOUT,
  },
]

const clamp01 = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const clampPipLayout = (layout: PipLayout): PipLayout => {
  const width = clamp01(layout.width, 0.08, 1)
  const height = clamp01(layout.height, 0.08, 1)
  return pipLayoutSchema.parse({
    mode: layout.mode,
    width,
    height,
    x: clamp01(layout.x, 0, 1 - width),
    y: clamp01(layout.y, 0, 1 - height),
    ...(layout.axis ? { axis: layout.axis } : {}),
    ...(layout.mainPct == null ? {} : { mainPct: clamp01(layout.mainPct, 0.2, 0.8) }),
    ...(layout.mainSide ? { mainSide: layout.mainSide } : {}),
  })
}

const cornerToLayout = (
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
  widthPct: number,
): PipLayout => {
  const width = clamp01(widthPct, 0.16, 0.5)
  const pipHeight = clamp01(width * 0.58, 0.14, 0.32)
  const x = corner.endsWith('left') ? 0.04 : 1 - width - 0.04
  const y = corner.startsWith('top') ? 0.06 : 1 - pipHeight - 0.06
  return clampPipLayout(pipLayoutSchema.parse({ mode: 'pip', x, y, width, height: pipHeight }))
}

/** Accept stored layout, legacy `{ corner, widthPct }`, or empty. */
export const normalizePipLayout = (input: unknown): PipLayout => {
  if (!input || typeof input !== 'object') return DEFAULT_PIP_LAYOUT
  const row = input as Record<string, unknown>
  if (typeof row.corner === 'string' && typeof row.widthPct === 'number') {
    return cornerToLayout(
      row.corner as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
      row.widthPct,
    )
  }
  const parsed = pipLayoutSchema.safeParse(row)
  if (parsed.success) return clampPipLayout(parsed.data)
  return DEFAULT_PIP_LAYOUT
}

export const layoutFromPreset = (id: PipPresetId): PipLayout => {
  const preset = PIP_LAYOUT_PRESETS.find((row) => row.id === id)
  return preset ? clampPipLayout(preset.layout) : DEFAULT_PIP_LAYOUT
}

export const swapPipSides = (layout: PipLayout): PipLayout => {
  const base = layout.mode === 'split' ? layout : layoutFromPreset('side-by-side')
  const mainSide = (base.mainSide ?? 'start') === 'start' ? 'end' : 'start'
  return clampPipLayout(syncSplitRect({ ...base, mode: 'split', mainSide }))
}

export const layoutRegions = (layout: PipLayout): { main: LayoutRect; pip: LayoutRect } => {
  const next = clampPipLayout(layout)
  if (next.mode !== 'split') {
    return {
      main: { x: 0, y: 0, width: 1, height: 1 },
      pip: { x: next.x, y: next.y, width: next.width, height: next.height },
    }
  }
  const axis = next.axis ?? 'horizontal'
  const mainPct = next.mainPct ?? 0.5
  const mainFirst = (next.mainSide ?? 'start') === 'start'
  if (axis === 'vertical') {
    const main: LayoutRect = mainFirst
      ? { x: 0, y: 0, width: 1, height: mainPct }
      : { x: 0, y: 1 - mainPct, width: 1, height: mainPct }
    const pip: LayoutRect = mainFirst
      ? { x: 0, y: mainPct, width: 1, height: 1 - mainPct }
      : { x: 0, y: 0, width: 1, height: 1 - mainPct }
    return { main, pip }
  }
  const main: LayoutRect = mainFirst
    ? { x: 0, y: 0, width: mainPct, height: 1 }
    : { x: 1 - mainPct, y: 0, width: mainPct, height: 1 }
  const pip: LayoutRect = mainFirst
    ? { x: mainPct, y: 0, width: 1 - mainPct, height: 1 }
    : { x: 0, y: 0, width: 1 - mainPct, height: 1 }
  return { main, pip }
}

/** Keep stored x/y/width/height in sync with split math so overlays can use the same rect. */
export const syncSplitRect = (layout: PipLayout): PipLayout => {
  if (layout.mode !== 'split') return layout
  const { pip } = layoutRegions(layout)
  return { ...layout, x: pip.x, y: pip.y, width: pip.width, height: pip.height }
}

export type PipLayoutPatch = {
  preset?: PipPresetId
  mode?: PipMode
  x?: number
  y?: number
  width?: number
  height?: number
  axis?: z.infer<typeof pipAxisSchema>
  mainPct?: number
  mainSide?: z.infer<typeof pipMainSideSchema>
  swap?: boolean
}

export const mergePipLayout = (current: unknown, patch: PipLayoutPatch): PipLayout => {
  const base = patch.preset ? layoutFromPreset(patch.preset) : normalizePipLayout(current)
  if (patch.swap) return swapPipSides(base)
  const next: PipLayout = {
    ...base,
    ...(patch.mode ? { mode: patch.mode } : {}),
    ...(patch.x != null ? { x: patch.x } : {}),
    ...(patch.y != null ? { y: patch.y } : {}),
    ...(patch.width != null ? { width: patch.width } : {}),
    ...(patch.height != null ? { height: patch.height } : {}),
    ...(patch.axis ? { axis: patch.axis } : {}),
    ...(patch.mainPct != null ? { mainPct: patch.mainPct } : {}),
    ...(patch.mainSide ? { mainSide: patch.mainSide } : {}),
  }
  return clampPipLayout(next.mode === 'split' ? syncSplitRect(next) : next)
}

export const applyPipLayoutToProject = <T extends { pipLayout?: PipLayout; revision: number }>(
  project: T,
  layout: PipLayout,
): T => ({
  ...project,
  pipLayout: clampPipLayout(layout.mode === 'split' ? syncSplitRect(layout) : layout),
  revision: project.revision + 1,
})
