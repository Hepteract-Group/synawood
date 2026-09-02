import { describe, expect, it } from 'vitest'
import {
  authoredHeadlineText,
  authoredJsxTextNodes,
  authoredOnScreenText,
  countUpValues,
} from './on-screen-text'

describe('countUpValues (#1269)', () => {
  it('reads value={n} and to={n}, including props on following lines', () => {
    expect(countUpValues('<CountUp value={40} label="hours" />')).toEqual([40])
    expect(countUpValues('<CountUp to={10000} from={0} durationInFrames={60} />')).toEqual([10000])
    expect(
      countUpValues(`<CountUp
            to={10000}
            from={0}
            durationInFrames={60}
            fontSize={120}
          />`),
    ).toEqual([10000])
  })
})

describe('authored headline and jsx text (#1243)', () => {
  it('reads BrandText and KineticType as headlines, CountUp labels as on-screen', () => {
    const source = `<KineticType text={'40 hours back'} />
      <BrandText text="Cloud storage" />
      <CountUp value={40} label="hours" />`
    expect(authoredHeadlineText(source)).toEqual(['Cloud storage', '40 hours back'])
    expect(authoredOnScreenText(source)).toEqual(['Cloud storage', '40 hours back', 'hours'])
  })

  it('reads literal JSX text nodes of 3+ characters', () => {
    expect(authoredJsxTextNodes('<div>Still juggling PDFs?</div>')).toEqual([
      'Still juggling PDFs?',
    ])
    expect(authoredJsxTextNodes('<div>{frame}</div>')).toEqual([])
  })
})
