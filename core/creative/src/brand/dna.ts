/** Brand DNA DTOs (ADR-0044 / #104). */

import { z } from 'zod'

export const brandDnaBusinessSchema = z
  .object({
    legalName: z.string().max(120).default(''),
    category: z.string().max(80).default(''),
    url: z.string().max(300).default(''),
    locale: z.string().max(16).default('en'),
  })
  .strict()

export const brandDnaSchema = z
  .object({
    productId: z.string().min(1),
    tagline: z.string().max(200).default(''),
    values: z.array(z.string().max(80)).max(12).default([]),
    icp: z.string().max(2000).default(''),
    offer: z.string().max(2000).default(''),
    proofPoints: z.array(z.string().max(240)).max(12).default([]),
    business: brandDnaBusinessSchema.default({
      legalName: '',
      category: '',
      url: '',
      locale: 'en',
    }),
    lockedFields: z.array(z.string().min(1).max(40)).max(24).default([]),
  })
  .strict()

export type BrandDna = z.infer<typeof brandDnaSchema>
export type BrandDnaBusiness = z.infer<typeof brandDnaBusinessSchema>

export const emptyBrandDna = (productId: string): BrandDna => brandDnaSchema.parse({ productId })

export const parseBrandDna = (input: unknown, productId: string): BrandDna => {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return brandDnaSchema.parse({ ...(input as Record<string, unknown>), productId })
  }
  return emptyBrandDna(productId)
}

/** Token-only project brand from Settings DNA — no disk kit. */
export const brandSliceFromDna = (
  dna: BrandDna,
): {
  productId: string
  displayName: string
  defaultCta: string
} => {
  const legal = dna.business.legalName.trim()
  const tagline = dna.tagline.trim()
  const offer = dna.offer.trim()
  return {
    productId: dna.productId,
    displayName: (legal || tagline || dna.productId).slice(0, 80),
    defaultCta: (offer || tagline || 'Learn more').slice(0, 80),
  }
}

export const DNA_FIELD_KEYS = [
  'tagline',
  'values',
  'icp',
  'offer',
  'proofPoints',
  'business.legalName',
  'business.category',
  'business.url',
  'business.locale',
] as const

export type DnaFieldKey = (typeof DNA_FIELD_KEYS)[number]

export const DNA_FIELD_LABELS: Record<DnaFieldKey, string> = {
  tagline: 'Tagline',
  values: 'Values',
  icp: 'Who it is for (ideal customer)',
  offer: 'Offer',
  proofPoints: 'Proof we can stand behind',
  'business.legalName': 'Legal name',
  'business.category': 'Category',
  'business.url': 'Website',
  'business.locale': 'Language and region',
}

export const DNA_FIELD_HINTS: Record<DnaFieldKey, string> = {
  tagline: 'The one line ads remember.',
  values: 'What this product stands for. One value per line.',
  icp: 'Ideal customer means the people this product is built for.',
  offer: 'What someone gets, in plain language.',
  proofPoints: 'Claims we can stand behind. One per line.',
  'business.legalName': 'The name on invoices and legal pages.',
  'business.category': 'The market this product sits in, such as PDF editor.',
  'business.url': 'The public website. Used when fetching copy from a page.',
  'business.locale': 'Language and region code, such as en or en-GB.',
}

export const isDnaFieldKey = (key: string): key is DnaFieldKey =>
  (DNA_FIELD_KEYS as readonly string[]).includes(key)

export const dnaFieldPreview = (dna: BrandDna, key: DnaFieldKey): string => {
  switch (key) {
    case 'tagline':
      return dna.tagline
    case 'values':
      return dna.values.join(', ')
    case 'icp':
      return dna.icp
    case 'offer':
      return dna.offer
    case 'proofPoints':
      return dna.proofPoints.join(', ')
    case 'business.legalName':
      return dna.business.legalName
    case 'business.category':
      return dna.business.category
    case 'business.url':
      return dna.business.url
    case 'business.locale':
      return dna.business.locale
  }
}
