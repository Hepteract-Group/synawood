import { interpolate } from 'remotion'

export type CountUpDisplayInput = {
  frame: number
  value?: number
  to?: number
  from?: number
  durationInFrames?: number
}

const finiteOr = (n: unknown, fallback: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? n : fallback

/** Frame-local count. `to` is the agent alias of `value`. Never pass undefined into interpolate. */
export const countUpDisplayed = (input: CountUpDisplayInput): number => {
  const target = finiteOr(input.value, finiteOr(input.to, 0))
  const start = finiteOr(input.from, 0)
  const duration = Math.max(1, finiteOr(input.durationInFrames, 30))
  return Math.round(
    interpolate(input.frame, [0, duration], [start, target], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  )
}
