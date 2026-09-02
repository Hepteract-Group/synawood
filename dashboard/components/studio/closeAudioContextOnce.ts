export type CloseableAudioContext = {
  state: string
  close: () => void | Promise<void>
}

/** Waveform decode and React cleanup both call close. The second throws InvalidStateError. */
export const closeAudioContextOnce = (ctx: CloseableAudioContext): (() => void) => {
  let started = false
  return () => {
    if (started || ctx.state === 'closed') return
    started = true
    void Promise.resolve(ctx.close()).catch(() => undefined)
  }
}
