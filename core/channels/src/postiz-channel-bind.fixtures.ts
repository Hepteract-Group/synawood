import type { PostizIntegration } from './postiz-channel-bind'

/** Vitest-only fixture names. Do not import from dashboard or API routes. */
export const MOCK_POSTIZ_INTEGRATIONS: PostizIntegration[] = [
  { id: 'int_x_demo', name: 'Founder X', provider: 'x' },
  { id: 'int_li_demo', name: 'Founder LinkedIn', provider: 'linkedin' },
  { id: 'int_tt_demo', name: 'Founder TikTok', provider: 'tiktok' },
]
