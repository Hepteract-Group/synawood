import type { GenerationPlanStatus } from '@synawood/creative/generation-plan/schema'
import { isPackExecutablePath } from '@synawood/creative/packs/executable-path'

export const ARTEFACTS_NO_PLAN = 'No plan yet'

const ARTEFACTS_SCRIPT_EXT = /\.(js|mjs|cjs|ts|py|wasm)$/i

export const artefactsPlanLine = (status: GenerationPlanStatus | null | undefined): string => {
  if (!status) return ARTEFACTS_NO_PLAN
  if (status === 'draft') return 'Plan: draft'
  if (status === 'ready') return 'Plan: ready'
  if (status === 'applied') return 'Plan: applied'
  if (status === 'stale') return 'Plan: stale'
  return `Plan: ${status}`
}

/** Pack denylist plus Artefacts script types (ADR-0086). No upload UI — this is the gate. */
export const artefactsUploadForbidden = (entryPath: string): boolean => {
  const normalized = entryPath.replace(/\\/g, '/')
  if (isPackExecutablePath(normalized)) return true
  if (normalized === 'node_modules' || normalized.startsWith('node_modules/')) return true
  if (normalized.split('/').includes('scripts')) return true
  const base = normalized.split('/').pop() ?? ''
  return ARTEFACTS_SCRIPT_EXT.test(base)
}

/** Strip tags and javascript: so preview never executes HTML. */
export const sanitiseSkillMarkdown = (markdown: string): string =>
  markdown.replace(/<[^>]*>/g, '').replace(/javascript:/gi, '')
