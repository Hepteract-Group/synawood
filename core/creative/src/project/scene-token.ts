/**
 * Pure `@scene:` token helpers — browser-safe, no Node imports.
 */

export type SceneRefLike = {
  id: string
  role: string
  label: string
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

const roleTitle = (role: string): string =>
  role ? role.charAt(0).toUpperCase() + role.slice(1).replaceAll('_', ' ') : 'Scene'

/** Display label for autocomplete / UI. */
export const sceneLabel = (scene: SceneRefLike): string => {
  const title = scene.label.trim()
  const role = roleTitle(scene.role)
  if (!title || title.toLowerCase() === scene.role.toLowerCase()) return role
  return `${role} — ${title}`
}

export const sceneTokenFor = (scene: SceneRefLike): string => {
  const slug = slugify(scene.label) || slugify(scene.role) || 'scene'
  return `@scene:${slug}-${scene.id.slice(0, 8)}`
}

/** Resolve `@scene:…` by full token body, id suffix, or raw uuid. */
export const findSceneForToken = (
  raw: string,
  scenes: readonly SceneRefLike[],
): SceneRefLike | undefined => {
  const needle = raw.toLowerCase().replace(/^scene:/, '')
  const exact = scenes.find(
    (scene) => sceneTokenFor(scene).slice('@scene:'.length).toLowerCase() === needle,
  )
  if (exact) return exact

  const byId = scenes.find(
    (scene) =>
      scene.id.toLowerCase() === needle ||
      scene.id.toLowerCase().startsWith(needle) ||
      scene.id.toLowerCase().slice(0, 8) === needle.replace(/^.*-/, ''),
  )
  if (byId) return byId

  const suffix = needle.match(/-([a-f0-9]{8})$/i)?.[1]?.toLowerCase()
  if (suffix) {
    return scenes.find((scene) => scene.id.toLowerCase().startsWith(suffix))
  }
  return undefined
}
