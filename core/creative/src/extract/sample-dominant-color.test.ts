import { deflateSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  sampleColorFromPng,
  sampleColorFromSvg,
  sampleDominantColor,
} from './sample-dominant-color'

const crc32 = (buf: Buffer): number => {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i]!
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xedb88320 & mask)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

const pngChunk = (type: string, data: Buffer): Buffer => {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

/** 2×2 RGB PNG: three teal pixels + one white (filtered None). */
const makeTealPng = (): Buffer => {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(2, 0)
  ihdr.writeUInt32BE(2, 4)
  ihdr[8] = 8
  ihdr[9] = 2 // RGB
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const teal = Buffer.from([0x1a, 0x5c, 0x3a])
  const white = Buffer.from([0xff, 0xff, 0xff])
  const raw = Buffer.concat([Buffer.from([0]), teal, teal, Buffer.from([0]), teal, white])
  const idat = deflateSync(raw)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

describe('sampleColorFromSvg', () => {
  it('picks the most common non-neutral fill', () => {
    const svg = `<svg><rect fill="#1a5c3a"/><circle fill="#1a5c3a"/><path stroke="#ffffff"/><path fill="#cccccc"/></svg>`
    expect(sampleColorFromSvg(svg)).toBe('#1a5c3a')
  })
})

describe('sampleColorFromPng', () => {
  it('samples the dominant non-white color', () => {
    const png = makeTealPng()
    expect(createHash('sha1').update(png).digest('hex').length).toBe(40)
    expect(sampleColorFromPng(png)?.toLowerCase()).toBe('#1a5c3a')
  })
})

describe('sampleDominantColor', () => {
  it('routes SVG by content type', () => {
    const bytes = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#c45c26"/></svg>`,
    )
    expect(sampleDominantColor({ bytes, contentType: 'image/svg+xml' })).toBe('#c45c26')
  })
})
