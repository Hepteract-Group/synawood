import { describe, expect, it } from 'vitest'
import {
  extractCostForPlanGbp,
  extractUrlsForPlanConfirm,
  parseExtraExtractUrlLines,
  shouldEnqueueExtractOnPlanConfirm,
} from './extract-on-confirm'

describe('extractCostForPlanGbp (#1100)', () => {
  it('is zero when Re-extract is off and no extra URLs', () => {
    expect(
      extractCostForPlanGbp({
        reExtractThisTurn: false,
        extraExtractUrls: [],
        existingSourceUrls: ['https://example.com/old'],
      }),
    ).toBe(0)
  })

  it('rises with extra URLs, and with stored URLs when Re-extract is on', () => {
    const none = extractCostForPlanGbp({ reExtractThisTurn: false, extraExtractUrls: [] })
    const withUrls = extractCostForPlanGbp({
      reExtractThisTurn: false,
      extraExtractUrls: ['https://example.com/a', 'https://example.com/b'],
    })
    const reExtract = extractCostForPlanGbp({
      reExtractThisTurn: true,
      extraExtractUrls: [],
      existingSourceUrls: ['https://example.com/home'],
    })
    const reExtractMany = extractCostForPlanGbp({
      reExtractThisTurn: true,
      extraExtractUrls: ['https://example.com/pricing'],
      existingSourceUrls: ['https://example.com/home', 'https://example.com/pricing'],
    })
    expect(withUrls).toBeGreaterThan(none)
    expect(reExtract).toBeGreaterThan(none)
    expect(withUrls).toBe(0.04)
    expect(reExtract).toBe(0.02)
    expect(reExtractMany).toBe(0.04)
  })

  it('floors Re-extract with no known URLs at one page', () => {
    expect(extractCostForPlanGbp({ reExtractThisTurn: true, extraExtractUrls: [] })).toBe(0.02)
  })
})

describe('extractUrlsForPlanConfirm (#1100)', () => {
  it('returns extra URLs only when Re-extract is off', () => {
    expect(
      extractUrlsForPlanConfirm({
        extraExtractUrls: [' https://example.com/a ', 'https://example.com/a'],
        reExtractThisTurn: false,
        existingSourceUrls: ['https://example.com/old'],
      }),
    ).toEqual(['https://example.com/a'])
  })

  it('unions extra URLs with existing source URLs when Re-extract is on', () => {
    expect(
      extractUrlsForPlanConfirm({
        extraExtractUrls: ['https://example.com/pricing'],
        reExtractThisTurn: true,
        existingSourceUrls: ['https://example.com/home', 'https://example.com/pricing'],
      }),
    ).toEqual(['https://example.com/pricing', 'https://example.com/home'])
  })

  it('is empty when Re-extract is on but nothing is listed or stored', () => {
    expect(
      extractUrlsForPlanConfirm({
        extraExtractUrls: [],
        reExtractThisTurn: true,
        existingSourceUrls: [],
      }),
    ).toEqual([])
  })
})

describe('parseExtraExtractUrlLines (#1100)', () => {
  it('splits lines and drops blanks', () => {
    expect(parseExtraExtractUrlLines('https://a.example\n\n  https://b.example  \n')).toEqual([
      'https://a.example',
      'https://b.example',
    ])
  })
})

describe('shouldEnqueueExtractOnPlanConfirm (#1099)', () => {
  it('does not recrawl when Extracts exist and the flag is off', () => {
    expect(
      shouldEnqueueExtractOnPlanConfirm({
        reExtractThisTurn: false,
        extraExtractUrls: [],
      }),
    ).toBe(false)
  })

  it('enqueues when Re-extract is on or extra URLs are listed', () => {
    expect(shouldEnqueueExtractOnPlanConfirm({ reExtractThisTurn: true })).toBe(true)
    expect(
      shouldEnqueueExtractOnPlanConfirm({
        reExtractThisTurn: false,
        extraExtractUrls: ['https://example.com/pricing'],
      }),
    ).toBe(true)
  })
})
