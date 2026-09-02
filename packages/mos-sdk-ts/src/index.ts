export type MosSdkOptions = {
  baseUrl: string
  apiKey: string
}

export const mosBearerHeaders = (apiKey: string): { Authorization: string } => ({
  Authorization: `Bearer ${apiKey}`,
})

export const createMosClient = (options: MosSdkOptions) => {
  const baseUrl = options.baseUrl.replace(/\/$/, '')
  return {
    health: async (fetchImpl: typeof fetch = fetch): Promise<{ ok: true; productId: string }> => {
      const response = await fetchImpl(`${baseUrl}/api/v1/health`, {
        headers: mosBearerHeaders(options.apiKey),
      })
      if (!response.ok) {
        throw new Error(`health failed: ${response.status}`)
      }
      return (await response.json()) as { ok: true; productId: string }
    },
  }
}
