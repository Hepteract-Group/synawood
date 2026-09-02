'use client'

import Link from 'next/link'
import { Player } from '@remotion/player'
import { useEffect, useState } from 'react'
import { MissingFrame404, missingFrame404Meta } from './MissingFrame404'

export const NotFoundView = () => {
  const [autoPlay, setAutoPlay] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setAutoPlay(!mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return (
    <section className="mos-not-found" aria-labelledby="mos-not-found-title">
      <h1 id="mos-not-found-title" className="sr-only">
        Page not found
      </h1>
      <div className="mos-not-found-stage">
        <Player
          component={MissingFrame404}
          durationInFrames={missingFrame404Meta.durationInFrames}
          compositionWidth={missingFrame404Meta.width}
          compositionHeight={missingFrame404Meta.height}
          fps={missingFrame404Meta.fps}
          style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' }}
          controls={false}
          loop={autoPlay}
          autoPlay={autoPlay}
          clickToPlay={false}
        />
      </div>
      <nav className="mos-not-found-actions" aria-label="Recover">
        <Link href="/home" className="btn btn-primary">
          Dashboard
        </Link>
        <Link href="/campaigns" className="btn">
          Campaigns
        </Link>
        <Link href="/studio" className="btn">
          Studio
        </Link>
        <Link href="/settings" className="btn">
          Settings
        </Link>
      </nav>
    </section>
  )
}
