import { describe, expect, it } from 'vitest'
import type { ToolTraceEntry } from '../tools/types'
import { groundAssistantText } from './ground-assistant-text'

const entry = (toolName: string, outcome: ToolTraceEntry['outcome']): ToolTraceEntry => ({
  id: crypto.randomUUID(),
  toolName,
  input: {},
  outcome,
  at: new Date().toISOString(),
})

describe('groundAssistantText', () => {
  it('prefers model narration when tools ran (ADR-0019)', () => {
    const text = groundAssistantText({
      toolTrace: [
        entry('generate_image', {
          ok: true,
          summary: 'Generated image asset asset-1',
        }),
        entry('add_clip', { ok: true, summary: 'Added clip clip-1' }),
      ],
      modelText: 'Placed a new end-screen still. Want me to tweak the timing?',
    })
    expect(text).toContain('Want me to tweak the timing')
    expect(text).not.toContain('Generated image asset asset-1')
  })

  it('synthesizes a short line when tools ran but model said nothing', () => {
    const text = groundAssistantText({
      toolTrace: [
        entry('plan_slideshow', { ok: true, summary: 'Planned 5 slides' }),
        entry('set_slide', { ok: true, summary: 'Updated slide slide_1' }),
      ],
      modelText: '',
    })
    expect(text).toMatch(/Planned 5 slides/i)
    expect(text).toMatch(/what should we do next/i)
  })

  it('surfaces failures in the synthesized fallback when all tools failed', () => {
    const text = groundAssistantText({
      toolTrace: [
        entry('generate_image', {
          ok: false,
          error: "Model 'google/gemini-3.1-flash-image' is a language model, not an image model",
        }),
      ],
      modelText: '',
    })
    expect(text).toMatch(/didn’t work|didn't work/i)
    expect(text).toContain('language model, not an image model')
  })

  it('rejects narrate-without-act when no tools ran', () => {
    const text = groundAssistantText({
      toolTrace: [],
      modelText: 'Please wait while I process the request. I will generate the image and add it.',
    })
    expect(text).toMatch(/no tools ran|no project changes/i)
    expect(text).not.toMatch(/please wait/i)
  })

  it('rejects third-person music-bed claims when no tools ran (#1016)', () => {
    const text = groundAssistantText({
      toolTrace: [],
      modelText:
        'Carousel now has a cinematic orchestral bed placed on the audio track — calm strings, soft piano, gentle pulses underneath the slides.',
    })
    expect(text).toMatch(/no tools ran|no project changes/i)
    expect(text).not.toMatch(/orchestral bed/i)
    expect(text).not.toMatch(/placed on the audio track/i)
  })

  it('strips a fake music-bed claim even when write_composition succeeded', () => {
    const text = groundAssistantText({
      toolTrace: [
        entry('write_composition', {
          ok: true,
          summary:
            'Composition compiled. Watch the Player, then inspect_preview before you finish.',
        }),
      ],
      modelText:
        'TSX is in with per-beat clocks. Cinematic orchestral bed placed on the audio track.',
    })
    expect(text).toMatch(/Composition compiled|What should we do next/)
    expect(text).toMatch(/No music was generated/)
    expect(text).not.toMatch(/Allow paid models/)
    expect(text).not.toMatch(/placed on the audio track/)
  })

  it('rejects a music-bed claim when only get_project_summary ran (#1016)', () => {
    const text = groundAssistantText({
      toolTrace: [entry('get_project_summary', { ok: true, summary: 'Project summary' })],
      modelText: 'Carousel now has a cinematic orchestral bed placed on the audio track.',
    })
    expect(text).toMatch(/no music was generated/i)
    expect(text).not.toMatch(/orchestral bed/i)
  })

  it('surfaces a failed generate_music instead of a fake bed (#1016)', () => {
    const text = groundAssistantText({
      toolTrace: [
        entry('generate_music', {
          ok: false,
          error: 'Confirm spend to run this generate (est. £0.12).',
        }),
      ],
      modelText: 'Carousel now has a cinematic orchestral bed placed on the audio track.',
    })
    expect(text).toMatch(/didn’t work|didn't work/i)
    expect(text).toContain('Confirm spend')
    expect(text).not.toMatch(/orchestral bed/i)
  })

  it('keeps music-bed narration when generate_music succeeded (#1016)', () => {
    const text = groundAssistantText({
      toolTrace: [entry('generate_music', { ok: true, summary: 'Generated music bed' })],
      modelText: 'Carousel now has a cinematic orchestral bed placed on the audio track.',
    })
    expect(text).toContain('orchestral bed')
  })

  it('keeps third-person slide status that is not a music-bed claim (#1016)', () => {
    const text = groundAssistantText({
      toolTrace: [],
      modelText: 'The intro slide now has a caption. Should I tighten the type?',
    })
    expect(text).toContain('now has a caption')
  })

  it('keeps clarifying prose when no tools ran and no edit claims', () => {
    const text = groundAssistantText({
      toolTrace: [],
      modelText: 'Which asset should I place at the end — the golfer still or a new generate?',
    })
    expect(text).toContain('Which asset should I place')
  })

  it('keeps a Plan-mode write-up that mentions a music bed (#1325)', () => {
    const plan = [
      '## Music + speech',
      'Bed: hopeful lo-fi / soft piano pulse, instrumental, ~60 s — background music under VO.',
      'Next: switch to Execute after you sign off.',
    ].join('\n')
    const text = groundAssistantText({
      toolTrace: [],
      modelText: plan,
      turnMode: 'plan',
    })
    expect(text).toContain('hopeful lo-fi')
    expect(text).toContain('background music')
    expect(text).not.toMatch(/no tools ran|not calling this done/i)
  })

  it('does not let Plan claim the ad was made when no write tools ran (#1328)', () => {
    const text = groundAssistantText({
      toolTrace: [],
      modelText:
        "**Implementation kicked off — TSX written with per-beat local clocks, stills generated, cut review pending.** Next: I'll run inspect_preview.",
      turnMode: 'plan',
    })
    expect(text).toMatch(/switch the footer to Execute/i)
    expect(text).not.toMatch(/kicked off|TSX written|stills generated/i)
  })

  it('does not let Execute claim TSX written when no tools ran (#1328)', () => {
    const text = groundAssistantText({
      toolTrace: [],
      modelText: 'Implementation kicked off — TSX written with per-beat local clocks.',
    })
    expect(text).toMatch(/no tools ran|no project changes/i)
    expect(text).not.toMatch(/kicked off|TSX written/i)
  })

  it('does not let Execute claim the composition is on the timeline when no tools ran (#1328)', () => {
    const text = groundAssistantText({
      toolTrace: [],
      modelText:
        'Implementation in progress — TSX with per-beat local clocks is on the timeline, stills bound, cut review pending.',
    })
    expect(text).toMatch(/no tools ran|no project changes/i)
    expect(text).not.toMatch(/on the timeline|stills bound|in progress/i)
  })

  it('strips a fake voiceover claim when generate_voiceover did not run', () => {
    const text = groundAssistantText({
      toolTrace: [
        entry('patch_composition', {
          ok: true,
          summary:
            'Composition compiled. Watch the Player, then inspect_preview before you finish.',
        }),
      ],
      modelText:
        'Built it faster with VO. Dropped a warm-female mid-20s voiceover onto the audio track.',
    })
    expect(text).toMatch(/Composition compiled/)
    expect(text).toMatch(/No voiceover was generated/)
    expect(text).not.toMatch(/warm-female/)
  })

  it('strips a with-VO claim when generate_voiceover did not run', () => {
    const text = groundAssistantText({
      toolTrace: [
        entry('patch_composition', {
          ok: true,
          summary:
            'Composition compiled. Watch the Player, then inspect_preview before you finish.',
        }),
      ],
      modelText: 'Built it faster, bigger, with VO.',
    })
    expect(text).toMatch(/No voiceover was generated/)
    expect(text).not.toMatch(/with VO/)
  })

  it('does not let chat claim site stills unless ids were passed (#1098)', () => {
    const lied = groundAssistantText({
      toolTrace: [
        entry('generate_video_clip', {
          ok: true,
          summary: 'Queued video clip',
        }),
      ],
      modelText: 'I used the site stills from Product Extracts as the generate refs.',
    })
    expect(lied).toMatch(/No Product Extract stills were passed/)
    expect(lied).not.toMatch(/I used the site stills/)

    const grounded = groundAssistantText({
      toolTrace: [
        {
          id: crypto.randomUUID(),
          toolName: 'generate_video_clip',
          input: { sourceImageAssetIds: ['11111111-1111-4111-8111-111111111111'] },
          outcome: { ok: true, summary: 'Queued video clip' },
          at: new Date().toISOString(),
        },
      ],
      modelText: 'I used the site stills from Product Extracts as the generate refs.',
    })
    expect(grounded).toMatch(/site stills/)
  })
})
