'use client'

import Link from 'next/link'

export type IntegrationStatusRow = { provider: string; status: string }

const PROVIDERS = ['tiktok', 'meta', 'youtube', 'linkedin', 'shopify', 'stripe'] as const

export const IntegrationsBar = ({ integrations }: { integrations: IntegrationStatusRow[] }) => {
  const byProvider = new Map(integrations.map((row) => [row.provider, row.status]))
  const connected = PROVIDERS.filter((provider) => byProvider.get(provider) === 'connected')

  return (
    <div className="settings-alert insights-integrations" role="status">
      <p>
        {connected.length === 0
          ? 'No analytics connections yet. Connect OAuth or paste a token on Outcomes.'
          : `${connected.length} connection${connected.length === 1 ? '' : 's'} saved: ${connected.join(', ')}. Pull worker stays stubbed until live adapters are approved.`}
      </p>
      <Link href="/settings/outcomes" className="btn btn-ghost">
        Open Outcomes
      </Link>
    </div>
  )
}
