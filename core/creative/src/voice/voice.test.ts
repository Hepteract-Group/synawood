import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createEmptyProject } from '../project/schema'
import { attachAsset, addClip } from '../project/operations'
import { applyCutList } from './apply-cut-list'
import { fillerCutList, isFillerText } from './fillers'
import { assertLipsyncQualityFloor, resolveLipsyncPair } from './lipsync'
import { assertVoiceProvenancePublishable } from './provenance-gate'
import { assertCloneConsent, assertCloneReady, parseVoiceProvenance } from './schema'
import { estimateVoiceCloneGbp, estimateVoiceSynthGbp } from './estimate'
import { createProductVoiceProfile } from './create-profile'
import { pickDefaultVoiceProfile, voiceClipLabel } from './pick-profile'

const migrationSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0037_voice_studio.sql'),
  'utf8',
)

const sampleMigrationSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0044_voice_profile_sample.sql'),
  'utf8',
)

describe('Voice Studio schema (#214)', () => {
  it('creates profiles, events, dub_jobs with clone consent check', () => {
    expect(migrationSql).toContain('create table public.voice_profiles')
    expect(migrationSql).toContain('create table public.voice_events')
    expect(migrationSql).toContain('create table public.dub_jobs')
    expect(migrationSql).toMatch(/voice_profiles_clone_consent_chk/)
    expect(migrationSql).toMatch(/'voice_synth'/)
    expect(migrationSql).toMatch(
      /grant select, insert, update, delete on public.voice_profiles to service_role/,
    )
  })
})

describe('clone sample (#762 / ADR-0060)', () => {
  it('adds sample_blob_key and requires it for clone rows', () => {
    expect(sampleMigrationSql).toContain('sample_blob_key')
    expect(sampleMigrationSql).toMatch(/voice_profiles_clone_sample_chk/)
  })

  it('blocks clone without a sample', () => {
    expect(() =>
      assertCloneReady({
        kind: 'clone',
        consentAt: '2026-08-22T08:00:00.000Z',
        sampleBlobKey: null,
        providerVoiceId: 'el_1',
      }),
    ).toThrow(/sample/)
  })

  it('refuses create without uploading a sample', async () => {
    await expect(
      createProductVoiceProfile({
        supabase: {} as never,
        blobEnv: {} as never,
        productId: 'demo',
        name: 'Founder',
        kind: 'clone',
        consentRecorded: true,
        sample: null,
        modelProfileId: 'founder-edit',
      }),
    ).rejects.toThrow(/sample/)
  })

  it('prefers a ready clone, then a synth profile', () => {
    const synth = {
      id: '11111111-1111-4111-8111-111111111111',
      productId: 'demo',
      name: 'Synth',
      locale: 'en',
      kind: 'synth' as const,
      providerVoiceId: null,
      sampleBlobKey: null,
      consentAt: null,
      consentSource: null,
      status: 'active' as const,
      createdAt: '2026-08-22T08:00:00.000Z',
      updatedAt: '2026-08-22T08:00:00.000Z',
    }
    const incomplete = {
      ...synth,
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Incomplete clone',
      kind: 'clone' as const,
      consentAt: '2026-08-22T08:00:00.000Z',
      sampleBlobKey: null,
      providerVoiceId: null,
    }
    const ready = {
      ...incomplete,
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Founder',
      sampleBlobKey: 'local/voice-clone/sample.webm',
      providerVoiceId: 'el_abc',
    }
    expect(pickDefaultVoiceProfile([incomplete, synth, ready])?.id).toBe(ready.id)
    expect(pickDefaultVoiceProfile([incomplete, synth])?.id).toBe(synth.id)
    expect(voiceClipLabel({ assetLabel: 'vo.mp3', profileName: 'Founder' })).toMatch(/Founder/)
  })
})

describe('consent (#216)', () => {
  it('blocks clone without consentAt', () => {
    expect(() => assertCloneConsent({ kind: 'clone', consentAt: null })).toThrow(/consent/)
    expect(() =>
      assertCloneConsent({ kind: 'clone', consentAt: '2026-08-17T08:00:00.000Z' }),
    ).not.toThrow()
    expect(() => assertCloneConsent({ kind: 'synth', consentAt: null })).not.toThrow()
  })
})

