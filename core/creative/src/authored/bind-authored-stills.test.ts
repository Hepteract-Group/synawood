import { describe, expect, it } from 'vitest'
import {
  authoredImgSrc,
  bindInventedStillProps,
  inventedStillPropNames,
  toAuthoredPlate,
} from './bind-authored-stills'

const SOURCE = `
type Props = { bgHook: string; uiCard: string; logo: string | null }
const Root = (props: Props) => (
  <>
    <Img src={props.bgHook} />
    <Img src={props.uiCard} />
    {props.logo ? <Img src={props.logo} /> : null}
  </>
)
export default Root
`

describe('bindInventedStillProps (#1328)', () => {
  it('names invented props.bgHook keys the host does not pass', () => {
    expect(inventedStillPropNames(SOURCE).sort()).toEqual(['bgHook', 'logo', 'uiCard'])
    expect(inventedStillPropNames('export default (props) => props.logoUrl')).toEqual([])
  })

  it('maps invented keys onto logo / product / plates so Img is not undefined', () => {
    const extra = bindInventedStillProps(SOURCE, {
      logo: 'https://blobs.example/logo.png',
      hero: 'https://blobs.example/product.png',
      plates: [
        'https://blobs.example/a.jpg',
        'https://blobs.example/b.jpg',
        'https://blobs.example/c.jpg',
      ],
    })
    expect(extra.logo).toBe('https://blobs.example/logo.png')
    expect(extra.uiCard).toBe('https://blobs.example/product.png')
    expect(extra.bgHook).toBe('https://blobs.example/a.jpg')
  })

  it('authoredImgSrc rejects empty and javascript URLs', () => {
    expect(authoredImgSrc(undefined)).toBeNull()
    expect(authoredImgSrc('')).toBeNull()
    expect(authoredImgSrc('javascript:alert(1)')).toBeNull()
    expect(authoredImgSrc('https://blobs.example/a.jpg')).toBe('https://blobs.example/a.jpg')
  })

  it('reads plates[i].src and string plates the same way', () => {
    const plate = toAuthoredPlate('https://blobs.example/a.jpg')
    expect(plate.src).toBe('https://blobs.example/a.jpg')
    expect(String(plate)).toBe('https://blobs.example/a.jpg')
    expect(authoredImgSrc(plate)).toBe('https://blobs.example/a.jpg')
    expect(authoredImgSrc({ src: 'https://blobs.example/a.jpg' })).toBe(
      'https://blobs.example/a.jpg',
    )
  })
})
