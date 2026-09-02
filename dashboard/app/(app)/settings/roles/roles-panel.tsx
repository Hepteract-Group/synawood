'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  FUNCTIONAL_ROLE_HINT,
  FUNCTIONAL_ROLE_LABEL,
  FUNCTIONAL_ROLES,
  PRODUCT_FEATURE_LABEL,
  PRODUCT_FEATURES,
  featuresForRole,
  type FunctionalRole,
} from '../../../../lib/functional-roles'
import { planIncludesRole, type ProductPlan } from '../../../../lib/plan-flags'
import { readApiJson } from '../../../../lib/read-api-json'
import { SettingsLocalNav } from '../settings-local-nav'

type PlanFlags = {
  plan: ProductPlan
  label: string
  includedRoles: FunctionalRole[]
}

export const RolesPanel = () => {
  const [flags, setFlags] = useState<PlanFlags | null>(null)

  useEffect(() => {
    void (async () => {
      const response = await fetch('/api/plan-flags')
      const body = await readApiJson<PlanFlags & { error?: string }>(response)
      if (!response.ok || !body.plan) return
      setFlags({
        plan: body.plan,
        label: body.label,
        includedRoles: body.includedRoles ?? [],
      })
    })()
  }, [])

  const plan = flags?.plan ?? 'founding'

  return (
    <section className="panel settings-page mos-enter">
      <header className="settings-header">
        <div className="settings-header-copy">
          <p className="eyebrow">
            <Link href="/settings" className="settings-crumb">
              Settings
            </Link>
            <span aria-hidden> / </span>
            Roles
          </p>
          <h1 className="settings-title">Roles</h1>
          <p className="page-lede">
            Job function is what someone can do. Opening the Product is still owner / editor /
            viewer. Change a person&apos;s job on <Link href="/settings/members">Members</Link>.
          </p>
        </div>
        <div className="settings-header-actions">
          <Link href="/settings/members" className="btn btn-ghost">
            Members
          </Link>
          <Link href="/settings" className="btn btn-primary">
            All settings
          </Link>
        </div>
      </header>
      <SettingsLocalNav />

      <div className="roles-plan-banner" role="status">
        <p className="roles-plan-banner-title">{flags ? `${flags.label} plan` : 'Founding plan'}</p>
        <p className="page-lede">
          {plan === 'founding'
            ? 'Every job function is included. Paid SKUs and checkout are not on yet.'
            : 'Some job functions are preview-only so you can see the upsell chip. There is no checkout.'}
        </p>
      </div>

      <div className="roles-grid mos-stagger">
        {FUNCTIONAL_ROLES.map((role) => {
          const allowed = new Set(featuresForRole(role))
          const included = planIncludesRole(plan, role)
          return (
            <article key={role} className="roles-card" aria-labelledby={`role-${role}`}>
              <p className="roles-card-kicker">Job function</p>
              <h2 id={`role-${role}`} className="roles-card-title">
                {FUNCTIONAL_ROLE_LABEL[role]}
              </h2>
              <p className={`roles-chip ${included ? 'is-included' : 'is-upsell'}`}>
                {included ? 'Included on this plan' : 'Not on this plan'}
              </p>
              <p className="page-lede">{FUNCTIONAL_ROLE_HINT[role]}</p>
              <ul className="roles-feature-list">
                {PRODUCT_FEATURES.map((feature) => {
                  const on = allowed.has(feature)
                  return (
                    <li
                      key={feature}
                      className={on ? 'roles-feature is-on' : 'roles-feature is-off'}
                    >
                      <span aria-hidden>{on ? 'Yes' : 'No'}</span>
                      <span>
                        {PRODUCT_FEATURE_LABEL[feature]}
                        <span className="visually-hidden">
                          {on ? ' included' : ' not included'}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </article>
          )
        })}
      </div>
    </section>
  )
}
