/** HTTP parse for B-roll assemble / commit / reject (#523). */

import { z } from 'zod'

export const brollAssembleBodySchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    sceneIds: z.array(z.string().min(1)).min(1).optional(),
    dryRun: z.boolean().optional(),
  })
  .strict()

export const brollCommitBodySchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    planId: z.string().uuid(),
    confirmSpend: z.boolean().optional(),
  })
  .strict()

export const brollRejectBodySchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    planId: z.string().uuid(),
  })
  .strict()

export const parseBrollAssembleBody = (input: unknown) => brollAssembleBodySchema.parse(input)

export const parseBrollCommitBody = (input: unknown) => brollCommitBodySchema.parse(input)

export const parseBrollRejectBody = (input: unknown) => brollRejectBodySchema.parse(input)
