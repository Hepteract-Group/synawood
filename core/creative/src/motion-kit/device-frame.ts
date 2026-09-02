/** Brand chassis + orbit from the current frame. No R3F useFrame. */

export const deviceOrbitDegrees = (frame: number, orbit: boolean): number => {
  if (!orbit) return 0
  const t = Math.min(1, Math.max(0, frame / 90))
  return -10 + t * 20
}
