/** Recipe shapes for product library items (ADR-0059). Client-safe. */

import { z } from 'zod'
import { isTreatmentId } from '../effects/treatments'

export const gradeRecipeSchema = z
  .object({
    contrast: z.number().min(0.5).max(2),
    saturate: z.number().min(0).max(3),
    hueRotate: z.number().min(-180).max(180),
    sepia: z.number().min(0).max(1),
    vignette: z.number().min(0).max(1),
  })
  .strict()

export type GradeRecipe = z.infer<typeof gradeRecipeSchema>

export const treatmentStepSchema = z
  .object({
    id: z.string().min(1).max(80),
    intensity: z.number().min(0).max(1),
  })
  .strict()

export const effectRecipeSchema = z
  .object({
    steps: z.array(treatmentStepSchema).min(1).max(8),
  })
  .strict()

export type EffectRecipe = z.infer<typeof effectRecipeSchema>

export const parseGradeRecipe = (input: unknown): GradeRecipe => gradeRecipeSchema.parse(input)

export const parseEffectRecipe = (input: unknown): EffectRecipe => {
  const recipe = effectRecipeSchema.parse(input)
  for (const step of recipe.steps) {
    if (!isTreatmentId(step.id)) {
      throw new Error(
        `Unknown treatment "${step.id}". Only shake, glow, flash, and zoom_punch are allowed.`,
      )
    }
  }
  return recipe
}
