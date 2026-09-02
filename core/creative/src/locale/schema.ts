/** Localization DTOs (ADR-0043 / #325). */

import { z } from 'zod'

/** BCP-47 language or language-region (en, en-GB, pt-BR, ar). */
export const localeCodeSchema = z
  .string()
  .trim()
  .regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/, 'locale must look like en, en-GB, pt-BR, or zh-Hant')
export type LocaleCode = z.infer<typeof localeCodeSchema>

export const localizedValueSchema = <T extends z.ZodType>(value: T) =>
  z
    .object({
      default: value,
      byLocale: z.record(z.string(), value).optional(),
    })
    .strict()

export type Localized<T> = {
  default: T
  byLocale?: Record<string, T>
}

export const localeCopySchema = z
  .object({
    overlays: z.record(z.string(), z.string()).default({}),
    slides: z
      .record(
        z.string(),
        z
          .object({
            headline: z.string().optional(),
            body: z.string().optional(),
          })
          .strict(),
      )
      .default({}),
    intent: z
      .object({
        cta: z.string().optional(),
        goalNote: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export type LocaleCopy = z.infer<typeof localeCopySchema>

export const moneySliceSchema = z
  .object({
    currency: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, 'ISO 4217 currency')
      .default('GBP'),
    amountMinor: z.number().int().nonnegative().optional(),
  })
  .strict()

export type MoneySlice = z.infer<typeof moneySliceSchema>

export const localizationSliceSchema = z
  .object({
    defaultLocale: localeCodeSchema.default('en'),
    activeLocale: localeCodeSchema.default('en'),
    locales: z.array(localeCodeSchema).min(1).max(40).default(['en']),
    copy: z.record(z.string(), localeCopySchema).default({}),
    money: moneySliceSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.locales.includes(value.defaultLocale)) {
      ctx.addIssue({
        code: 'custom',
        message: 'defaultLocale must be listed in locales',
        path: ['defaultLocale'],
      })
    }
    if (!value.locales.includes(value.activeLocale)) {
      ctx.addIssue({
        code: 'custom',
        message: 'activeLocale must be listed in locales',
        path: ['activeLocale'],
      })
    }
  })

export type LocalizationSlice = z.infer<typeof localizationSliceSchema>

export const emptyLocalization = (): LocalizationSlice =>
  localizationSliceSchema.parse({
    defaultLocale: 'en',
    activeLocale: 'en',
    locales: ['en'],
    copy: {},
  })

export const parseLocalization = (input: unknown): LocalizationSlice =>
  localizationSliceSchema.parse(input)
