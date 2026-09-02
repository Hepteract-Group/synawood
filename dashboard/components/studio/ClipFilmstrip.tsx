'use client'

import { useEffect, useMemo, useState } from 'react'

const TILE_PX = 56

type ClipFilmstripProps = {
  kind: 'video' | 'image'
  src: string
  widthPx: number
  label: string
  onFailed?: () => void
}

/**
 * Timeline media preview.
 * Images tile like an NLE filmstrip; video prefers a poster JPEG when available,
 * otherwise one cover frame via <video preload="metadata"> (tiling multiple
 * <video> elements would hammer /content and the decoder).
 */
export const ClipFilmstrip = ({ kind, src, widthPx, label, onFailed }: ClipFilmstripProps) => {
  const [failed, setFailed] = useState(false)
  const tileCount = useMemo(
    () => Math.max(1, Math.min(24, Math.ceil(Math.max(widthPx, TILE_PX) / TILE_PX))),
    [widthPx],
  )

  useEffect(() => {
    setFailed(false)
  }, [src])

  useEffect(() => {
    if (failed) onFailed?.()
  }, [failed, onFailed])

  if (failed) return null

  const markFailed = () => setFailed(true)

  if (kind === 'video') {
    return (
      <div className="clip-filmstrip is-video" aria-hidden>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          className="clip-filmstrip-cover"
          src={`${src}#t=0.05`}
          muted
          playsInline
          preload="metadata"
          draggable={false}
          onError={markFailed}
          aria-label={label}
        />
        <span className="clip-filmstrip-shade" />
      </div>
    )
  }

  return (
    <div className="clip-filmstrip is-image" aria-hidden>
      {Array.from({ length: tileCount }, (_, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={index}
          className="clip-filmstrip-tile"
          src={src}
          alt=""
          draggable={false}
          onError={markFailed}
        />
      ))}
      <span className="clip-filmstrip-shade" />
    </div>
  )
}
