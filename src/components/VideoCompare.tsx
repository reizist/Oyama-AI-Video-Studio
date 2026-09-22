import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { AlertCircle, Check, Columns3, FolderOpen, LoaderCircle, Pause, Play, RotateCcw, Volume2, VolumeX, X } from 'lucide-react'
import './video-compare.css'

export type CompareVideo = { id: string; name: string; url: string }

type CompareCount = 1 | 2 | 3

const letters = ['A', 'B', 'C'] as const
const colors = ['#64caff', '#c995ff', '#ffbd79'] as const

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00'
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

export function VideoCompare({ onClose }: { onClose(): void }) {
  const [count, setCount] = useState<CompareCount>(2)
  const [slots, setSlots] = useState<Array<CompareVideo | null>>([null, null, null])
  const [twoSplit, setTwoSplit] = useState(50)
  const [threeSplits, setThreeSplits] = useState<[number, number]>([33.33, 66.67])
  const [durationBySlot, setDurationBySlot] = useState([0, 0, 0])
  const [errors, setErrors] = useState(['', '', ''])
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loop, setLoop] = useState(true)
  const [audioSlot, setAudioSlot] = useState(0)
  const [busySlot, setBusySlot] = useState<number | null>(null)
  const [notice, setNotice] = useState('')
  const stageRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const videosRef = useRef<Array<HTMLVideoElement | null>>([])
  const lastTimePaint = useRef(0)

  const active = slots.slice(0, count)
  const loaded = active.map((source, index) => source ? durationBySlot[index] : 0).filter((value) => value > 0)
  const duration = active.every((source, index) => !source || durationBySlot[index] > 0) && loaded.length ? Math.min(...loaded) : 0
  const readyCount = active.filter(Boolean).length
  const boundaries = count === 1 ? [] : count === 2 ? [twoSplit] : threeSplits
  const canPlay = readyCount === count && duration > 0 && !errors.slice(0, count).some(Boolean)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    const siblings = [...(backdropRef.current?.parentElement?.children ?? [])].filter((item) => item !== backdropRef.current)
    const previouslyInert = siblings.map((item) => item.hasAttribute('inert'))
    siblings.forEach((item) => item.setAttribute('inert', ''))
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const panel = stageRef.current?.closest('[role="dialog"]')
      const focusable = [...(panel?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? [])].filter((item) => item.getClientRects().length > 0)
      if (!focusable.length) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown); siblings.forEach((item, index) => { if (!previouslyInert[index]) item.removeAttribute('inert') }); previousFocus?.focus() }
  }, [onClose])

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      const lead = videosRef.current.find((video, index) => index < count && slots[index] && video)
      if (!lead) return
      for (let index = 0; index < count; index += 1) {
        const video = videosRef.current[index]
        if (video && video !== lead && Math.abs(video.currentTime - lead.currentTime) > 0.12) video.currentTime = lead.currentTime
      }
    }, 250)
    return () => window.clearInterval(timer)
  }, [count, playing, slots])

  const pause = () => { videosRef.current.forEach((video) => video?.pause()); setPlaying(false) }
  const seek = (next: number) => {
    const clamped = Math.max(0, Math.min(duration || 0, next))
    videosRef.current.forEach((video) => { if (video && Number.isFinite(video.duration)) video.currentTime = clamped })
    setTime(clamped)
  }
  const play = async () => {
    if (!canPlay) return
    if (duration && time >= duration - 0.05) seek(0)
    const results = await Promise.allSettled(videosRef.current.slice(0, count).filter(Boolean).map((video) => video!.play()))
    if (results.some((result) => result.status === 'rejected')) { pause(); setNotice('Playback could not start. Check the selected files and try again.'); return }
    setNotice('')
    setPlaying(true)
  }
  const replace = (index: number, video: CompareVideo | null) => {
    pause()
    videosRef.current.forEach((item) => { if (item) item.currentTime = 0 })
    setTime(0)
    setSlots((current) => current.map((item, slot) => slot === index ? video : item))
    setDurationBySlot((current) => current.map((value, slot) => slot === index ? 0 : value))
    setErrors((current) => current.map((value, slot) => slot === index ? '' : value))
    setNotice('')
  }
  const browse = async (index: number) => {
    setBusySlot(index)
    try {
      const file = await window.minimax.chooseMedia('video')
      if (!file) return
      const url = await window.minimax.mediaUrl(file.path)
      replace(index, { id: `local:${file.path}`, name: file.name, url })
    } catch (error) { setNotice(`Could not open the selected video: ${error instanceof Error ? error.message : String(error)}`) }
    finally { setBusySlot(null) }
  }
  const browseMany = async () => {
    setBusySlot(0)
    try {
      const files = await window.minimax.chooseVideos()
      if (!files.length) return
      if (files.length > 3) { setNotice('Choose no more than three videos in the file picker.'); return }
      const sources = await Promise.all(files.map(async (file) => ({ id: `local:${file.path}`, name: file.name, url: await window.minimax.mediaUrl(file.path) })))
      pause()
      setSlots([sources[0] ?? null, sources[1] ?? null, sources[2] ?? null])
      setCount(sources.length as CompareCount)
      setAudioSlot(0)
      setDurationBySlot([0, 0, 0])
      setErrors(['', '', ''])
      setTime(0)
      setNotice('')
    } catch (error) { setNotice(`Could not open the selected videos: ${error instanceof Error ? error.message : String(error)}`) }
    finally { setBusySlot(null) }
  }
  const setCountSafely = (next: CompareCount) => { pause(); setCount(next); setTime(0); videosRef.current.forEach((video) => { if (video) video.currentTime = 0 }) }
  const setBoundary = (index: number, value: number) => {
    if (count === 2) setTwoSplit(Math.max(8, Math.min(92, value)))
    else setThreeSplits(([first, second]) => index === 0 ? [Math.max(8, Math.min(second - 8, value)), second] : [first, Math.max(first + 8, Math.min(92, value))])
  }
  const dragBoundary = (event: PointerEvent<HTMLDivElement>, index: number) => {
    const stage = stageRef.current
    if (!stage) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const value = ((event.clientX - stage.getBoundingClientRect().left) / stage.getBoundingClientRect().width) * 100
    setBoundary(index, value)
  }

  return <div className="video-compare-backdrop" ref={backdropRef}><section className="video-compare" role="dialog" aria-modal="true" aria-labelledby="video-compare-title">
    <header className="video-compare-header"><div className="video-compare-brand"><span><Columns3 size={20} /></span><div><small>OYAMA STUDIO / REVIEW</small><h1 id="video-compare-title">Video Compare</h1></div></div><div className="video-compare-header-actions"><span>1–3 videos · synchronized review</span><button ref={closeRef} type="button" className="video-compare-close" onClick={onClose} aria-label="Close Video Compare"><X size={20} /></button></div></header>
    <div className="video-compare-content"><div className="video-compare-heading"><div><span className="video-compare-eyebrow">FRAME BY FRAME, SIDE BY SIDE</span><h2>See the difference.</h2><p>Select one, two, or three videos from your computer. Drag the reveal bars to compare the same moment across every version.</p></div><div className="video-compare-setup"><button type="button" className="video-compare-open" onClick={() => void browseMany()} disabled={busySlot !== null}><FolderOpen size={17} />Open videos…</button><div className="video-compare-count" role="group" aria-label="Number of videos">{([1, 2, 3] as const).map((value) => <button key={value} type="button" aria-pressed={count === value} onClick={() => setCountSafely(value)}>{value}<span>{value === 1 ? 'Solo' : value === 2 ? 'Split' : 'Triple'}</span></button>)}</div></div></div>
      <div className="video-compare-stage" ref={stageRef} aria-label={`${count} video comparison viewport`}>
        <div className="video-compare-stage-grid" aria-hidden="true" />
        {active.map((source, index) => {
          const left = index === 0 ? 0 : boundaries[index - 1]
          const right = index === count - 1 ? 100 : boundaries[index]
          const style = { clipPath: `inset(0 ${100 - right}% 0 ${left}%)` } as CSSProperties
          return <div className="video-compare-layer" style={style} key={index}>
            {source ? <video key={source.id} ref={(node) => { videosRef.current[index] = node }} src={source.url} preload="auto" playsInline muted={audioSlot !== index} onLoadedMetadata={(event) => setDurationBySlot((current) => current.map((value, slot) => slot === index ? event.currentTarget.duration : value))} onTimeUpdate={(event) => { if (index !== active.findIndex(Boolean)) return; const now = performance.now(); if (now - lastTimePaint.current > 180) { lastTimePaint.current = now; setTime(event.currentTarget.currentTime) } }} onWaiting={() => { if (playing) { pause(); setNotice(`${letters[index]} is buffering. Press Play when it is ready.`) } }} onStalled={() => { if (playing) { pause(); setNotice(`${letters[index]} stopped loading. Check the source, then press Play or replace it.`) } }} onEnded={() => { if (!playing) return; if (loop) { seek(0); void play() } else pause() }} onError={(event) => { pause(); const mediaError = event.currentTarget.error; const reason = mediaError?.code === 3 ? 'This codec could not be decoded.' : mediaError?.code === 4 ? 'This format is unsupported.' : 'The local file could not be loaded.'; setErrors((current) => current.map((value, slot) => slot === index ? reason : value)) }} /> : <div className="video-compare-empty-layer" style={{ left: `${(left + right) / 2}%`, width: `${right - left}%`, transform: 'translateX(-50%)' }}><Columns3 size={34} /><strong>Video {letters[index]}</strong><span>Open a file below</span></div>}
          </div>
        })}
        {boundaries.map((value, index) => <div key={index} className="video-compare-reveal" style={{ left: `${value}%` }} role="slider" tabIndex={0} aria-label={`Reveal bar ${index + 1}`} aria-orientation="horizontal" aria-valuemin={8} aria-valuemax={92} aria-valuenow={Math.round(value)} aria-valuetext={`${Math.round(value)} percent across`} onPointerDown={(event) => dragBoundary(event, index)} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) dragBoundary(event, index) }} onKeyDown={(event) => { const delta = event.shiftKey ? 5 : 1; if (event.key === 'ArrowLeft') { event.preventDefault(); setBoundary(index, value - delta) } else if (event.key === 'ArrowRight') { event.preventDefault(); setBoundary(index, value + delta) } else if (event.key === 'Home') { event.preventDefault(); setBoundary(index, 8) } else if (event.key === 'End') { event.preventDefault(); setBoundary(index, 92) } }}><span><Columns3 size={17} /></span></div>)}
        <div className="video-compare-stage-labels" aria-hidden="true">{active.map((source, index) => <span key={index} style={{ left: `${index === 0 ? 0 : boundaries[index - 1]}%`, width: `${(index === count - 1 ? 100 : boundaries[index]) - (index === 0 ? 0 : boundaries[index - 1])}%` }}><b style={{ color: colors[index] }}>{letters[index]}</b>{source?.name ?? 'No video selected'}</span>)}</div>
      </div>
      <div className="video-compare-transport"><button type="button" className="video-compare-play" onClick={() => playing ? pause() : void play()} disabled={!canPlay} aria-label={playing ? 'Pause synchronized playback' : 'Play synchronized playback'}>{playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}</button><button type="button" className="video-compare-restart" onClick={() => seek(0)} disabled={!duration} aria-label="Return to start"><RotateCcw size={17} /></button><span className="video-compare-time">{formatTime(time)} <i>/</i> {formatTime(duration)}</span><input type="range" min={0} max={duration || 1} step={0.01} value={Math.min(time, duration || 1)} onChange={(event) => seek(Number(event.target.value))} disabled={!duration} aria-label="Comparison timeline" style={{ '--compare-progress': `${duration ? time / duration * 100 : 0}%` } as CSSProperties} /><label className="video-compare-loop"><input type="checkbox" checked={loop} onChange={(event) => setLoop(event.target.checked)} />Loop</label></div>
      <div className="video-compare-lanes" data-count={count}>{active.map((source, index) => <article key={index} className="video-compare-lane" style={{ '--lane-color': colors[index] } as CSSProperties}><div className="video-compare-lane-head"><span>{letters[index]}</span><div><strong>{source?.name ?? `Choose video ${letters[index]}`}</strong><small>{source ? durationBySlot[index] ? `${formatTime(durationBySlot[index])} · Ready to compare` : 'Loading video…' : 'Open a video from your computer'}</small></div>{source && <button type="button" className="video-compare-audio" aria-label={audioSlot === index ? `Mute video ${letters[index]}` : `Listen to video ${letters[index]}`} aria-pressed={audioSlot === index} onClick={() => setAudioSlot(audioSlot === index ? -1 : index)}>{audioSlot === index ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>}</div><div className="video-compare-lane-actions"><button type="button" onClick={() => void browse(index)} disabled={busySlot !== null}>{busySlot === index ? <LoaderCircle size={15} className="spin" /> : <FolderOpen size={15} />}{busySlot === index ? 'Opening…' : source ? 'Replace video…' : 'Choose video…'}</button></div>{errors[index] && <div className="video-compare-error" role="alert"><AlertCircle size={15} /><span>{errors[index]} Choose another file or retry.</span><button type="button" onClick={() => { setErrors((current) => current.map((value, slot) => slot === index ? '' : value)); videosRef.current[index]?.load() }}>Retry</button></div>}</article>)}</div>
      <footer className="video-compare-footer"><span role="status" aria-live="polite">{notice || (canPlay ? <><Check size={14} />All {count} videos ready · drag the bars or use arrow keys</> : readyCount < count ? `Choose ${count - readyCount} more video${count - readyCount === 1 ? '' : 's'} to compare.` : 'Preparing selected videos…')}</span><span>Audio plays from one video at a time.</span></footer>
    </div>
  </section></div>
}
