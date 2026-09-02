import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseExtractedBrief, type ExtractedBrief } from '../extracted-brief'

const fixturesDir = dirname(fileURLToPath(import.meta.url))

export type BriefFixtureName = 'acme-url-brief' | 'acme-pdf-brief'

/** Load a checked-in ExtractedBrief fixture and parse it through Zod. */
export const loadBriefFixture = (name: BriefFixtureName): ExtractedBrief => {
  const raw = JSON.parse(readFileSync(join(fixturesDir, `${name}.json`), 'utf8')) as unknown
  return parseExtractedBrief(raw)
}
