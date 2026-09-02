/**
 * Parse an API response as JSON without treating HTML error pages as JSON.
 */
export const readApiJson = async <T>(response: Response): Promise<T> => {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    if (response.status === 401) {
      throw new Error('Unauthorized')
    }
    throw new Error(`Unexpected response (${response.status})`)
  }
  return (await response.json()) as T
}