describe('fillers + cut list (#220)', () => {
  it('detects filler-only segments', () => {
    expect(isFillerText('um')).toBe(true)
    expect(isFillerText('Edit PDFs in your browser')).toBe(false)
  })

  it('builds cut ranges from filler segments', () => {
    const cuts = fillerCutList({
      fps: 30,
      clipFrom: 0,
      segments: [
        { startMs: 0, endMs: 400, text: 'um' },
        { startMs: 400, endMs: 2000, text: 'Edit PDFs' },
      ],
    })
    expect(cuts).toEqual([{ from: 0, durationInFrames: 12 }])
  })

  it('offsets filler cuts by clipFrom', () => {
    const cuts = fillerCutList({
      fps: 30,
      clipFrom: 90,
      segments: [{ startMs: 0, endMs: 400, text: 'um' }],
    })
    expect(cuts).toEqual([{ from: 90, durationInFrames: 12 }])
  })

  it('ripple-deletes filler range from a clip', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = attachAsset(project, {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      kind: 'audio',
      blobKey: 'local/vo.mp3',
      source: 'upload',
      probe: {},
    })
    project = addClip(project, {
      assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      from: 0,
      durationInFrames: 90,
    })
    const clipId = project.clips[0]!.id
    const next = applyCutList(project, clipId, [{ from: 30, durationInFrames: 10 }])
    const remaining = next.clips.filter(
      (clip) => clip.assetId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    )
    const total = remaining.reduce((sum, clip) => sum + clip.durationInFrames, 0)
    expect(total).toBe(80)
  })
})

describe('lipsync quality floor (#219)', () => {
  it('rejects duration drift over 15%', () => {
    expect(() =>
      assertLipsyncQualityFloor({
        videoKind: 'video',
        audioKind: 'audio',
        videoDurationFrames: 100,
        audioDurationFrames: 50,
      }),
    ).toThrow(/15%/)
  })

  it('resolves a matching pair', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = attachAsset(project, {
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'video',
      blobKey: 'local/a.mp4',
      source: 'upload',
      probe: {},
    })
    project = attachAsset(project, {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      kind: 'audio',
      blobKey: 'local/vo.mp3',
      source: 'upload',
      probe: {},
    })
    project = addClip(project, {
      assetId: '11111111-1111-4111-8111-111111111111',
      from: 0,
      durationInFrames: 90,
    })
    project = addClip(project, {
      assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      from: 0,
      durationInFrames: 90,
    })
    const videoClip = project.clips.find((clip) => clip.assetId.startsWith('1111'))!
    const audioClip = project.clips.find((clip) => clip.assetId.startsWith('aaaa'))!
    const pair = resolveLipsyncPair(project, {
      videoClipId: videoClip.id,
      audioClipId: audioClip.id,
    })
    expect(pair.videoAsset.kind).toBe('video')
  })
})

describe('Approve provenance (#221)', () => {
  it('blocks mock lip-sync', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = attachAsset(project, {
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'video',
      blobKey: 'local/a.mp4',
      source: 'generator',
      probe: {
        voiceProvenance: { kind: 'lipsync', modelId: 'mock-lipsync', stub: true },
      },
    })
    expect(() => assertVoiceProvenancePublishable(project)).toThrow(/mock lip-sync/)
  })

  it('blocks mock lip-sync even without a stub flag', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = attachAsset(project, {
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'video',
      blobKey: 'local/a.mp4',
      source: 'generator',
      probe: {
        voiceProvenance: { kind: 'lipsync', modelId: 'mock-lipsync' },
      },
    })
    expect(() => assertVoiceProvenancePublishable(project)).toThrow(/mock lip-sync/)
  })

  it('blocks unknown provenance kinds', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = attachAsset(project, {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      kind: 'audio',
      blobKey: 'local/vo.mp3',
      source: 'generator',
      probe: {
        voiceProvenance: { kind: 'celebrity', modelId: 'openai/tts-1' },
      },
    })
    expect(() => assertVoiceProvenancePublishable(project)).toThrow(/unknown voice provenance/)
  })

  it('blocks mock clone even with consent', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = attachAsset(project, {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      kind: 'audio',
      blobKey: 'local/vo.mp3',
      source: 'generator',
      probe: {
        voiceProvenance: {
          kind: 'clone',
          modelId: 'mock-voice-clone',
          stub: true,
          consentAt: '2026-08-17T08:00:00.000Z',
        },
      },
    })
    expect(() => assertVoiceProvenancePublishable(project)).toThrow(/mock clone/)
  })

  it('allows synth without clone consent', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = attachAsset(project, {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      kind: 'audio',
      blobKey: 'local/vo.mp3',
      source: 'generator',
      probe: {
        voiceProvenance: { kind: 'synth', modelId: 'openai/tts-1' },
      },
    })
    expect(() => assertVoiceProvenancePublishable(project)).not.toThrow()
    expect(parseVoiceProvenance(project.assets[0]?.probe)?.kind).toBe('synth')
  })
})

describe('cost (#224 / #762)', () => {
  it('prices mock synth at zero and live clone on ElevenLabs', () => {
    expect(
      estimateVoiceSynthGbp({ modelProfileId: 'ci-stub', durationSeconds: 8 }).estimatedGbp,
    ).toBe(0)
    expect(estimateVoiceCloneGbp({ modelProfileId: 'ci-stub', durationSeconds: 8 }).modelId).toBe(
      'mock-voice-clone',
    )
    expect(
      estimateVoiceCloneGbp({ modelProfileId: 'founder-edit', durationSeconds: 8 }).modelId,
    ).toBe('elevenlabs/eleven_multilingual_v2')
  })
})
