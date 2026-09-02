'use client'

import { Player, type PlayerRef } from '@remotion/player'
import * as MotionKit from '@synawood/creative/motion-kit'
import {
  authoredPlayStartFrame,
  SYNAWOOD_AUTHORED_MESSAGE,
  type MosAuthoredToFrame,
} from '@synawood/creative/authored/client'
import { loadAuthoredComponent } from '@synawood/creative/authored/load-component'
import {
  AuthoredPathCWrap,
  type AuthoredPathCWrapProps,
} from '@synawood/creative/authored/path-c-wrap'
import {
  hydrateAuthoredInputProps,
  parseAuthoredAudioClips,
} from '@synawood/creative/authored/input-props'
import { authoredImgSrc } from '@synawood/creative/authored/bind-authored-stills'
import { authoredInterpolate } from '@synawood/creative/authored/safe-interpolate'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import * as React from 'react'
import * as JsxRuntime from 'react/jsx-runtime'
import * as JsxDevRuntime from 'react/jsx-dev-runtime'
import * as Remotion from 'remotion'
import * as RemotionLottie from '@remotion/lottie'
import * as RemotionTransitions from '@remotion/transitions'
import * as RemotionTransitionsFade from '@remotion/transitions/fade'
import * as RemotionTransitionsSlide from '@remotion/transitions/slide'
import * as RemotionTransitionsWipe from '@remotion/transitions/wipe'
import * as RemotionShapes from '@remotion/shapes'
import * as RemotionThree from '@remotion/three'

type Loaded = {
  component: ComponentType<Record<string, unknown>>
  inputProps: Record<string, unknown>
  fps: number
  width: number
  height: number
  durationInFrames: number
}

/** Remotion Img throws if src is missing or the still 404s. Keep the Player alive. */
const SafeImg = (props: React.ComponentProps<typeof Remotion.Img>) => {
  const src = authoredImgSrc(props.src)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setFailed(false)
  }, [src])
  if (!src || failed) {
    return React.createElement('div', {
      'data-authored-img-fallback': '',
      style: {
        width: '100%',
        height: '100%',
        background: '#142232',
        ...(typeof props.style === 'object' && props.style ? props.style : {}),
      },
    })
  }
  return React.createElement(Remotion.Img, {
    ...props,
    src,
    onError: () => setFailed(true),
  })
}

const remotionForAuthored = new Proxy(Remotion, {
  get(target, prop, receiver) {
    if (prop === 'Img') return SafeImg
    if (prop === 'interpolate') return authoredInterpolate
    return Reflect.get(target, prop, receiver)
  },
})

const requireMap = {
  remotion: remotionForAuthored,
  react: React,
  'react/jsx-runtime': JsxRuntime,
  'react/jsx-dev-runtime': JsxDevRuntime,
  '@synawood/creative/motion-kit': MotionKit,
  '@remotion/lottie': RemotionLottie,
  '@remotion/transitions': RemotionTransitions,
  '@remotion/transitions/fade': RemotionTransitionsFade,
  '@remotion/transitions/slide': RemotionTransitionsSlide,
  '@remotion/transitions/wipe': RemotionTransitionsWipe,
  '@remotion/shapes': RemotionShapes,
  '@remotion/three': RemotionThree,
} as const

const loadFrameComponent = (code: string): ComponentType<Record<string, unknown>> =>
  loadAuthoredComponent(code, requireMap)

const playFromFrame = (player: PlayerRef, durationInFrames: number, coveredLastFrame?: number) => {
  const current = player.getCurrentFrame()
  const start = authoredPlayStartFrame(current, durationInFrames, coveredLastFrame)
  // Remotion no-ops play() from `ended` even after a prior seek postMessage.
  player.seekTo(start)
  requestAnimationFrame(() => {
    player.play()
  })
}

/**
 * Runs inside a sandboxed iframe (unique origin). Eval here is the sandbox —
 * not the dashboard origin and not the render worker.
 */
const applyControl = (
  player: PlayerRef,
  data: MosAuthoredToFrame,
  durationInFrames: number,
  coveredLastFrame?: number,
) => {
  if (data.type === SYNAWOOD_AUTHORED_MESSAGE.play) {
    playFromFrame(player, durationInFrames, coveredLastFrame)
  }
  if (data.type === SYNAWOOD_AUTHORED_MESSAGE.pause) player.pause()
  if (data.type === SYNAWOOD_AUTHORED_MESSAGE.toggle) {
    if (player.isPlaying()) {
      player.pause()
      return
    }
    playFromFrame(player, durationInFrames, coveredLastFrame)
  }
  if (data.type === SYNAWOOD_AUTHORED_MESSAGE.seek) player.seekTo(data.frame)
}

