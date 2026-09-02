import { generateText, type LanguageModel } from 'ai'
import { clampThreadTitle } from './chat-threads'

type GenerateTextFn = typeof generateText

const TITLE_PROMPT = (
  userText: string,
  assistantText: string,
): string => `Name this Studio chat in at most 6 words. Output the name only. No quotes.
User: ${userText.slice(0, 500)}
Assistant: ${assistantText.slice(0, 400)}`

export const generateThreadTitle = async (input: {
  userText: string
  assistantText: string
  model?: LanguageModel | string | null
  generateText?: GenerateTextFn
}): Promise<string> => {
  const fallback = clampThreadTitle(input.userText)
  const gateway = Boolean(process.env.AI_GATEWAY_API_KEY?.trim())
  const canCallModel = Boolean(input.model) && (typeof input.model !== 'string' || gateway)
  if (!canCallModel) return fallback
  try {
    const generate = input.generateText ?? generateText
    const result = await generate({
      model: input.model as LanguageModel,
      maxOutputTokens: 24,
      prompt: TITLE_PROMPT(input.userText, input.assistantText),
    })
    const next = clampThreadTitle(result.text ?? '')
    return next && next !== 'Chat' ? next : fallback
  } catch {
    return fallback
  }
}
