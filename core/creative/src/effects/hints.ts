/** Free-text → pack id (Director / Effects tab). No spend. */

import { getStylePack, type StylePackId } from './packs'

export const suggestStylePackFromText = (text: string | undefined): StylePackId | null => {
  const t = (text ?? '').toLowerCase()
  if (!t.trim()) return null
  if (/\bvhs\b|camcorder|\btape\b|tracking error/.test(t)) return 'vhs'
  if (/perfume|fragrance|silk|gold leaf|luxury ad/.test(t)) return 'luxury-perfume'
  if (/teal|orange|cinematic|film look|color grade/.test(t)) return 'cinematic-teal-orange'
  return null
}

export const applyStylePackPromptHints = (
  prompt: string,
  stylePackId: string | null | undefined,
): string => {
  const pack = getStylePack(stylePackId)
  if (!pack?.promptHints.length) return prompt
  const block = `Look pack (${pack.label}): ${pack.promptHints.join('; ')}`
  const user = prompt.trim()
  return user ? `${user}\n\n${block}` : block
}

export const applyStylePackMusicHints = (
  prompt: string,
  stylePackId: string | null | undefined,
): string => {
  const pack = getStylePack(stylePackId)
  if (!pack?.musicHints.length) return prompt
  const block = `Look pack music (${pack.label}): ${pack.musicHints.join('; ')}`
  const user = prompt.trim()
  return user ? `${user}\n\n${block}` : block
}
