'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { GUIDE_CATALOGUE } from '@/lib/guides/catalogue'
import {
  fetchGuideList,
  postGuideSession,
  putGuideProgress,
  type GuideApiItem,
  type GuideSessionPayload,
} from '@/lib/guides/client'
import {
  GUIDE_PROMPTED_KEY,
  GUIDE_RUNTIME_EVENT,
  GUIDE_SESSION_CACHE,
  GUIDE_SESSION_FLAG,
  formatGuideChip,
  nextGuideCardPos,
  pickActiveGuide,
  pickGuideHostView,
  placeGuideCard,
  progressAfterAction,
  splitGuideEmphasis,
  type SessionEligibleGuide,
} from '@/lib/guides/presentation'

const CARD = { width: 360, height: 240 }

const blockingJobOpen = (): boolean => {
  if (typeof document === 'undefined') return false
  return Boolean(document.querySelector('.render-progress-modal, .publish-modal-root'))
}

const targetBox = (spotlight: string | undefined) => {
  if (!spotlight || typeof document === 'undefined') return null
  const node = document.querySelector(`[data-guide="${spotlight}"]`)
  if (!node) return null
  const rect = node.getBoundingClientRect()
  return { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom }
}

const toSessionGuide = (item: GuideApiItem): SessionEligibleGuide | null => {
  const definition = GUIDE_CATALOGUE.find((guide) => guide.id === item.id)
  if (!definition) return null
  const status = item.status === 'not_seen' ? 'pending' : item.status
  return {
    id: definition.id,
    kind: definition.kind,
    title: definition.title,
    summary: definition.summary,
    steps: definition.steps,
    status,
    stepIndex: item.stepIndex,
  }
}

const GuideBody = ({ text }: { text: string }) => (
  <>
    {splitGuideEmphasis(text).map((part, index) =>
      part.strong ? <strong key={index}>{part.text}</strong> : <span key={index}>{part.text}</span>,
    )}
  </>
)

