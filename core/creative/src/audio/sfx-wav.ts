import { getSfxPackItem, type SfxPackId } from './sfx-catalog'

export const SFX_SAMPLE_RATE = 44_100

const encodePcmWav = (samples: Float32Array): Buffer => {
  const dataBytes = samples.length * 2
  const buffer = Buffer.alloc(44 + dataBytes)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataBytes, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(SFX_SAMPLE_RATE, 24)
  buffer.writeUInt32LE(SFX_SAMPLE_RATE * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataBytes, 40)
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]!))
    buffer.writeInt16LE(sample < 0 ? sample * 0x8000 : sample * 0x7fff, 44 + index * 2)
  }
  return buffer
}

const whooshSamples = (count: number): Float32Array => {
  const samples = new Float32Array(count)
  let noise = 0
  for (let index = 0; index < count; index += 1) {
    const t = index / count
    const hash = Math.sin(index * 12.9898) * 43758.5453
    noise = noise * 0.62 + (hash - Math.floor(hash)) * 0.76 - 0.38
    const envelope = Math.sin(Math.PI * t) ** 1.15
    const sweep = Math.sin((2 * Math.PI * (1400 - 1100 * t) * index) / SFX_SAMPLE_RATE)
    samples[index] = (noise * 0.65 + sweep * 0.35) * envelope * 0.5
  }
  return samples
}

const hitSamples = (count: number): Float32Array => {
  const samples = new Float32Array(count)
  for (let index = 0; index < count; index += 1) {
    const t = index / SFX_SAMPLE_RATE
    const envelope = Math.exp(-t * 26)
    const click = index < 90 ? (index % 2 === 0 ? 0.7 : -0.7) * (1 - index / 90) : 0
    const body = Math.sin(2 * Math.PI * 82 * t)
    samples[index] = (click * 0.4 + body * 0.75) * envelope * 0.72
  }
  return samples
}

export const encodeSfxWav = (packId: SfxPackId): Buffer => {
  const item = getSfxPackItem(packId)
  if (!item) {
    throw new Error(`Unknown sound: ${packId}`)
  }
  const count = Math.max(1, Math.round(item.durationSeconds * SFX_SAMPLE_RATE))
  const samples = packId === 'whoosh' ? whooshSamples(count) : hitSamples(count)
  return encodePcmWav(samples)
}
