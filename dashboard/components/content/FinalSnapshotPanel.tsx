'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { CreativeStructure } from '@synawood/creative/intent/creative-structure'
import { formatBeatWindow } from '@/components/studio/timelineMath'
import {
  STRUCTURE_SNAPSHOT_EMPTY,
  STRUCTURE_SNAPSHOT_EMPTY_HINT,
  STRUCTURE_SNAPSHOT_LEDE,
  structureBeatLabel,
  structureSourceLabel,
} from '@/lib/studio-structure-copy'

type FinalSnapshot = {
  id: string
  projectId: string
  createdAt: string
  creativeStructure: CreativeStructure
}

export const FinalSnapshotPanel = ({ finalId }: { finalId: string }) => {
  const [final, setFinal] = useState<FinalSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/content/finals/${encodeURIComponent(finalId)}`)
      const body = (await response.json().catch(() => null)) as {
        final?: FinalSnapshot
        error?: string
      } | null
      if (!response.ok || !body?.final) {
        setError(body?.error ?? 'Could not load this Final.')
        setLoading(false)
        return
      }
      setFinal(body.final)
      setLoading(false)
    })()
  }, [finalId])

  return (
    <section className="panel settings-page final-snapshot-page mos-enter">
      <header className="settings-header">
        <div className="settings-header-copy">
          <p className="eyebrow">
            <Link href="/content" className="settings-crumb">
              Work board
            </Link>
            <span aria-hidden> / </span>
            Final
          </p>
          <h1 className="settings-title">Final snapshot</h1>
          <p className="page-lede">{STRUCTURE_SNAPSHOT_LEDE}</p>
        </div>
        <div className="settings-header-actions">
          <Link href="/content" className="btn btn-ghost">
            Work board
          </Link>
          {final ? (
            <Link href={`/studio/${final.projectId}`} className="btn btn-primary">
              Open Studio
            </Link>
          ) : null}
        </div>
      </header>

      {loading ? (
        <p className="page-lede" role="status">
          Loading Final…
        </p>
      ) : null}
      {error ? (
        <div className="settings-alert is-error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
      {final ? (
        <>
          <h2 className="section-title">Creative structure</h2>
          <p className="muted">
            Source: {structureSourceLabel(final.creativeStructure.source)} · Approved{' '}
            {new Date(final.createdAt).toLocaleString()}
          </p>
          {final.creativeStructure.beats.length === 0 ? (
            <div className="settings-empty-inline">
              <p>{STRUCTURE_SNAPSHOT_EMPTY}</p>
              <p className="page-lede">{STRUCTURE_SNAPSHOT_EMPTY_HINT}</p>
            </div>
          ) : (
            <ol className="structure-beat-list">
              {final.creativeStructure.beats.map((beat, index) => (
                <li key={`${beat.kind}-${index}`}>
                  <strong>{structureBeatLabel(beat.kind)}</strong>
                  <span className="muted">
                    {formatBeatWindow(beat.from, beat.durationInFrames)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : null}
    </section>
  )
}
