import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('Studio timeline chrome (#1266)', () => {
  it('names the music bed AUDIO and the effects lane SFX', () => {
    const header = readFileSync(join(root, 'components/studio/TrackHeader.tsx'), 'utf8')
    expect(header).toMatch(/return 'AUDIO'/)
    expect(header).toMatch(/return 'SFX'/)
    expect(header).not.toMatch(/return 'A1'/)
    expect(header).not.toMatch(/return 'SND'/)
  })

  it('does not rehydrate a cancelled export after Dismiss', () => {
    const workspace = readFileSync(join(root, 'components/studio/StudioWorkspace.tsx'), 'utf8')
    expect(workspace).toMatch(/shouldHydrateLatestRenderJob/)
    expect(workspace).toMatch(/markRenderJobDismissed/)
    expect(workspace).toMatch(/readDismissedRenderJob/)
  })

  it('offers Download video from the export-complete banner (#1271)', () => {
    const progress = readFileSync(join(root, 'components/studio/RenderProgress.tsx'), 'utf8')
    expect(progress).toMatch(/downloadUrl/)
    expect(progress).toMatch(/Download video/)
    expect(progress).toMatch(/dismissReady/)
    const workspace = readFileSync(join(root, 'components/studio/StudioWorkspace.tsx'), 'utf8')
    expect(workspace).toMatch(/videoDownloadUrlFromOutputs/)
    expect(workspace).toMatch(/renderDownloadUrl/)
    expect(workspace).toMatch(/onPersistDismiss/)
    expect(workspace).toMatch(/renderReadyDismissed/)
    const bar = readFileSync(join(root, 'components/studio/ReviewBar.tsx'), 'utf8')
    expect(bar).toMatch(/IconFilm/)
    expect(bar).toMatch(/Download the encoded MP4/)
  })

  it('overlays a compact Needs inspect chip on the player (#1272)', () => {
    const banners = readFileSync(join(root, 'components/studio/WorkspaceStatusBanners.tsx'), 'utf8')
    expect(banners).toMatch(/AdReadyChip/)
    expect(banners).toMatch(/Needs inspect/)
    expect(banners).not.toMatch(/Approve is blocked/)
    expect(banners).not.toMatch(/Watch Play/)
    const workspace = readFileSync(join(root, 'components/studio/StudioWorkspace.tsx'), 'utf8')
    expect(workspace).toMatch(/player-stage-wrap/)
    expect(workspace).toMatch(/AdReadyChip/)
    const css = readFileSync(join(root, 'app/globals.css'), 'utf8')
    expect(css).toMatch(/\.ad-ready-chip \{/)
  })

  it('keeps timeline clip details short and dismissable (#1372 #1373)', () => {
    const timeline = readFileSync(join(root, 'components/studio/Timeline.tsx'), 'utf8')
    expect(timeline).toMatch(/clipTimelineLabel/)
    expect(timeline).toMatch(/clipVisibleChrome/)
    expect(timeline).toMatch(/Hide clip details/)
    expect(timeline).toMatch(/Minimize clip details/)
    expect(timeline).toMatch(/Show clip details/)
    expect(timeline).not.toMatch(/probe\?\.prompt \?\? asset\?\.probe\?\.brandKitPath/)
    const block = readFileSync(join(root, 'components/studio/TimelineClipBlock.tsx'), 'utf8')
    expect(block).toMatch(/endHandleLeftPx/)
    expect(block).toMatch(/Delete \$\{label\}/)
  })
})
