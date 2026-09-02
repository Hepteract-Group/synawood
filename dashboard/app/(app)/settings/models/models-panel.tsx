'use client'

import Link from 'next/link'
import { ModelCatalogueContent } from '@/components/settings/ModelCatalogueContent'
import { SettingsLocalNav } from '../settings-local-nav'

export const ModelsSettingsPanel = () => (
  <section className="panel settings-page mos-enter">
    <header className="settings-header">
      <div className="settings-header-copy">
        <p className="eyebrow">
          <Link href="/settings" className="settings-crumb">
            Settings
          </Link>
          <span aria-hidden> / </span>
          Models
        </p>
        <h1 className="settings-title">Models</h1>
        <p className="page-lede">
          Which models we support for chat, stills, and clips — and when to use each.
        </p>
      </div>
      <div className="settings-header-actions">
        <Link href="/settings" className="btn btn-ghost">
          All settings
        </Link>
        <Link href="/studio" className="btn btn-primary">
          Studio
        </Link>
      </div>
    </header>
    <SettingsLocalNav />
    <ModelCatalogueContent />
  </section>
)
