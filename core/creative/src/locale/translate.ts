/** Fill missing locale copy from the default locale (#330). */

import type { LocaleCopy } from './schema'

export type Translator = (input: { text: string; from: string; to: string }) => Promise<string>

/** CI / stub translator — marks the locale without calling a paid model. */
export const stubTranslator: Translator = async ({ text, to }) => {
  const trimmed = text.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith(`[${to}]`)) return trimmed
  return `[${to}] ${trimmed}`
}

export const translateLocaleCopy = async (input: {
  source: LocaleCopy
  target: LocaleCopy
  from: string
  to: string
  translate: Translator
}): Promise<LocaleCopy> => {
  const overlays: Record<string, string> = { ...input.target.overlays }
  for (const [id, text] of Object.entries(input.source.overlays)) {
    if (!overlays[id]?.trim() && text.trim()) {
      overlays[id] = await input.translate({ text, from: input.from, to: input.to })
    }
  }
  const slides: LocaleCopy['slides'] = { ...input.target.slides }
  for (const [id, slide] of Object.entries(input.source.slides)) {
    const current = slides[id] ?? {}
    slides[id] = {
      headline:
        current.headline?.trim() ||
        (slide.headline?.trim()
          ? await input.translate({ text: slide.headline, from: input.from, to: input.to })
          : current.headline),
      body:
        current.body?.trim() ||
        (slide.body?.trim()
          ? await input.translate({ text: slide.body, from: input.from, to: input.to })
          : current.body),
    }
  }
  const intent = { ...input.target.intent }
  if (!intent.cta?.trim() && input.source.intent?.cta?.trim()) {
    intent.cta = await input.translate({
      text: input.source.intent.cta,
      from: input.from,
      to: input.to,
    })
  }
  if (!intent.goalNote?.trim() && input.source.intent?.goalNote?.trim()) {
    intent.goalNote = await input.translate({
      text: input.source.intent.goalNote,
      from: input.from,
      to: input.to,
    })
  }
  return { overlays, slides, intent }
}
