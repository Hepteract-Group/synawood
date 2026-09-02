import { describe, expect, it } from 'vitest'
import { AUTHORED_PLAYER_PATH, authoredPlayerSrcDoc } from './iframe-protocol'

describe('authored iframe protocol', () => {
  it('rewrites the player script to the app origin for srcDoc', () => {
    expect(AUTHORED_PLAYER_PATH).toBe('/authored-player.html')
    const srcDoc = authoredPlayerSrcDoc(
      '<script src="/authored-player.js"></script>',
      'http://localhost:3000',
    )
    expect(srcDoc).toContain('src="http://localhost:3000/authored-player.js"')
    expect(srcDoc).not.toContain('src="/authored-player.js"')
  })

  it('keeps a content-hash query from the built html (#1259)', () => {
    const srcDoc = authoredPlayerSrcDoc(
      '<script src="/authored-player.js?h=abc123"></script>',
      'http://localhost:3000',
    )
    expect(srcDoc).toContain('src="http://localhost:3000/authored-player.js?h=abc123"')
    expect(srcDoc).not.toContain('src="/authored-player.js')
  })
})