export const GuideHost = () => {
  const pathname = usePathname()
  const router = useRouter()
  const titleId = useId()
  const cardRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [blockedByJob, setBlockedByJob] = useState(false)
  const [cardOpen, setCardOpen] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [completeTitle, setCompleteTitle] = useState('')
  const [guide, setGuide] = useState<SessionEligibleGuide | null>(null)
  const [autoPromptUsed, setAutoPromptUsed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cardPos, setCardPos] = useState({ top: 120, left: 24, width: 360, centered: true })

  const applyEligible = useCallback((eligible: GuideSessionPayload['eligibleGuides']) => {
    setGuide(pickActiveGuide(eligible, GUIDE_CATALOGUE))
  }, [])

  useEffect(() => {
    let cancelled = false
    const start = async () => {
      try {
        const evaluated = sessionStorage.getItem(GUIDE_SESSION_FLAG) === '1'
        const prompted = sessionStorage.getItem(GUIDE_PROMPTED_KEY) === '1'
        if (prompted) setAutoPromptUsed(true)
        if (!evaluated) {
          const session = await postGuideSession()
          if (cancelled) return
          sessionStorage.setItem(GUIDE_SESSION_FLAG, '1')
          sessionStorage.setItem(GUIDE_SESSION_CACHE, JSON.stringify(session))
          applyEligible(session.eligibleGuides)
        } else {
          const list = await fetchGuideList()
          if (cancelled) return
          const active = list.find((item) => item.status === 'in_progress')
          if (active) {
            setGuide(toSessionGuide(active))
            setCardOpen(false)
          } else if (!prompted) {
            const cached = sessionStorage.getItem(GUIDE_SESSION_CACHE)
            if (cached) {
              const session = JSON.parse(cached) as GuideSessionPayload
              applyEligible(session.eligibleGuides)
            }
          }
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Could not load the guide.')
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    void start()
    return () => {
      cancelled = true
    }
  }, [applyEligible])

  useEffect(() => {
    const sync = () => {
      void fetchGuideList()
        .then((list) => {
          const active = list.find((item) => item.status === 'in_progress')
          if (!active) return
          setGuide(toSessionGuide(active))
          setCardOpen(true)
          setShowComplete(false)
        })
        .catch(() => undefined)
    }
    window.addEventListener(GUIDE_RUNTIME_EVENT, sync)
    return () => window.removeEventListener(GUIDE_RUNTIME_EVENT, sync)
  }, [])

  useEffect(() => {
    const check = () => setBlockedByJob(blockingJobOpen())
    check()
    const timer = window.setInterval(check, 400)
    return () => window.clearInterval(timer)
  }, [])

  const view = pickGuideHostView({
    ready,
    blockedByJob,
    cardOpen,
    showComplete,
    completeTitle,
    guide,
    autoPromptUsed,
    error,
  })

  const currentStep = view.type === 'step' ? view.guide.steps[view.stepIndex] : undefined
  const stepOpen = view.type === 'step' && view.cardOpen
  const stepIndex = view.type === 'step' ? view.stepIndex : -1
  const spotlight = currentStep?.spotlight
  const stepRoute = currentStep?.route

  useEffect(() => {
    if (view.type !== 'step' || !stepRoute) return
    if (pathname === stepRoute || pathname.startsWith(`${stepRoute}/`)) return
    router.push(stepRoute)
  }, [view.type, stepRoute, pathname, router])

  useLayoutEffect(() => {
    if (!stepOpen) return
    let timer = 0
    let tries = 0
    const paint = () => {
      const target = spotlight ? document.querySelector(`[data-guide="${spotlight}"]`) : null
      document.querySelectorAll('.is-guide-spotlight').forEach((node) => {
        node.classList.remove('is-guide-spotlight')
      })
      target?.classList.add('is-guide-spotlight')
      if (target) {
        target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
      } else if (tries < 20) {
        tries += 1
        timer = window.setTimeout(paint, 100)
        return
      }
      const measured = cardRef.current?.getBoundingClientRect()
      const next = placeGuideCard({
        target: targetBox(spotlight),
        viewport: { width: window.innerWidth, height: window.innerHeight },
        card: {
          width: measured?.width || CARD.width,
          height: measured?.height || CARD.height,
        },
        studioDock: pathname.startsWith('/studio'),
      })
      setCardPos((prev) => nextGuideCardPos(prev, next))
    }
    paint()
    return () => {
      window.clearTimeout(timer)
      document.querySelectorAll('.is-guide-spotlight').forEach((node) => {
        node.classList.remove('is-guide-spotlight')
      })
    }
  }, [stepOpen, stepIndex, spotlight, pathname])

  const markPrompted = () => {
    sessionStorage.setItem(GUIDE_PROMPTED_KEY, '1')
    setAutoPromptUsed(true)
  }

  const act = async (action: 'start' | 'next' | 'back' | 'skip' | 'complete') => {
    if (!guide) return
    setBusy(true)
    setError(null)
    try {
      const next = progressAfterAction({
        action,
        stepIndex: guide.stepIndex,
        stepCount: guide.steps.length,
      })
      await putGuideProgress(guide.id, next.status, next.stepIndex)
      if (action === 'start' || action === 'skip' || action === 'complete') markPrompted()
      if (action === 'skip') {
        sessionStorage.removeItem(GUIDE_SESSION_CACHE)
        setGuide(null)
        setCardOpen(false)
        return
      }
      if (action === 'complete') {
        setCompleteTitle(guide.title)
        setShowComplete(true)
        setGuide({ ...guide, status: 'completed', stepIndex: next.stepIndex })
        setCardOpen(false)
        return
      }
      setGuide({ ...guide, status: next.status, stepIndex: next.stepIndex })
      setCardOpen(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the guide. Try again.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (view.type !== 'start' && view.type !== 'complete' && !stepOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || busy || blockingJobOpen()) return
      event.preventDefault()
      if (view.type === 'complete') {
        setShowComplete(false)
        return
      }
      void act('skip')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view.type, stepOpen, guide, busy])

  const onNext = () => {
    if (!guide) return
    if (guide.stepIndex >= guide.steps.length - 1) {
      void act('complete')
      return
    }
    void act('next')
  }

  const chip =
    view.type === 'step' ? formatGuideChip(view.stepIndex, view.guide.steps.length) : null

  return (
    <>
      {view.type === 'error' ? (
        <div className="guide-load-alert" role="alert">
          <p>{view.message} You can retry from Settings → Guides.</p>
          <button type="button" className="guide-load-alert-dismiss" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {chip ? (
        <div className="guide-chip-row">
          <button
            type="button"
            className="guide-chip"
            data-guide="guide-chip"
            aria-label={`${chip.label}, step ${chip.fraction.replace('/', ' of ')}`}
            onClick={() => setCardOpen((open) => !open)}
          >
            <span className="guide-chip-label">{chip.label}</span>
            <span className="guide-chip-count">{chip.fraction}</span>
          </button>
          <button
            type="button"
            className="guide-skip guide-chip-skip"
            disabled={busy}
            onClick={() => void act('skip')}
          >
            Skip
          </button>
        </div>
      ) : null}

      {view.type === 'start' ? (
        <div
          className="dialog-root guide-host-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <button
            type="button"
            className="dialog-backdrop"
            aria-label="Not now"
            onClick={() => void act('skip')}
          />
          <div className="dialog-panel guide-start-panel">
            <h2 id={titleId} className="dialog-title">
              {view.guide.title}
            </h2>
            <p className="dialog-body">{view.guide.summary}</p>
            {error ? (
              <p className="guide-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => void act('skip')}
              >
                Not now
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void act('start')}
              >
                Start guide
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {view.type === 'step' && view.cardOpen ? (
        <div
          ref={cardRef}
          className={
            pathname.startsWith('/studio') ? 'guide-step-card is-studio' : 'guide-step-card'
          }
          role="region"
          aria-label="Guide"
          style={{
            top: cardPos.top,
            left: cardPos.left,
            width: cardPos.width,
          }}
        >
          <p className="guide-step-index">
            Step {view.stepIndex + 1} of {view.guide.steps.length}
          </p>
          <h2 className="guide-step-title">{currentStep?.title}</h2>
          <p className="guide-step-body">
            {currentStep ? <GuideBody text={currentStep.body} /> : null}
          </p>
          {error ? (
            <p className="guide-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="guide-step-actions">
            {view.stepIndex > 0 ? (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => void act('back')}
              >
                Back
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="guide-skip"
              disabled={busy}
              onClick={() => void act('skip')}
            >
              Skip guide
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={onNext}>
              {view.stepIndex >= view.guide.steps.length - 1 ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      ) : null}

      {view.type === 'complete' ? (
        <div
          className="dialog-root guide-host-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <button
            type="button"
            className="dialog-backdrop"
            aria-label="Close"
            onClick={() => setShowComplete(false)}
          />
          <div className="dialog-panel guide-start-panel">
            <h2 id={titleId} className="dialog-title">
              You are done
            </h2>
            <p className="dialog-body">
              {view.title} is finished. You can replay it from Settings.
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowComplete(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
