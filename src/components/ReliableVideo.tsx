import { useEffect, useState, type ComponentProps } from 'react'

type Props = Omit<ComponentProps<'video'>, 'ref'> & {
  videoRef?: (node: HTMLVideoElement | null) => void
  recoveryHint?: string
}

export function ReliableVideo({ src, videoRef, recoveryHint = 'Check that the file still exists, or try an MP4 with H.264 video and AAC audio.', onError, onWaiting, onStalled, onCanPlay, onPlaying, ...props }: Props) {
  const [failure, setFailure] = useState('')
  const [buffering, setBuffering] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => { setFailure(''); setBuffering(false); setAttempt(0) }, [src])

  return <>
    <video {...props} key={`${src}:${attempt}`} src={src} ref={videoRef} onError={event => {
      const code = event.currentTarget.error?.code
      setFailure(code === 2 ? 'The video file could not be read.' : code === 3 ? 'The video codec could not be decoded.' : code === 4 ? 'This video format is not supported.' : 'This video could not be played.')
      setBuffering(false)
      onError?.(event)
    }} onWaiting={event => { setBuffering(true); onWaiting?.(event) }} onStalled={event => { setBuffering(true); onStalled?.(event) }} onCanPlay={event => { setBuffering(false); setFailure(''); onCanPlay?.(event) }} onPlaying={event => { setBuffering(false); onPlaying?.(event) }} />
    {failure ? <p className="media-playback-feedback error" role="alert">{failure} {recoveryHint} <button type="button" onClick={() => { setFailure(''); setBuffering(false); setAttempt(value => value + 1) }}>Retry playback</button></p> : buffering ? <p className="media-playback-feedback" role="status" aria-live="polite">Buffering video…</p> : null}
  </>
}
