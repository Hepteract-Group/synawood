'use client'

import type { StudioMutation, StudioProject } from '@synawood/creative/project/client'
import { getSlideshowPreset } from '@synawood/creative/presets/slideshow'
import { slideTokenFor } from '@synawood/creative/project/slide-token'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type SlideStripProps = {
  project: StudioProject
  selectedSlideId: string | null
  onSelectSlide: (slideId: string) => void
  onMutate: (mutation: StudioMutation) => Promise<void>
  /** Insert @slide:… into the chat composer. */
  onMentionSlide?: (token: string) => void
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
  disabled?: boolean
}

const SCROLL_EPS = 4

/** Bottom slide strip — replaces NLE timeline in slideshow mode. */
export const SlideStrip = ({
  project,
  selectedSlideId,
  onSelectSlide,
  onMutate,
  onMentionSlide,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  disabled = false,
}: SlideStripProps) => {
  const slides = useMemo(
    () => [...(project.slideshow?.slides ?? [])].sort((a, b) => a.order - b.order),
    [project.slideshow?.slides],
  )
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  const preset = project.slideshow ? getSlideshowPreset(project.slideshow.presetId) : null
  const atMin = preset ? slides.length <= preset.slideCount.min : true
  const atMax = preset ? slides.length >= preset.slideCount.max : true
  const locked = disabled || busy

  const updateScrollAffordances = useCallback(() => {
    const el = scrollerRef.current
    if (!el) {
      setCanScrollLeft(false)
      setCanScrollRight(false)
      return
    }
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanScrollLeft(scrollLeft > SCROLL_EPS)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - SCROLL_EPS)
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    updateScrollAffordances()
    const onScroll = () => updateScrollAffordances()
    el.addEventListener('scroll', onScroll, { passive: true })
    const resize = new ResizeObserver(() => updateScrollAffordances())
    resize.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      resize.disconnect()
    }
  }, [updateScrollAffordances, slides.length])

  useEffect(() => {
    // Re-measure after layout settles when selection / thumbs change.
    const id = requestAnimationFrame(() => updateScrollAffordances())
    return () => cancelAnimationFrame(id)
  }, [updateScrollAffordances, selectedSlideId, slides])

  const scrollByCard = (direction: -1 | 1) => {
    const el = scrollerRef.current
    if (!el) return
    const firstCard = el.querySelector('.slide-strip-card') as HTMLElement | null
    const step = firstCard ? firstCard.offsetWidth + 8 : 160
    el.scrollBy({ left: direction * step, behavior: 'smooth' })
  }

  const run = async (mutation: StudioMutation, after?: () => void) => {
    if (locked) return
    setBusy(true)
    try {
      await onMutate(mutation)
      after?.()
    } finally {
      setBusy(false)
    }
  }

  const moveSlide = async (fromId: string, toId: string) => {
    if (fromId === toId || locked) return
    const ids = slides.map((slide) => slide.id)
    const from = ids.indexOf(fromId)
    const to = ids.indexOf(toId)
    if (from < 0 || to < 0) return
    const next = [...ids]
    const [moved] = next.splice(from, 1)
    if (!moved) return
    next.splice(to, 0, moved)
    await run({ type: 'reorder_slides', orderedIds: next })
  }

  const onAdd = () => {
    if (slides.length === 0) {
      void run({ type: 'add_slide' })
      return
    }
    void run({
      type: 'add_slide',
      afterSlideId: selectedSlideId ?? slides[slides.length - 1]?.id,
    })
  }

  const onRemove = (slideId: string) => {
    if (atMin) return
    const index = slides.findIndex((slide) => slide.id === slideId)
    const neighbor = slides[index + 1]?.id ?? slides[index - 1]?.id ?? null
    void run({ type: 'remove_slide', slideId }, () => {
      if (neighbor) onSelectSlide(neighbor)
    })
  }

  const selectedSlide = selectedSlideId
    ? (slides.find((slide) => slide.id === selectedSlideId) ?? null)
    : null

  const onMention = () => {
    if (!selectedSlide || !onMentionSlide) return
    onMentionSlide(slideTokenFor(selectedSlide))
  }

  if (slides.length === 0) {
    return (
      <div className="slide-strip slide-strip-empty" aria-label="Slide strip">
        <p className="muted">No slides yet. Add a starter pack, or ask the agent to plan one.</p>
        <button type="button" className="btn" disabled={locked} onClick={onAdd}>
          Add slides
        </button>
      </div>
    )
  }

  return (
    <div
      className="slide-strip"
      aria-label="Slide strip"
      tabIndex={0}
      onKeyDown={(event) => {
        if (locked) return
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
          event.preventDefault()
          if (event.shiftKey) {
            if (canRedo) onRedo?.()
          } else if (canUndo) {
            onUndo?.()
          }
        }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
          event.preventDefault()
          if (canRedo) onRedo?.()
        }
      }}
    >
      <div className="slide-strip-toolbar" role="toolbar" aria-label="Slide actions">
        <button
          type="button"
          className="btn slide-strip-action"
          disabled={locked || !canUndo || !onUndo}
          title="Undo last edit (⌘Z / Ctrl+Z)"
          onClick={() => onUndo?.()}
        >
          Undo
        </button>
        <button
          type="button"
          className="btn slide-strip-action"
          disabled={locked || !canRedo || !onRedo}
          title="Redo (⌘⇧Z / Ctrl+Y)"
          onClick={() => onRedo?.()}
        >
          Redo
        </button>
        <button
          type="button"
          className="btn slide-strip-action"
          disabled={locked || atMax}
          title={
            atMax
              ? `This format allows at most ${preset?.slideCount.max ?? 0} slides`
              : 'Add a slide after the selected one'
          }
          onClick={onAdd}
        >
          Add slide
        </button>
        <button
          type="button"
          className="btn slide-strip-action"
          disabled={locked || atMin || !selectedSlideId}
          title={
            atMin
              ? `This format needs at least ${preset?.slideCount.min ?? 0} slides`
              : 'Remove the selected slide'
          }
          onClick={() => {
            if (selectedSlideId) onRemove(selectedSlideId)
          }}
        >
          Remove
        </button>
        {onMentionSlide ? (
          <button
            type="button"
            className="btn slide-strip-action"
            disabled={locked || !selectedSlide}
            title="Mention the selected slide in chat"
            onClick={onMention}
          >
            Mention in chat
          </button>
        ) : null}
        <span className="slide-strip-count muted mono">
          {slides.length}
          {preset ? ` / ${preset.slideCount.max}` : ''}
        </span>
      </div>
      <div
        className={`slide-strip-scroller-wrap${canScrollLeft ? ' has-left' : ''}${canScrollRight ? ' has-right' : ''}`}
      >
        {canScrollLeft ? (
          <button
            type="button"
            className="slide-strip-nav is-prev"
            aria-label="Show earlier slides"
            title="Earlier slides"
            onClick={() => scrollByCard(-1)}
          >
            ‹
          </button>
        ) : null}
        <div className="slide-strip-scroller" ref={scrollerRef}>
          <ul className="slide-strip-list">
            {slides.map((slide, index) => {
              const selected = slide.id === selectedSlideId
              const thumbUrl = slide.backgroundAssetId
                ? `/api/studio/projects/${project.id}/assets/${slide.backgroundAssetId}/content`
                : null
              return (
                <li key={slide.id} className="slide-strip-item">
                  <button
                    type="button"
                    className={`slide-strip-card ${selected ? 'is-selected' : ''} ${thumbUrl ? 'has-thumb' : 'no-thumb'}`}
                    disabled={locked}
                    draggable={!locked}
                    onDragStart={() => setDraggingId(slide.id)}
                    onDragEnd={() => setDraggingId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggingId) void moveSlide(draggingId, slide.id)
                      setDraggingId(null)
                    }}
                    onClick={() => onSelectSlide(slide.id)}
                  >
                    {thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed studio asset proxy
                      <img src={thumbUrl} alt="" className="slide-strip-thumb" draggable={false} />
                    ) : (
                      <span className="slide-strip-thumb-placeholder" aria-hidden />
                    )}
                    <span className="slide-strip-scrim" aria-hidden />
                    <span className="slide-strip-card-body">
                      <span className="slide-strip-index mono">{index + 1}</span>
                      <span className="slide-strip-headline">
                        {slide.headline.trim() || 'Untitled slide'}
                      </span>
                      <span className="slide-strip-meta mono">
                        {Math.round(slide.durationFrames / project.fps)}s · {slide.transition}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="slide-strip-remove"
                    disabled={locked || atMin}
                    aria-label={`Remove slide ${index + 1}`}
                    title={atMin ? `Need at least ${preset?.slideCount.min ?? 0} slides` : 'Remove'}
                    onClick={(event) => {
                      event.stopPropagation()
                      onRemove(slide.id)
                    }}
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
        {canScrollRight ? (
          <button
            type="button"
            className="slide-strip-nav is-next"
            aria-label="Show later slides"
            title="Later slides"
            onClick={() => scrollByCard(1)}
          >
            ›
          </button>
        ) : null}
      </div>
    </div>
  )
}
