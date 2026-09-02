'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { GUIDE_CATALOGUE } from '@/lib/guides/catalogue'
import {
  fetchGuideList,
  firstGuideRoute,
  putGuideProgress,
  type GuideApiItem,
} from '@/lib/guides/client'
import { emitGuideRuntime, guideSettingsAction, guideStatusLabel } from '@/lib/guides/presentation'

export const SettingsGuidesCard = () => {
  const router = useRouter()
  const [guides, setGuides] = useState<GuideApiItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const list = await fetchGuideList()
      setGuides(list)
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load guides.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (GUIDE_CATALOGUE.length === 0) return null

  const replay = async (guideId: string) => {
    setPendingId(guideId)
    setError(null)
    try {
      await putGuideProgress(guideId, 'in_progress', 0)
      emitGuideRuntime()
      const route = firstGuideRoute(guideId)
      if (route) router.push(route)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start that guide.')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section className="settings-guides" aria-labelledby="settings-guides-title">
      <header className="settings-guides-header">
        <div>
          <h2 id="settings-guides-title" className="settings-guides-title">
            Guides
          </h2>
          <p className="page-lede">Short tours of the product. Replay any time.</p>
        </div>
      </header>
      {error ? (
        <p className="guide-error" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="settings-guides-list">
        {guides.map((guide) => (
          <li key={guide.id} className="settings-guides-row">
            <div className="settings-guides-copy">
              <p className="settings-guides-name">{guide.title}</p>
              <p className="page-lede">{guide.summary}</p>
            </div>
            <span
              className={
                guide.status === 'completed' ? 'status-pill' : 'status-pill status-pill-ghost'
              }
            >
              {guideStatusLabel(guide.status)}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pendingId === guide.id}
              onClick={() => void replay(guide.id)}
            >
              {guideSettingsAction(guide.status)}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
