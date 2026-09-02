import { describe, expect, it } from 'vitest'
import {
  applyPipLayoutToProject,
  layoutFromPreset,
  layoutRegions,
  mergePipLayout,
  normalizePipLayout,
  type PipLayout,
} from './pip-layout'

describe('pip layout', () => {
  it('maps legacy corner + widthPct onto a rect', () => {
    const layout = normalizePipLayout({ corner: 'bottom-right', widthPct: 0.32 })
    expect(layout.mode).toBe('pip')
    expect(layout.x).toBeGreaterThan(0.4)
    expect(layout.y).toBeGreaterThan(0.4)
  })

  it('splits the frame for news / side-by-side', () => {
    const news = layoutRegions(layoutFromPreset('news'))
    expect(news.main.x).toBe(0)
    expect(news.main.width).toBeCloseTo(0.58)
    expect(news.pip.x).toBeCloseTo(0.58)
    expect(news.pip.width).toBeCloseTo(0.42)
  })

  it('keeps main full-bleed when mode is pip', () => {
    const regions = layoutRegions(layoutFromPreset('bottom-right'))
    expect(regions.main).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })

  it('bumps revision when applying onto a project', () => {
    const next = applyPipLayoutToProject(
      { revision: 3, pipLayout: undefined as PipLayout | undefined },
      layoutFromPreset('side-by-side'),
    )
    expect(next.revision).toBe(4)
    expect(next.pipLayout?.mode).toBe('split')
  })

  it('swaps which side holds the main picture', () => {
    const swapped = mergePipLayout(layoutFromPreset('news'), { swap: true })
    expect(swapped.mainSide).toBe('end')
    expect(layoutRegions(swapped).main.x).toBeCloseTo(0.42)
  })

  it('overlays numeric patches on a preset', () => {
    const layout = mergePipLayout(undefined, { preset: 'news', mainPct: 0.62 })
    expect(layout.mode).toBe('split')
    expect(layout.mainPct).toBeCloseTo(0.62)
    expect(layout.x).toBeCloseTo(0.62)
    expect(layout.width).toBeCloseTo(0.38)
  })
})
