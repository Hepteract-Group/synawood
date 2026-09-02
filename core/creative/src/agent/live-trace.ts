export type TurnLiveEvent =
  | { type: 'step'; stepNumber: number }
  | { type: 'model' }
  | { type: 'tool_choice'; toolName: string }
  | { type: 'tool_start'; toolName: string }

/** Tool names the model chose, from `onLanguageModelCallEnd` content (before execute). */
export const toolNamesFromModelContent = (content: readonly unknown[]): string[] => {
  const names: string[] = []
  for (const part of content) {
    if (!part || typeof part !== 'object') continue
    const row = part as { type?: unknown; toolName?: unknown }
    if (row.type === 'tool-call' && typeof row.toolName === 'string' && row.toolName.trim()) {
      names.push(row.toolName)
    }
  }
  return names
}
