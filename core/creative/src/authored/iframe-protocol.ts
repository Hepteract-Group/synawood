/** Iframe sandbox flags: scripts on, unique origin (no parent cookies). */
export const AUTHORED_IFRAME_SANDBOX = 'allow-scripts' as const

/** Parent Transport play() is postMessage — Chrome needs this to unmute iframe audio. */
export const AUTHORED_IFRAME_ALLOW = 'autoplay' as const

export const AUTHORED_PLAYER_PATH = '/authored-player.html'

/** Unique-origin iframes throw on Web Storage. No-op when localStorage already works. */
export const UNIQUE_ORIGIN_STORAGE_POLYFILL =
  '(function(){try{window.localStorage.getItem("__mos_probe")}catch(e){var make=function(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}};try{Object.defineProperty(window,"localStorage",{value:make(),configurable:true});Object.defineProperty(window,"sessionStorage",{value:make(),configurable:true})}catch(x){}}})();'

/** srcDoc so scripts run; path-absolute script URLs would resolve against about:srcdoc. */
export const authoredPlayerSrcDoc = (html: string, origin: string): string =>
  html.replace(
    /src="\/authored-player\.js(\?[^"]*)?"/g,
    (_match, query: string | undefined) => `src="${origin}/authored-player.js${query ?? ''}"`,
  )

export const SYNAWOOD_AUTHORED_MESSAGE = {
  init: 'mos-authored:init',
  play: 'mos-authored:play',
  pause: 'mos-authored:pause',
  toggle: 'mos-authored:toggle',
  seek: 'mos-authored:seek',
  ready: 'mos-authored:ready',
  frame: 'mos-authored:frame',
  playing: 'mos-authored:playing',
  error: 'mos-authored:error',
} as const

export type MosAuthoredToFrame =
  | {
      type: typeof SYNAWOOD_AUTHORED_MESSAGE.init
      code: string
      inputProps: Record<string, unknown>
      fps: number
      width: number
      height: number
      durationInFrames: number
      coveredLastFrame?: number
    }
  | { type: typeof SYNAWOOD_AUTHORED_MESSAGE.play }
  | { type: typeof SYNAWOOD_AUTHORED_MESSAGE.pause }
  | { type: typeof SYNAWOOD_AUTHORED_MESSAGE.toggle }
  | { type: typeof SYNAWOOD_AUTHORED_MESSAGE.seek; frame: number }

export type MosAuthoredFromFrame =
  | { type: typeof SYNAWOOD_AUTHORED_MESSAGE.ready }
  | { type: typeof SYNAWOOD_AUTHORED_MESSAGE.frame; frame: number }
  | { type: typeof SYNAWOOD_AUTHORED_MESSAGE.playing; playing: boolean }
  | { type: typeof SYNAWOOD_AUTHORED_MESSAGE.error; message: string }

export const isMosAuthoredFromFrame = (value: unknown): value is MosAuthoredFromFrame => {
  if (!value || typeof value !== 'object') return false
  const type = (value as { type?: unknown }).type
  return (
    type === SYNAWOOD_AUTHORED_MESSAGE.ready ||
    type === SYNAWOOD_AUTHORED_MESSAGE.frame ||
    type === SYNAWOOD_AUTHORED_MESSAGE.playing ||
    type === SYNAWOOD_AUTHORED_MESSAGE.error
  )
}
