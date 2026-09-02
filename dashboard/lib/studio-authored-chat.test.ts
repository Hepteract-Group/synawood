import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('Studio authored player + chat composer (#1257)', () => {
  it('clears the composer when a turn is pending', () => {
    const chat = readFileSync(join(root, 'components/studio/Chat.tsx'), 'utf8')
    expect(chat).toMatch(/shouldClearComposerDraft/)
    expect(chat).toMatch(/turnPending: pending/)
  })

  it('sets iframe allow=autoplay without allow-same-origin', () => {
    const pane = readFileSync(join(root, 'components/studio/AuthoredPlayerPane.tsx'), 'utf8')
    expect(pane).toMatch(/AUTHORED_IFRAME_ALLOW/)
    expect(pane).toMatch(/allow=\{AUTHORED_IFRAME_ALLOW\}/)
    expect(pane).not.toMatch(/allow-same-origin/)
  })

  it('plays timeline audio in the page on Transport click (#1259)', () => {
    const pane = readFileSync(join(root, 'components/studio/AuthoredPlayerPane.tsx'), 'utf8')
    expect(pane).toMatch(/<audio/)
    expect(pane).toMatch(/authoredAudioClock/)
    expect(pane).toMatch(/assets\/\$\{asset\.id\}\/content/)
    expect(pane).toMatch(/authoredIframeInputProps/)
    expect(pane).not.toMatch(/Date\.now\(\)/)
  })

  it('restarts Play from frame 0 after the cut ends (#1268)', () => {
    const pane = readFileSync(join(root, 'components/studio/AuthoredPlayerPane.tsx'), 'utf8')
    expect(pane).toMatch(/authoredPlayStartFrame/)
    expect(pane).toMatch(/authoredCoveredLastFrame/)
    expect(pane).toMatch(/playFromClock/)
    expect(pane).toMatch(/coveredLastFrame/)
    const frame = readFileSync(join(root, 'app/authored-player/authored-player-frame.tsx'), 'utf8')
    expect(frame).toMatch(/authoredPlayStartFrame/)
    expect(frame).toMatch(/playFromFrame/)
    expect(frame).toMatch(/coveredLastFrame/)
    expect(frame).toMatch(/player.seekTo\(start\)/)
    expect(frame).toMatch(/requestAnimationFrame/)
  })

  it('sizes the authored iframe from the player stage, not a collapsing shell', () => {
    const css = readFileSync(join(root, 'app/globals.css'), 'utf8')
    const wrap = css.match(/\.player-stage-wrap \{[^}]+\}/)?.[0] ?? ''
    const shell = css.match(/\.studio-pane-center \.player-shell \{[^}]+\}/)?.[0] ?? ''
    const frameCq =
      css.match(
        /@supports \(width: 1cqh\) \{\s*\.studio-pane-center \.player-frame \{[^}]+\}/,
      )?.[0] ?? ''
    expect(wrap).toMatch(/container-type: size/)
    expect(wrap).toMatch(/align-items: stretch/)
    expect(shell).not.toMatch(/container-type: size/)
    expect(frameCq).toMatch(/min\(100cqi, calc\(100cqh/)
    expect(frameCq).toMatch(/min\(100cqh, calc\(100cqi/)
    expect(frameCq).not.toMatch(/min\(100%/)
  })

  it('does not wait on iframe media and retries ready until init (#1265)', () => {
    const pane = readFileSync(join(root, 'components/studio/AuthoredPlayerPane.tsx'), 'utf8')
    const frame = readFileSync(join(root, 'app/authored-player/authored-player-frame.tsx'), 'utf8')
    expect(pane).toMatch(/runtimeError/)
    expect(pane).toMatch(/setRuntimeError/)
    expect(pane).toMatch(/SYNAWOOD_AUTHORED_MESSAGE.error/)
    expect(frame).toMatch(/pauseWhenLoading: false/)
    expect(frame).toMatch(/pauseWhenBuffering: false/)
    expect(frame).toMatch(/errorFallback/)
    expect(frame).toMatch(/SYNAWOOD_AUTHORED_MESSAGE.error/)
    expect(frame).toMatch(/role="alert"/)
    expect(frame).toMatch(/hydrateAuthoredInputProps/)
    expect(frame).toMatch(/setInterval/)
    expect(frame).toMatch(/gotInitRef/)
  })

  it('counts picture clips toward talking-head shared audio tags', () => {
    const pane = readFileSync(join(root, 'components/studio/PlayerPane.tsx'), 'utf8')
    expect(pane).toMatch(/talkingHeadProps\.clips\.length/)
    expect(pane).toMatch(/pipClips/)
    expect(pane).not.toMatch(/mediaKind === 'audio'\)\.length/)
  })

  it('lets the operator dismiss compile and inspect notes (#1371)', () => {
    const pane = readFileSync(join(root, 'components/studio/AuthoredPlayerPane.tsx'), 'utf8')
    expect(pane).toMatch(/Dismiss player note/)
    expect(pane).toMatch(/Hide player note/)
    expect(pane).toMatch(/banner.kind !== 'building'/)
    const banners = readFileSync(join(root, 'components/studio/WorkspaceStatusBanners.tsx'), 'utf8')
    expect(banners).toMatch(/Hide review notes/)
    expect(banners).toMatch(/'all'/)
  })
})

describe('Studio agent live thoughts (#1270 / #1274)', () => {
  it('opens Thoughts during the turn with live model and tool rows', () => {
    const chat = readFileSync(join(root, 'components/studio/Chat.tsx'), 'utf8')
    expect(chat).toMatch(/liveToolNames/)
    expect(chat).toMatch(/liveThoughts/)
    expect(chat).toMatch(/chat-activity-row is-live/)
    expect(chat).toMatch(/Running…/)
    expect(chat).not.toMatch(/Thinking…/)
    expect(chat).not.toMatch(/planning=\{/)
    expect(chat).not.toMatch(/chat-pending muted/)
    const workspace = readFileSync(join(root, 'components/studio/StudioWorkspace.tsx'), 'utf8')
    expect(workspace).toMatch(/Calling model/)
    expect(workspace).toMatch(/Chose this tool/)
    expect(workspace).toMatch(/event === 'tool_choice'/)
  })

  it('flushes SSE from a TransformStream before runTurn finishes', () => {
    const route = readFileSync(join(root, 'app/api/studio/chat/route.ts'), 'utf8')
    expect(route).toMatch(/new TransformStream/)
    expect(route).toMatch(/onLive:/)
    expect(route).toMatch(/send\('tool_choice'/)
    expect(route).toMatch(/send\('tool_start'/)
    expect(route).toMatch(/onToolStart:/)
    expect(route).toMatch(/X-Accel-Buffering/)
    expect(route).toMatch(/SSE_PAD/)
    expect(route).toMatch(/Content-Encoding': 'identity'/)
    expect(route).not.toMatch(/for \(const entry of result\.toolTrace\)/)
    expect(route).not.toMatch(/new ReadableStream/)
    const workspace = readFileSync(join(root, 'components/studio/StudioWorkspace.tsx'), 'utf8')
    expect(workspace).toMatch(/event === 'tool_start'/)
    expect(workspace).toMatch(/event === 'status'/)
    const turn = readFileSync(join(root, '../core/creative/src/agent/run-turn.ts'), 'utf8')
    expect(turn).toMatch(/onLanguageModelCallEnd/)
    expect(turn).toMatch(/onToolExecutionStart/)
  })
})
