import { z } from 'zod'

export const pmColumnSchema = z.enum(['planned', 'in_progress', 'done'])

export const slotPrioritySchema = z.enum(['p0', 'p1', 'p2'])
