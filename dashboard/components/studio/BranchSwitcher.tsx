'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'

export type BranchSummaryDto = {
  id: string
  name: string
  slug: string
  isMain: boolean
  isActive: boolean
  parentBranchId: string | null
  forkedFromRevision: number | null
  revision: number
  updatedAt: string
}

type BranchSwitcherProps = {
  projectId: string
  expectedRevision: number
  disabled?: boolean
  onProjectChanged: (project: unknown) => void
  onError: (message: string) => void
  /** Match mutations/history: reload project when server returns 409. */
  onRevisionConflict?: () => Promise<void>
}

/**
 * Named-branch switcher for the Studio workspace bar (ADR-0030 / #186).
 * Calls GET/POST /branches and POST …/switch — not Ad Generator variants.
 */
export const BranchSwitcher = ({
  projectId,
  expectedRevision,
  disabled = false,
  onProjectChanged,
  onError,
  onRevisionConflict,
}: BranchSwitcherProps) => {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [branches, setBranches] = useState<BranchSummaryDto[]>([])
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null)

  const active =
    branches.find((branch) => branch.id === activeBranchId) ?? branches.find((b) => b.isActive)
  const triggerLabel = active?.name ?? 'Branch'

  const loadBranches = useCallback(async () => {
    try {
      const response = await fetch(`/api/studio/projects/${projectId}/branches`)
      const body = (await response.json()) as {
        branches?: BranchSummaryDto[]
        activeBranchId?: string | null
        error?: string
      }
      if (!response.ok) {
        onError(body.error ?? 'Failed to load branches')
        return
      }
      setBranches(body.branches ?? [])
      setActiveBranchId(body.activeBranchId ?? null)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to load branches')
    }
  }, [onError, projectId])

  useEffect(() => {
    void loadBranches()
  }, [loadBranches, expectedRevision])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setCreating(false)
        setNewName('')
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setCreating(false)
        setNewName('')
      }
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const switchTo = async (branchId: string) => {
    if (busy || branchId === activeBranchId) {
      setOpen(false)
      return
    }
    setBusy(true)
    try {
      const response = await fetch(
        `/api/studio/projects/${projectId}/branches/${branchId}/switch`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedRevision }),
        },
      )
      const body = (await response.json()) as { project?: unknown; error?: string }
      if (!response.ok || !body.project) {
        if (response.status === 409 && onRevisionConflict) {
          await onRevisionConflict()
        }
        onError(body.error ?? 'Failed to switch branch')
        return
      }
      onProjectChanged(body.project)
      setActiveBranchId(branchId)
      setOpen(false)
      setCreating(false)
      await loadBranches()
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to switch branch')
    } finally {
      setBusy(false)
    }
  }

  const createBranch = async () => {
    const name = newName.trim()
    if (!name || busy) return
    setBusy(true)
    try {
      const response = await fetch(`/api/studio/projects/${projectId}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRevision,
          name,
          switchAfter: true,
        }),
      })
      const body = (await response.json()) as {
        project?: unknown
        branchId?: string
        error?: string
      }
      if (!response.ok) {
        if (response.status === 409 && onRevisionConflict) {
          await onRevisionConflict()
        }
        onError(body.error ?? 'Failed to create branch')
        return
      }
      if (body.project) onProjectChanged(body.project)
      setNewName('')
      setCreating(false)
      setOpen(false)
      await loadBranches()
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to create branch')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`studio-link-menu is-compact${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className={`studio-link-menu-trigger${open ? ' is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={listId}
        aria-label="Switch named branch"
        disabled={disabled || busy}
        title="Named style branches inside this project (not Ad versions)"
        onClick={() => {
          setOpen((current) => !current)
          if (!open) void loadBranches()
        }}
      >
        <span className="studio-link-menu-trigger-copy">
          <strong>{triggerLabel}</strong>
        </span>
        <span className="studio-link-menu-chevron" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <ul id={listId} className="studio-link-menu-list" role="menu" aria-label="Named branches">
          <li className="studio-link-menu-hint" role="presentation">
            Style tips in this project — not Ad versions.
          </li>
          {branches.map((branch) => {
            const isActive = branch.id === activeBranchId || branch.isActive
            const mark = (branch.name.trim().charAt(0) || '?').toUpperCase()
            return (
              <li key={branch.id} role="presentation">
                <button
                  type="button"
                  role="menuitem"
                  className={`studio-link-menu-option${isActive ? ' is-active' : ''}`}
                  aria-current={isActive ? 'true' : undefined}
                  disabled={busy}
                  onClick={() => void switchTo(branch.id)}
                >
                  <span className="studio-link-menu-option-mark" aria-hidden>
                    {mark}
                  </span>
                  <span className="studio-link-menu-option-copy">
                    <strong>{branch.name}</strong>
                    <span>
                      rev {branch.revision}
                      {branch.isMain ? ' · main' : ''}
                    </span>
                  </span>
                  <span className="studio-link-menu-option-go" aria-hidden>
                    {isActive ? '●' : '→'}
                  </span>
                </button>
              </li>
            )
          })}
          <li className="studio-branch-create" role="presentation">
            {creating ? (
              <form
                className="studio-branch-create-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void createBranch()
                }}
              >
                <input
                  type="text"
                  value={newName}
                  maxLength={40}
                  placeholder="Funny / Luxury / …"
                  aria-label="New branch name"
                  autoFocus
                  disabled={busy}
                  onChange={(event) => setNewName(event.target.value)}
                />
                <button type="submit" disabled={busy || !newName.trim()}>
                  Create
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="studio-link-menu-option studio-branch-create-trigger"
                role="menuitem"
                disabled={busy}
                onClick={() => setCreating(true)}
              >
                <span className="studio-link-menu-option-mark" aria-hidden>
                  +
                </span>
                <span className="studio-link-menu-option-copy">
                  <strong>New branch</strong>
                  <span>Fork active tip</span>
                </span>
              </button>
            )}
          </li>
        </ul>
      ) : null}
    </div>
  )
}
