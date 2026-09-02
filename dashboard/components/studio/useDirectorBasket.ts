'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  addToDirectorBasket,
  directorBasketPrompt,
  directorBasketStorageKey,
  parseDirectorBasket,
  removeFromDirectorBasket,
  type DirectorBasketItem,
} from './director-basket'

export const useDirectorBasket = (projectId: string) => {
  const [items, setItems] = useState<DirectorBasketItem[]>([])

  useEffect(() => {
    setItems(parseDirectorBasket(window.localStorage.getItem(directorBasketStorageKey(projectId))))
  }, [projectId])

  const persist = useCallback(
    (next: DirectorBasketItem[]) => {
      setItems(next)
      window.localStorage.setItem(directorBasketStorageKey(projectId), JSON.stringify(next))
    },
    [projectId],
  )

  const add = useCallback(
    (item: Omit<DirectorBasketItem, 'addedAt'> & { addedAt?: string }) => {
      persist(addToDirectorBasket(items, item))
    },
    [items, persist],
  )

  const remove = useCallback(
    (input: { assetId: string; shotId?: string }) => {
      persist(removeFromDirectorBasket(items, input))
    },
    [items, persist],
  )

  const clear = useCallback(() => {
    persist([])
  }, [persist])

  return {
    items,
    add,
    remove,
    clear,
    prompt: directorBasketPrompt(items),
  }
}
