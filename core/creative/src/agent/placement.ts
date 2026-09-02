import type { ProjectClip } from '../project/schema'

export type PlacementIntent =
  | { kind: 'append'; from: number }
  | { kind: 'explicit'; from: number }
  | { kind: 'replace'; from: number }
  | { kind: 'default'; from: number }

const EXPLICIT_SECONDS =
  /(?:at|insert(?: at)?|place(?: at)?)\s+(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)\b/i
const EXPLICIT_FRAMES = /(?:at\s+frame\s+(\d+)\b|(?:^|[\s,])(?:at\s+)?(\d+)\s*(?:f|fr|frames)\b)/i

const APPEND_WORDS =
  /(at the end|to the end|at end|append|extend|after (?:the )?(?:current|last|existing)|continue|add (?:this|it|the clip)? ?(on)? ?to the end|follow)/i
const REPLACE_WORDS = /(replace|swap|substitute)/i

const clipEnd = (clips: ProjectClip[]): number =>
  clips.reduce((end, clip) => Math.max(end, clip.from + clip.durationInFrames), 0)

/**
 * Resolve *where* a clip should land from a natural-language edit instruction.
 * Complements resolveAssetReferences (which fixes *which* asset). Used by the
 * mock reasoner and described in the system prompt for the real model.
 */
export const resolvePlacementIntent = (
  userMessage: string,
  project: { clips: ProjectClip[]; durationFrames: number; fps: number },
): PlacementIntent => {
  const text = userMessage.trim()

  // Prefer seconds over bare "at N" — frame unit is optional in EXPLICIT_FRAMES and
  // would otherwise steal "at 5 seconds".
  const secondsMatch = text.match(EXPLICIT_SECONDS)
  if (secondsMatch) {
    return {
      kind: 'explicit',
      from: Math.max(0, Math.round(parseFloat(secondsMatch[1]) * project.fps)),
    }
  }

  const framesMatch = text.match(EXPLICIT_FRAMES)
  if (framesMatch) {
    const frame = parseInt(framesMatch[1] ?? framesMatch[2], 10)
    if (Number.isFinite(frame)) {
      return { kind: 'explicit', from: Math.max(0, frame) }
    }
  }

  if (REPLACE_WORDS.test(text)) {
    // Replace the first clip: reuse its position.
    const first = project.clips[0]
    return { kind: 'replace', from: first ? first.from : 0 }
  }

  if (APPEND_WORDS.test(text)) {
    return { kind: 'append', from: clipEnd(project.clips) }
  }

  // No placement phrase: on a non-empty timeline, defaulting to 0 would overlap
  // existing footage, so land new clips after the last one.
  return { kind: 'default', from: clipEnd(project.clips) }
}

/** True when the message asks to place/add/insert a clip. */
export const isPlacementRequest = (userMessage: string): boolean => {
  const text = userMessage.toLowerCase()
  // Captions are a different tool — don't treat "add captions" as clip placement.
  if (/\badd captions?\b/.test(text)) return false
  // "Add @asset:…" / "@still-image at 5s" / "… to the footage"
  if (
    (/@asset:/.test(text) || /@[a-z0-9][\w-]{1,}/.test(text)) &&
    (/\b(add|place|insert|put|recall)\b/.test(text) ||
      /\bat\s+\d/.test(text) ||
      /footage|timeline|\bvideo\b|\bcut\b/.test(text))
  ) {
    return true
  }
  return /(add clip|add (?:this|it)|place|insert|recall|use @asset|put (?:the )?clip|extend|append|replace|swap)/i.test(
    userMessage,
  )
}
