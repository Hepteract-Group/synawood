/** IRIDAS/Adobe `.cube` 3D LUT parse (ADR-0059 v1.1 / #720). Client-safe. */

export const CUBE_LUT_MAX_SIZE = 32

export type CubeLut = {
  type: 'cube_lut'
  title: string
  size: number
  domainMin: [number, number, number]
  domainMax: [number, number, number]
  /** RGB triples, red-fastest then green then blue. Length `size³ × 3`. */
  table: number[]
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export const isCubeLut = (value: unknown): value is CubeLut => {
  if (!value || typeof value !== 'object') return false
  const row = value as CubeLut
  return (
    row.type === 'cube_lut' &&
    typeof row.size === 'number' &&
    Array.isArray(row.table) &&
    row.table.length === row.size * row.size * row.size * 3
  )
}

const parseVec3 = (parts: string[]): [number, number, number] | null => {
  if (parts.length < 3) return null
  const vec: [number, number, number] = [Number(parts[0]), Number(parts[1]), Number(parts[2])]
  if (!vec.every(isFiniteNumber)) return null
  return vec
}

/**
 * Parse an IRIDAS `.cube` 3D LUT. 1D cubes are rejected. Size above
 * `CUBE_LUT_MAX_SIZE` is rejected so the recipe stays JSON-safe.
 */
export const parseCubeLut = (text: string, fileName = 'lut.cube'): CubeLut => {
  const lines = text.split(/\r?\n/)
  let title =
    fileName
      .replace(/\.cube$/i, '')
      .replace(/[_-]+/g, ' ')
      .trim() || 'Imported LUT'
  let size = 0
  let domainMin: [number, number, number] = [0, 0, 0]
  let domainMax: [number, number, number] = [1, 1, 1]
  const table: number[] = []

  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith('//')) continue
    const tokens = line.split(/\s+/)
    const head = tokens[0]?.toUpperCase()
    if (head === 'TITLE') {
      const named = line.match(/TITLE\s+"([^"]+)"/i)
      if (named?.[1]) title = named[1].trim().slice(0, 80)
      continue
    }
    if (head === 'LUT_1D_SIZE') {
      throw new Error('1D .cube LUTs are not supported. Export a 3D LUT.')
    }
    if (head === 'LUT_3D_SIZE') {
      size = Number(tokens[1])
      if (!Number.isInteger(size) || size < 2 || size > CUBE_LUT_MAX_SIZE) {
        throw new Error(`LUT_3D_SIZE must be an integer from 2 to ${CUBE_LUT_MAX_SIZE}.`)
      }
      continue
    }
    if (head === 'DOMAIN_MIN') {
      const vec = parseVec3(tokens.slice(1))
      if (!vec) throw new Error('DOMAIN_MIN needs three numbers.')
      domainMin = vec
      continue
    }
    if (head === 'DOMAIN_MAX') {
      const vec = parseVec3(tokens.slice(1))
      if (!vec) throw new Error('DOMAIN_MAX needs three numbers.')
      domainMax = vec
      continue
    }
    const rgb = parseVec3(tokens)
    if (!rgb) {
      throw new Error(`Could not parse LUT table line: ${line.slice(0, 80)}`)
    }
    table.push(rgb[0], rgb[1], rgb[2])
  }

  if (size < 2) {
    throw new Error('Missing LUT_3D_SIZE. This file is not a 3D .cube LUT.')
  }
  const expected = size * size * size * 3
  if (table.length !== expected) {
    throw new Error(`Expected ${expected / 3} RGB rows for size ${size}, got ${table.length / 3}.`)
  }
  return { type: 'cube_lut', title: title.slice(0, 80), size, domainMin, domainMax, table }
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

const sampleNearest = (lut: CubeLut, r: number, g: number, b: number): [number, number, number] => {
  const n = lut.size
  const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
  const rr = clamp01(r) * (n - 1)
  const gg = clamp01(g) * (n - 1)
  const bb = clamp01(b) * (n - 1)
  const r0 = Math.floor(rr)
  const g0 = Math.floor(gg)
  const b0 = Math.floor(bb)
  const r1 = Math.min(n - 1, r0 + 1)
  const g1 = Math.min(n - 1, g0 + 1)
  const b1 = Math.min(n - 1, b0 + 1)
  const at = (ri: number, gi: number, bi: number): [number, number, number] => {
    const index = (ri + n * gi + n * n * bi) * 3
    return [lut.table[index] ?? 0, lut.table[index + 1] ?? 0, lut.table[index + 2] ?? 0]
  }
  const c000 = at(r0, g0, b0)
  const c100 = at(r1, g0, b0)
  const c010 = at(r0, g1, b0)
  const c110 = at(r1, g1, b0)
  const c001 = at(r0, g0, b1)
  const c101 = at(r1, g0, b1)
  const c011 = at(r0, g1, b1)
  const c111 = at(r1, g1, b1)
  const td = rr - r0
  const tg = gg - g0
  const tb = bb - b0
  const mix2 = (
    a: [number, number, number],
    b: [number, number, number],
    t: number,
  ): [number, number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
  const c00 = mix2(c000, c100, td)
  const c10 = mix2(c010, c110, td)
  const c01 = mix2(c001, c101, td)
  const c11 = mix2(c011, c111, td)
  const c0 = mix2(c00, c10, tg)
  const c1 = mix2(c01, c11, tg)
  return mix2(c0, c1, tb)
}

/** Flatten a 3D LUT into 1D channel curves for a CSS/SVG preview (Remotion). */
export const cubeLutChannelCurves = (
  lut: CubeLut,
  samples = 9,
): { r: number[]; g: number[]; b: number[] } => {
  const r: number[] = []
  const g: number[] = []
  const b: number[] = []
  for (let i = 0; i < samples; i += 1) {
    const t = samples === 1 ? 0 : i / (samples - 1)
    const sampled = sampleNearest(lut, t, t, t)
    r.push(Number(sampled[0].toFixed(4)))
    g.push(Number(sampled[1].toFixed(4)))
    b.push(Number(sampled[2].toFixed(4)))
  }
  return { r, g, b }
}

/** CSS `filter` using SVG component transfer tables sampled from the 3D LUT. */
export const cubeLutToCssFilter = (lut: CubeLut, intensity = 1): string => {
  const amount = Math.min(1, Math.max(0, intensity))
  if (amount <= 0) return 'none'
  const curves = cubeLutChannelCurves(lut)
  const mixTable = (table: number[]) =>
    table.map((value, index) => {
      const identity = table.length === 1 ? 0 : index / (table.length - 1)
      return lerp(identity, value, amount)
    })
  const r = mixTable(curves.r).join(' ')
  const g = mixTable(curves.g).join(' ')
  const b = mixTable(curves.b).join(' ')
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg"><filter id="c"><feComponentTransfer><feFuncR type="table" tableValues="${r}"/><feFuncG type="table" tableValues="${g}"/><feFuncB type="table" tableValues="${b}"/></feComponentTransfer></filter></svg>`,
  )
  return `url("data:image/svg+xml,${svg}#c")`
}
