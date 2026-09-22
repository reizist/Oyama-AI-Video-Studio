import { movieFrameTargets, type MovieFrameTarget } from '../lib/movieHandoff'
import { WorkspacePanel, StudioButton, ProductionLoading, EmptyState } from './Workspace'
import { createId } from '../lib/createId'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Download, FolderOpen, Image, LoaderCircle, Plus, Save, Scissors, X } from 'lucide-react'
import type { AppSettings, ClipItem, GenerationJob, MediaFile } from '../types'
import { ReliableVideo } from './ReliableVideo'

type VideoMeta = { duration: number; fps: number; frameCount: number; width: number; height: number }
type SavedFrame = { path: string; name: string; index: number; role: 'start' | 'end' | 'frame'; preview?: string }
type ExportResult = {
  path: string
  name: string
  url: string
  folder: string
  frameCount: number
  duration: number
  startFrame: number
  endFrame: number
  width: number
  height: number
  fps: number
}

function clampFrame(value: number, meta: VideoMeta | null) {
  const maximum = Math.max(0, (meta?.frameCount ?? 1) - 1)
  return Math.max(0, Math.min(maximum, Math.floor(Number.isFinite(value) ? value : 0)))
}

function frameTime(frame: number, fps: number) {
  return fps > 0 ? frame / fps : 0
}

function frameLabel(frame: number, width = 4) { return String(frame).padStart(width, '0') }
function clipMasterFolderName(value: string) {
  const stem = value.replace(/\.[^.]+$/, '')
  return (stem || 'clip').replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'clip'
}

