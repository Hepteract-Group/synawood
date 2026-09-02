/** #594 — CI lock for visual retrieve + analyze persist without live Gateway. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ASSET_VISUAL_EMBEDDING_DIMS, mockVisualEmbedding } from '../model-profiles/embed-visual'
import { analyzeSchemaId, fixtureAnalyzeResult, validateAnalyzeResult } from './analyze-schema'
import { RRF_VISUAL_WEIGHT, reciprocalRankFusion } from './fuse-moment-ranks'
import {
  isVisualEmbedCapSkip,
  isVisualEmbedFailed,
  VISUAL_EMBED_CAP_SKIP_MESSAGE,
} from './visual-embed-status'

const analyzeSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0040_asset_analyses.sql'),
  'utf8',
)
const embeddingsSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0020_asset_intelligence.sql'),
  'utf8',
)

describe('intelligence layer CI locks (#594)', () => {
  it('pins visual and text embeddings to the same 1536-d column', () => {
    expect(embeddingsSql).toMatch(/embedding extensions\.vector\(1536\)/)
    expect(ASSET_VISUAL_EMBEDDING_DIMS).toBe(1536)
    expect(mockVisualEmbedding('ci-lock')).toHaveLength(1536)
  })

  it('keeps asset_analyses kinds + replace unique key in the migration', () => {
    expect(analyzeSql).toMatch(/kind in \('segment', 'compliance', 'highlight', 'custom'\)/)
    expect(analyzeSql).toMatch(/unique \(asset_id, kind, schema_id\)/)
    expect(analyzeSql).toMatch(
      /grant select, insert, update, delete on public\.asset_analyses to service_role/,
    )
  })

  it('allows analyze as an index stage (#588)', () => {
    const stageSql = readFileSync(
      path.join(process.cwd(), '../../supabase/migrations/0041_analyze_index_stage.sql'),
      'utf8',
    )
    expect(stageSql).toMatch(/'analyze'/)
  })

  it('keeps visual RRF weight above caption so appearance beats a distractor', () => {
    expect(RRF_VISUAL_WEIGHT).toBe(2)
    const scores = reciprocalRankFusion([
      { weight: RRF_VISUAL_WEIGHT, hits: [{ shotId: 'look' }] },
      { weight: 1, hits: [{ shotId: 'caption' }] },
    ])
    expect(scores.get('look')!).toBeGreaterThan(scores.get('caption')!)
  })

  it('does not treat expected no-picture skips as visual embed failure (#635)', () => {
    expect(
      isVisualEmbedFailed(
        'caption skipped: no keyframe image yet (video/audio wait for shot thumbs); visual embed skipped: no keyframe thumb',
      ),
    ).toBe(false)
    expect(isVisualEmbedFailed('visual embed skipped: no keyframe thumb')).toBe(false)
    expect(isVisualEmbedFailed('visual embed failed: gateway 500')).toBe(true)
    expect(
      isVisualEmbedFailed(
        "caption failed: The image data you provided does not represent a valid image. Please check your input and try again with one of the supported image formats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].; visual embed failed: Provided image is not valid.",
      ),
    ).toBe(false)
  })

  it('analyze fixture satisfies required schema keys without a VLM call', () => {
    const schema = {
      type: 'object',
      properties: { summary: { type: 'string' } },
      required: ['summary'],
    }
    const result = fixtureAnalyzeResult(schema)
    expect(validateAnalyzeResult(result, schema).summary).toEqual(expect.any(String))
    expect(analyzeSchemaId(schema)).toHaveLength(40)
  })
})
