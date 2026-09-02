/** Studio editor layout. Stack panes at 1100px (docs/ui/responsive.md, #828). */

export const STUDIO_STACK_MAX_PX = 1100

export type StudioLayoutMode = 'wide' | 'stack'

export const studioLayoutModeForWidth = (width: number): StudioLayoutMode =>
  width <= STUDIO_STACK_MAX_PX ? 'stack' : 'wide'

export const STUDIO_STACK_MEDIA_QUERY = `(max-width: ${STUDIO_STACK_MAX_PX}px)`
