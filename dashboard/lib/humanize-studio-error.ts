import { STUDIO_UPLOAD_MAX_LABEL } from './studio-upload-limits'
import { humanizeCutReviewForFounder } from '@synawood/creative/critic/humanize-cut-review'

/** Model stamped confirmSpend on a tool that never took it, or a paid tool still asked. */
export const leftoverConfirmSpendCopy =
  /confirmSpend.*required|needs confirmSpend=true|parameter is required when estimate|unrecognized_keys.{0,80}confirmSpend|Unrecognized key:.{0,12}confirmSpend/i

/** Founder-facing error presentation for Studio banners. */
export const humanizeStudioError = (message: unknown): string => {
  const text = typeof message === 'string' ? message.trim() : String(message ?? '').trim()
  if (!text) return 'Something went wrong. Try again.'

  if (/Cannot read properties of undefined \(reading ['"]?trim['"]?\)/i.test(text)) {
    return 'That edit could not be applied. Refresh the project and try again.'
  }
  if (leftoverConfirmSpendCopy.test(text)) {
    return 'Paid models are already allowed. The agent does not need a confirmSpend argument.'
  }
  if (/Failed to parse body as FormData|could not be read as a file/i.test(text)) {
    return `That upload was cut off (file too large for the server). Use a file under ${STUDIO_UPLOAD_MAX_LABEL} and refresh Studio, then try again.`
  }
  if (/had nothing new to apply|made no change to the project|re-check inputs/i.test(text)) {
    return 'That change is already on the timeline — nothing new to apply.'
  }
  if (/revision conflict|updated elsewhere|expectedRevision/i.test(text)) {
    return 'This project changed elsewhere. Reloading the latest version…'
  }
  if (/unknown clip/i.test(text)) {
    return 'That clip is no longer on the timeline. Move the playhead onto a Video-track clip and try again.'
  }
  if (/unknown scene/i.test(text)) {
    return 'That scene was removed. Pick another scene card and try again.'
  }
  if (/move the playhead onto a timeline clip/i.test(text)) {
    return text
  }
  if (/AZURE_STORAGE_CONNECTION_STRING must include AccountName/i.test(text)) {
    return (
      'Azure Blob credentials look incomplete. Unset AZURE_STORAGE_CONNECTION_STRING in this ' +
      'terminal (a bare `;` truncates it), then restart `npm run dev:review` so dashboard/.env.local loads.'
    )
  }
  if (/AZURE_STORAGE_CONNECTION_STRING is required/i.test(text)) {
    return 'Azure Blob is not configured. Add AZURE_STORAGE_CONNECTION_STRING to dashboard/.env.local and restart the dev server.'
  }
  if (/^unauthorized$/i.test(text) || /authrequirederror/i.test(text)) {
    return 'Session missing or expired. Refresh the page and sign in again, then retry.'
  }
  if (/ElevenLabs Music API failed \(401\)/i.test(text)) {
    return 'ElevenLabs rejected the API key for Music. Check ELEVENLABS_API_KEY in dashboard/.env.local and that the key has Music access.'
  }
  if (/Executable doesn't exist|Playwright Chromium is not installed/i.test(text)) {
    return 'Extract stills need Playwright Chromium. In the repo root run: npx playwright install chromium — then ask the agent to extract the URL again.'
  }
  if (/duration specified in the request is not valid|not valid for model .*seedance/i.test(text)) {
    return (
      'That clip length is not allowed for this video model. Seedance 2.0 only accepts 4–15 seconds. ' +
      'Ask for a new clip at a valid length — retrying the same job would fail again.'
    )
  }
  if (
    /React\.createContext|use client|Server Component|Could not render player frames|inspect_preview|Do not say the video is done/i.test(
      text,
    )
  ) {
    return humanizeCutReviewForFounder(text)
  }

  return (
    text.replace(/^(?:Tool|Mutation|set_scene|assign_clip_to_scene)[:\s-]+/i, '').trim() || text
  )
}

export const isAlreadyInPlaceStudioError = (message: unknown): boolean => {
  const text = typeof message === 'string' ? message.trim() : String(message ?? '').trim()
  if (!text) return false
  return /had nothing new to apply|made no change|already on the timeline|already in place|already matches those inputs/i.test(
    text,
  )
}

export type StudioErrorTone = 'info' | 'warning' | 'danger'

export type StudioErrorAction = {
  href: string
  label: string
}

export type StudioErrorPresentation = {
  title: string
  body: string
  tone: StudioErrorTone
  action?: StudioErrorAction
}

export const BUY_CREDITS_HREF = '/settings/billing'

const isInsufficientCreditsCopy = (text: string): boolean => /Buy credits to run it/i.test(text)

/** Title + tone for the Studio error banner (body is always humanized). */
export const presentStudioError = (message: unknown): StudioErrorPresentation => {
  const raw = typeof message === 'string' ? message.trim() : String(message ?? '').trim()
  const body = humanizeStudioError(raw)

  if (isInsufficientCreditsCopy(raw + body)) {
    return {
      title: 'Not enough credits',
      body,
      tone: 'danger',
      action: { href: BUY_CREDITS_HREF, label: 'Buy credits' },
    }
  }

  if (
    /had nothing new to apply|made no change|already on the timeline|already in place/i.test(
      raw + body,
    )
  ) {
    return { title: 'Already in place', body, tone: 'info' }
  }
  if (/revision conflict|updated elsewhere|Reloading the latest/i.test(raw + body)) {
    return { title: 'Out of sync', body, tone: 'warning' }
  }
  if (/unknown clip|unknown scene|no longer on the timeline|was removed/i.test(raw + body)) {
    return { title: 'Selection changed', body, tone: 'warning' }
  }
  if (/reading ['"]?trim['"]?|could not be applied|Refresh the project/i.test(raw + body)) {
    return { title: "Couldn't apply", body, tone: 'danger' }
  }
  if (
    /Failed to apply|couldn't apply|Could not|confirmSpend|spend|FormData|cut off|too large/i.test(
      raw + body,
    )
  ) {
    return { title: "Couldn't apply", body, tone: 'danger' }
  }

  return { title: 'Something went wrong', body, tone: 'danger' }
}
