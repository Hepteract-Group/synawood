'use client'

import { useCallback, useEffect, useState } from 'react'
import type { GenerationPlanStatus } from '@synawood/creative/generation-plan/schema'
import { artefactsPlanLine, sanitiseSkillMarkdown } from '../../lib/artefacts-bin'
import { readApiJson } from '../../lib/read-api-json'
import { PackMarkdownPreview } from '../settings/PackMarkdownPreview'
import { IconX } from '../icons'

type SkillRow = {
  id: string
  name: string
  description: string
  markdown?: string
}

type ArtefactsBinProps = {
  productId: string
  planStatus?: GenerationPlanStatus | null
  onOpenPlan?: () => void
}

export const ArtefactsBin = ({ productId, planStatus = null, onOpenPlan }: ArtefactsBinProps) => {
  const [skills, setSkills] = useState<SkillRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSkill, setSelectedSkill] = useState<SkillRow | null>(null)
  const planLine = artefactsPlanLine(planStatus)

  const load = useCallback(async () => {
    const response = await fetch(`/api/studio/skills?productId=${encodeURIComponent(productId)}`)
    const body = await readApiJson<{ skills?: SkillRow[]; error?: string }>(response)
    if (!response.ok) {
      throw new Error(body.error ?? "Couldn't load skills.")
    }
    setSkills(body.skills ?? [])
  }, [productId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void load()
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load skills.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [load])

  useEffect(() => {
    if (!selectedSkill) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedSkill(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedSkill])

  return (
    <div className="artefacts-bin">
      <section className="artefacts-bin-section" aria-labelledby="artefacts-plan-heading">
        <h3 id="artefacts-plan-heading" className="artefacts-bin-heading">
          Generation plan
        </h3>
        <button type="button" className="artefacts-plan-row" onClick={() => onOpenPlan?.()}>
          <span className="artefacts-plan-line">{planLine}</span>
          <span className="muted">Open</span>
        </button>
      </section>

      <section className="artefacts-bin-section" aria-labelledby="artefacts-skills-heading">
        <h3 id="artefacts-skills-heading" className="artefacts-bin-heading">
          Skills
        </h3>
        <p className="muted artefacts-skills-hint">
          Read-only. Change which skills load from Settings → Packs.
        </p>
        {loading ? (
          <p className="muted" role="status">
            Loading skills…
          </p>
        ) : null}
        {error ? (
          <p className="extract-bin-error" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error && skills.length === 0 ? (
          <p className="muted">No first-party skills on disk.</p>
        ) : null}
        {skills.length > 0 ? (
          <ul className="artefacts-skill-list">
            {skills.map((skill) => (
              <li key={skill.id}>
                <button
                  type="button"
                  className="artefacts-skill"
                  onClick={() => setSelectedSkill(skill)}
                >
                  <span className="artefacts-skill-name">{skill.name}</span>
                  {skill.description ? (
                    <span className="muted artefacts-skill-desc">{skill.description}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {selectedSkill ? (
        <div className="dialog-root artefacts-skill-root" role="presentation">
          <button
            type="button"
            className="dialog-backdrop"
            aria-label="Close skill"
            onClick={() => setSelectedSkill(null)}
          />
          <div
            className="dialog-panel artefacts-skill-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="artefacts-skill-title"
          >
            <div className="artefacts-skill-sheet-head">
              <h2 id="artefacts-skill-title" className="dialog-title">
                {selectedSkill.name}
              </h2>
              <button
                type="button"
                className="icon-btn"
                aria-label="Close skill"
                onClick={() => setSelectedSkill(null)}
              >
                <IconX />
              </button>
            </div>
            <p className="muted artefacts-skill-sheet-note">Read-only markdown. Not a script.</p>
            <div className="artefacts-skill-sheet-body">
              <PackMarkdownPreview markdown={sanitiseSkillMarkdown(selectedSkill.markdown ?? '')} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
