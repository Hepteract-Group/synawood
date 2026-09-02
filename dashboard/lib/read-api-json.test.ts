import { describe, expect, it } from 'vitest'
import { readApiJson } from './read-api-json'

describe('readApiJson', () => {
  it('parses application/json bodies', async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
    await expect(readApiJson<{ ok: boolean }>(response)).resolves.toEqual({ ok: true })
  })

  it('maps HTML 401 to Unauthorized without parsing HTML', async () => {
    const response = new Response('<!DOCTYPE html>', {
      status: 401,
      headers: { 'Content-Type': 'text/html' },
    })
    await expect(readApiJson(response)).rejects.toThrow('Unauthorized')
  })

  it('rejects non-JSON success-shaped HTML', async () => {
    const response = new Response('<!DOCTYPE html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
    await expect(readApiJson(response)).rejects.toThrow('Unexpected response (200)')
  })
})
