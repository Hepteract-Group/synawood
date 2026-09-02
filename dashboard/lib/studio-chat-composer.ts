/** Spend modal intercepts send: keep the draft. Clear once the turn starts or send went through. */
export const shouldClearComposerDraft = (input: {
  sendAccepted: boolean
  turnPending: boolean
}): boolean => input.turnPending || input.sendAccepted

/** One line + composer padding. Grows with the draft; cap matches CSS max-height. */
export const COMPOSER_MIN_HEIGHT_PX = 44
export const COMPOSER_MAX_HEIGHT_PX = 280

export const composerAutoHeightPx = (scrollHeight: number): number =>
  Math.min(COMPOSER_MAX_HEIGHT_PX, Math.max(COMPOSER_MIN_HEIGHT_PX, scrollHeight))

export const syncComposerTextareaHeight = (el: {
  style: { height: string }
  scrollHeight: number
}): void => {
  el.style.height = '0px'
  el.style.height = `${composerAutoHeightPx(el.scrollHeight)}px`
}
