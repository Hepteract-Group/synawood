/** Product slug helpers for onboarding create-Product (#103). */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Lowercase, hyphenated slug from a display name. Empty if nothing usable. */
export const slugifyProductName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)

export const isValidProductSlug = (slug: string): boolean =>
  slug.length >= 2 && slug.length <= 64 && SLUG_RE.test(slug)
