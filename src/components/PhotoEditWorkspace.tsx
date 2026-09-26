import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ImagePlus, LoaderCircle, RotateCcw, Sparkles, X } from 'lucide-react'
import type { MediaFile } from '../types'
import type { ObjectInfo } from '../lib/comfyInfo'
import { buildFireRedEditWorkflow, FIRE_RED_REQUIRED_NODES, inferFireRedSelection } from '../lib/fireRedEditWorkflow'
import { queuePromptState } from '../lib/comfyJobState'
import { defaultFrameResolution, resolveFrameSize, type FrameResolution, type FrameSize } from '../lib/frameResolution'
import { FrameResolutionControl } from './FrameResolutionControl'
import './photo-edit.css'

const storageKey = 'oyama.photo-edit.workspace.v1'
type EditJob = { id: string; url: string }
type Draft = { source: MediaFile | null; references: MediaFile[]; prompt: string; seed: number; mode: 'turbo' | 'quality'; resolution: FrameResolution; result: MediaFile | null; job: EditJob | null }
type HistoryEntry = { status?: { status_str?: string }; outputs?: Record<string, { images?: Array<{ filename: string; subfolder?: string; type?: string }> }> }

function readDraft(): Draft {
  const fresh: Draft = { source: null, references: [], prompt: '', seed: Math.floor(Math.random() * 1_000_000_000), mode: 'turbo', resolution: defaultFrameResolution, result: null, job: null }
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Partial<Draft>
    return { ...fresh, ...saved, references: Array.isArray(saved.references) ? saved.references.filter((file): file is MediaFile => typeof file?.path === 'string' && Boolean(file.path)).slice(0, 2) : [], resolution: saved.resolution?.mode ? saved.resolution : defaultFrameResolution, mode: saved.mode === 'quality' ? 'quality' : 'turbo', source: saved.source?.path ? saved.source : null, result: saved.result?.path ? saved.result : null, job: saved.job?.id && saved.job.url ? saved.job : null }
  } catch { return fresh }
}

function ReferenceImage({ file, number, disabled, onReplace, onRemove }: { file: MediaFile; number: number; disabled: boolean; onReplace(): void; onRemove(): void }) {
  const [preview, setPreview] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    setPreview(''); setFailed(false)
    window.minimax.mediaUrl(file.path).then(value => { if (active) setPreview(value) }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [file.path])
  return <div className="photo-edit-reference">
    <div className="photo-edit-reference-preview">{preview && !failed ? <img src={preview} alt={`Image ${number} reference`} onError={() => setFailed(true)}/> : <ImagePlus size={24} aria-hidden="true"/>}</div>
    <div className="photo-edit-reference-detail"><strong>Image {number} · Reference</strong><span title={file.path}>{file.name}</span>{failed && <small role="alert">Cannot open this image. Replace it before rendering.</small>}</div>
    <div className="photo-edit-reference-actions"><button type="button" onClick={onReplace} disabled={disabled}>Replace</button><button type="button" onClick={onRemove} disabled={disabled} aria-label={`Remove Image ${number} reference`}><X size={15}/></button></div>
  </div>
}

