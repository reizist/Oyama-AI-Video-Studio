import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { VideoExportButtons } from './VideoExportButtons'
import { MovieMediaThumbnail } from './MovieMediaThumbnail'
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronRight, CircleStop, Copy, Film, FolderOpen, GitBranch, LoaderCircle, PanelRight, Play, Plus, RefreshCw, RotateCcw, Search, Settings2, Trash2, X } from 'lucide-react'
import { createId } from '../lib/createId'
import { normalizeContinuationSources, continuationBeatSignature, continuationLongestSequence, continuationOutputName, continuationSourcePrompt, continuationTiming, type ContinuationOpenRequest } from '../lib/continuation'
import type { LivePreview } from '../lib/useLivePreview'
import type { GenerationJob, MediaFile } from '../types'
import './continue-workspace.css'

export type ContinueMethod = 'motion' | 'last' | 'frame'
export type ContinueMode = 'text' | 'reference'
export type ContinuationSettings = {
  dialogueMode: 'inherit' | 'none' | 'allow'
  contextFrames: number
  blendFrames: number
  carryAudio: boolean
}
export type ContinueBeat = {
  id: string
  name: string
  prompt: string
  duration: number
  frameTime: number
  cameraOverride: string
  shotSize?: string
  cameraAngle?: string
  cameraMovement?: string
  continuityBreak: boolean
  replacements: Partial<Record<'character' | 'wardrobe' | 'location' | 'prop', MediaFile>>
  replacementOwnerIds?: Partial<Record<'character' | 'wardrobe', string>>
  sourceMode?: 'previous' | 'original' | 'beat'
  sourceBeatId?: string
}
export type ContinueScript = { version: 1; id: string; videoName: string; mode: ContinueMode; method: ContinueMethod; continuity: ContinuationSettings; sourceJobId?: string; externalSource?: MediaFile; sourcePromptDrafts?: Record<string, string>; beats: ContinueBeat[] }

const storageKey = 'oyama.continue.script.v1'
const defaultContinuity = (): ContinuationSettings => ({ dialogueMode: 'inherit', contextFrames: 22, blendFrames: 0, carryAudio: true })
const newBeat = (name = 'Beat 1'): ContinueBeat => ({ id: createId(), name, prompt: '', duration: 5, frameTime: 0, cameraOverride: '', continuityBreak: false, replacements: {}, sourceMode: 'original' })
const emptyScript = (): ContinueScript => ({ version: 1, id: createId(), videoName: '', mode: 'text', method: 'last', continuity: defaultContinuity(), beats: [newBeat()] })
function loadScript(): ContinueScript {
  try {
    type LegacyBeat = ContinueBeat & Partial<ContinuationSettings> & { branchFromBeatId?: string }
    const raw = JSON.parse(localStorage.getItem(storageKey) || 'null') as (Omit<ContinueScript, 'beats' | 'continuity'> & { continuity?: Partial<ContinuationSettings>; beats: LegacyBeat[] }) | null
    if (raw?.version === 1 && Array.isArray(raw.beats)) {
      const legacySettings = raw.beats[0]
      const continuity = { ...defaultContinuity(), ...legacySettings, ...raw.continuity }
      return { ...raw, videoName: raw.videoName ?? '', continuity, beats: raw.beats.length ? normalizeBeatSources(raw.beats.map((beat, index) => {
        const normalizedBeat = { ...beat }
        delete normalizedBeat.contextFrames
        delete normalizedBeat.blendFrames
        delete normalizedBeat.carryAudio
        delete normalizedBeat.dialogueMode
        const branchFromBeatId = normalizedBeat.branchFromBeatId
        delete normalizedBeat.branchFromBeatId
        return { ...newBeat(), ...normalizedBeat, replacements: beat.replacements ?? {}, name: beat.name?.trim() || `Beat ${index + 1}`, sourceMode: beat.sourceMode ?? (branchFromBeatId ? 'beat' : index === 0 ? 'original' : 'previous'), sourceBeatId: beat.sourceBeatId ?? branchFromBeatId }
      })) : [newBeat()] }
    }
  } catch { /* A damaged draft should not block the workspace. */ }
  return emptyScript()
}

function nextBeatName(beats: ContinueBeat[]) {
  let number = 1
  const names = new Set(beats.map(beat => beat.name.trim().toLocaleLowerCase()))
  while (names.has(`beat ${number}`)) number += 1
  return `Beat ${number}`
}

function sourceName(file: GenerationJob | MediaFile | undefined) {
  if (!file) return ''
  const raw = 'status' in file ? file.localOutputPath?.split(/[\\/]/).at(-1) : file.name
  return raw?.replace(/\.[^.]+$/, '') ?? ''
}

function sourceBeatIdFor(beats: ContinueBeat[], beat: ContinueBeat, index: number) {
  if (beat.sourceMode === 'original') return undefined
  if (beat.sourceMode === 'beat') return beat.sourceBeatId
  return beats[index - 1]?.id
}

const normalizeBeatSources = normalizeContinuationSources

function ContinuationRenderPreview({ job, livePreview, liveConnected, compact = false }: { job: GenerationJob; livePreview: LivePreview | null; liveConnected: boolean; compact?: boolean }) {
  const [playbackStatus, setPlaybackStatus] = useState('')
  useEffect(() => setPlaybackStatus(''), [job.outputUrl])
  const live = job.promptId && livePreview?.promptId === job.promptId ? livePreview : null
  const rendering = ['queued', 'running'].includes(job.status)
  return <div className={`continue-render-preview ${compact ? 'compact' : ''}`}>
    {job.outputUrl ? <video src={job.outputUrl} controls preload="metadata" onWaiting={() => setPlaybackStatus('Buffering video…')} onCanPlay={() => setPlaybackStatus('')} onPlaying={() => setPlaybackStatus('')} onError={() => setPlaybackStatus('Video could not be decoded. Export the clip to open it in another player, or check that the source file is available.')} /> : live ? <figure><div>{live.mime === 'video/mp4' ? <video key={live.url} src={live.url} aria-label="Animated continuation preview" autoPlay loop muted playsInline preload="auto" /> : <img key={live.url} src={live.url} alt={live.animated ? 'Animated continuation preview' : 'Live continuation preview'} />}</div><figcaption><span><i />Live preview</span><small>{live.animated ? `Animated H3${live.step && live.totalSteps ? ` · step ${live.step}/${live.totalSteps}` : ''}` : 'Intermediate decoded frame'}</small></figcaption></figure> : <div className={`continue-render-placeholder ${job.status}`}><span>{rendering ? <LoaderCircle className="spin" size={28} /> : <Film size={28} />}</span><strong>{job.status === 'queued' ? job.promptId ? 'Waiting in the ComfyUI queue' : 'Preparing locally before ComfyUI' : job.status === 'running' ? 'Waiting for the first preview frame' : job.status === 'cancelled' ? 'Beat cancelled' : 'Preview unavailable'}</strong><small>{rendering && job.promptId ? liveConnected ? 'Live feed connected · the render will appear here automatically' : 'Live feed is reconnecting · the render continues in ComfyUI' : job.progressLabel ?? `${job.width} × ${job.height} · ${job.duration}s`}</small></div>}
    {rendering && <div className="continue-render-progress"><span><i style={{ width: `${Math.max(2, job.progress)}%` }} /></span><small>{job.currentStep !== undefined && job.totalSteps ? `Step ${job.currentStep} of ${job.totalSteps}` : job.progressLabel ?? 'Preparing preview'}<b>{Math.round(job.progress)}%</b></small></div>}
    <div className="continue-render-details" role="status" aria-live="polite"><strong>{job.progressLabel ?? (job.status === 'completed' ? 'Combined video saved' : job.status === 'failed' ? 'Render failed' : 'Preparing locally')}</strong><span>{job.promptId ? `ComfyUI prompt ${job.promptId} · ` : 'Not submitted to ComfyUI · '}{job.queuePosition ? `Queue position ${job.queuePosition} · ` : ''}{job.currentStep !== undefined && job.totalSteps ? `Sampler step ${job.currentStep} of ${job.totalSteps} · ` : ''}{job.width} × {job.height} · {job.duration}s</span></div>
    {(job.comfyActivity?.length || job.execution) && <details className="continue-render-activity" open={job.status === 'failed'}><summary>Render activity and configuration</summary>{job.execution && <p>{[job.execution.diffusionModel && `Model: ${job.execution.diffusionModel}`, job.execution.gpuRouting && `GPU: ${job.execution.gpuRouting}`, job.execution.sampler && `Sampler: ${job.execution.sampler}`, job.execution.preview && `Preview: ${job.execution.preview}`].filter(Boolean).join(' · ')}</p>}{Boolean(job.comfyActivity?.length) && <ol>{job.comfyActivity?.map((entry, index) => <li key={`${entry.at}-${index}`}><time dateTime={new Date(entry.at).toISOString()}>{new Date(entry.at).toLocaleTimeString()}</time> {entry.message}</li>)}</ol>}</details>}
    {playbackStatus && <p role="status" aria-live="polite">{playbackStatus}</p>}
  </div>
}