const AuthoredPlayerFrame = () => {
  const playerRef = useRef<PlayerRef>(null)
  const pendingControlsRef = useRef<MosAuthoredToFrame[]>([])
  const gotInitRef = useRef(false)
  const durationRef = useRef(1)
  const coveredLastRef = useRef<number | undefined>(undefined)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)

  const postToParent = useCallback(
    (message: { type: string; frame?: number; playing?: boolean; message?: string }) => {
      // Unique-origin iframe cannot read parent.origin; '*' is required.
      window.parent.postMessage(message, '*')
    },
    [],
  )

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return
      const data = event.data as MosAuthoredToFrame | undefined
      if (!data || typeof data !== 'object' || !('type' in data)) return

      if (data.type === SYNAWOOD_AUTHORED_MESSAGE.init) {
        gotInitRef.current = true
        try {
          const component = loadFrameComponent(data.code)
          setError(null)
          setLoaded({
            component,
            inputProps: data.inputProps,
            fps: data.fps,
            width: data.width,
            height: data.height,
            durationInFrames: data.durationInFrames,
          })
          durationRef.current = data.durationInFrames
          coveredLastRef.current = data.coveredLastFrame
        } catch (caught) {
          setLoaded(null)
          const message = caught instanceof Error ? caught.message : 'Failed to load composition'
          setError(message)
          postToParent({ type: SYNAWOOD_AUTHORED_MESSAGE.error, message })
        }
        return
      }

      const player = playerRef.current
      if (!player) {
        pendingControlsRef.current.push(data)
        return
      }
      applyControl(player, data, durationRef.current, coveredLastRef.current)
    }
    window.addEventListener('message', onMessage)
    gotInitRef.current = false
    postToParent({ type: SYNAWOOD_AUTHORED_MESSAGE.ready })
    const retry = window.setInterval(() => {
      if (gotInitRef.current) {
        window.clearInterval(retry)
        return
      }
      postToParent({ type: SYNAWOOD_AUTHORED_MESSAGE.ready })
    }, 120)
    return () => {
      window.clearInterval(retry)
      window.removeEventListener('message', onMessage)
    }
  }, [postToParent])

  useEffect(() => {
    if (!loaded) return
    let cancelled = false
    let cleanup: (() => void) | undefined
    const attach = () => {
      const player = playerRef.current
      if (!player) {
        if (!cancelled) requestAnimationFrame(attach)
        return
      }
      for (const command of pendingControlsRef.current) {
        applyControl(player, command, loaded.durationInFrames, coveredLastRef.current)
      }
      pendingControlsRef.current = []
      const onFrame = (event: { detail?: { frame?: number } }) => {
        const frame = event.detail?.frame
        if (typeof frame === 'number')
          postToParent({ type: SYNAWOOD_AUTHORED_MESSAGE.frame, frame })
      }
      const onPlay = () => postToParent({ type: SYNAWOOD_AUTHORED_MESSAGE.playing, playing: true })
      const onPause = () =>
        postToParent({ type: SYNAWOOD_AUTHORED_MESSAGE.playing, playing: false })
      player.addEventListener('frameupdate', onFrame)
      player.addEventListener('play', onPlay)
      player.addEventListener('pause', onPause)
      player.addEventListener('ended', onPause)
      cleanup = () => {
        player.removeEventListener('frameupdate', onFrame)
        player.removeEventListener('play', onPlay)
        player.removeEventListener('pause', onPause)
        player.removeEventListener('ended', onPause)
      }
    }
    attach()
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [loaded, postToParent])

  return (
    <div className="authored-player-frame">
      {error ? <p className="authored-player-error">{error}</p> : null}
      {loaded ? (
        <AuthoredHostPlayer
          loaded={loaded}
          playerRef={playerRef}
          onCompositionError={(message) =>
            postToParent({ type: SYNAWOOD_AUTHORED_MESSAGE.error, message })
          }
        />
      ) : null}
    </div>
  )
}

const AuthoredHostPlayer = ({
  loaded,
  playerRef,
  onCompositionError,
}: {
  loaded: Loaded
  playerRef: React.RefObject<PlayerRef | null>
  onCompositionError: (message: string) => void
}) => {
  const Host = useMemo(() => {
    const Inner = loaded.component
    const Wrapped = (props: Record<string, unknown>) =>
      React.createElement(
        AuthoredPathCWrap,
        hydrateAuthoredInputProps(props) as AuthoredPathCWrapProps,
        React.createElement(Inner, props),
      )
    return Wrapped
  }, [loaded.component])
  const iframeProps = hydrateAuthoredInputProps(loaded.inputProps)
  const audioCount = parseAuthoredAudioClips(loaded.inputProps).length
  const postedError = useRef(false)

  return (
    <Player
      ref={playerRef}
      component={Host}
      inputProps={iframeProps}
      durationInFrames={loaded.durationInFrames}
      compositionWidth={loaded.width}
      compositionHeight={loaded.height}
      fps={loaded.fps}
      style={{ width: '100%', height: '100%' }}
      controls={false}
      {...({
        pauseWhenLoading: false,
        pauseWhenBuffering: false,
      } as object)}
      errorFallback={({ error }) => {
        if (!postedError.current) {
          postedError.current = true
          onCompositionError(error.message)
        }
        return (
          <p className="authored-player-error" role="alert">
            {error.message}
          </p>
        )
      }}
      numberOfSharedAudioTags={Math.max(5, audioCount)}
      acknowledgeRemotionLicense
    />
  )
}

export default AuthoredPlayerFrame
