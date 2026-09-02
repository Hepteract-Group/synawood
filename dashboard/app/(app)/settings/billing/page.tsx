import type { Metadata } from 'next'
import { BillingMonthlyCapPanel } from '@/components/billing/BillingMonthlyCapPanel'
import { BillingSummaryPanel } from '@/components/billing/BillingSummaryPanel'
import { SettingsLocalNav } from '../settings-local-nav'

export const metadata: Metadata = { title: 'Billing' }

export default function BillingPage() {
  return (
    <>
      <SettingsLocalNav />
      <div className="settings-content">
        <section className="settings-section">
          <h1 className="settings-heading">Billing</h1>
          <p className="muted">
            Plan, wallet, trial, and monthly generator cap for this organisation.
          </p>
          <BillingSummaryPanel />
          <BillingMonthlyCapPanel />
        </section>
      </div>
    </>
  )
}
