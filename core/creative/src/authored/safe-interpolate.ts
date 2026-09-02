import { interpolate } from 'remotion'

type InterpolateOptions = NonNullable<Parameters<typeof interpolate>[3]>

/** Agent TSX often omits extrapolate. Spring overshoot must not kill the Player. */
export const authoredInterpolate = (
  input: number,
  inputRange: readonly number[],
  outputRange: readonly number[],
  options?: InterpolateOptions,
): number =>
  interpolate(input, inputRange, outputRange, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    ...options,
  })
