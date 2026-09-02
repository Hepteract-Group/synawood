'use client'

import { useCallback, useEffect, useState } from 'react'
import { readActiveProductIdFromDocument, rememberActiveProductId } from './active-product-cookie'
import { readApiJson } from './read-api-json'
import { pickActiveProductId } from './resolve-client-product-id'

export type ActiveProductOption = {
  productId: string
  name: string
}

export const ACTIVE_PRODUCT_EVENT = 'synawood-active-product'

export const broadcastActiveProduct = (id: string): void => {
  rememberActiveProductId(id)
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ACTIVE_PRODUCT_EVENT, { detail: id }))
}

export const useActiveProduct = () => {
  const [products, setProducts] = useState<ActiveProductOption[]>([])
  const [productId, setProductId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/products')
        const body = await readApiJson<{
          memberships?: Array<{ productId: string; product: { name: string } }>
          error?: string
        }>(response)
        if (!response.ok) throw new Error(body.error ?? 'Could not load Products.')
        const list = (body.memberships ?? []).map((row) => ({
          productId: row.productId,
          name: row.product.name,
        }))
        setProducts(list)
        const cookieId = readActiveProductIdFromDocument()
        const picked = pickActiveProductId(list, cookieId)
        if (picked && picked !== cookieId) rememberActiveProductId(picked)
        setProductId(picked)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load Products.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    const onChange = (event: Event) => {
      const id = (event as CustomEvent<string>).detail
      if (typeof id === 'string' && id) setProductId(id)
    }
    window.addEventListener(ACTIVE_PRODUCT_EVENT, onChange)
    return () => window.removeEventListener(ACTIVE_PRODUCT_EVENT, onChange)
  }, [])

  const selectProduct = useCallback((id: string) => {
    broadcastActiveProduct(id)
  }, [])

  const productName = products.find((row) => row.productId === productId)?.name ?? null

  return { productId, productName, products, loading, error, selectProduct }
}