export function ContinueWorkspace({ openRequest, jobs, connected, liveConnected, motionReady, assemblyReady, missingNodes, livePreview, cancellingIds, onChooseVideo, onChooseImage, onGenerate, onCancel, onResetSource, onEditSourcePrompt }: {
  openRequest: ContinuationOpenRequest
  jobs: GenerationJob[]
  connected: boolean
  liveConnected: boolean
  motionReady: boolean
  assemblyReady: boolean
  missingNodes: string[]
  livePreview: LivePreview | null
  cancellingIds: Set<string>
  onChooseVideo(): Promise<MediaFile | null>
  onChooseImage(): Promise<MediaFile | null>
  onGenerate(script: ContinueScript, beat: ContinueBeat, source: GenerationJob | MediaFile, method: ContinueMethod, onProgress: (stage: string) => void): Promise<void>
  onCancel(job: GenerationJob): Promise<void>
  onResetSource(): void
  onEditSourcePrompt(job: GenerationJob, prompt: string): void
}) {
  const launchLock = useRef(false)
  const [script, setScript] = useState<ContinueScript>(loadScript)
  const [activeBeatId, setActiveBeatId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(true)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false)
  const [sourceQuery, setSourceQuery] = useState('')
  const [sourceImporting, setSourceImporting] = useState(false)
  const [sourcePickerError, setSourcePickerError] = useState('')
  const [runningAll, setRunningAll] = useState(false)
  const [preparing, setPreparing] = useState<string | null>(null)
  const [preparationStage, setPreparationStage] = useState('')
  const [error, setError] = useState('')
  const [queueNotice, setQueueNotice] = useState('')
  const [frameDuration, setFrameDuration] = useState(0)
  const [sourcePlaybackError, setSourcePlaybackError] = useState('')
  const [sequenceTime, setSequenceTime] = useState(0)
  const [sequenceDuration, setSequenceDuration] = useState(0)
  const [cutCueTime, setCutCueTime] = useState(2.5)
  const sequencePlayer = useRef<HTMLVideoElement>(null)
  const [beatFrameDurations, setBeatFrameDurations] = useState<Record<string, number>>({})
  const appliedSourceRequest = useRef(0)
  const launched = useRef(new Set<string>())
  const sourcePickerRef = useRef<HTMLElement>(null)
  const completedJobs = useMemo(() => jobs.filter(job => job.mediaType !== 'image' && job.mediaType !== 'audio' && job.status === 'completed' && job.outputUrl), [jobs])
  const filteredSourceJobs = useMemo(() => {
    const query = sourceQuery.trim().toLocaleLowerCase()
    return query ? completedJobs.filter(job => `${job.prompt} ${sourceName(job)}`.toLocaleLowerCase().includes(query)) : completedJobs
  }, [completedJobs, sourceQuery])
  const sourceJob = completedJobs.find(job => job.id === script.sourceJobId)
  const source = sourceJob ?? script.externalSource
  const sourceUrl = sourceJob?.outputUrl ?? script.externalSource?.preview
  useEffect(() => { setSourcePlaybackError(''); setFrameDuration(0) }, [sourceUrl])
  const motionAvailable = motionReady && Boolean(sourceJob?.latentFile || jobs.some(job => job.continuation?.scriptId === script.id && job.status === 'completed' && job.latentFile))
  const method: ContinueMethod = script.method === 'motion' && !motionAvailable ? 'last' : script.method
  const beatJobs = useMemo(() => {
    const found = new Map<string, GenerationJob | undefined>()
    script.beats.forEach((beat, index) => {
      const parentId = sourceBeatIdFor(script.beats, beat, index)
      const parentSource = parentId ? found.get(parentId) : source
      const parentJobId = parentId && parentSource && 'status' in parentSource ? parentSource.id : parentId ? undefined : script.sourceJobId ?? script.externalSource?.path
      const beatMethod = method === 'motion' && (!parentSource || !('status' in parentSource) || !parentSource.latentFile) ? 'last' : method
      found.set(beat.id, parentId && !parentJobId ? undefined : jobs.find(job => job.continuation?.scriptId === script.id && job.continuation.beatId === beat.id && job.continuation.sourceJobId === parentJobId && job.continuation.beatSignature === continuationBeatSignature(beat, script.videoName, `${script.mode}:${beatMethod}`, script.continuity)))
    })
    return found
  }, [jobs, method, script, source])
  const continuationJobs = jobs.filter(job => job.continuation?.scriptId === script.id && script.beats.some(beat => beat.id === job.continuation?.beatId))
  const activeBeatJob = continuationJobs.find(job => ['queued', 'running'].includes(job.status))
  const displayedBeatJob = activeBeatJob ?? continuationJobs.find(job => job.outputUrl || job.status === 'failed' || job.status === 'cancelled')
  const displayedBeatNumber = displayedBeatJob ? script.beats.findIndex(beat => beat.id === displayedBeatJob.continuation?.beatId) + 1 : 0
  const activeBeat = script.beats.find(beat => beat.id === activeBeatId) ?? script.beats[0]
  const activeBeatIndex = Math.max(0, script.beats.findIndex(beat => beat.id === activeBeat.id))
  const activeJob = beatJobs.get(activeBeat.id)
  const sequence = useMemo(() => continuationLongestSequence(script, beatJobs, frameDuration || sourceJob?.duration || 0), [script, beatJobs, frameDuration, sourceJob?.duration])
  const sequenceUrl = sequence.job?.outputUrl ?? sourceUrl
  useEffect(() => { setSequenceTime(0); setSequenceDuration(0); setSourcePlaybackError('') }, [sequenceUrl])

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(script)) }
    catch { setError('The continuation draft could not be saved. Free local storage and edit again to retry. Keep the studio open.') }
  }, [script])
  useEffect(() => {
    if (!openRequest.sourceId || appliedSourceRequest.current === openRequest.id) return
    if (activeBeatJob || preparing || runningAll) return
    appliedSourceRequest.current = openRequest.id
    const requestedJob = jobs.find(job => job.id === openRequest.sourceId)
    setScript(current => ({ ...current, videoName: current.videoName.trim() || sourceName(requestedJob), sourceJobId: openRequest.sourceId!, externalSource: undefined, method: motionReady && requestedJob?.latentFile ? 'motion' : 'last' }))
  }, [openRequest, jobs, motionReady, activeBeatJob, preparing, runningAll])
  useEffect(() => {
    if (!script.beats.some(beat => beat.id === activeBeatId)) setActiveBeatId(script.beats[0]?.id ?? null)
  }, [activeBeatId, script.beats])
  useEffect(() => {
    if (!sourcePickerOpen) return
    const doc = sourcePickerRef.current?.ownerDocument ?? document
    const previousFocus = doc.activeElement as HTMLElement | null
    sourcePickerRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSourcePickerOpen(false)
      if (event.key !== 'Tab') return
      const elements = Array.from(sourcePickerRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? [])
      const first = elements[0]; const last = elements.at(-1)
      if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    doc.addEventListener('keydown', onKey)
    return () => { doc.removeEventListener('keydown', onKey); previousFocus?.focus() }
  }, [sourcePickerOpen])

  const updateBeat = (id: string, patch: Partial<ContinueBeat>) => setScript(current => ({ ...current, beats: current.beats.map(beat => beat.id === id ? { ...beat, ...patch } : beat) }))
  const insertCutCue = (beat: ContinueBeat) => {
    const seconds = Math.max(0, Math.min(beat.duration, cutCueTime))
    const framing = [beat.shotSize, beat.cameraAngle, beat.cameraMovement].filter(Boolean).join(', ')
    const cue = `At ${seconds.toFixed(1)} seconds, hard cut to ${framing || 'a new camera angle'}; continue the action without a dissolve.`
    updateBeat(beat.id, { prompt: `${beat.prompt.trimEnd()}${beat.prompt.trim() ? '\n' : ''}${cue}` })
  }
  const updateContinuity = (patch: Partial<ContinuationSettings>) => setScript(current => ({ ...current, continuity: { ...current.continuity, ...patch } }))
  const sourceFor = useCallback((beat: ContinueBeat): GenerationJob | MediaFile | undefined => {
    const index = script.beats.findIndex(item => item.id === beat.id)
    const parentId = sourceBeatIdFor(script.beats, beat, index)
    if (parentId) return beatJobs.get(parentId)?.status === 'completed' ? beatJobs.get(parentId) : undefined
    return source
  }, [script.beats, beatJobs, source])
  const launch = useCallback(async (beat: ContinueBeat) => {
    if (!connected) { setError('Start ComfyUI and test the connection before generating.'); setRunningAll(false); return }
    const prior = sourceFor(beat)
    if (!prior) { setError('Generate the previous beat first, or choose a completed source clip.'); setRunningAll(false); return }
    if (!script.videoName.trim()) { setError('Name the source video before generating a beat.'); setRunningAll(false); return }
    if (!beat.name.trim()) { setError('Give this beat a name before generating it.'); setRunningAll(false); return }
    if (script.beats.some(item => item.id !== beat.id && item.name.trim().toLocaleLowerCase() === beat.name.trim().toLocaleLowerCase())) { setError('Every beat name must be unique. Rename this beat before generating it.'); setRunningAll(false); return }
    if (!beat.prompt.trim()) { setError('Write what happens next for this beat.'); setRunningAll(false); return }
    const sourceCharacters = 'status' in prior ? prior.continuityState?.characters ?? [] : []
    const ambiguousReplacement = (['character', 'wardrobe'] as const).find(role => beat.replacements[role] && sourceCharacters.length > 1 && !beat.replacementOwnerIds?.[role])
    if (ambiguousReplacement) { setError(`Choose which character receives the ${ambiguousReplacement} replacement.`); setRunningAll(false); return }
    if (launchLock.current || preparing || activeBeatJob) return
    if (!assemblyReady) { setError('Install the H3 Extender Trim and Merge nodes, then reconnect before generating.'); setRunningAll(false); return }
    launchLock.current = true
    const beatMethod: ContinueMethod = method === 'motion' && (!('status' in prior) || !prior.latentFile) ? 'last' : method
    setPreparing(beat.id); setPreparationStage('Checking source and render requirements'); setError(''); setQueueNotice('')
    try {
      await onGenerate(script, beat, prior, beatMethod, setPreparationStage)
      launched.current.add(beat.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setRunningAll(false)
    } finally { launchLock.current = false; setPreparing(null); setPreparationStage('') }
  }, [connected, sourceFor, preparing, activeBeatJob, assemblyReady, onGenerate, script, method])
  const cancel = useCallback(async (job: GenerationJob) => {
    setRunningAll(false)
    setQueueNotice('')
    try { await onCancel(job) } catch (cause) { setError(`Could not cancel: ${cause instanceof Error ? cause.message : String(cause)}. Try Cancel again.`) }
  }, [onCancel])
  useEffect(() => {
    if (!runningAll || preparing || activeBeatJob) return
    const next = script.beats.find(beat => (!beatJobs.get(beat.id) || ['failed', 'cancelled'].includes(beatJobs.get(beat.id)?.status ?? '')) && !launched.current.has(beat.id))
    if (!next) {
      const stopped = script.beats.find(beat => ['failed', 'cancelled'].includes(beatJobs.get(beat.id)?.status ?? ''))
      if (stopped) { setRunningAll(false); setError(`${stopped.name} did not finish. Fix the issue, then choose Generate All to retry from that beat.`) }
      else if (script.beats.every(beat => beatJobs.get(beat.id)?.status === 'completed')) setRunningAll(false)
      return
    }
    const index = script.beats.indexOf(next)
    const parentId = sourceBeatIdFor(script.beats, next, index)
    const parent = parentId ? beatJobs.get(parentId) : null
    if (parent?.status === 'failed' || parent?.status === 'cancelled') { setRunningAll(false); setError('A prior beat did not finish. Regenerate it, then resume Generate All.'); return }
    if (!parentId || parent?.status === 'completed') void launch(next)
  }, [runningAll, jobs, preparing, activeBeatJob, script, beatJobs, launch])

  const chooseSourceJob = (job: GenerationJob) => {
    setScript(current => ({ ...current, videoName: current.videoName.trim() || sourceName(job), sourceJobId: job.id, externalSource: undefined, method: motionReady && job.latentFile ? 'motion' : 'last' }))
    setError(''); setQueueNotice(''); setSourcePickerError(''); setSourcePickerOpen(false)
  }
  const openSourcePicker = () => { setSourceQuery(''); setSourcePickerError(''); setSourcePickerOpen(true) }
  const pickExternal = async () => {
    setSourceImporting(true); setError(''); setSourcePickerError('')
    try {
      const file = await onChooseVideo()
      if (!file) return
      setScript(current => ({ ...current, videoName: current.videoName.trim() || sourceName(file), sourceJobId: undefined, externalSource: file, method: 'last' }))
      setSourcePickerOpen(false); setQueueNotice(`${file.name} is ready as the continuation source.`)
    } catch (cause) {
      setSourcePickerError(`The video could not be loaded: ${cause instanceof Error ? cause.message : String(cause)}. Choose another file or verify that it still exists.`)
    } finally { setSourceImporting(false) }
  }
  const chooseReplacement = async (beat: ContinueBeat, role: keyof ContinueBeat['replacements']) => {
    const file = await onChooseImage()
    if (file) updateBeat(beat.id, { replacements: { ...beat.replacements, [role]: { ...file, referenceRole: role === 'character' ? 'subject' : role } } })
  }
  const insert = (index: number, sourceBeatId?: string) => setScript(current => { const beats = [...current.beats]; beats.splice(index + 1, 0, { ...newBeat(nextBeatName(current.beats)), sourceMode: sourceBeatId ? 'beat' : 'previous', sourceBeatId }); return { ...current, beats } })
  const move = (index: number, direction: -1 | 1) => setScript(current => { const beats = [...current.beats]; const target = index + direction; if (target < 0 || target >= beats.length) return current; [beats[index], beats[target]] = [beats[target], beats[index]]; return { ...current, beats: normalizeBeatSources(beats) } })
  const resetContinuation = () => {
    if (activeBeatJob) return
    if (!window.confirm('Reset the Continuation workspace? This clears the selected source and beat plan. Existing rendered files and generation history will be kept.')) return
    launched.current.clear()
    setRunningAll(false)
    setPreparing(null)
    setError('')
    setQueueNotice('')
    setFrameDuration(0)
    setBeatFrameDurations({})
    onResetSource()
    setScript(emptyScript())
  }

  const clearBeatSetup = async () => {
    setRunningAll(false)
    if (preparing) { setError('This beat is still being prepared. Wait for submission to finish, then clear its setup.'); return }
    const runningJob = continuationJobs.find(job => job.continuation?.beatId === activeBeat.id && ['queued', 'running'].includes(job.status))
    if (runningJob) {
      try { await onCancel(runningJob) }
      catch (cause) { setError(`Could not stop this beat before clearing it: ${cause instanceof Error ? cause.message : String(cause)}`); return }
    }
    launched.current.delete(activeBeat.id)
    setScript(current => ({ ...current, beats: current.beats.map(beat => beat.id === activeBeat.id ? { ...newBeat(beat.name), id: beat.id, sourceMode: beat.sourceMode, sourceBeatId: beat.sourceBeatId } : beat) }))
    setError('')
    setQueueNotice(`${activeBeat.name} setup cleared. Its source and place in the script are preserved.`)
  }

  const resetQueue = async () => {
    setRunningAll(false)
    launched.current.clear()
    setError('')
    if (activeBeatJob) {
      try {
        await onCancel(activeBeatJob)
      } catch (cause) {
        setError(`The queue was paused, but the active beat could not be stopped: ${cause instanceof Error ? cause.message : String(cause)}`)
        return
      }
    }
    setQueueNotice('Queue reset. Your script and completed beats are unchanged. Choose Resume sequence when you are ready.')
  }

  const locked = Boolean(activeBeatJob || preparing || runningAll)
  const finalJob = beatJobs.get(script.beats.at(-1)?.id ?? '')
  const activeBeatSource = sourceFor(activeBeat)
  const activeBeatMethod: ContinueMethod = method === 'motion' && (!activeBeatSource || !('status' in activeBeatSource) || !activeBeatSource.latentFile) ? 'last' : method
  const activeSourceCharacters = activeBeatSource && 'status' in activeBeatSource ? activeBeatSource.continuityState?.characters ?? [] : []
  const sourceChoice = activeBeat.sourceMode === 'beat' && activeBeat.sourceBeatId ? `beat:${activeBeat.sourceBeatId}` : activeBeatIndex === 0 || activeBeat.sourceMode === 'original' ? 'original' : 'previous'
  const duplicateName = script.beats.some(item => item.id !== activeBeat.id && item.name.trim().toLocaleLowerCase() === activeBeat.name.trim().toLocaleLowerCase())
  const activeTiming = continuationTiming(activeBeat.duration, !activeBeat.continuityBreak && activeBeatMethod === 'motion' ? script.continuity.contextFrames : 0, activeBeat.continuityBreak ? 0 : script.continuity.blendFrames)
  const completedCount = script.beats.filter(beat => beatJobs.get(beat.id)?.status === 'completed').length
  const nextIncomplete = script.beats.find(beat => !beatJobs.get(beat.id) || ['failed', 'cancelled'].includes(beatJobs.get(beat.id)?.status ?? ''))
  const failedBeat = script.beats.find(beat => beatJobs.get(beat.id)?.status === 'failed')
  const frameSourceUrl = activeBeatSource ? 'status' in activeBeatSource ? activeBeatSource.outputUrl : activeBeatSource.preview : undefined
  const selectedSourceName = sourceJob ? sourceName(sourceJob) || sourceJob.prompt.trim().split('\n')[0] || 'Completed render' : script.externalSource?.name ?? ''
  const editableSourceJob = sourceJob?.provider === 'minimax' && !sourceJob.continuation ? sourceJob : undefined
  const originalSourcePrompt = editableSourceJob ? continuationSourcePrompt(editableSourceJob) : ''
  const sourcePromptDraft = editableSourceJob ? script.sourcePromptDrafts?.[editableSourceJob.id] ?? originalSourcePrompt : ''

  return <div className={`continue-workspace ${settingsOpen ? '' : 'settings-collapsed'} ${script.beats.length === 1 ? 'single-beat' : ''}`}>
    <header className="continue-heading">
      <div><p className="eyebrow">CONTINUE / H3</p><h1>Continue a video</h1><p>Build the next shot from a finished clip. Each completed beat becomes a reusable source.</p></div>
      <div className="continue-heading-actions"><button className="secondary-button" type="button" disabled={locked} onClick={openSourcePicker}><FolderOpen size={15} />{source ? 'Change source' : 'Choose source'}</button><button className="secondary-button" type="button" aria-pressed={settingsOpen} onClick={() => setSettingsOpen(value => !value)}><PanelRight size={15} />{settingsOpen ? 'Hide setup' : 'Show setup'}</button></div>
    </header>

    <section className="continue-source-banner" aria-label="Current source" role="status" aria-live="polite">
      <span className="continue-source-banner-icon"><Film size={19} /></span>
      <span><small>STARTING CLIP</small><strong>{source ? selectedSourceName : 'No video selected'}</strong><small>{sourceJob ? `${sourceJob.width} × ${sourceJob.height} · ${sourceJob.duration}s${sourceJob.latentFile ? ' · motion context available' : ''}` : source ? 'Imported video · frame continuity' : 'Choose a completed render or import a video to begin'}</small></span>
      {source && <button className="secondary-button" type="button" disabled={locked} onClick={openSourcePicker}>Replace</button>}
    </section>

    {editableSourceJob && <details className="continue-source-prompt" key={editableSourceJob.id}>
      <summary><span><strong>Original H3 prompt</strong><small>{sourcePromptDraft !== originalSourcePrompt ? 'Revised draft saved in Continue' : 'Review or revise the prompt used for this source clip'}</small></span><span>Edit prompt</span></summary>
      <div className="continue-source-prompt-body"><label htmlFor="continue-original-prompt">Source clip prompt</label><textarea id="continue-original-prompt" rows={5} value={sourcePromptDraft} onChange={event => { const text = event.target.value; setScript(current => ({ ...current, sourcePromptDrafts: { ...current.sourcePromptDrafts, [editableSourceJob.id]: text } })) }} /><p>The saved clip will not change. Open this draft in H3 Create to render a new version, then select that render as the Continue source.</p><div><button className="secondary-button" type="button" disabled={sourcePromptDraft === originalSourcePrompt} onClick={() => setScript(current => { const sourcePromptDrafts = { ...current.sourcePromptDrafts }; delete sourcePromptDrafts[editableSourceJob.id]; return { ...current, sourcePromptDrafts } })}>Restore saved prompt</button><button className="primary-button" type="button" disabled={locked || !sourcePromptDraft.trim()} onClick={() => onEditSourcePrompt(editableSourceJob, sourcePromptDraft)}>Open draft in H3 Create</button></div></div>
    </details>}

    {(script.beats.length > 1 || activeBeatJob || preparing || failedBeat || error) && <section className="continue-queuebar" aria-label="Sequence queue">
      <div><span className={`continue-queue-dot ${activeBeatJob ? 'working' : failedBeat ? 'failed' : completedCount === script.beats.length ? 'complete' : ''}`} /><span><strong>{activeBeatJob ? `${activeBeatJob.promptId ? 'Rendering' : 'Preparing'} Beat ${displayedBeatNumber}` : failedBeat ? `${failedBeat.name} needs attention` : completedCount === script.beats.length ? 'Sequence complete' : 'Sequence ready'}</strong><small>{completedCount} of {script.beats.length} beats complete{activeBeatJob ? ` · ${Math.round(activeBeatJob.progress)}%` : ''}</small></span></div>
      <div><button className="secondary-button" type="button" disabled={!activeBeatJob && !runningAll && !preparing && !failedBeat && !error} onClick={() => void resetQueue()}><RotateCcw size={14} />Reset queue</button>{activeBeatJob ? <button className="danger-button" type="button" disabled={cancellingIds.has(activeBeatJob.id)} onClick={() => void cancel(activeBeatJob)}><CircleStop size={14} />{cancellingIds.has(activeBeatJob.id) ? 'Stopping…' : 'Stop current'}</button> : <button className="primary-button" type="button" disabled={!connected || !source || !assemblyReady || !nextIncomplete || Boolean(preparing)} onClick={() => { launched.current.clear(); setError(''); setQueueNotice(''); setRunningAll(true) }}><Play size={14} />{failedBeat ? 'Resume sequence' : 'Generate remaining'}</button>}</div>
    </section>}

    {error && <section className="continue-recovery" role="alert"><AlertTriangle size={20} /><div><strong>{failedBeat && beatJobs.get(failedBeat.id)?.promptId ? 'Continuation stopped in ComfyUI' : 'Beat stopped before ComfyUI submission'}</strong><p>{error}</p><span>{failedBeat && <button className="secondary-button" type="button" disabled={locked || !sourceFor(failedBeat)} onClick={() => { setActiveBeatId(failedBeat.id); void launch(failedBeat) }}><RefreshCw size={14} />Retry {failedBeat.name}</button>}<button className="secondary-button" type="button" onClick={() => setError('')}>Dismiss</button></span></div></section>}
    {queueNotice && <p className="continue-queue-notice" role="status" aria-live="polite"><Check size={15} />{queueNotice}</p>}
    {!connected ? <section className="continue-recovery" role="alert"><AlertTriangle size={20} /><div><strong>ComfyUI is offline</strong><p>Start ComfyUI, then use Test connection in Settings. You can keep planning the clip, but Generate stays disabled until the local engine is available.</p></div></section> : !assemblyReady && <section className="continue-recovery" role="alert"><AlertTriangle size={20} /><div><strong>Continuation tools are not installed</strong><p>Missing: <code>{missingNodes.join(', ')}</code>. Install <a href="https://github.com/pmhaidn/ComfyUI-Minimax-H3-Extender" target="_blank" rel="noreferrer">MiniMax H3 Extender</a> from ComfyUI Manager, restart ComfyUI, then use Test connection. Editing remains available, but Generate stays disabled so the app cannot submit a workflow ComfyUI will reject.</p></div></section>}

    <div className="continue-layout">
      <aside className="continue-script-sidebar" aria-label="Continuation script outline">
        <header><span><strong>Script</strong><small>{script.beats.length} {script.beats.length === 1 ? 'beat' : 'beats'}</small></span><button className="icon-button" type="button" disabled={locked} aria-label="Add beat" title="Add beat" onClick={() => insert(script.beats.length - 1)}><Plus size={17} /></button></header>
        <nav><div className="continue-origin-tile"><span className="continue-script-number"><Film size={13} /></span><span><strong>Original</strong><small>{source ? selectedSourceName : 'Choose source'}</small></span></div>{script.beats.map((beat, index) => { const job = beatJobs.get(beat.id); const status = job?.status ?? 'planned'; const parentId = sourceBeatIdFor(script.beats, beat, index); const parent = script.beats.find(item => item.id === parentId); return <button type="button" key={beat.id} className={`continue-script-item ${beat.id === activeBeat.id ? 'selected' : ''} status-${status}`} aria-current={beat.id === activeBeat.id ? 'step' : undefined} onClick={() => setActiveBeatId(beat.id)}><span className="continue-script-number">{job?.status === 'completed' ? <Check size={13} /> : index + 1}</span><span><strong>{beat.name.trim() || `Beat ${index + 1}`}</strong><small>From {parent?.name.trim() || 'Original'} · {status}{beat.continuityBreak ? ' · cut' : ''}</small></span><ChevronRight size={14} /></button> })}</nav>
        <footer><button className="secondary-button" type="button" disabled={locked} onClick={() => insert(script.beats.length - 1)}><Plus size={14} />Add beat</button><button className="secondary-button" type="button" disabled={locked} title="Clear the source and script; completed files and history are preserved" onClick={resetContinuation}><Trash2 size={14} />New script</button></footer>
      </aside>

      <div className="continue-editor">
        <section className={`continue-live-monitor ${activeBeatJob || preparing ? 'active' : ''}`} aria-label="Sequence player">
          <header>
            <span><small>SEQUENCE PLAYER</small><strong>{sequence.job ? `Longest completed sequence · Original + ${sequence.beats.length} ${sequence.beats.length === 1 ? 'beat' : 'beats'}` : source ? 'Original clip · ready for Beat 1' : 'Choose a source above'}</strong></span>
            <span className={`continue-live-health ${!connected ? 'offline' : liveConnected ? 'connected' : 'disconnected'}`} title={!connected ? 'ComfyUI is offline' : liveConnected ? 'Connected to the ComfyUI live preview feed' : 'The live preview feed is reconnecting'}><i />{!connected ? 'Live feed unavailable' : liveConnected ? 'Live feed ready' : 'Live feed reconnecting'}</span>
          </header>
          {sourceUrl && <video key={`source-metadata:${sourceUrl}`} className="continue-metadata-video" src={sourceUrl} preload="metadata" onLoadedMetadata={event => setFrameDuration(event.currentTarget.duration || 0)} aria-hidden="true" tabIndex={-1} />}
          {sequenceUrl ? <><video ref={sequencePlayer} key={sequenceUrl} className="continue-preview" src={sequenceUrl} controls preload="metadata" onLoadedMetadata={event => setSequenceDuration(event.currentTarget.duration || 0)} onTimeUpdate={event => setSequenceTime(event.currentTarget.currentTime)} onWaiting={event => event.currentTarget.setAttribute('aria-busy', 'true')} onCanPlay={event => { event.currentTarget.removeAttribute('aria-busy'); setSourcePlaybackError('') }} onError={event => { event.currentTarget.removeAttribute('aria-busy'); setSourcePlaybackError('This sequence could not be played. Verify that the source file still exists and uses a supported video codec.') }} /><div className="continue-timeline" aria-label="Completed sequence timeline"><div className="continue-timeline-summary"><strong>{sequence.beats.length ? 'Completed sequence' : 'Starting clip'}</strong><span>{sequenceDuration ? sequenceDuration.toFixed(2) : sequence.duration.toFixed(2)}s · 24 fps output</span></div><div className="continue-timeline-track">{sequence.segments.map(segment => <button key={segment.id} type="button" className={`continue-timeline-segment ${segment.id === 'original' ? 'original' : ''} ${sequenceTime >= segment.start && sequenceTime < segment.start + segment.duration ? 'playing' : ''}`} style={{ flexGrow: Math.max(1, segment.duration) }} title={`${segment.label}: ${segment.start.toFixed(2)}s to ${(segment.start + segment.duration).toFixed(2)}s`} onClick={() => { if (sequencePlayer.current) sequencePlayer.current.currentTime = Math.min(segment.start, Math.max(0, (sequencePlayer.current.duration || sequence.duration) - 0.04)) }}><span>{segment.label}</span><small>{segment.duration.toFixed(1)}s</small></button>)}</div><small>Click a section to seek. Each completed beat adds to the combined video.</small></div>{sourcePlaybackError && <p className="continue-source-playback-error" role="status" aria-live="polite">{sourcePlaybackError}</p>}</> : <div className="continue-monitor-empty"><Film size={28} /><strong>No source selected</strong><span>Choose a completed render or import a video with Choose source above.</span></div>}
          {(activeBeatJob || preparing || displayedBeatJob) && <details className="continue-render-drawer" open={Boolean(activeBeatJob || preparing)}><summary>{activeBeatJob ? `Rendering Beat ${displayedBeatNumber} · ${Math.round(activeBeatJob.progress)}%` : preparing ? preparationStage : `Latest beat render · ${displayedBeatJob?.status}`}</summary>{preparing ? <div className="continue-render-placeholder" role="status" aria-live="polite"><LoaderCircle className="spin" size={28} /><strong>{preparationStage}</strong><small>The source is being prepared before ComfyUI submission.</small></div> : displayedBeatJob && <ContinuationRenderPreview job={displayedBeatJob} livePreview={livePreview} liveConnected={liveConnected} compact />}</details>}
        </section>

        <section className="continue-editor-card">
          <header className="continue-editor-heading"><span><small>NEXT CLIP {script.beats.length > 1 ? `· ${activeBeatIndex + 1} OF ${script.beats.length}` : ''}</small><input aria-label="Beat name" disabled={locked} value={activeBeat.name} maxLength={48} aria-invalid={duplicateName || !activeBeat.name.trim()} onChange={event => updateBeat(activeBeat.id, { name: event.target.value })} /></span><div><span className={`continue-status status-${activeJob?.status ?? 'planned'}`}>{activeJob?.status ?? 'planned'}</span><button className="secondary-button continue-tools-toggle" type="button" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen(value => !value)}>Beat tools</button></div></header>
          {advancedOpen && <div className="continue-beat-tools" aria-label="Advanced beat tools"><button className="icon-button" type="button" title="Move up" aria-label={`Move beat ${activeBeatIndex + 1} up`} disabled={locked || activeBeatIndex === 0} onClick={() => move(activeBeatIndex, -1)}><ArrowUp size={15} /></button><button className="icon-button" type="button" title="Move down" aria-label={`Move beat ${activeBeatIndex + 1} down`} disabled={locked || activeBeatIndex === script.beats.length - 1} onClick={() => move(activeBeatIndex, 1)}><ArrowDown size={15} /></button><button className="icon-button" type="button" title="Duplicate beat" aria-label={`Duplicate beat ${activeBeatIndex + 1}`} disabled={locked} onClick={() => setScript(current => { const beats = [...current.beats]; const copy: ContinueBeat = { ...activeBeat, id: createId(), name: nextBeatName(current.beats), sourceMode: 'previous', sourceBeatId: undefined }; beats.splice(activeBeatIndex + 1, 0, copy); setActiveBeatId(copy.id); return { ...current, beats } })}><Copy size={15} /></button><button className="icon-button" type="button" title="Branch from beat" aria-label={`Branch from beat ${activeBeatIndex + 1}`} disabled={locked} onClick={() => insert(activeBeatIndex, activeBeat.id)}><GitBranch size={15} /></button><button className="icon-button" type="button" title="Delete beat" aria-label={`Delete beat ${activeBeatIndex + 1}`} disabled={locked || script.beats.length === 1} onClick={() => setScript(current => ({ ...current, beats: normalizeBeatSources(current.beats.filter(item => item.id !== activeBeat.id)) }))}><Trash2 size={15} /></button><button className="secondary-button" type="button" onClick={() => void clearBeatSetup()}>Clear this clip</button></div>}
          {duplicateName && <p className="continue-field-error" role="alert">Beat names must be unique so outputs and recovery points stay unambiguous.</p>}
          <div className="continue-handoff"><span>INCOMING SOURCE</span><strong>{activeBeatSource ? sourceBeatIdFor(script.beats, activeBeat, activeBeatIndex) ? `Completed ${script.beats.find(beat => beat.id === sourceBeatIdFor(script.beats, activeBeat, activeBeatIndex))?.name ?? 'beat'}` : 'Original clip' : sourceBeatIdFor(script.beats, activeBeat, activeBeatIndex) ? `Generate ${script.beats.find(beat => beat.id === sourceBeatIdFor(script.beats, activeBeat, activeBeatIndex))?.name ?? 'the parent beat'} first` : 'Choose an original clip'}</strong><small>{activeBeat.continuityBreak ? 'Hard cut: this beat starts a new shot without the prior frame or motion guide.' : activeBeatMethod === 'motion' ? 'Inherits the preceding beat’s last motion and audio context.' : activeBeatMethod === 'frame' ? 'Uses a chosen source frame as the visual guide.' : 'Uses the last frame of the incoming video as the visual guide.'}</small></div>
          <label className="continue-prompt-field"><span>What happens next?</span><textarea disabled={locked} value={activeBeat.prompt} rows={6} placeholder="Describe only the new action, camera change, or dialogue in this beat…" onChange={event => updateBeat(activeBeat.id, { prompt: event.target.value })} /><small>Keep it focused. Source appearance, location, and prior action are carried forward automatically.</small></label>
          <div className="continue-cut-cue"><span><strong>Cut inside this beat</strong><small>Add a timed camera cut instruction to the prompt. Timing is a generation cue; use the between-beat cut below for an exact edit point.</small></span><label>At <input type="number" min="0" max={activeBeat.duration} step="0.5" value={cutCueTime} onChange={event => setCutCueTime(Number(event.target.value) || 0)} /> s</label><button className="secondary-button" type="button" disabled={locked} onClick={() => insertCutCue(activeBeat)}>Add cut cue</button></div>
          <div className="continue-camera-controls"><div><strong>Shot design</strong><small>Guide the new camera framing and movement</small></div><div><label>Size<select disabled={locked} value={activeBeat.shotSize ?? ''} onChange={event => updateBeat(activeBeat.id, { shotSize: event.target.value })}><option value="">Inherit / auto</option><option value="wide shot">Wide</option><option value="medium shot">Medium</option><option value="close-up">Close-up</option><option value="extreme close-up">Extreme close-up</option></select></label><label>Angle<select disabled={locked} value={activeBeat.cameraAngle ?? ''} onChange={event => updateBeat(activeBeat.id, { cameraAngle: event.target.value })}><option value="">Inherit / auto</option><option value="eye-level angle">Eye level</option><option value="low angle">Low angle</option><option value="high angle">High angle</option><option value="over-the-shoulder angle">Over shoulder</option></select></label><label>Movement<select disabled={locked} value={activeBeat.cameraMovement ?? ''} onChange={event => updateBeat(activeBeat.id, { cameraMovement: event.target.value })}><option value="">Inherit / auto</option><option value="locked-off camera">Locked</option><option value="slow pan">Pan</option><option value="tracking shot">Tracking</option><option value="handheld camera">Handheld</option></select></label></div><label className="continue-switch"><span><strong>Cut between beats</strong><small>Use only when this beat begins a new shot. The joined video cuts here without a frame or motion guide.</small></span><input type="checkbox" role="switch" disabled={locked} checked={activeBeat.continuityBreak} onChange={event => updateBeat(activeBeat.id, { continuityBreak: event.target.checked })} /></label></div>
          {advancedOpen && <div className="continue-output-name"><small>SAVED OUTPUT</small><code>{continuationOutputName(script, activeBeat)}</code></div>}
          <div className="continue-editor-actions">{activeJob && ['queued', 'running'].includes(activeJob.status) ? <button className="danger-button" type="button" disabled={cancellingIds.has(activeJob.id)} onClick={() => void cancel(activeJob)}><CircleStop size={14} />{cancellingIds.has(activeJob.id) ? 'Stopping…' : 'Cancel render'}</button> : <button className="primary-button" type="button" disabled={locked || !connected || !assemblyReady || !activeBeatSource} onClick={() => void launch(activeBeat)}>{activeJob ? <RefreshCw size={14} /> : <Play size={14} />}{activeJob ? 'Generate again' : 'Generate next clip'}</button>}<button className="secondary-button" type="button" disabled={locked} onClick={() => insert(activeBeatIndex)}><Plus size={14} />Add another clip</button></div>
        </section>

        {activeJob?.error && <section className="continue-inline-error" role="alert"><AlertTriangle size={16} /><span><strong>This beat did not finish</strong>{activeJob.error}</span></section>}
        {activeJob && <VideoExportButtons job={activeJob} />}
        {finalJob?.status === 'completed' && activeJob?.id !== finalJob.id && <section className="continue-final-output"><span><Check size={16} /><strong>Final combined video is ready</strong></span><VideoExportButtons job={finalJob} /></section>}
      </div>

      {settingsOpen && <aside className="continue-settings" aria-label="Continuation settings">
        <header><Settings2 size={16} /><span><strong>Setup</strong><small>Sequence and continuity</small></span></header>
        <fieldset className="continue-fields" disabled={locked}>
          <section><h2>Sequence</h2><label>Video name<input value={script.videoName} maxLength={64} placeholder="Name this video" onChange={event => setScript(current => ({ ...current, videoName: event.target.value }))} /></label></section>
          <section className="continue-beat-source-settings"><h2>Beat {activeBeatIndex + 1}</h2><label>Source for this beat<select value={sourceChoice} onChange={event => { const choice = event.target.value; updateBeat(activeBeat.id, choice.startsWith('beat:') ? { sourceMode: 'beat', sourceBeatId: choice.slice(5) } : { sourceMode: choice as 'previous' | 'original', sourceBeatId: undefined }) }}>{activeBeatIndex > 0 && <option value="previous">Previous beat</option>}<option value="original">Original source video</option>{script.beats.slice(0, activeBeatIndex).map((candidate, index) => <option value={`beat:${candidate.id}`} key={candidate.id}>Beat {index + 1} · {candidate.name}</option>)}</select><small>This choice is saved only on {activeBeat.name.trim() || `Beat ${activeBeatIndex + 1}`}.</small></label><label>Length<div className="continue-number-field"><input type="number" min="1" max="15" step="0.5" value={activeBeat.duration} onChange={event => updateBeat(activeBeat.id, { duration: Math.max(1, Math.min(15, Number(event.target.value) || 5)) })} /><span>seconds</span></div><small>{activeTiming.renderFrames > 362 ? 'Reduce the length or advanced motion context.' : `About ${activeTiming.deliveredDuration.toFixed(2)}s after H3 frame alignment.`}</small></label></section>
          <details className="continue-advanced" open={advancedOpen} onToggle={event => setAdvancedOpen(event.currentTarget.open)}><summary>Advanced continuity</summary>
            <section><h2>Workflow</h2><div className="continue-segmented" role="group" aria-label="Continuation mode"><button type="button" className={script.mode === 'text' ? 'selected' : ''} onClick={() => setScript(current => ({ ...current, mode: 'text' }))}>Text only</button><button type="button" className={script.mode === 'reference' ? 'selected' : ''} onClick={() => setScript(current => ({ ...current, mode: 'reference' }))}>Replace a reference</button></div><label>Join from<select value={script.method} onChange={event => setScript(current => ({ ...current, method: event.target.value as ContinueMethod }))}><option value="motion" disabled={!motionReady}>Motion + audio context</option><option value="last">Last frame</option><option value="frame">Choose a frame</option></select></label><p className="continue-note" role="status" aria-live="polite">{motionAvailable ? 'Motion context is available and preferred for a smooth handoff.' : 'Last-frame continuity is the compatible fallback for this source.'}</p></section>
            {method === 'frame' && <section><h2>Chosen frame</h2><label>Source frame<input type="range" min="0" max={Math.max(0, (beatFrameDurations[activeBeat.id] ?? frameDuration) - 0.05)} step="0.04" value={activeBeat.frameTime} onChange={event => updateBeat(activeBeat.id, { frameTime: Number(event.target.value) })} /><output>{activeBeat.frameTime.toFixed(2)}s</output></label>{frameSourceUrl && <video className="continue-frame-preview" src={frameSourceUrl} muted playsInline preload="metadata" onLoadedMetadata={event => { setBeatFrameDurations(current => ({ ...current, [activeBeat.id]: event.currentTarget.duration || 0 })); event.currentTarget.currentTime = activeBeat.frameTime }} ref={element => { if (element && element.readyState >= 1 && Math.abs(element.currentTime - activeBeat.frameTime) > 0.06) element.currentTime = activeBeat.frameTime }} />}</section>}
            <section><h2>All clips</h2><label>Dialogue<select value={script.continuity.dialogueMode} onChange={event => updateContinuity({ dialogueMode: event.target.value as ContinuationSettings['dialogueMode'] })}><option value="inherit">Match the source</option><option value="none">No dialogue</option><option value="allow">Dialogue allowed</option></select></label>{method === 'motion' && <><label>Motion context<select value={script.continuity.contextFrames} onChange={event => updateContinuity({ contextFrames: Number(event.target.value) })}>{![1, 5, 22, 39].includes(script.continuity.contextFrames) && <option value={script.continuity.contextFrames}>{script.continuity.contextFrames} legacy frames</option>}{[1, 5, 22, 39].map(frames => <option key={frames} value={frames}>{frames} frames</option>)}</select></label><label className="continue-switch"><span><strong>Carry audio across joins</strong><small>Keep audio timing continuous at each seam</small></span><input type="checkbox" role="switch" checked={script.continuity.carryAudio} onChange={event => updateContinuity({ carryAudio: event.target.checked })} /></label></>}<label>Seam blend<input type="number" min="0" max="16" value={script.continuity.blendFrames} onChange={event => updateContinuity({ blendFrames: Math.max(0, Math.min(16, Number(event.target.value) || 0)) })} /></label></section>
            <section><h2>Camera detail</h2><label>Additional direction<input value={activeBeat.cameraOverride} onChange={event => updateBeat(activeBeat.id, { cameraOverride: event.target.value })} placeholder="Optional lens or movement detail" /></label></section>
            {script.mode === 'reference' && <section><h2>Reference changes</h2><p className="continue-note">Everything is inherited unless you replace it here.</p><div className="continue-replacements">{(['character', 'wardrobe', 'location', 'prop'] as const).map(role => <div key={role}><span><strong>{role}</strong><small>{activeBeat.replacements[role]?.name ?? 'Inherited'}</small></span>{activeBeat.replacements[role] && (role === 'character' || role === 'wardrobe') && activeSourceCharacters.length > 1 && <select aria-label={`Character for ${role} replacement`} value={activeBeat.replacementOwnerIds?.[role] ?? ''} onChange={event => updateBeat(activeBeat.id, { replacementOwnerIds: { ...activeBeat.replacementOwnerIds, [role]: event.target.value || undefined } })}><option value="">Choose character</option>{activeSourceCharacters.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}</select>}<button className="secondary-button" type="button" onClick={() => void chooseReplacement(activeBeat, role)}>Replace</button>{activeBeat.replacements[role] && <button className="icon-button" type="button" aria-label={`Restore inherited ${role}`} onClick={() => { const replacements = { ...activeBeat.replacements }; delete replacements[role]; const replacementOwnerIds = { ...activeBeat.replacementOwnerIds }; if (role === 'character' || role === 'wardrobe') delete replacementOwnerIds[role]; updateBeat(activeBeat.id, { replacements, replacementOwnerIds }) }}><X size={13} /></button>}</div>)}</div></section>}
          </details>
        </fieldset>
      </aside>}
    </div>
    {sourcePickerOpen && <div className="continue-source-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSourcePickerOpen(false) }}><section className="continue-source-modal" ref={sourcePickerRef} role="dialog" aria-modal="true" aria-labelledby="continue-source-picker-title">
      <header><span><strong id="continue-source-picker-title">Choose a source video</strong><small>Select any finished video render or import a clip from your computer.</small></span><button className="icon-button" type="button" aria-label="Close source video picker" onClick={() => setSourcePickerOpen(false)}><X size={18} /></button></header>
      <div className="continue-source-toolbar"><label><Search size={15} /><input type="search" value={sourceQuery} onChange={event => setSourceQuery(event.target.value)} placeholder="Search videos…" aria-label="Search source videos" /></label><button className="primary-button" type="button" disabled={sourceImporting} onClick={() => void pickExternal()}>{sourceImporting ? <LoaderCircle className="spin" size={15} /> : <FolderOpen size={15} />}{sourceImporting ? 'Loading video…' : 'Import video'}</button>{sourcePickerError && <p className="continue-source-picker-error" role="alert">{sourcePickerError}</p>}</div>
      <div className="continue-source-modal-body">{script.externalSource && <section><h2>Imported video</h2><button type="button" className="continue-source-card selected" onClick={() => setSourcePickerOpen(false)}><span className="continue-source-card-media">{script.externalSource.preview ? <MovieMediaThumbnail source={script.externalSource.preview} /> : <Film size={28} />}</span><span><strong>{script.externalSource.name}</strong><small>Imported file · frame continuity</small></span><i><Check size={14} />Selected</i></button></section>}<section><div className="continue-source-section-title"><h2>Finished renders</h2><small>{filteredSourceJobs.length} {filteredSourceJobs.length === 1 ? 'video' : 'videos'}</small></div>{filteredSourceJobs.length ? <div className="continue-source-grid">{filteredSourceJobs.map(job => { const title = sourceName(job) || job.prompt.trim().split('\n')[0] || 'Untitled render'; const selected = script.sourceJobId === job.id; return <button type="button" className={`continue-source-card ${selected ? 'selected' : ''}`} key={job.id} aria-pressed={selected} onClick={() => chooseSourceJob(job)}><span className="continue-source-card-media"><MovieMediaThumbnail source={job.outputUrl!} posterUrl={job.thumbnailUrl} /></span><span><strong title={title}>{title}</strong><small>{job.width} × {job.height} · {job.duration}s · {new Date(job.createdAt).toLocaleDateString()}</small><em>{job.latentFile ? 'Motion context ready' : `${job.provider === 'ltx25' ? 'LTX 2.5 · ' : ''}Frame continuation`}</em></span>{selected && <i><Check size={14} />Selected</i>}</button> })}</div> : <div className="continue-source-picker-empty"><Film size={28} /><strong>{sourceQuery ? 'No videos match your search' : 'No finished renders yet'}</strong><span>{sourceQuery ? 'Try another title or prompt.' : 'Import a video now, or finish a video render and it will appear here automatically.'}</span>{sourceQuery && <button className="secondary-button" type="button" onClick={() => setSourceQuery('')}>Clear search</button>}</div>}</section></div>
      <footer><small>The selected video is only read as a source. It is never modified.</small><button className="secondary-button" type="button" onClick={() => setSourcePickerOpen(false)}>Cancel</button></footer>
    </section></div>}
  </div>
}
