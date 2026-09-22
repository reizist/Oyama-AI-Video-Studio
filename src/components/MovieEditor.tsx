import { MoviePanelDivider } from './MoviePanelDivider'
import { MovieMediaThumbnail } from './MovieMediaThumbnail'
import { movieFrameTargets, movieSourceFrame, type MovieFrameTarget } from '../lib/movieHandoff'
import { adjacentEditFrame, preserveLockedClips, previewSourceFrame } from '../lib/movieTimeline'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent } from 'react'
import { ChevronLeft, ChevronRight, Copy, Eye, EyeOff, Flag, FolderOpen, Layers3, LoaderCircle, Lock, Magnet, Music2, Pause, Play, Plus, Redo2, Scissors, SkipBack, SkipForward, Trash2, Undo2, Volume2, VolumeX } from 'lucide-react'
import type { AppSettings, ClipItem, GenerationJob, MediaFile, MovieEditorClip, MovieEditorProject, MovieEditorTrack, MovieEditorTrackKind } from '../types'
import { createId } from '../lib/createId'

const STORAGE_KEY = 'minimax.movie-editor-projects'
const fps = 24
const defaultTracks: MovieEditorTrack[] = [
  { id: 'v1', name: 'Primary video', kind: 'video' },
  { id: 'v2', name: 'B-roll / inserts', kind: 'video' },
  { id: 'titles', name: 'Titles', kind: 'title' },
  { id: 'a1', name: 'Dialogue', kind: 'audio' },
  { id: 'a2', name: 'Music', kind: 'audio' },
]
const frameToTime = (frame: number, rate: number) => Math.max(0, frame) / rate
const timecode = (frame: number, rate: number) => {
  const seconds = Math.max(0, Math.floor(frame / rate)); const frames = Math.max(0, frame % rate)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}:${String(frames).padStart(2, '0')}`
}
const clipFrames = (clip: MovieEditorClip) => Math.max(1, (clip.sourceOutFrame ?? Math.round((clip.duration ?? 5) * fps)) - clip.sourceInFrame)
const makeProject = (n = 1): MovieEditorProject => { const now = Date.now(); return { id: createId(), name: n === 1 ? 'Untitled movie' : `Movie ${n}`, createdAt: now, updatedAt: now, frameRate: fps, media: [], tracks: defaultTracks.map((track) => ({ ...track })), clips: [] } }
function loadProjects(): MovieEditorProject[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Partial<MovieEditorProject>[]
    const projects = parsed.filter((project) => project?.id && project?.name).map((project) => ({ ...makeProject(), ...project, tracks: Array.isArray(project.tracks) && project.tracks.length ? project.tracks : defaultTracks.map((track) => ({ ...track })), media: Array.isArray(project.media) ? project.media : [], clips: Array.isArray(project.clips) ? project.clips : [] }))
    return projects.length ? projects : [makeProject()]
  } catch { return [makeProject()] }
}
function jobClip(job: GenerationJob): ClipItem | null {
  if (job.status !== 'completed' || !job.outputUrl || job.mediaType === 'image') return null
  const filename = job.localOutputPath?.split(/[\\/]/).at(-1)?.replace(/\.[^.]+$/, '')
  const readablePrompt = job.prompt
    .replace(/<[^>]*>/g, ' ')
    .replace(/\b(?:subject_definitions|integrated_multimodal|reference_images?)\b\s*[:=]?/gi, ' ')
    .replace(/[_{}[\]"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const name = filename || readablePrompt.split(/[.!?]/)[0]?.slice(0, 54) || `${job.modelName ?? 'Generated'} clip`
  return { id: `job-${job.id}`, name, source: job.outputUrl, duration: job.duration, createdAt: job.createdAt, mediaKind: job.mediaType === 'audio' ? 'audio' : 'video', thumbnailUrl: job.thumbnailUrl }
}

export function MovieEditor({ settings, jobs, onUseFrame, onOpenClipMaster, onNotice, onCreate, standalone = false }: {
  settings: AppSettings; jobs: GenerationJob[]; onCreate?(kind: 'video' | 'music'): void; onUseFrame(file: MediaFile, target: MovieFrameTarget, clip: ClipItem): void | Promise<void>; onOpenClipMaster?(clip: ClipItem): void; onNotice(tone: 'error' | 'success' | 'neutral', text: string): void; standalone?: boolean
}) {
  const [projects, setProjects] = useState<MovieEditorProject[]>(loadProjects)
  const [projectId, setProjectId] = useState(() => {
    try { const active = localStorage.getItem(`${STORAGE_KEY}.active`); return projects.find((item) => item.id === active)?.id ?? projects[0].id } catch { return projects[0].id }
  })
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [playhead, setPlayhead] = useState(0)
  const [zoom, setZoom] = useState(4)
  const [dragSource, setDragSource] = useState<ClipItem | MovieEditorClip | null>(null)
  const [busy, setBusy] = useState<'export' | 'frame' | null>(null)
  const [history, setHistory] = useState<MovieEditorProject[][]>([])
  const [future, setFuture] = useState<MovieEditorProject[][]>([])
  const [clipboard, setClipboard] = useState<MovieEditorClip[]>([])
  const editorRef = useRef<HTMLDivElement>(null)
  const projectDialogRef = useRef<HTMLDialogElement>(null)
  const [tool, setTool] = useState<'select' | 'razor'>('select')
  const [layout, setLayout] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('minimax.movie-layout') ?? '{}')
      return { media: Math.min(400, Math.max(180, Number(saved.media) || 240)), inspector: Math.min(400, Math.max(180, Number(saved.inspector) || 260)), timeline: Math.min(460, Math.max(160, Number(saved.timeline) || 260)), swapped: Boolean(saved.swapped), grid: Boolean(saved.grid) }
    } catch { return { media: 240, inspector: 260, timeline: 260, swapped: false, grid: false } }
  })
  useEffect(() => { try { localStorage.setItem('minimax.movie-layout', JSON.stringify(layout)) } catch { /* Layout preferences are optional. */ } }, [layout])
  const scrubRaf = useRef(0)
  const scrubFrame = useRef(0)
  useEffect(() => () => cancelAnimationFrame(scrubRaf.current), [])
  const videoRef = useRef<HTMLVideoElement>(null)
  const project = projects.find((item) => item.id === projectId) ?? projects[0]
  const selected = project.clips.find((clip) => selectedIds.includes(clip.id)) ?? null
  const program = useMemo(() => {
    const visibleVideoTracks = new Set(project.tracks.filter((track) => track.kind === 'video' && !track.hidden).map((track) => track.id))
    const selectedVideo = selected && selected.mediaKind !== 'audio' && visibleVideoTracks.has(selected.trackId) ? selected : null
    return project.clips.filter((clip) => visibleVideoTracks.has(clip.trackId) && clip.startFrame <= playhead && clip.startFrame + clipFrames(clip) > playhead).sort((a, b) => b.startFrame - a.startFrame)[0] ?? selectedVideo ?? project.clips.find((clip) => visibleVideoTracks.has(clip.trackId) && clip.mediaKind !== 'audio') ?? null
  }, [playhead, project.clips, project.tracks, selected])
  const totalFrames = Math.max(project.frameRate * 15, ...project.clips.map((clip) => clip.startFrame + clipFrames(clip) + project.frameRate * 2))
  const tickFrames = project.frameRate * Math.max(2, Math.ceil(90 / (zoom * project.frameRate)))
  const timelineWidth = Math.max(1, totalFrames * zoom)
  const [query, setQuery] = useState('')
  const [mediaKind, setMediaKind] = useState('all')
  const [snap, setSnap] = useState(true)
  const [insertMode, setInsertMode] = useState('append')
  const [frameTarget, setFrameTarget] = useState<MovieFrameTarget>('h3-reference-first')
  const [framePosition, setFramePosition] = useState<'current' | 'first' | 'last'>('current')
  const [programState, setProgramState] = useState<'loading' | 'ready' | 'playing' | 'buffering' | 'error'>('loading')
  const [programError, setProgramError] = useState('')
  const timelineRef = useRef<HTMLDivElement>(null)
  const completed = useMemo(() => jobs.map(jobClip).filter((clip): clip is ClipItem => Boolean(clip)), [jobs])
  const media = useMemo(() => Array.from(new Map([...project.media, ...completed].map((clip) => [clip.id, clip])).values()), [project.media, completed])
  const filteredMedia = useMemo(() => media.filter((clip) => (mediaKind === 'all' || (clip.mediaKind ?? 'video') === mediaKind) && clip.name.toLowerCase().includes(query.toLowerCase())), [media, query, mediaKind])
  const primaryClips = useMemo(() => project.clips.filter((clip) => clip.trackId === 'v1').sort((a, b) => a.startFrame - b.startFrame), [project.clips])
  const clipsByTrack = useMemo(() => {
    const result = new Map<string, MovieEditorClip[]>()
    for (const clip of project.clips) result.set(clip.trackId, [...(result.get(clip.trackId) ?? []), clip])
    return result
  }, [project.clips])

  const saveRef = useRef(() => {})
  saveRef.current = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)) } catch { onNotice('error', 'Movie could not be saved. Local storage is full or unavailable.') } }
  useEffect(() => {
    const timer = window.setTimeout(() => saveRef.current(), 400)
    return () => window.clearTimeout(timer)
  }, [projects])
  useEffect(() => {
    const save = () => saveRef.current()
    window.addEventListener('pagehide', save)
    return () => { window.removeEventListener('pagehide', save); save() }
  }, [])
  useEffect(() => { setSelectedIds([]); setPlayhead(0); try { localStorage.setItem(`${STORAGE_KEY}.active`, projectId) } catch { /* Project data saving reports storage failures. */ } }, [projectId])
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return
      setProjects(loadProjects()); setHistory([]); setFuture([]); setSelectedIds([])
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  useEffect(() => {
    const importClip = (event: Event) => {
      const clip = (event as CustomEvent<ClipItem>).detail
      if (!clip?.id || !clip.source) return
      const trackId = project.tracks.find((track) => track.kind === (clip.mediaKind === 'audio' ? 'audio' : 'video'))?.id ?? 'v1'
      const timelineClip: MovieEditorClip = { ...clip, id: createId(), assetId: clip.id, trackId, startFrame: playhead, sourceInFrame: 0, sourceOutFrame: clip.duration ? Math.round(clip.duration * project.frameRate) : undefined, transform: { x: 0, y: 0, scale: 100, rotation: 0, opacity: 100 }, audio: { volume: 100, fadeInFrames: 0, fadeOutFrames: 0, muted: false } }
      commit((value) => ({ ...value, media: [...value.media, clip], clips: [...value.clips, timelineClip] }))
      setSelectedIds([timelineClip.id])
      onNotice('success', `${clip.name} returned from Clip Master and was placed on the timeline.`)
    }
    window.addEventListener('oyama-movie-add-media', importClip)
    return () => window.removeEventListener('oyama-movie-add-media', importClip)
  })
  useEffect(() => {
    const video = videoRef.current
    if (!video || !program) return
    if (!video.paused) return
    const inFrame = previewSourceFrame(program.sourceInFrame, clipFrames(program), program.startFrame, playhead)
    const next = frameToTime(inFrame, project.frameRate)
    if (Math.abs(video.currentTime - next) > .5 / project.frameRate) video.currentTime = next
  }, [playhead, program, project.frameRate])
  useEffect(() => { setProgramError(''); setProgramState('loading') }, [program?.id, program?.source])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!editorRef.current?.getClientRects().length) return
      if ((event.target as HTMLElement)?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]') || document.querySelector('dialog[open], [role="dialog"]:not(dialog)')) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicate(); return }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') { event.preventDefault(); copySelection(); return }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') { event.preventDefault(); pasteSelection(); return }
      if (event.shiftKey && (event.key === 'Delete' || event.key === 'Backspace')) { event.preventDefault(); rippleDelete(); return }
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); remove(); return }
      if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'c') { event.preventDefault(); setTool('razor'); return }
      if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'v') { event.preventDefault(); setTool('select'); return }
      if (event.code === 'Space' && (event.target as HTMLElement)?.closest('button')) return
      if (event.key.toLowerCase() === 's') { event.preventDefault(); split(); return }
      if (event.key.toLowerCase() === 'm') { event.preventDefault(); addMarker(); return }
      if (event.code === 'Space') { event.preventDefault(); void togglePlayback(); return }
      if (event.key === 'ArrowLeft') { event.preventDefault(); stepPlayhead(-1) }
      if (event.key === 'ArrowRight') { event.preventDefault(); stepPlayhead(1) }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  })
  const commit = (change: (value: MovieEditorProject) => MovieEditorProject) => {
    setHistory((entries) => [...entries.slice(-39), projects]); setFuture([])
    setProjects((items) => items.map((item) => { if (item.id !== project.id) return item; const next = change(item); return { ...next, clips: preserveLockedClips(item, next), updatedAt: Date.now() } }))
  }
  const undo = () => { const previous = history.at(-1); if (!previous) return; setFuture((items) => [...items, projects]); setProjects(previous); setHistory((items) => items.slice(0, -1)) }
  const redo = () => { const next = future.at(-1); if (!next) return; setHistory((items) => [...items, projects]); setProjects(next); setFuture((items) => items.slice(0, -1)) }
  const addTrack = (kind: MovieEditorTrackKind) => commit((value) => ({ ...value, tracks: [...value.tracks, { id: createId(), name: kind === 'audio' ? 'Audio track' : 'Video track', kind }] }))
  const removeTrack = (track: MovieEditorTrack) => {
    if (defaultTracks.some((item) => item.id === track.id)) return
    const clipCount = project.clips.filter((clip) => clip.trackId === track.id).length
    if (clipCount && !window.confirm(`Delete ${track.name} and its ${clipCount} timeline ${clipCount === 1 ? 'clip' : 'clips'}?`)) return
    commit((value) => ({ ...value, tracks: value.tracks.filter((item) => item.id !== track.id), clips: value.clips.filter((clip) => clip.trackId !== track.id) }))
    setSelectedIds((ids) => ids.filter((id) => project.clips.find((clip) => clip.id === id)?.trackId !== track.id))
  }
  const removeMedia = (asset: ClipItem) => {
    if (!project.media.some((item) => item.id === asset.id)) return
    commit((value) => ({ ...value, media: value.media.filter((item) => item.id !== asset.id) }))
    onNotice('neutral', `${asset.name} was removed from the media pool. Existing timeline clips and the original file were kept.`)
  }
  const removeMarker = (markerId: string) => commit((value) => ({ ...value, markers: (value.markers ?? []).filter((marker) => marker.id !== markerId) }))
  const deleteMovie = () => {
    if (!window.confirm(`Delete the movie project “${project.name}”? Imported files and completed generations will be kept.`)) return
    const remaining = projects.filter((item) => item.id !== project.id)
    const fallback = remaining.length ? remaining : [makeProject()]
    setProjects(fallback)
    setProjectId(fallback[0].id)
    setHistory([]); setFuture([]); setSelectedIds([])
    onNotice('neutral', `${project.name} was deleted.`)
  }
  const addClip = (asset: ClipItem, trackId = project.tracks.find((track) => track.kind === (asset.mediaKind === 'audio' ? 'audio' : 'video'))?.id ?? 'v1', at?: number) => {
    if (project.tracks.find((track) => track.id === trackId)?.locked) { onNotice('neutral', 'Unlock the target track before adding media.'); return }
    const generation = asset.id.startsWith('job-') ? jobs.find((job) => `job-${job.id}` === asset.id) : undefined
    const clip: MovieEditorClip = { ...asset, id: createId(), assetId: asset.id, trackId, startFrame: Math.max(0, at ?? (insertMode === 'append' ? Math.max(0, ...project.clips.filter((item) => item.trackId === trackId).map((item) => item.startFrame + clipFrames(item))) : playhead)), sourceInFrame: 0, sourceOutFrame: asset.duration ? Math.round(asset.duration * project.frameRate) : undefined, transform: { x: 0, y: 0, scale: 100, rotation: 0, opacity: 100 }, audio: { volume: 100, fadeInFrames: 0, fadeOutFrames: 0, muted: false }, generation: generation ? { jobId: generation.id, model: generation.modelName ?? generation.provider, prompt: generation.prompt, width: generation.width, height: generation.height } : undefined }
    commit((value) => ({ ...value, clips: [...value.clips, clip] })); setSelectedIds([clip.id]); setPlayhead(clip.startFrame)
  }
  const positionFromPointer = (event: { clientX: number; currentTarget: Element }) => Math.max(0, Math.min(totalFrames, Math.round((event.clientX - event.currentTarget.getBoundingClientRect().left) / zoom)))
  const drop = (track: MovieEditorTrack, event: DragEvent) => { event.preventDefault(); if (!dragSource || track.locked) return; const raw = positionFromPointer(event); const edges = [0, playhead, ...project.clips.filter((clip) => clip.id !== dragSource.id).flatMap((clip) => [clip.startFrame, clip.startFrame + clipFrames(clip)])]; const nearest = edges.reduce((best, edge) => Math.abs(edge - raw) < Math.abs(best - raw) ? edge : best, raw + 9 / zoom); const at = snap && Math.abs(nearest - raw) <= 8 / zoom ? nearest : raw; if (track.kind !== (dragSource.mediaKind === 'audio' ? 'audio' : 'video') || ('trackId' in dragSource && project.tracks.find((item) => item.id === dragSource.trackId)?.locked)) return; if ('trackId' in dragSource) commit((value) => ({ ...value, clips: value.clips.map((clip) => clip.id === dragSource.id ? { ...clip, trackId: track.id, startFrame: at } : clip) })); else addClip(dragSource, track.id, at); setDragSource(null) }
  const remove = () => { if (!selectedIds.length) return; commit((value) => ({ ...value, clips: value.clips.filter((clip) => !selectedIds.includes(clip.id)) })); setSelectedIds([]) }
  const rippleDelete = () => {
    const targets = project.clips.filter((clip) => selectedIds.includes(clip.id)); if (!targets.length) return

    commit((value) => ({ ...value, clips: value.clips.filter((clip) => !selectedIds.includes(clip.id)).map((clip) => {
      const removedBefore = targets.filter((target) => target.trackId === clip.trackId && target.startFrame < clip.startFrame).reduce((sum, target) => sum + clipFrames(target), 0)
      return removedBefore ? { ...clip, startFrame: Math.max(0, clip.startFrame - removedBefore) } : clip
    }) })); setSelectedIds([])
  }
  const duplicate = () => { if (!selected) return; const copy = { ...selected, id: createId(), startFrame: selected.startFrame + clipFrames(selected) }; commit((value) => ({ ...value, clips: [...value.clips, copy] })); setSelectedIds([copy.id]) }
  const copySelection = () => setClipboard(project.clips.filter((clip) => selectedIds.includes(clip.id)))
  const pasteSelection = () => { if (!clipboard.length) return; const earliest = Math.min(...clipboard.map((clip) => clip.startFrame)); const copies = clipboard.map((clip) => ({ ...clip, id: createId(), startFrame: playhead + clip.startFrame - earliest })); commit((value) => ({ ...value, clips: [...value.clips, ...copies] })); setSelectedIds(copies.map((clip) => clip.id)) }
  const addMarker = () => commit((value) => ({ ...value, markers: [...(value.markers ?? []), { id: createId(), frame: playhead, label: `Marker ${((value.markers?.length ?? 0) + 1)}`, color: 'yellow' }] }))
  const cutClip = (clip: MovieEditorClip, frame: number) => {
    if (project.tracks.find(track => track.id === clip.trackId)?.locked || frame <= clip.startFrame || frame >= clip.startFrame + clipFrames(clip)) return
    const sourceFrame = clip.sourceInFrame + frame - clip.startFrame
    const right = { ...clip, id: createId(), startFrame: frame, sourceInFrame: sourceFrame }
    commit(value => ({ ...value, clips: value.clips.flatMap(item => item.id === clip.id ? [{ ...clip, sourceOutFrame: sourceFrame }, right] : [item]) }))
    setSelectedIds([right.id])
    onNotice('success', `Cut at ${timecode(frame, project.frameRate)}. Undo to restore the clip.`)
  }
  const split = () => { if (selected) cutClip(selected, playhead) }
  const markIn = () => { if (!selected || playhead < selected.startFrame || playhead >= selected.startFrame + clipFrames(selected)) return; const sourceInFrame = selected.sourceInFrame + playhead - selected.startFrame; commit((value) => ({ ...value, clips: value.clips.map((clip) => clip.id === selected.id ? { ...clip, startFrame: playhead, sourceInFrame } : clip) })); onNotice('success', `In point set at ${timecode(playhead, project.frameRate)}.`) }
  const markOut = () => { if (!selected || playhead < selected.startFrame || playhead >= selected.startFrame + clipFrames(selected)) return; const sourceOutFrame = selected.sourceInFrame + playhead - selected.startFrame + 1; commit((value) => ({ ...value, clips: value.clips.map((clip) => clip.id === selected.id ? { ...clip, sourceOutFrame } : clip) })); onNotice('success', `Out point set at ${timecode(playhead, project.frameRate)}.`) }
  const toggleTrack = (track: MovieEditorTrack, key: 'locked' | 'hidden' | 'muted') => commit((value) => ({ ...value, tracks: value.tracks.map((item) => item.id === track.id ? { ...item, [key]: !item[key] } : item) }))
  const updateSelected = (change: Partial<MovieEditorClip>) => { if (!selected || project.tracks.find((track) => track.id === selected.trackId)?.locked) return; commit((value) => ({ ...value, clips: value.clips.map((clip) => clip.id === selected.id ? { ...clip, ...change } : clip) })) }
  const syncPlayback = useCallback((mediaTime: number) => {
    if (!program) return
    const sourceFrame = Math.round(mediaTime * project.frameRate)
    const lastSourceFrame = program.sourceInFrame + clipFrames(program)
    if (sourceFrame >= lastSourceFrame) {
      videoRef.current?.pause()
      const next = primaryClips.find((clip) => clip.startFrame >= program.startFrame + clipFrames(program))
      setPlayhead(next?.startFrame ?? program.startFrame + clipFrames(program))
      return
    }
    setPlayhead(program.startFrame + sourceFrame - program.sourceInFrame)
  }, [primaryClips, program, project.frameRate])
  useEffect(() => {
    const video = videoRef.current
    if (!video || !program || programState !== 'playing' || typeof video.requestVideoFrameCallback !== 'function') return
    let callbackId = 0
    const onFrame: VideoFrameRequestCallback = (_now, metadata) => {
      syncPlayback(metadata.mediaTime)
      if (!video.paused) callbackId = video.requestVideoFrameCallback(onFrame)
    }
    callbackId = video.requestVideoFrameCallback(onFrame)
    return () => video.cancelVideoFrameCallback(callbackId)
  }, [program, programState, syncPlayback])
  const stepPlayhead = (direction: -1 | 1) => {
    videoRef.current?.pause()
    setPlayhead((value) => Math.max(0, Math.min(totalFrames, value + direction)))
  }
  const jumpToEdit = (direction: -1 | 1) => {
    videoRef.current?.pause()
    setPlayhead((value) => adjacentEditFrame(value, direction, totalFrames, project.clips.map((clip) => ({ startFrame: clip.startFrame, frameCount: clipFrames(clip) }))))
  }
  const scrubToFrame = (frame: number) => {
    videoRef.current?.pause()
    setPlayhead(Math.max(0, Math.min(totalFrames, Math.round(frame))))
  }
  const queueScrub = (frame: number) => {
    videoRef.current?.pause()
    scrubFrame.current = frame
    if (!scrubRaf.current) scrubRaf.current = requestAnimationFrame(() => { scrubRaf.current = 0; scrubToFrame(scrubFrame.current) })
  }
  const rulerPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (event.type === 'pointerdown') {
      if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId)
    }
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    queueScrub(positionFromPointer(event))
    if (event.type === 'pointerup') event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const togglePlayback = async () => {
    const video = videoRef.current
    if (!video || !program || programState === 'error') return
    if (!video.paused) { video.pause(); return }
    const lastTime = frameToTime(program.sourceInFrame + clipFrames(program) - 1, project.frameRate)
    if (video.currentTime >= lastTime) {
      video.currentTime = frameToTime(program.sourceInFrame, project.frameRate)
      setPlayhead(program.startFrame)
    }
    try { await video.play() } catch (error) {
      setProgramState('error')
      setProgramError(error instanceof Error ? error.message : 'Preview playback could not start.')
    }
  }
  const exportMovie = async () => { const clips = primaryClips; if (clips.length < 2) return; setBusy('export'); try { await window.minimax.joinVideos(clips.map((clip) => ({ source: clip.source, start: frameToTime(clip.sourceInFrame, project.frameRate), end: clip.sourceOutFrame ? frameToTime(clip.sourceOutFrame, project.frameRate) : undefined })), settings.outputDirectory, settings.ffmpegPath); onNotice('success', 'Exported a versioned movie file from the primary video sequence.') } catch (error) { onNotice('error', error instanceof Error ? error.message : String(error)) } finally { setBusy(null) } }
  const grabFrame = async () => { if (!selected) return; setBusy('frame'); try { const result = await window.minimax.extractVideoFrame(selected.source, frameToTime(movieSourceFrame(selected.startFrame, selected.sourceInFrame, clipFrames(selected), playhead, framePosition), project.frameRate), settings.outputDirectory, settings.ffmpegPath); await onUseFrame({ ...result, kind: 'image', preview: await window.minimax.mediaUrl(result.path) }, frameTarget, selected) } catch (error) { onNotice('error', error instanceof Error ? error.message : String(error)) } finally { setBusy(null) } }

  return <div ref={editorRef} style={{ '--movie-media-width': `${layout.media}px`, '--movie-inspector-width': `${layout.inspector}px`, '--movie-timeline-height': `${layout.timeline}px` } as CSSProperties} data-swapped={layout.swapped} data-tool={tool} className={`movie-editor movie-desktop ${standalone ? 'movie-editor-standalone' : ''}`} aria-label="Movie editor">
    <dialog ref={projectDialogRef} className="movie-project-dialog" role="dialog" aria-labelledby="movie-project-title">
      <header><h2 id="movie-project-title">Movie projects</h2><button type="button" className="secondary-button" onClick={() => projectDialogRef.current?.close()}>Done</button></header>
    <div className="movie-editor-projectbar"><label>Project<select value={project.id} onChange={(event) => setProjectId(event.target.value)}>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><input aria-label="Movie name" value={project.name} onChange={(event) => commit((value) => ({ ...value, name: event.target.value }))} /><button className="secondary-button" onClick={() => { const next = makeProject(projects.length + 1); setProjects((items) => [...items, next]); setProjectId(next.id) }}><Plus size={15} />New movie</button><button className="danger-button" onClick={deleteMovie}><Trash2 size={15} />Delete movie</button></div>
    </dialog>
    <div className="movie-layout-toolbar">
      <button type="button" className="secondary-button movie-project-button" aria-haspopup="dialog" title="Manage Movie projects" onClick={() => projectDialogRef.current?.showModal()}><FolderOpen size={14} />{project.name}</button>
      <button type="button" className="secondary-button" aria-pressed={layout.swapped} onClick={() => setLayout(value => ({ ...value, swapped: !value.swapped }))}>Swap side panels</button>
      <button type="button" className="secondary-button" onClick={() => setLayout({ media: 240, inspector: 260, timeline: 260, swapped: false, grid: false })}>Reset layout</button>
      <span>Drag dividers to resize · V select · C razor · Drag ruler to scrub</span>
    </div>
    <div className="movie-editor-workspace">
      <MoviePanelDivider className="movie-media-divider" label="Media pool width" value={layout.media} min={180} max={400} reverse={layout.swapped} onChange={media => setLayout(value => ({ ...value, media }))} />
      <MoviePanelDivider className="movie-inspector-divider" label="Inspector width" value={layout.inspector} min={180} max={400} reverse={!layout.swapped} onChange={inspector => setLayout(value => ({ ...value, inspector }))} />
      <aside className="movie-media-panel"><header><Layers3 size={16} /><span><strong>Media pool</strong><small>{media.length} available · click to add</small></span><div><button title="Import video" aria-label="Import video" onClick={async () => { const item = await window.minimax.chooseMedia('video'); if (!item) return; const clip = { id: createId(), name: item.name, source: await window.minimax.mediaUrl(item.path), createdAt: Date.now(), mediaKind: 'video' as const }; commit((value) => ({ ...value, media: [...value.media, clip] })) }}><FolderOpen size={15} /></button><button title="Import audio" aria-label="Import audio" onClick={async () => { const item = await window.minimax.chooseMedia('audio'); if (!item) return; const clip = { id: createId(), name: item.name, source: await window.minimax.mediaUrl(item.path), createdAt: Date.now(), mediaKind: 'audio' as const }; commit((value) => ({ ...value, media: [...value.media, clip] })) }}><Music2 size={15} /></button></div></header><div className="movie-media-browser"><div className="movie-media-view" role="group" aria-label="Media pool view"><button type="button" aria-pressed={!layout.grid} onClick={() => setLayout(value => ({ ...value, grid: false }))}>List</button><button type="button" aria-pressed={layout.grid} onClick={() => setLayout(value => ({ ...value, grid: true }))}>Thumbnails</button></div><div className="movie-media-filters"><label className="movie-search">Search media<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a clip…" /></label><label className="movie-search">Media type<select value={mediaKind} onChange={(event) => setMediaKind(event.target.value)}><option value="all">All media</option><option value="video">Video</option><option value="audio">Audio</option></select></label><label className="movie-search">Insert position<select value={insertMode} onChange={(event) => setInsertMode(event.target.value)}><option value="append">End of track</option><option value="playhead">At playhead</option></select></label></div><div className={`movie-media-list ${layout.grid ? 'movie-media-grid' : ''}`}>{filteredMedia.map((clip) => <article className="movie-media-item" key={clip.id}><button className="movie-media-add" draggable title={`${clip.name} — click to add to timeline`} aria-label={`${clip.name}. Click to add to timeline.`} onDragStart={() => setDragSource(clip)} onClick={() => addClip(clip)}><MovieMediaThumbnail key={clip.source} source={clip.source} posterUrl={clip.thumbnailUrl} audio={clip.mediaKind === 'audio'} /><span><strong>{clip.name}</strong><small>{clip.duration ? `${clip.duration.toFixed(1)}s` : 'Duration pending'}</small></span><Plus aria-hidden="true" size={14} /></button>{project.media.some((item) => item.id === clip.id) && <button className="movie-media-remove" title="Remove from media pool" aria-label={`Remove ${clip.name} from media pool`} onClick={() => removeMedia(clip)}><Trash2 size={13} /></button>}</article>)}{!project.media.length && !completed.length && <p>Import media or finish a render to begin.</p>}{media.length > 0 && !filteredMedia.length && <p>No matching media. Try another search or media type.</p>}</div></div></aside>
      <section className="movie-program"><header><span><strong>Program monitor</strong><small>{timecode(playhead, project.frameRate)} · 16:9 fit</small></span>{selected && <button className="secondary-button" onClick={() => onOpenClipMaster?.(selected)}><Scissors size={14} />Clip Master</button>}</header><div className="movie-program-stage"><div className="movie-program-viewport">{program ? <><video key={program.id} ref={videoRef} src={program.source} playsInline preload="auto" onLoadStart={() => setProgramState('loading')} onLoadedMetadata={(event) => { const inFrame = previewSourceFrame(program.sourceInFrame, clipFrames(program), program.startFrame, playhead); const at = frameToTime(inFrame, project.frameRate); event.currentTarget.currentTime = Math.min(at, event.currentTarget.duration || at); event.currentTarget.volume = Math.min(1, Math.max(0, (program.audio?.volume ?? 100) / 100)); event.currentTarget.muted = Boolean(program.audio?.muted); setProgramState('ready') }} onCanPlay={(event) => setProgramState(event.currentTarget.paused ? 'ready' : 'playing')} onPlaying={() => setProgramState('playing')} onPlay={() => setProgramState('playing')} onPause={() => setProgramState((state) => state === 'loading' || state === 'error' ? state : 'ready')} onWaiting={() => setProgramState('buffering')} onError={(event) => { const detail = event.currentTarget.error?.message; setProgramState('error'); setProgramError(`${detail ? `${detail}. ` : ''}Try converting this clip to H.264 video with AAC audio.`) }} onTimeUpdate={(event) => { if (!event.currentTarget.paused && typeof event.currentTarget.requestVideoFrameCallback !== 'function') syncPlayback(event.currentTarget.currentTime) }} />{programState !== 'playing' && <span className={`movie-program-feedback ${programState}`} role={programState === 'error' ? 'alert' : 'status'} aria-live="polite">{programState === 'loading' ? 'Loading preview…' : programState === 'buffering' ? 'Buffering…' : programState === 'error' ? programError : 'Preview ready'}</span>}</> : <div className="movie-program-empty"><Layers3 size={30} /><strong>Build your first sequence</strong><span>Import media or add completed renders from the media pool.</span>{onCreate && <div className="movie-start-actions"><button className="primary-button" onClick={() => onCreate('video')}>Generate a shot</button><button className="secondary-button" onClick={() => onCreate('music')}>Create music</button></div>}</div>}</div></div><footer className="movie-program-transport"><div><button type="button" onClick={() => jumpToEdit(-1)} disabled={!project.clips.length} aria-label="Previous edit point" title="Previous edit point"><SkipBack size={14} /></button><button type="button" onClick={() => stepPlayhead(-1)} disabled={!program} aria-label="Previous frame" title="Previous frame (Left arrow)"><ChevronLeft size={15} /></button><button type="button" className="movie-transport-play" onClick={() => void togglePlayback()} disabled={!program || programState === 'error'} aria-label={programState === 'playing' ? 'Pause preview' : 'Play preview'} title="Play or pause (Space)">{programState === 'playing' ? <Pause size={15} /> : <Play size={15} />}</button><button type="button" onClick={() => stepPlayhead(1)} disabled={!program} aria-label="Next frame" title="Next frame (Right arrow)"><ChevronRight size={15} /></button><button type="button" onClick={() => jumpToEdit(1)} disabled={!project.clips.length} aria-label="Next edit point" title="Next edit point"><SkipForward size={14} /></button></div><output aria-label="Current playhead timecode">{timecode(playhead, project.frameRate)}</output><span title={program?.name}>{program?.name ?? 'No clip at playhead'}</span><input className="movie-program-scrubber" type="range" min="0" max={totalFrames} step="1" value={playhead} onChange={(event) => queueScrub(Number(event.currentTarget.value))} aria-label="Program timeline scrubber" /></footer></section>
      <aside className={`movie-inspector ${selected ? '' : 'is-empty'}`}><header><strong>Inspector</strong>{selected ? <small>{selected.name}</small> : <small>Select one clip</small>}</header>{selected ? <div className="movie-inspector-fields"><label>Position X<input type="number" value={selected.transform?.x ?? 0} onChange={(event) => updateSelected({ transform: { ...(selected.transform ?? { y: 0, scale: 100, rotation: 0, opacity: 100 }), x: Number(event.target.value) } })} /></label><label>Position Y<input type="number" value={selected.transform?.y ?? 0} onChange={(event) => updateSelected({ transform: { ...(selected.transform ?? { x: 0, scale: 100, rotation: 0, opacity: 100 }), y: Number(event.target.value) } })} /></label><label>Scale<input type="number" value={selected.transform?.scale ?? 100} onChange={(event) => updateSelected({ transform: { ...(selected.transform ?? { x: 0, y: 0, rotation: 0, opacity: 100 }), scale: Number(event.target.value) } })} /></label><label>Opacity<input type="number" min="0" max="100" value={selected.transform?.opacity ?? 100} onChange={(event) => updateSelected({ transform: { ...(selected.transform ?? { x: 0, y: 0, scale: 100, rotation: 0 }), opacity: Number(event.target.value) } })} /></label><label>Volume<input type="number" min="0" max="200" value={selected.audio?.volume ?? 100} onChange={(event) => updateSelected({ audio: { ...(selected.audio ?? { fadeInFrames: 0, fadeOutFrames: 0, muted: false }), volume: Number(event.target.value) } })} /></label><section><strong>Source range</strong><small>{timecode(selected.sourceInFrame, project.frameRate)} — {timecode(selected.sourceInFrame + clipFrames(selected), project.frameRate)} · Use Mark in / Mark out, then Split or open Clip Master to render this range.</small></section><section><strong>Preview settings</strong><small>Transform and volume values are project metadata; primary sequence export uses source video and audio.</small></section><section><strong>Generated media</strong><small>{selected.generation?.model ?? 'Imported media'}{selected.generation?.prompt ? ` · ${selected.generation.prompt}` : ''}</small></section><section className="movie-frame-handoff"><strong>Continue this shot</strong><label>Source frame<select value={framePosition} onChange={(event) => setFramePosition(event.target.value as typeof framePosition)}><option value="current">Current timeline frame</option><option value="first">First frame of trimmed clip</option><option value="last">Last frame of trimmed clip</option></select></label><label>Send frame to<select value={frameTarget} onChange={(event) => setFrameTarget(event.target.value as MovieFrameTarget)}>{movieFrameTargets.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><small>{frameTarget === 'h3-reference-first' ? 'Sets a native Ref2VA Frame 0 anchor at frame_idx 0 and keeps your other references. This is not reference-only guidance.' : frameTarget === 'h3-i2v' ? 'Sets the FL2VA/I2V first-frame input at 0.00s. Other Ref2VA media is not used.' : 'Uses the selected trimmed source frame. Review the destination before generating.'}</small><button className="primary-button" onClick={() => void grabFrame()} disabled={busy !== null || selected.mediaKind === 'audio'}>{busy === 'frame' ? <LoaderCircle className="spin" size={14} /> : <Scissors size={14} />}{busy === 'frame' ? 'Preparing frame…' : frameTarget === 'save' ? 'Save frame' : 'Send frame to workspace'}</button></section><button className="secondary-button" onClick={() => onOpenClipMaster?.(selected)}><Scissors size={14} />Open in Clip Master</button><button className="danger-button" onClick={remove}><Trash2 size={14} />Remove</button></div> : <p className="movie-inspector-empty">Use Shift-click to multi-select. Click media to append it or choose At playhead in the media pool.</p>}</aside>
    </div>
    <MoviePanelDivider vertical reverse label="Timeline height" value={layout.timeline} min={160} max={460} onChange={timeline => setLayout(value => ({ ...value, timeline }))} />
    <section className="movie-timeline">
      <header><div className="timeline-tools"><button type="button" className="secondary-button" aria-pressed={tool === 'select'} onClick={() => setTool('select')}>Select (V)</button><button type="button" className="secondary-button" aria-pressed={tool === 'razor'} onClick={() => setTool('razor')}><Scissors size={14} />Razor (C)</button><button aria-label="Zoom timeline out" onClick={() => setZoom((value) => Math.max(.1, value / 2))}>−</button><span>{zoom.toFixed(1)}px / frame</span><button aria-label="Zoom timeline in" onClick={() => setZoom((value) => Math.min(24, value * 2))}>+</button><button className="secondary-button" onClick={markIn} disabled={!selected}><Flag size={14} />Mark in</button><button className="secondary-button" onClick={markOut} disabled={!selected}><Flag size={14} />Mark out</button><button className="secondary-button" onClick={split} disabled={!selected}><Scissors size={14} />Split</button><button className="secondary-button" onClick={duplicate} disabled={!selected}><Copy size={14} />Duplicate</button><button className="secondary-button" onClick={rippleDelete} disabled={!selected}><Trash2 size={14} />Ripple delete</button><button className="secondary-button" onClick={addMarker}><Flag size={14} />Marker</button><button className="secondary-button" onClick={() => addTrack('video')}><Plus size={14} />Track</button><button className="secondary-button" aria-pressed={snap} onClick={() => setSnap(!snap)}><Magnet size={13} />Snap {snap ? 'on' : 'off'}</button><button className="secondary-button" onClick={() => setZoom(Math.max(.01, ((timelineRef.current?.clientWidth ?? 960) - 170) / totalFrames))}>Fit sequence</button></div><output>{timecode(playhead, project.frameRate)}</output></header>
      <div className="movie-timeline-scroll" ref={timelineRef}>
        <div className="movie-timeline-canvas" style={{ '--timeline-width': `${timelineWidth}px` } as CSSProperties}>
          <div className="movie-ruler"><div className="movie-ruler-gutter" aria-hidden="true" /><div className="movie-ruler-lane" onPointerDown={rulerPointer} onPointerMove={rulerPointer} onPointerUp={rulerPointer}>{Array.from({ length: Math.ceil(totalFrames / tickFrames) + 1 }, (_, index) => <span key={index} style={{ left: `${index * tickFrames * zoom}px` }}>{timecode(index * tickFrames, project.frameRate)}</span>)}{(project.markers ?? []).map((marker) => <button type="button" className={`movie-marker ${marker.color}`} key={marker.id} title={`${marker.label} · click to remove`} aria-label={`Remove ${marker.label}`} style={{ left: `${marker.frame * zoom}px` }} onClick={(event) => { event.stopPropagation(); removeMarker(marker.id) }} />)}<i className="movie-playhead" style={{ left: `${playhead * zoom}px` }} /></div></div>
          <div className="movie-track-list">{project.tracks.map((track) => <div className="movie-track" key={track.id}><div className="movie-track-controls"><strong>{track.name}</strong><small>{track.kind}</small><span><button onClick={() => toggleTrack(track, 'locked')} aria-label={`Toggle ${track.name} lock`} className={track.locked ? 'active' : ''}><Lock size={13} /></button><button onClick={() => toggleTrack(track, 'hidden')} aria-label={`Toggle ${track.name} visibility`} className={track.hidden ? 'active' : ''}>{track.hidden ? <EyeOff size={13} /> : <Eye size={13} />}</button>{track.kind === 'audio' && <button onClick={() => toggleTrack(track, 'muted')} aria-label={`Toggle ${track.name} mute`} className={track.muted ? 'active' : ''}>{track.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}</button>}{!defaultTracks.some((item) => item.id === track.id) && <button onClick={() => removeTrack(track)} aria-label={`Delete ${track.name}`} title="Delete track"><Trash2 size={13} /></button>}</span></div><div className="movie-track-lane" onClick={(event) => { if (event.target === event.currentTarget) scrubToFrame(positionFromPointer(event)) }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(track, event)}>{(clipsByTrack.get(track.id) ?? []).map((clip) => <button key={clip.id} draggable={tool === 'select' && !track.locked} onDragStart={() => setDragSource(clip)} className={`movie-timeline-clip ${selectedIds.includes(clip.id) ? 'selected' : ''}`} style={{ left: `${clip.startFrame * zoom}px`, width: `${Math.max(1, clipFrames(clip) * zoom)}px` }} onClick={(event) => {
      if (tool === 'razor') {
        const lane = event.currentTarget.parentElement!
        cutClip(clip, event.detail === 0 ? playhead : positionFromPointer({ clientX: event.clientX, currentTarget: lane }))
      } else setSelectedIds(current => event.shiftKey ? (current.includes(clip.id) ? current.filter(id => id !== clip.id) : [...current, clip.id]) : [clip.id])
    }} onDoubleClick={() => onOpenClipMaster?.(clip)}><strong>{clip.name}</strong><small>{timecode(clip.sourceInFrame, project.frameRate)} — {timecode(clip.sourceInFrame + clipFrames(clip), project.frameRate)}</small></button>)}<i className="movie-playhead" style={{ left: `${playhead * zoom}px` }} /></div></div>)}</div>
        </div>
      </div>
      <footer><button className="secondary-button" onClick={() => addTrack('audio')}><Music2 size={14} />Add audio track</button><span>Export joins primary video trims in order; overlays, gaps and audio tracks are not mixed. Shortcuts: ←/→ frame step · S split · M marker · Ctrl/Cmd+C/V copy/paste · Shift+Delete ripple delete</span></footer>
    </section>
    <footer className="movie-editor-bottom-bar"><div><strong>{project.name || 'Untitled movie'}</strong><span>{project.clips.length} {project.clips.length === 1 ? 'clip' : 'clips'} · {media.length} media</span></div><span className="movie-editor-bottom-status">{selected ? `Selected: ${selected.name}` : `Playhead ${timecode(playhead, project.frameRate)}`}</span><div className="movie-editor-bottom-actions"><button className="secondary-button" onClick={undo} disabled={!history.length}><Undo2 size={15} />Undo</button><button className="secondary-button" onClick={redo} disabled={!future.length}><Redo2 size={15} />Redo</button><button className="primary-button" onClick={() => void exportMovie()} disabled={busy === 'export' || primaryClips.length < 2}>{busy === 'export' ? <LoaderCircle className="spin" size={15} /> : <Scissors size={15} />}Export primary sequence</button></div></footer>
  </div>
}
