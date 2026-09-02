/** Wave 2E / #194 — optional brand kit music.style.json (defaults when missing). */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { brandKitRoot } from '../brand/attach'

export const musicStyleSchema = z
  .object({
    tempoBpm: z.number().min(40).max(220).optional(),
    mood: z.string().trim().min(1).max(200).optional(),
    genres: z.array(z.string().trim().min(1).max(64)).max(12).optional(),
    avoidVocals: z.boolean().optional(),
    energy: z.enum(['low', 'medium', 'high']).optional(),
    referenceNotes: z.string().trim().max(1000).optional(),
    negativeStyles: z.array(z.string().trim().min(1).max(64)).max(12).optional(),
  })
  .strict()

export type MusicStyle = z.infer<typeof musicStyleSchema>

export const DEFAULT_MUSIC_STYLE: MusicStyle = {
  tempoBpm: 95,
  mood: 'clean modern underscore',
  genres: ['lo-fi', 'ambient'],
  avoidVocals: true,
  energy: 'medium',
  referenceNotes: '',
  negativeStyles: ['vocals', 'lyrics', 'choir'],
}

export const loadMusicStyle = async (
  productId: string,
  repoRoot?: string,
): Promise<{ style: MusicStyle; source: 'file' | 'default' }> => {
  const filePath = path.join(brandKitRoot(productId, repoRoot), 'music.style.json')
  try {
    const raw = JSON.parse(await readFile(filePath, 'utf8')) as unknown
    return { style: musicStyleSchema.parse(raw), source: 'file' }
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return { style: DEFAULT_MUSIC_STYLE, source: 'default' }
    }
    // Invalid JSON / schema → safe defaults (ADR-0041: missing/bad file is not failure).
    return { style: DEFAULT_MUSIC_STYLE, source: 'default' }
  }
}

export const toMusicPromptBlock = (style: MusicStyle): string => {
  const parts = [
    style.mood ? `Mood: ${style.mood}` : null,
    style.tempoBpm != null ? `Tempo ~${style.tempoBpm} BPM` : null,
    style.energy ? `Energy: ${style.energy}` : null,
    style.genres?.length ? `Genres: ${style.genres.join(', ')}` : null,
    style.avoidVocals !== false ? 'Instrumental only — no vocals or lyrics.' : null,
    style.referenceNotes?.trim() ? `Notes: ${style.referenceNotes.trim()}` : null,
    style.negativeStyles?.length ? `Avoid: ${style.negativeStyles.join(', ')}` : null,
  ]
  return parts.filter(Boolean).join('\n')
}

export const mergeMusicPrompt = (input: { userPrompt: string; style: MusicStyle }): string => {
  const brandBlock = toMusicPromptBlock(input.style)
  const user = input.userPrompt.trim()
  if (!brandBlock) return user
  if (!user) return brandBlock
  return `${brandBlock}\n\nUser request: ${user}`
}
