'use client'

import type { ActiveProductOption } from '@/lib/use-active-product'

type ProductSwitcherProps = {
  productId: string | null
  products: ActiveProductOption[]
  disabled?: boolean
  onChange: (productId: string) => void
}

/** Visible Product name + switcher. One Product still shows the name. */
export const ProductSwitcher = ({
  productId,
  products,
  disabled,
  onChange,
}: ProductSwitcherProps) => {
  if (products.length === 0) return null
  const value = productId && products.some((row) => row.productId === productId) ? productId : ''

  return (
    <label className="product-switcher">
      <span className="product-switcher-label">Product</span>
      <select
        value={value}
        disabled={disabled || products.length === 1}
        aria-label="Product for this page"
        onChange={(event) => onChange(event.target.value)}
      >
        {value ? null : (
          <option value="" disabled>
            Choose a Product
          </option>
        )}
        {products.map((row) => (
          <option key={row.productId} value={row.productId}>
            {row.name}
          </option>
        ))}
      </select>
    </label>
  )
}