export function PhotoEditWorkspace({ url, info, connected, outputDirectory, incomingSource, onConsumeIncoming, onUseRipple, onOpenRipple }: {
  url: string
  info: ObjectInfo
  connected: boolean
  outputDirectory: string
  incomingSource: { file: MediaFile; size: FrameSize } | null
  onConsumeIncoming(): void
  onUseRipple(file: MediaFile, size: FrameSize): void
  onOpenRipple(): void
}) {
  const initial = useMemo(readDraft, [])
  const [source, setSource] = useState<MediaFile | null>(incomingSource?.file ?? initial.source)
  const [references, setReferences] = useState<MediaFile[]>(initial.references)
  const [sourceSize, setSourceSize] = useState<FrameSize | null>(null)
  const [resultSize, setResultSize] = useState<FrameSize | null>(null)
  const [resolution, setResolution] = useState<FrameResolution>(incomingSource ? { mode: 'custom', ...incomingSource.size } : initial.resolution)
  const [prompt, setPrompt] = useState(initial.prompt)
  const [seed, setSeed] = useState(initial.seed)
  const [mode, setMode] = useState<'turbo' | 'quality'>(initial.mode)
  const [result, setResult] = useState<MediaFile | null>(incomingSource ? null : initial.result)
  const [job, setJob] = useState<EditJob | null>(initial.job)
  const [preparing, setPreparing] = useState(false)
  const [message, setMessage] = useState(incomingSource ? 'Ripple’s first frame is ready to edit.' : '')
  const [error, setError] = useState(false)
  const [saveProblem, setSaveProblem] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [resultUrl, setResultUrl] = useState('')
  const outputSize = resolveFrameSize(sourceSize, resolution)
  const selected = inferFireRedSelection(info)
  const missingNodes: string[] = FIRE_RED_REQUIRED_NODES.filter(node => !info[node])
  if (selected.modelLoader === 'UnetLoaderGGUF' && !info.UnetLoaderGGUF) missingNodes.push('UnetLoaderGGUF')
  if (selected.lightningLora && !info.LoraLoaderModelOnly) missingNodes.push('LoraLoaderModelOnly')
  const missing = [
    ...(!connected ? ['Connect ComfyUI in Settings.'] : []),
    ...(connected && missingNodes.length ? [`Update ComfyUI for: ${missingNodes.join(', ')}.`] : []),
    ...(connected && !selected.model ? ['Install a FireRed Image Edit transformer (GGUF or safetensors) in ComfyUI/models/diffusion_models.'] : []),
    ...(connected && !selected.encoder ? ['Install a Qwen 2.5 VL 7B text encoder in ComfyUI/models/text_encoders.'] : []),
    ...(connected && !selected.vae ? ['Install qwen_image_vae.safetensors in ComfyUI/models/vae.'] : []),
    ...(connected && mode === 'turbo' && !selected.lightningLora ? ['Turbo needs a FireRed 8-step Lightning LoRA. Choose Quality to render without it.'] : []),
  ]
  const busy = preparing || Boolean(job && !saveProblem)

  useEffect(() => { if (incomingSource) onConsumeIncoming() }, [incomingSource, onConsumeIncoming])
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ source: source ? { ...source, preview: undefined } : null, references: references.map(file => ({ ...file, preview: undefined })), prompt, seed, mode, resolution, result: result ? { ...result, preview: undefined } : null, job }))
  }, [source, references, prompt, seed, mode, resolution, result, job])
  useEffect(() => {
    let active = true
    setSourceUrl(''); setSourceSize(null)
    if (source) window.minimax.mediaUrl(source.path).then(value => { if (active) setSourceUrl(value) }).catch(reason => { if (active) { setMessage(`Source image could not be opened: ${String(reason)}`); setError(true) } })
    return () => { active = false }
  }, [source])
  useEffect(() => {
    let active = true
    setResultUrl(''); setResultSize(null)
    if (result) window.minimax.mediaUrl(result.path).then(value => { if (active) setResultUrl(value) }).catch(reason => { if (active) { setMessage(`Edited image could not be opened: ${String(reason)}`); setError(true) } })
    return () => { active = false }
  }, [result])
  useEffect(() => {
    if (!job || saveProblem) return
    let active = true
    let timer: ReturnType<typeof setTimeout>
    let missingOutputPolls = 0
    let missingJobPolls = 0
    const poll = async () => {
      try {
        const history = await window.minimax.getHistory(job.url, job.id)
        if (!active) return
        const entry = history[job.id] as HistoryEntry | undefined
        if (entry?.status?.status_str === 'error') {
          setJob(null); setMessage('FireRed failed in ComfyUI. Check its execution log and the selected model files.'); setError(true)
          return
        }
        const image = entry?.outputs?.['14']?.images?.[0]
        if (image) {
          setMessage('Saving the edited frame…')
          const saved = await window.minimax.saveComfyOutputImage(job.url, image, outputDirectory, 'photo-edit').catch(reason => {
            throw new Error(`FireRed finished, but the image could not be saved locally. Retry saving or choose the finished image from ComfyUI output. ${reason instanceof Error ? reason.message : String(reason)}`)
          })
          if (active) { setResult({ ...saved, kind: 'image' }); setJob(null); setMessage('Photo edit ready. Send it to Ripple when it looks right.'); setError(false) }
          return
        }
        if (entry?.status?.status_str === 'success') {
          missingOutputPolls += 1
          if (missingOutputPolls > 2) {
            setJob(null); setMessage('FireRed finished without a saved image. Check the SaveImage node in ComfyUI.'); setError(true)
            return
          }
          setMessage('Collecting the edited image…')
        } else if (entry) {
          missingJobPolls = 0
          setMessage('FireRed is editing the photo in ComfyUI…')
        } else {
          const queue = await window.minimax.getQueue(job.url)
          if (!active) return
          const state = queuePromptState(queue, job.id)
          if (state) missingJobPolls = 0
          else missingJobPolls += 1
          if (missingJobPolls >= 5) {
            setJob(null); setMessage('ComfyUI no longer has this edit. Choose its image from ComfyUI output, or render again.'); setError(true)
            return
          }
          setMessage(state === 'queued' ? 'FireRed edit is queued in ComfyUI…' : state === 'running' ? 'FireRed is editing the photo in ComfyUI…' : 'Checking the FireRed edit in ComfyUI…')
        }
      } catch (reason) {
        if (active) {
          const problem = reason instanceof Error ? reason.message : String(reason)
          if (problem.startsWith('FireRed finished, but')) { setSaveProblem(problem); setMessage(problem); setError(true); return }
          setMessage('ComfyUI connection lost. Waiting to reconnect and recover this edit…'); setError(false)
        }
      }
      if (active) timer = setTimeout(poll, 2000)
    }
    void poll()
    return () => { active = false; clearTimeout(timer) }
  }, [job, outputDirectory, saveProblem])

  const chooseSource = async () => {
    try {
      const picked = await window.minimax.chooseMedia('image')
      if (!picked) return
      setSource({ ...picked, kind: 'image' }); setResult(null); setJob(null); setSaveProblem(''); setMessage('Source image ready. Describe the change you want.'); setError(false)
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); setError(true) }
  }
  const chooseReference = async (index: number) => {
    try {
      const picked = await window.minimax.chooseMedia('image')
      if (!picked) return
      setReferences(current => {
        const next = [...current]
        next[index] = { ...picked, kind: 'image' }
        return next.slice(0, 2)
      })
      setResult(null); setMessage(`Image ${index + 2} reference ready. Refer to it by number in your edit instruction.`); setError(false)
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); setError(true) }
  }
  const removeReference = (index: number) => {
    setReferences(current => current.filter((_, at) => at !== index))
    setResult(null)
    setMessage('Reference removed. Review the image numbers in your instruction before rendering again.')
    setError(false)
  }
  const render = async () => {
    if (!source || !outputSize || !prompt.trim() || missing.length || job || preparing) return
    setPreparing(true); setResult(null); setMessage('Uploading the source image…'); setError(false)
    try {
      const uploaded = await window.minimax.uploadInput(url, source.path)
      const uploadedReferences = []
      for (const [index, reference] of references.entries()) {
        setMessage(`Uploading Image ${index + 2} reference…`)
        uploadedReferences.push(await window.minimax.uploadInput(url, reference.path))
      }
      const graph = buildFireRedEditWorkflow(uploaded, prompt, seed, selected, mode, outputSize, uploadedReferences)
      const response = await window.minimax.submitPrompt(url, graph)
      setJob({ id: response.prompt_id, url })
      setMessage('FireRed edit queued in ComfyUI…')
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); setError(true) }
    finally { setPreparing(false) }
  }
  const cancel = async () => {
    if (!job) return
    if (saveProblem) { setJob(null); setSaveProblem(''); setMessage('Save retry dismissed. The finished image remains in ComfyUI output.'); setError(false); return }
    try { await window.minimax.cancelPrompt(job.url, job.id); setJob(null); setMessage('Photo edit cancelled.'); setError(false) }
    catch (reason) { setMessage(`Could not cancel: ${reason instanceof Error ? reason.message : String(reason)}`); setError(true) }
  }
  const chooseExistingResult = async () => {
    try {
      const picked = await window.minimax.chooseMedia('image')
      if (!picked) return
      setResult({ ...picked, kind: 'image' }); setJob(null); setSaveProblem(''); setMessage('Edited image ready to send to Ripple.'); setError(false)
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); setError(true) }
  }
  const reset = () => { setSource(null); setReferences([]); setPrompt(''); setMode('turbo'); setResolution(defaultFrameResolution); setResult(null); setJob(null); setSaveProblem(''); setSeed(Math.floor(Math.random() * 1_000_000_000)); setMessage('Photo edit cleared.'); setError(false) }

  return <div className="photo-edit-workspace">
    <header className="photo-edit-heading"><div><span className="photo-edit-eyebrow">CREATE · FIRERED IMAGE EDIT</span><h1>Photo Edit</h1><p>Start with a photo, describe one change, then use the result as Ripple’s replacement frame.</p></div><button type="button" className="photo-edit-reset" onClick={reset} disabled={busy}><RotateCcw size={15}/>Reset</button></header>
    <div className="photo-edit-grid">
      <div className="photo-edit-left">
        <section className="photo-edit-card"><div className="photo-edit-card-heading"><span>01</span><div><h2>Image 1 · Source photo</h2><p>The frame you want to change.</p></div></div><button className="photo-edit-image-picker" type="button" onClick={() => void chooseSource()} disabled={busy}>{sourceUrl ? <img src={sourceUrl} alt="Image 1 source photo for FireRed edit" onLoad={event => setSourceSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}/> : <span><ImagePlus size={31}/><strong>Choose a photo</strong><small>Or send frame 0 from Ripple</small></span>}</button>{source && <div className="photo-edit-file"><span title={source.path}>{source.name}</span><button type="button" onClick={() => void chooseSource()} disabled={busy}>Replace</button></div>}<FrameResolutionControl source={sourceSize} value={resolution} onChange={setResolution} disabled={busy}/></section>
        <section className="photo-edit-card"><div className="photo-edit-card-heading"><span>02</span><div><h2>References &amp; edit</h2><p>Image 1 is the source above. Add up to two references for identity, clothing, objects, or style.</p></div></div>
          <div className="photo-edit-references" aria-label="FireRed reference images">
            {references.map((file, index) => <ReferenceImage key={`${index}-${file.path}`} file={file} number={index + 2} disabled={busy} onReplace={() => void chooseReference(index)} onRemove={() => removeReference(index)}/>)}
            {references.length < 2 && <button type="button" className="photo-edit-add-reference" onClick={() => void chooseReference(references.length)} disabled={busy}><ImagePlus size={17}/>Add Image {references.length + 2} reference <span>Optional</span></button>}
          </div>
          <label className="photo-edit-prompt" htmlFor="fire-red-prompt">What should change?<textarea id="fire-red-prompt" value={prompt} onChange={event => setPrompt(event.target.value)} rows={5} disabled={busy} placeholder="Keep Image 1's pose and background. Use the jacket from Image 2 and the hat from Image 3." /></label><small className="photo-edit-hint">Refer to Image 1, Image 2, and Image 3 by number. Image 1 sets the output framing and resolution.</small></section>
      </div>
      <div className="photo-edit-right">
        <section className="photo-edit-card photo-edit-result">
          <div className="photo-edit-card-heading"><span>03</span><div><h2>Edited frame</h2><p>Review it before sending it to Ripple.</p></div></div>
          <div className="photo-edit-result-stage">{resultUrl ? <img src={resultUrl} alt="FireRed edited frame" onLoad={event => setResultSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}/> : busy ? <div className="photo-edit-placeholder" role="status"><LoaderCircle className="photo-edit-spin" size={30}/><strong>{message || 'Editing in ComfyUI…'}</strong></div> : <div className="photo-edit-placeholder"><Sparkles size={30}/><strong>Your edited photo appears here</strong><span>Choose a source and describe the change.</span><button type="button" className="photo-edit-secondary" onClick={() => void chooseExistingResult()}>Choose existing edited image</button></div>}</div>
          {result && resultUrl && <div className="photo-edit-result-actions"><span className="photo-edit-result-size">{resultSize ? `${resultSize.width} × ${resultSize.height}` : 'Reading image size…'}</span><a href={resultUrl} download={result.name} className="photo-edit-secondary">Save image</a><button type="button" className="photo-edit-use" disabled={!resultSize} onClick={() => { if (resultSize) onUseRipple(result, resultSize) }}><Check size={16}/>Use as Ripple replacement<ArrowRight size={16}/></button></div>}
        </section>
        <section className="photo-edit-card photo-edit-run">
          <div className="photo-edit-engine"><span className={missing.length ? 'photo-edit-engine-dot missing' : 'photo-edit-engine-dot'} /><span>{missing.length ? 'Setup needed' : `FireRed ready · ${mode === 'turbo' ? '8-step Turbo' : '40-step Quality'}`}</span></div>
          <fieldset className="photo-edit-mode" disabled={busy}><legend>Render mode</legend><label className={mode === 'turbo' ? 'selected' : ''}><input type="radio" name="photo-edit-mode" checked={mode === 'turbo'} onChange={() => setMode('turbo')}/>Turbo <small>8 steps · Lightning LoRA</small></label><label className={mode === 'quality' ? 'selected' : ''}><input type="radio" name="photo-edit-mode" checked={mode === 'quality'} onChange={() => setMode('quality')}/>Quality <small>40 steps · no LoRA</small></label></fieldset>
          {missing.length > 0 && <div className="photo-edit-setup" role="status">{missing.map(item => <p key={item}>{item}</p>)}<a href="https://huggingface.co/FireRedTeam/FireRed-Image-Edit-1.1-ComfyUI" target="_blank" rel="noreferrer">Get official FireRed models <ArrowRight size={13}/></a></div>}
          {message && <p className={error ? 'photo-edit-message error' : 'photo-edit-message'} role={error ? 'alert' : 'status'} aria-live="polite">{message}</p>}
          <div className="photo-edit-run-actions"><button type="button" className="photo-edit-generate" onClick={() => void render()} disabled={Boolean(job) || preparing || !source || !outputSize || !prompt.trim() || missing.length > 0}>{busy ? <LoaderCircle className="photo-edit-spin" size={17}/> : <Sparkles size={17}/>} {busy ? 'Editing photo…' : 'Edit photo'}</button>{saveProblem && <button type="button" className="photo-edit-secondary" onClick={() => { setSaveProblem(''); setMessage('Retrying the save…'); setError(false) }}>Retry save</button>}{job && <button type="button" className="photo-edit-secondary" onClick={() => void cancel()}><X size={15}/>{saveProblem ? 'Dismiss' : 'Cancel'}</button>}</div>
          <button type="button" className="photo-edit-back" onClick={onOpenRipple}><ArrowLeft size={15}/>Back to Ripple</button>
        </section>
      </div>
    </div>
  </div>
}
