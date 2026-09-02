/** Locale Studio Tools (ADR-0043 / #328–#332 / #510). */

import { tool } from 'ai'
import { z } from 'zod'
import {
  createBranchFromActiveTip,
  isBranchExistsError,
  slugifyBranchName,
  switchActiveBranch,
} from '../project'
import {
  captureLocaleCopy,
  applyMoneyToCta,
  emptyLocalization,
  formatProjectMoney,
  localeCodeSchema,
  missingTranslationChips,
  moneySliceSchema,
  stubTranslator,
  switchProjectLocale,
  translateLocaleCopy,
  writeLocaleCopy,
} from '../locale'
import { parseStudioProject } from '../project/schema'
import {
  applyProjectMutation,
  runSerializedOnContext,
  syncToolContextProject,
  wrapTool,
} from './store'
import type { StudioToolContext } from './types'
import { toolFail, toolOk } from './types'

export const createLocaleTools = (ctx: StudioToolContext) => ({
  set_active_locale: tool({
    description:
      'Switch the project active locale. Snapshots current overlay/slide/intent strings, then applies stored copy for the target locale (falls back to the default locale).',
    inputSchema: z.object({
      locale: localeCodeSchema,
    }),
    execute: async (input) =>
      wrapTool(ctx, 'set_active_locale', input, async () => {
        const { project } = await applyProjectMutation(ctx, (current) =>
          switchProjectLocale(current, input.locale),
        )
        return toolOk(`Active locale is ${project.localization.activeLocale}`, {
          localization: project.localization,
          revision: project.revision,
          missing: missingTranslationChips(project),
        })
      }),
  }),

  translate_all_missing: tool({
    description:
      'Fill empty strings in copy[locale] from the default locale. Default applyToPreview=true also switches the active locale and applies that copy to the timeline. Pass applyToPreview:false to store translations without leaving the current preview. v1 prefixes [locale] (no Gateway adapter yet). Live profiles still require confirmSpend so a later paid translator cannot spend silently.',
    inputSchema: z.object({
      locale: localeCodeSchema,
      confirmSpend: z.boolean().optional(),
      applyToPreview: z.boolean().optional(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'translate_all_missing', input, async () => {
        const stub = ctx.modelProfileId === 'ci-stub'
        if (!stub && !input.confirmSpend && !ctx.confirmSpend) {
          return toolFail('confirmSpend is required to translate missing copy on a live profile.')
        }
        const loc = ctx.project.localization ?? emptyLocalization()
        const from = loc.defaultLocale
        const source = loc.copy[from] ?? captureLocaleCopy(ctx.project)
        const target = loc.copy[input.locale] ?? { overlays: {}, slides: {} }
        const translated = await translateLocaleCopy({
          source,
          target,
          from,
          to: input.locale,
          translate: stubTranslator,
        })
        const applyToPreview = input.applyToPreview !== false
        const { project } = await applyProjectMutation(ctx, (current) =>
          writeLocaleCopy(current, {
            locale: input.locale,
            source,
            translated,
            applyToPreview,
          }),
        )
        return toolOk(`Filled missing ${input.locale} copy from ${from}`, {
          localization: project.localization,
          revision: project.revision,
          missing: missingTranslationChips(project),
          applyToPreview,
        })
      }),
  }),

  dub_project_for_locale: tool({
    description:
      'Fork a named branch locale-<code>, switch the project onto that branch (main is no longer active), and fill missing copy. Does not lipsync (Voice Studio). Requires persist.',
    inputSchema: z.object({
      locale: localeCodeSchema,
      confirmSpend: z.boolean().optional(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'dub_project_for_locale', input, async () => {
        if (!ctx.persist) {
          return toolFail('dub_project_for_locale requires a persisted project')
        }
        const stub = ctx.modelProfileId === 'ci-stub'
        if (!stub && !input.confirmSpend && !ctx.confirmSpend) {
          return toolFail('confirmSpend is required to dub a live-profile project.')
        }
        const name = `locale-${input.locale}`
        const switched = await runSerializedOnContext(ctx, async () => {
          try {
            await createBranchFromActiveTip(ctx.supabase, {
              projectId: ctx.projectId,
              name,
            })
          } catch (error) {
            if (!isBranchExistsError(error)) throw error
          }
          const next = await switchActiveBranch(ctx.supabase, {
            projectId: ctx.projectId,
            slug: slugifyBranchName(name),
          })
          syncToolContextProject(ctx, next.project)
          return next
        })
        const loc = ctx.project.localization ?? emptyLocalization()
        const from = loc.defaultLocale
        const source = loc.copy[from] ?? captureLocaleCopy(ctx.project)
        const translated = await translateLocaleCopy({
          source,
          target: loc.copy[input.locale] ?? { overlays: {}, slides: {} },
          from,
          to: input.locale,
          translate: stubTranslator,
        })
        const { project } = await applyProjectMutation(ctx, (current) =>
          writeLocaleCopy(current, {
            locale: input.locale,
            source,
            translated,
            applyToPreview: true,
          }),
        )
        return toolOk(`Dubbed onto branch ${name}`, {
          branchId: switched.branch.id,
          locale: input.locale,
          revision: project.revision,
        })
      }),
  }),

  apply_locale_money: tool({
    description:
      'Set ISO currency + amount (minor units) on the project and append a formatted price to the Intent CTA. Replaces a previous trailing · price; does not strip currency figures inside the CTA copy.',
    inputSchema: moneySliceSchema.extend({
      applyToCta: z.boolean().optional(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'apply_locale_money', input, async () => {
        const { project } = await applyProjectMutation(ctx, (current) => {
          const localization = {
            ...(current.localization ?? emptyLocalization()),
            money: { currency: input.currency, amountMinor: input.amountMinor },
          }
          const formatted = formatProjectMoney(localization.money, localization.activeLocale)
          const intent =
            input.applyToCta === false
              ? current.intent
              : { ...current.intent, cta: applyMoneyToCta(current.intent.cta, formatted) }
          return parseStudioProject({
            ...current,
            localization,
            intent,
            revision: current.revision + 1,
          })
        })
        return toolOk('Updated locale money', {
          money: project.localization.money,
          cta: project.intent.cta,
          revision: project.revision,
        })
      }),
  }),
})
