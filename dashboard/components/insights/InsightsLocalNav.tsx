'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ProductSwitcher } from '@/components/ProductSwitcher'
import type { ActiveProductOption } from '@/lib/use-active-product'

const LINKS = [
  { href: '/insights', label: 'Open insights' },
  { href: '/insights/explore', label: 'Explore' },
] as const

type InsightsLocalNavProps = {
  productId: string | null
  products: ActiveProductOption[]
  onProductChange: (productId: string) => void
}

export const InsightsLocalNav = ({
  productId,
  products,
  onProductChange,
}: InsightsLocalNavProps) => {
  const pathname = usePathname()
  return (
    <div className="insights-toolbar">
      <nav className="packs-tabs settings-local-nav" aria-label="Insights sections">
        {LINKS.map((item) => {
          const active =
            item.href === '/insights' ? pathname === '/insights' : pathname.startsWith(item.href)
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
      <ProductSwitcher productId={productId} products={products} onChange={onProductChange} />
    </div>
  )
}
