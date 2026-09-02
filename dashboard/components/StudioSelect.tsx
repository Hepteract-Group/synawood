'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconChevronRight } from './icons'

export type StudioSelectOption = {
  value: string
  label: string
  mark?: string
  meta?: string
  disabled?: boolean
}

type StudioSelectProps = {
  label: string
  value: string
  options: StudioSelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  title?: string
  /** Compact density for chat footer model pickers. */
  size?: 'default' | 'compact' | 'inline'
  /** Open menu above the trigger (chat footer) or below. */
  placement?: 'up' | 'down'
  /** Extra class on the root (e.g. model-role). */
  className?: string
  /** Optional leading icon inside the mark chip when mark text is omitted. */
  markIcon?: ReactNode
  /** One-line explanation shown in the menu header (inline pills hide the label). */
  description?: string
}

const markFromLabel = (label: string): string => {
  const trimmed = label.trim()
  if (!trimmed) return '?'
  return trimmed.charAt(0).toUpperCase()
}

/**
 * Shared Studio dropdown — same family as Usage spend-scope / chat @ menu:
 * icon chip, label+meta, chevron, floating option list.
 */
export const StudioSelect = ({
  label,
  value,
  options,
  onChange,
  disabled = false,
  title,
  size = 'default',
  placement = 'down',
  className,
  markIcon,
  description,
}: StudioSelectProps) => {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLUListElement | null>(null)
  const [open, setOpen] = useState(false)
  const [menuBox, setMenuBox] = useState<{
    top?: number
    bottom?: number
    left: number
    width: number
    maxHeight: number
  } | null>(null)
  const enabledOptions = options.filter((option) => !option.disabled)
  const selected =
    options.find((option) => option.value === value) ?? enabledOptions[0] ?? options[0]

  const syncMenuBox = () => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const gap = 6
    const maxMenu = size === 'default' ? 256 : 224
    if (placement === 'up') {
      const available = Math.max(120, rect.top - gap - 8)
      setMenuBox({
        bottom: window.innerHeight - rect.top + gap,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(maxMenu, available),
      })
      return
    }
    const available = Math.max(120, window.innerHeight - rect.bottom - gap - 8)
    setMenuBox({
      top: rect.bottom + gap,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.min(maxMenu, available),
    })
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuBox(null)
      return
    }
    syncMenuBox()
  }, [open, placement, size, options.length])

  // Content-sized inline menus can be wider than the trigger; keep them on screen.
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!open || !menu || !menuBox) return
    const width = menu.getBoundingClientRect().width
    const maxLeft = window.innerWidth - width - 8
    const clamped = Math.max(8, Math.min(menuBox.left, maxLeft))
    if (Math.abs(clamped - menuBox.left) > 0.5) {
      setMenuBox({ ...menuBox, left: clamped })
    }
  }, [open, menuBox])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if ((target as Element).closest?.(`[data-studio-select-menu="${listId}"]`)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onReposition = () => syncMenuBox()
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, listId])

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  const moveSelection = (delta: number) => {
    if (enabledOptions.length === 0) return
    const index = Math.max(
      0,
      enabledOptions.findIndex((option) => option.value === value),
    )
    const next = enabledOptions[(index + delta + enabledOptions.length) % enabledOptions.length]
    if (next) onChange(next.value)
  }

  const selectedMark = selected?.mark ?? markFromLabel(selected?.label ?? label)
  const inline = size === 'inline'

  const menu =
    open && menuBox && typeof document !== 'undefined'
      ? createPortal(
          <ul
            id={listId}
            ref={menuRef}
            className={`studio-select-menu is-ported${size !== 'default' ? ` is-${size}` : ''}`}
            role="listbox"
            aria-labelledby={`${listId}-label`}
            data-studio-select-menu={listId}
            style={{
              top: menuBox.top,
              bottom: menuBox.bottom,
              left: menuBox.left,
              minWidth: menuBox.width,
              width: inline ? undefined : menuBox.width,
              maxHeight: menuBox.maxHeight,
            }}
          >
            <li className="studio-select-menu-header" role="presentation">
              <span className="studio-select-menu-title">{label}</span>
              {description ? <span className="studio-select-menu-hint">{description}</span> : null}
            </li>
            {options.map((option) => {
              const active = option.value === value
              return (
                <li key={option.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={option.disabled}
                    className={`studio-select-option${active ? ' is-active' : ''}${option.disabled ? ' is-disabled' : ''}`}
                    onClick={() => {
                      if (option.disabled) return
                      onChange(option.value)
                      setOpen(false)
                    }}
                  >
                    {inline ? null : (
                      <span className="studio-select-mark" aria-hidden>
                        {option.mark ?? markFromLabel(option.label)}
                      </span>
                    )}
                    <span className="studio-select-copy">
                      <strong>{option.label}</strong>
                      {option.meta ? <span>{option.meta}</span> : null}
                    </span>
                    {active ? (
                      <span className="studio-select-check" aria-hidden>
                        ✓
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>,
          document.body,
        )
      : null

  return (
    <div
      className={[
        'studio-select',
        size !== 'default' ? `is-${size}` : '',
        placement === 'up' ? 'opens-up' : 'opens-down',
        open ? 'is-open' : '',
        disabled ? 'is-disabled' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      ref={rootRef}
    >
      <span className="studio-select-label" id={`${listId}-label`}>
        {label}
      </span>
      <button
        type="button"
        ref={triggerRef}
        className={`studio-select-trigger${open ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${listId}-label`}
        aria-controls={listId}
        title={title ?? `${label}: ${selected?.label ?? ''}`}
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpen((current) => !current)
        }}
        onKeyDown={(event) => {
          if (disabled) return
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            if (!open) setOpen(true)
            else moveSelection(1)
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) setOpen(true)
            else moveSelection(-1)
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setOpen((current) => !current)
          }
        }}
      >
        {inline ? null : (
          <span className="studio-select-mark" aria-hidden>
            {markIcon ?? selectedMark}
          </span>
        )}
        <span className="studio-select-copy">
          <strong>{selected?.label ?? 'Select'}</strong>
          {selected?.meta && !inline ? <span>{selected.meta}</span> : null}
        </span>
        <span className="studio-select-chevron" aria-hidden>
          <IconChevronRight />
        </span>
      </button>
      {menu}
    </div>
  )
}
