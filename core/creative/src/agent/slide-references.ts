import type { ResolvedSlideReference } from '../project/slide-token'

/** Grounding block so the agent acts on the mentioned slide ids. */
export const slideReferenceBlock = (refs: ResolvedSlideReference[]): string => {
  if (refs.length === 0) return ''
  const lines = refs.map((ref) => {
    const layout = ref.layout ? ` layout=${ref.layout}` : ''
    const headline = ref.headline.trim() ? ` headline="${ref.headline.trim()}"` : ''
    return `- ${ref.token} → slideId=${ref.slideId} order=${ref.order} (slide ${ref.order + 1})${layout}${headline}`
  })
  return [
    '## Referenced slides (resolved from @slide: tokens)',
    'The user referenced these slides explicitly. Ground set_slide / generate_slide_background / remove_slide / reorder on these slideIds — never invent ids.',
    ...lines,
  ].join('\n')
}
