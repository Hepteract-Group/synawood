/**
 * Build the image-gen prompt for a slideshow slide background.
 * Pure — safe for API routes and tools.
 */
export const buildSlideBackgroundPrompt = (input: {
  headline: string
  direction?: string
}): string => {
  const headline = input.headline.trim() || 'this slide'
  const direction = input.direction?.trim()
  const parts = [
    `Branded slideshow slide background for: "${headline}".`,
    'Do not paint headline or body text into the image — Path C Remotion type sits on top.',
    'Leave clear lower/center space for overlay text. No fake product UI chrome.',
  ]
  if (direction) {
    parts.push(`Founder direction: ${direction}`)
  } else {
    parts.push(
      'Fresh on-brand photographic or graphic background with strong contrast for white text.',
    )
  }
  return parts.join(' ')
}