function ClipSegmentEditor({ clip, settings, onClose, onNotice, onExportClip, onUseFrame, initialRange, onRange, onSplit }: { initialRange?: { start: number; end: number }; onRange(start: number, end: number, meta: VideoMeta): void; onSplit(frame: number): void; onUseFrame?(file: MediaFile, target: MovieFrameTarget): void; clip: ClipItem; settings: AppSettings; onClose(): void; onNotice(tone: 'error' | 'success' | 'neutral', text: string): void; onExportClip?(clip: ClipItem): void }) {
  const initialRangeRef = useRef(initialRange)
  const dialogRef = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const noticeRef = useRef(onNotice)
  const [meta, setMeta] = useState<VideoMeta | null>(null)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [startFrame, setStartFrame] = useState(0)
  const [endFrame, setEndFrame] = useState(0)
  const [batchFrames, setBatchFrames] = useState<number[]>([])
  const [savedFrames, setSavedFrames] = useState<SavedFrame[]>([])
  const [outputFolder, setOutputFolder] = useState('')
  const [exportResult, setExportResult] = useState<ExportResult | null>(null)
  const [busy, setBusy] = useState<'metadata' | 'frames' | 'export' | null>('metadata')
  const [batchInput, setBatchInput] = useState('')
  const [metadataError, setMetadataError] = useState('')
  const [exportError, setExportError] = useState('')
  const [continuationTarget, setContinuationTarget] = useState<MovieFrameTarget>('h3-reference-first')

  useEffect(() => { noticeRef.current = onNotice }, [onNotice])

  useEffect(() => {
    let disposed = false
    setBusy('metadata'); setMeta(null); setMetadataError(''); setExportError(''); setSavedFrames([]); setOutputFolder(''); setExportResult(null); setBatchFrames([])
    void window.minimax.getVideoMetadata(clip.source, settings.ffmpegPath).then((value) => {
      if (disposed) return
      setMeta(value)
      setStartFrame(initialRangeRef.current?.start ?? 0); setCurrentFrame(initialRangeRef.current?.start ?? 0); setEndFrame(initialRangeRef.current?.end ?? Math.max(0, value.frameCount - 1))
      setBusy(null)
    }).catch((error) => { if (!disposed) { const message = error instanceof Error ? error.message : String(error); setBusy(null); setMetadataError(message); noticeRef.current('error', `Clip Master could not read video metadata: ${message}`) } })
    return () => { disposed = true }
  }, [clip.id, clip.source, settings.ffmpegPath])

  useEffect(() => {
    if (meta && videoRef.current) videoRef.current.currentTime = (initialRangeRef.current?.start ?? 0) / meta.fps
  }, [meta])

  useEffect(() => { if (meta) onRange(startFrame, endFrame, meta) }, [startFrame, endFrame, meta, onRange])

  const duration = meta ? (endFrame - startFrame + 1) / meta.fps : 0
  const selectedFrameCount = meta ? endFrame - startFrame + 1 : 0
  const folderName = useMemo(() => clipMasterFolderName(clip.name), [clip.name])
  const setFrame = (value: number) => {
    const next = clampFrame(value, meta)
    setCurrentFrame(next)
    if (videoRef.current && meta) { videoRef.current.pause(); videoRef.current.currentTime = frameTime(next, meta.fps) }
  }
  const seekBy = (amount: -1 | 1) => setFrame(currentFrame + amount)
  const setStart = () => { setStartFrame(Math.min(currentFrame, endFrame)); onNotice('success', `Start frame set to ${frameLabel(currentFrame)}.`) }
  const setEnd = () => { setEndFrame(Math.max(currentFrame, startFrame)); onNotice('success', `End frame set to ${frameLabel(currentFrame)}.`) }
  const updateStartFrame = (value: number) => {
    const next = clampFrame(value, meta)
    setStartFrame(next)
    if (next > endFrame) setEndFrame(next)
  }
  const updateEndFrame = (value: number) => {
    const next = clampFrame(value, meta)
    setEndFrame(next)
    if (next < startFrame) setStartFrame(next)
  }
  const addBatchFrame = (value = currentFrame) => {
    const next = clampFrame(value, meta)
    setBatchFrames((items) => items.includes(next) ? items : [...items, next].sort((a, b) => a - b))
  }
  const removeBatchFrame = (value: number) => setBatchFrames((items) => items.filter((item) => item !== value))

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (event.key === ' ') { event.preventDefault(); if (videoRef.current?.paused) void videoRef.current.play(); else videoRef.current?.pause() }
      else if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && meta) {
        event.preventDefault()
        const amount = event.key === 'ArrowLeft' ? -1 : 1
        setCurrentFrame((value) => {
          const next = clampFrame(value + amount, meta)
          if (videoRef.current) videoRef.current.currentTime = frameTime(next, meta.fps)
          return next
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [meta, onClose])

  const saveFrames = async (requests: Array<{ index: number; role: 'start' | 'end' | 'frame' }>) => {
    if (!meta || !requests.length || busy) return false
    setBusy('frames')
    try {
      const result: { folder: string; files: SavedFrame[] } = { folder: '', files: [] }
      for (let index = 0; index < requests.length; index += 100) {
        const batch = await window.minimax.extractClipMasterFrames(clip.source, requests.slice(index, index + 100), settings.clipMasterOutputDirectory, settings.ffmpegPath, clip.name)
        result.folder = batch.folder; result.files.push(...batch.files)
      }
      const files = await Promise.all(result.files.map(async (file) => ({ ...file, preview: await window.minimax.mediaUrl(file.path) })))
      setSavedFrames((items) => [...items, ...files]); setOutputFolder(result.folder)
      onNotice('success', `${files.length} frame${files.length === 1 ? '' : 's'} saved to ${result.folder}.`)
      return true
    } catch (error) { onNotice('error', error instanceof Error ? error.message : String(error)); return false }
    finally { setBusy(null) }
  }
  const continueFrame = async () => {
    if (!meta || busy || !onUseFrame) return
    setBusy('frames')
    try { const result = await window.minimax.extractClipMasterFrames(clip.source, [{ index: currentFrame, role: 'end' }], settings.clipMasterOutputDirectory, settings.ffmpegPath, clip.name); const file = result.files[0]; if (file) onUseFrame({ kind: 'image', path: file.path, name: file.name, preview: await window.minimax.mediaUrl(file.path) }, continuationTarget) }
    catch (error) { onNotice('error', String(error)) } finally { setBusy(null) }
  }
  const saveRangeFrames = () => void saveFrames([{ index: startFrame, role: 'start' }, { index: endFrame, role: 'end' }])
  const saveCurrent = () => void saveFrames([{ index: currentFrame, role: 'frame' }])
  const saveBatch = async () => {
    const saved = await saveFrames(batchFrames.map((index) => ({ index, role: 'frame' as const })))
    if (saved) setBatchFrames([])
  }
  const exportClip = async () => {
    if (!meta || busy || endFrame < startFrame) return
    try {
      const outputPath = await window.minimax.chooseClipMasterExportPath(settings.clipMasterOutputDirectory, clip.name)
      if (!outputPath) return
      setExportError(''); setBusy('export')
      const result = await window.minimax.trimClipMaster(clip.source, startFrame, endFrame, meta.fps, outputPath, settings.ffmpegPath)
      setExportResult({ ...result, startFrame, endFrame, width: meta.width, height: meta.height, fps: meta.fps }); setOutputFolder(result.folder)
      onNotice('success', `${result.name} exported to ${result.folder}.`)
      onExportClip?.({ id: `clip-master-${Date.now()}`, name: result.name, source: result.url, duration: result.duration, createdAt: Date.now(), mediaKind: 'video' })
    } catch (error) { const message = error instanceof Error ? error.message : String(error); setExportError(message); onNotice('error', `Clip export failed. Your source and marked frame range are unchanged. ${message}`) }
    finally { setBusy(null) }
  }

  const metadataSummary = useMemo(() => meta ? `${meta.width} × ${meta.height} · ${meta.fps.toFixed(meta.fps % 1 ? 3 : 0)} fps · ${meta.frameCount.toLocaleString()} frames · ${meta.duration.toFixed(2)}s` : metadataError ? 'Metadata unavailable' : 'Reading frame rate and frame count…', [meta, metadataError])
  return <div className="clip-segment-editor">
    <section ref={dialogRef} className="clip-master-modal" aria-labelledby="clip-master-title">
      <header hidden className="clip-master-header"><div><span className="eyebrow">PRECISION FRAME EDITOR</span><h2 id="clip-master-title">Clip Master</h2><small>{clip.name}</small></div><button autoFocus className="icon-button" onClick={onClose} aria-label="Close Clip Master"><X size={18} /></button></header>
      <div className="clip-master-body">
        <div className="clip-master-preview"><ReliableVideo videoRef={node => { videoRef.current = node }} src={clip.source} controls playsInline preload="auto" onLoadedMetadata={(event) => { if (meta) event.currentTarget.currentTime = frameTime(currentFrame, meta.fps) }} onTimeUpdate={(event) => { if (!meta) return; const next = clampFrame(Math.floor(event.currentTarget.currentTime * meta.fps + 0.001), meta); if (next !== currentFrame) setCurrentFrame(next) }} /><div className="clip-master-frame-readout"><strong>Frame {frameLabel(currentFrame)}</strong><span>{meta ? `${frameTime(currentFrame, meta.fps).toFixed(3)}s · ${metadataSummary}` : metadataSummary}</span></div>{metadataError && <div className="clip-master-error" role="alert"><strong>Unable to inspect this clip.</strong><span>{metadataError}</span></div>}</div>
        <div className="clip-master-controls"><button className="secondary-button" disabled={!meta || !!busy || currentFrame <= startFrame || currentFrame > endFrame} onClick={() => onSplit(currentFrame)}><Scissors size={15}/>Split before current frame</button><div className="clip-master-stepper"><button className="secondary-button" onClick={() => seekBy(-1)} disabled={!meta || currentFrame <= 0} aria-label="Previous frame"><ChevronLeft size={16} />Previous frame</button><label>Current frame<input type="number" min="0" max={Math.max(0, (meta?.frameCount ?? 1) - 1)} value={currentFrame} onChange={(event) => setFrame(Number(event.target.value))} /></label><button className="secondary-button" onClick={() => seekBy(1)} disabled={!meta || currentFrame >= (meta.frameCount - 1)} aria-label="Next frame">Next frame<ChevronRight size={16} /></button></div><input className="clip-master-scrubber" type="range" min="0" max={Math.max(0, (meta?.frameCount ?? 1) - 1)} value={currentFrame} onChange={(event) => setFrame(Number(event.target.value))} aria-label="Frame timeline" disabled={!meta} /><div className="clip-master-range-fields"><label>Start Frame<input type="number" min="0" max={Math.max(0, (meta?.frameCount ?? 1) - 1)} value={startFrame} onChange={(event) => updateStartFrame(Number(event.target.value))} /></label><button className="secondary-button" onClick={setStart} disabled={!meta}>Set current as Start</button><label>End Frame<input type="number" min="0" max={Math.max(0, (meta?.frameCount ?? 1) - 1)} value={endFrame} onChange={(event) => updateEndFrame(Number(event.target.value))} /></label><button className="secondary-button" onClick={setEnd} disabled={!meta}>Set current as End</button></div><div className="clip-master-range-summary"><strong>Selected range: {frameLabel(startFrame)}–{frameLabel(endFrame)}</strong><span>{selectedFrameCount.toLocaleString()} frames · {duration.toFixed(3)}s</span></div></div>
        <section className="clip-master-tools">{onUseFrame && <div className="clip-continuation"><label>Continuation destination<select value={continuationTarget} onChange={event => setContinuationTarget(event.target.value as MovieFrameTarget)}>{movieFrameTargets.filter(([target]) => target !== 'save').map(([target, label]) => <option key={target} value={target}>{label}</option>)}</select></label><button className="secondary-button" disabled={!meta || !!busy} onClick={() => void continueFrame()}>Use current frame for continuation</button></div>}<div className="clip-master-tool-heading"><div><strong>Frame extraction</strong><small>Frame indexes start at 0. Saved under the Clip Master default: {settings.clipMasterOutputDirectory}\\ClipMaster\\{folderName}</small></div><button className="secondary-button" onClick={saveRangeFrames} disabled={!meta || Boolean(busy)}>{busy === 'frames' ? <LoaderCircle className="spin" size={15} /> : <Image size={15} />}{busy === 'frames' ? 'Saving frames…' : 'Save Start + End'}</button></div><div className="clip-master-tool-grid"><button className="secondary-button" disabled={!meta || !!busy} onClick={() => void saveFrames(Array.from({ length: endFrame - startFrame + 1 }, (_, index) => ({ index: startFrame + index, role: 'frame' as const })))}>Extract marked frame range</button><button className="secondary-button" disabled={!meta || !!busy} onClick={() => void saveFrames([{ index: currentFrame, role: 'end' }])}>Save continuation frame</button><button className="secondary-button" onClick={saveCurrent} disabled={!meta || Boolean(busy)}><Download size={14} />Save current frame {frameLabel(currentFrame)}</button><button className="secondary-button" onClick={() => addBatchFrame()} disabled={!meta || Boolean(busy)}><Plus size={14} />Add current to batch</button><label className="clip-master-batch-input">Frame #<input type="number" min="0" max={Math.max(0, (meta?.frameCount ?? 1) - 1)} value={batchInput} onChange={(event) => setBatchInput(event.target.value)} placeholder="e.g. 195" disabled={!meta || Boolean(busy)} /><button className="secondary-button" onClick={() => { addBatchFrame(Number(batchInput)); setBatchInput('') }} disabled={!batchInput || !meta || Boolean(busy)} aria-label="Add typed frame to batch"><Plus size={13} /></button></label><button className="primary-button" onClick={() => void saveBatch()} disabled={!batchFrames.length || Boolean(busy)}><Save size={14} />Save {batchFrames.length} selected frame{batchFrames.length === 1 ? '' : 's'}</button></div>{batchFrames.length > 0 && <div className="clip-master-batch-list" aria-label="Frames selected for extraction">{batchFrames.map((frame) => <button key={frame} className="chip" onClick={() => removeBatchFrame(frame)} title="Remove from batch">Frame {frameLabel(frame)} ×</button>)}</div>}</section>
        <section className="clip-master-export"><div><strong>Export New Clip</strong><small>Exact frame trim · opens a save dialog · defaults to a versioned name in the Clip Master video folder.</small><dl className="clip-master-export-plan"><div><dt>Range</dt><dd>{frameLabel(startFrame)}–{frameLabel(endFrame)} · {selectedFrameCount.toLocaleString()} frames</dd></div><div><dt>Timeline</dt><dd>{duration.toFixed(3)}s · {meta?.fps.toFixed(3) ?? '—'} fps CFR</dd></div><div><dt>Audio</dt><dd>Trimmed and re-encoded with the selected picture range</dd></div></dl></div><button className="primary-button" onClick={() => void exportClip()} disabled={!meta || Boolean(busy) || endFrame < startFrame}>{busy === 'export' ? <LoaderCircle className="spin" size={15} /> : <Scissors size={15} />}{busy === 'export' ? 'Exporting…' : exportError ? 'Retry export' : 'Export New Clip'}</button>{exportError && <div className="clip-master-error clip-master-export-error" role="alert"><strong>Export did not complete.</strong><span>{exportError}</span><small>The temporary failed output was removed. Choose a destination and retry; your source clip and frame marks are unchanged.</small></div>}</section>
        {(outputFolder || savedFrames.length > 0 || exportResult) && <section className="clip-master-results"><header><div><strong>Saved outputs</strong><small>{outputFolder}</small></div><button className="secondary-button" onClick={() => void window.minimax.showOutput(outputFolder)} disabled={!outputFolder}><FolderOpen size={14} />Open Folder</button></header>{exportResult && <div className="clip-master-confirmation"><Check size={18} /><div><strong>{exportResult.name}</strong><span>Frames {frameLabel(exportResult.startFrame)}–{frameLabel(exportResult.endFrame)} · {exportResult.frameCount.toLocaleString()} frames · {exportResult.duration.toFixed(3)}s · {exportResult.width} × {exportResult.height} · {exportResult.fps.toFixed(3)} fps</span><small>{exportResult.path}</small><ReliableVideo src={exportResult.url} controls preload="metadata" aria-label={`Exported clip ${exportResult.name}`} /></div></div>}{savedFrames.length > 0 && <div className="clip-master-saved-files">{savedFrames.map((file) => <div key={`${file.path}-${file.index}-${file.role}`}><img src={file.preview} alt="" /><span><strong>{file.name}</strong><small>Frame {frameLabel(file.index)} · {file.path}</small></span></div>)}</div>}</section>}
      </div>
      <footer className="clip-master-footer"><span>Exact frame controls are synchronized to the detected {meta?.fps ? `${meta.fps.toFixed(3)} fps` : 'video'} timeline.</span><button className="secondary-button" onClick={onClose}>Done</button></footer>
    </section>
  </div>
}


type Segment = { id: string; clip: ClipItem; start?: number; end?: number; meta?: VideoMeta; included: boolean }
export function ClipMasterBeta({ clip, settings, onClose, onNotice, onExportClip, onUseFrame, jobs = [] }: { onUseFrame?(file: MediaFile, target: MovieFrameTarget): void; jobs?: GenerationJob[]; clip?: ClipItem; settings: AppSettings; onClose(): void; onNotice(tone: 'error' | 'success' | 'neutral', text: string): void; onExportClip?(clip: ClipItem): void }) {
 const [segments, setSegments] = useState<Segment[]>(clip ? [{ id: createId(), clip, included: true }] : [])
 const [selected, setSelected] = useState('')
 const [busy, setBusy] = useState('')
 const active = segments.find(item => item.id === selected) || segments[0]
 const onRange = useCallback((start: number, end: number, meta: VideoMeta) => setSegments(items => items.map(item => item.id === active?.id && (item.start !== start || item.end !== end || !item.meta) ? { ...item, start, end, meta } : item)), [active?.id])
 const add = async () => { try { const file = await window.minimax.chooseMedia('video'); if (!file) return; const source = await window.minimax.mediaUrl(file.path); const meta = await window.minimax.getVideoMetadata(source, settings.ffmpegPath); const id = createId(); setSegments(items => [...items, { id, clip: { id, name: file.name, source, createdAt: Date.now() }, start: 0, end: meta.frameCount - 1, meta, included: true }]); setSelected(id) } catch (error) { onNotice('error', String(error)) } }
 const split = (frame: number) => { if (!active || active.start === undefined || active.end === undefined || frame <= active.start || frame > active.end) return; const id = createId(); setSegments(items => items.flatMap(item => item.id === active.id ? [{ ...item, id: createId(), end: frame - 1 }, { ...item, id, start: frame }] : [item])); setSelected(id) }
 const move = (direction: number) => { const index = segments.indexOf(active); const next = index + direction; if (next < 0 || next >= segments.length) return; setSegments(items => { const result = [...items]; [result[index], result[next]] = [result[next], result[index]]; return result }) }
 const splice = async () => { const chosen = segments.filter(item => item.included); if (!chosen.length || chosen.some(item => !item.meta)) return; setBusy('Preparing exact frame segments'); try { const result = await window.minimax.spliceClipMaster(chosen.map(item => ({ source: item.clip.source, startFrame: item.start!, endFrame: item.end! })), settings.clipMasterOutputDirectory, settings.ffmpegPath); onNotice('success', `Sequence exported: ${result.path}`); onExportClip?.({ id: createId(), name: 'Clip Master sequence', source: result.url, createdAt: Date.now(), mediaKind: 'video' }); await window.minimax.showOutput(result.path) } catch (error) { onNotice('error', `Splice failed: ${String(error)}`) } finally { setBusy('') } }
 return <div className="clip-master-workspace"><header className="clip-workspace-heading"><div><span className="eyebrow">EDIT / ASSEMBLE / EXTRACT</span><h1>Clip Master</h1></div><div><select aria-label="Add completed render" value="" disabled={!!busy} onChange={event => { const job = jobs.find(item => item.id === event.target.value); if (!job?.outputUrl) return; const id = createId(); setSegments(items => [...items, { id, clip: { id, name: job.prompt.slice(0, 60) || 'Render', source: job.outputUrl!, createdAt: job.createdAt }, included: true }]); setSelected(id) }}><option value="">Add completed render…</option>{jobs.filter(job => job.status === 'completed' && job.outputUrl && (job.mediaType ?? 'video') === 'video').map(job => <option key={job.id} value={job.id}>{job.prompt.slice(0, 60) || 'Render'}</option>)}</select><StudioButton onClick={() => void add()} disabled={!!busy}><Plus size={15}/>Add source</StudioButton><StudioButton tone="primary" disabled={!!busy || !segments.some(item => item.included) || segments.some(item => item.included && !item.meta)} onClick={() => void splice()}>Export selected sequence</StudioButton><StudioButton onClick={onClose} disabled={!!busy}>Close editor</StudioButton></div></header>{busy && <ProductionLoading label={busy}/>}
 {!active && <EmptyState title="Build your sequence"><p>Add a source video or completed render to begin trimming, splitting, and extracting frames.</p><StudioButton onClick={() => void add()}>Choose video</StudioButton></EmptyState>}
 {active && <ClipSegmentEditor key={active.id} clip={active.clip} settings={settings} onClose={onClose} onNotice={onNotice} onExportClip={onExportClip} onUseFrame={onUseFrame} initialRange={active.start === undefined ? undefined : { start: active.start, end: active.end! }} onRange={onRange} onSplit={split}/>}
 <WorkspacePanel title={`Sequence · ${segments.length} segments`} className="clip-strip-panel" actions={<><StudioButton onClick={() => move(-1)} disabled={!!busy || segments.indexOf(active) <= 0}>Move left</StudioButton><StudioButton onClick={() => move(1)} disabled={!!busy || segments.indexOf(active) === segments.length - 1}>Move right</StudioButton><StudioButton disabled={!!busy || !active} onClick={() => { const id = createId(); setSegments(items => [...items.slice(0, items.indexOf(active) + 1), { ...active, id }, ...items.slice(items.indexOf(active) + 1)]); setSelected(id) }}>Duplicate</StudioButton><StudioButton tone="danger" disabled={!!busy || !active} onClick={() => { setSegments(items => items.filter(item => item.id !== active.id)); setSelected('') }}>Remove</StudioButton></>}><div className="clip-segment-strip">{segments.map((item, index) => <article key={item.id} className={item.id === active?.id ? 'selected' : ''}><button disabled={!!busy} onClick={() => setSelected(item.id)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.clip.name}</strong><small>{item.meta ? `${item.start}–${item.end} · ${((item.end! - item.start! + 1) / item.meta.fps).toFixed(3)}s` : 'Select to inspect'}</small></button><label><input type="checkbox" checked={item.included} disabled={!!busy} onChange={event => setSegments(items => items.map(segment => segment.id === item.id ? { ...segment, included: event.target.checked } : segment))}/>Include in export</label></article>)}</div></WorkspacePanel><small>← / → Step one frame · Space Play / pause · Frame ranges are inclusive · Sources remain unchanged</small></div>
}
