'use client'

import { useEffect, useId, useRef, useState } from 'react'

export type StudioLinkMenuOption = {
  id: string
  label: string
  meta?: string
  href: string
  mark?: string
}

type StudioLinkMenuProps = {
  /** Visible label on the trigger button. */
  triggerLabel: string
  /** Optional second line under the trigger label. */
  triggerMeta?: string
  options: StudioLinkMenuOption[]
  /** Marks the current item (sibling switcher). */
  activeId?: string
  ariaLabel: string
  /** Compact chip-sized trigger for Studio workspace bar. */
  compact?: boolean
}

/**
 * Floating link menu matching SpendScopeSelect / asset-tile dropdown craft:
 * surface + blur panel, accent hover rows, click-outside + Escape.
 */
export const StudioLinkMenu = ({
  triggerLabel,
  triggerMeta,
  options,
  activeId,
  ariaLabel,
  compact = false,
}: StudioLinkMenuProps) => {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (options.length === 0) return null

  return (
    <div
      className={`studio-link-menu${open ? ' is-open' : ''}${compact ? ' is-compact' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={`studio-link-menu-trigger${open ? ' is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="studio-link-menu-trigger-copy">
          <strong>{triggerLabel}</strong>
          {triggerMeta ? <span>{triggerMeta}</span> : null}
        </span>
        <span className="studio-link-menu-chevron" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <ul id={listId} className="studio-link-menu-list" role="menu" aria-label={ariaLabel}>
          <li className="studio-link-menu-hint" role="presentation">
            Opens a separate cut — not the main project.
          </li>
          {options.map((option) => {
            const active = option.id === activeId
            const mark = (option.mark ?? (option.label.trim().charAt(0) || '?')).toUpperCase()
            return (
              <li key={option.id} role="presentation">
                <a
                  role="menuitem"
                  href={option.href}
                  className={`studio-link-menu-option${active ? ' is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="studio-link-menu-option-mark" aria-hidden>
                    {mark}
                  </span>
                  <span className="studio-link-menu-option-copy">
                    <strong>{option.label}</strong>
                    {option.meta ? <span>{option.meta}</span> : null}
                  </span>
                  <span className="studio-link-menu-option-go" aria-hidden>
                    →
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
