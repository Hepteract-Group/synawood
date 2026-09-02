import { describe, expect, it, vi } from 'vitest'
import {
  createProviderCloneVoice,
  isMockCloneProviderId,
  MOCK_CLONE_PROVIDER_VOICE_ID,
  requireElevenLabsKey,
} from './clone'

describe('ElevenLabs clone (#762)', () => {
  it('returns mock-clone on the stub path without calling the provider', async () => {
    const addVoice = vi.fn(async () => ({ voiceId: 'should-not-run' }))
    await expect(
      createProviderCloneVoice({
        name: 'Founder',
        fileName: 'sample.webm',
        contentType: 'audio/webm',
        bytes: new Uint8Array([1, 2, 3]),
        stub: true,
        addVoice,
      }),
    ).resolves.toBe(MOCK_CLONE_PROVIDER_VOICE_ID)
    expect(addVoice).not.toHaveBeenCalled()
  })

  it('uploads the sample on the live path', async () => {
    const addVoice = vi.fn(async () => ({ voiceId: 'el_live_1' }))
    const prev = process.env.ELEVENLABS_API_KEY
    process.env.ELEVENLABS_API_KEY = 'el-test'
    try {
      await expect(
        createProviderCloneVoice({
          name: 'Founder',
          fileName: 'sample.webm',
          contentType: 'audio/webm',
          bytes: new Uint8Array([1, 2, 3]),
          stub: false,
          addVoice,
        }),
      ).resolves.toBe('el_live_1')
      expect(addVoice).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'el-test',
          name: 'Founder',
          fileName: 'sample.webm',
        }),
      )
    } finally {
      if (prev === undefined) delete process.env.ELEVENLABS_API_KEY
      else process.env.ELEVENLABS_API_KEY = prev
    }
  })

  it('fails loud when the ElevenLabs key is missing', () => {
    const prev = process.env.ELEVENLABS_API_KEY
    delete process.env.ELEVENLABS_API_KEY
    try {
      expect(() => requireElevenLabsKey({})).toThrow(/ELEVENLABS_API_KEY/)
    } finally {
      if (prev !== undefined) process.env.ELEVENLABS_API_KEY = prev
    }
  })

  it('does not treat ElevenLabs-like ids starting with mock as cloned mocks', () => {
    expect(isMockCloneProviderId('mock-clone')).toBe(true)
    expect(isMockCloneProviderId('mockingbird')).toBe(false)
  })
})
