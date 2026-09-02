export const treatmentPreviewClass = (id: string): string =>
  `overlay-tile-motion is-${id.replaceAll('_', '-')}`
