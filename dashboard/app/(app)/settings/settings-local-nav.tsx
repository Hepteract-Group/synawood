'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ProductSwitcher } from '@/components/ProductSwitcher'
import { useActiveProduct } from '@/lib/use-active-product'

const LINKS = [
  { href: '/settings', label: 'Overview' },
  { href: '/settings/brand', label: 'Brand' },
  { href: '/settings/voice', label: 'Voice' },
  { href: '/settings/outcomes', label: 'Outcomes' },
  { href: '/settings/members', label: 'Members' },
  { href: '/settings/roles', label: 'Roles' },
  { href: '/settings/audit', label: 'Audit' },
  { href: '/settings/packs', label: 'Packs' },
  { href: '/settings/agent-tools', label: 'Agent tools' },
  { href: '/settings/models', label: 'Models' },
  { href: '/settings/channels', label: 'Postiz' },
  { href: '/settings/api', label: 'API' },
  { href: '/settings/billing', label: 'Billing' },
] as const

const isActive = (pathname: string, href: string): boolean =>
  href === '/settings'
    ? pathname === '/settings'
    : pathname === href || pathname.startsWith(`${href}/`)

export const SettingsLocalNav = () => {
  const pathname = usePathname()
  const { productId, products, selectProduct } = useActiveProduct()
  return (
    <div className="settings-toolbar">
      <nav className="packs-tabs settings-local-nav" aria-label="Settings sections">
        {LINKS.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? 'packs-tab is-active' : 'packs-tab'}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
      <ProductSwitcher productId={productId} products={products} onChange={selectProduct} />
    </div>
  )
}
