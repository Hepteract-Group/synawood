/** Public http(s) URLs pasted in chat. Trailing punctuation is not part of the URL. */
export const publicHttpUrlsFromText = (text: string): string[] => {
  const matches = text.match(/https?:\/\/[^\s<>"'`]+/gi) ?? []
  const cleaned = matches.map((url) => url.replace(/[.,);]+$/u, ''))
  return [...new Set(cleaned.filter((url) => url.length > 8))]
}
