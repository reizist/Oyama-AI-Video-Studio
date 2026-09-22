import { useEffect, useRef, useState } from 'react'
import { Film, Music2 } from 'lucide-react'

const posters = new Map<string, string>()

export function MovieMediaThumbnail({ source, posterUrl, audio = false }: { source: string; posterUrl?: string; audio?: boolean }) {
  const host = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [posterFailed, setPosterFailed] = useState(false)
  const [poster, setPoster] = useState(() => posters.get(source))
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setVisible(false)
    setPosterFailed(false)
    setFailed(false)
    setPoster(posters.get(source))
  }, [source, posterUrl])
  useEffect(() => {
    const element = host.current
    if (!element || audio || poster || (posterUrl && !posterFailed)) return
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect() } }, { rootMargin: '80px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [audio, poster, posterUrl, posterFailed])
  const capture = (video: HTMLVideoElement) => {
    if (!video.videoWidth || !video.videoHeight || video.seeking) return
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 240
      canvas.height = Math.max(1, Math.round(240 * video.videoHeight / video.videoWidth))
      const context = canvas.getContext('2d')
      if (!context) return
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const next = canvas.toDataURL('image/jpeg', .7)
      if (posters.size >= 120) posters.delete(posters.keys().next().value!)
      posters.set(source, next); setPoster(next)
    } catch { /* Cross-origin sources retain their decoded video thumbnail. */ }
  }
  return <span className="movie-media-thumbnail" ref={host} aria-hidden="true">
    {audio ? <Music2 size={22} /> : posterUrl && !posterFailed ? <img src={posterUrl} alt="" onError={() => setPosterFailed(true)} /> : poster ? <img src={poster} alt="" onError={() => { posters.delete(source); setPoster(undefined) }} /> : visible && !failed ? <video src={source} muted playsInline preload="auto" onError={() => setFailed(true)} onLoadedMetadata={event => {
      const video = event.currentTarget
      const target = Number.isFinite(video.duration) ? Math.min(1, video.duration / 3) : .2
      if (target > .02) video.currentTime = target
    }} onLoadedData={event => capture(event.currentTarget)} onSeeked={event => capture(event.currentTarget)} /> : <Film size={22} />}
  </span>
}
