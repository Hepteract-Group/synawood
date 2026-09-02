import { describe, expect, it } from 'vitest'
import { createEmptyProject } from './schema'
import { appendWhyLog, formatWhyLogTimecode, WHY_LOG_CAP } from './why-log'

describe('appendWhyLog', () => {
  it('starts empty on a new project and keeps rows after parse', () => {
    const project = createEmptyProject({
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      productId: 'demo',
    })
    expect(project.whyLog).toEqual([])
    const next = appendWhyLog(project, {
      t: 8,
      target: 'clip_1',
      action: 'duck',
      reason: 'Ducked music under speech.',
    })
    expect(next.whyLog).toHaveLength(1)
    expect(next.whyLog[0]).toMatchObject({
      t: 8,
      target: 'clip_1',
      action: 'duck',
      reason: 'Ducked music under speech.',
    })
    expect(next.revision).toBe(project.revision)
  })

  it('keeps only the last 100 rows', () => {
    let project = createEmptyProject({
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      productId: 'demo',
    })
    for (let index = 0; index < WHY_LOG_CAP + 3; index += 1) {
      project = appendWhyLog(project, {
        t: index,
        target: 'cut',
        action: 'cut',
        reason: `Edit ${index}`,
      })
    }
    expect(project.whyLog).toHaveLength(WHY_LOG_CAP)
    expect(project.whyLog[0]?.reason).toBe('Edit 3')
    expect(project.whyLog.at(-1)?.reason).toBe(`Edit ${WHY_LOG_CAP + 2}`)
  })
})

describe('formatWhyLogTimecode', () => {
  it('formats seconds as m:ss', () => {
    expect(formatWhyLogTimecode(0)).toBe('0:00')
    expect(formatWhyLogTimecode(8)).toBe('0:08')
    expect(formatWhyLogTimecode(65)).toBe('1:05')
  })
})
