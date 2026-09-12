import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, CircleStop, Dices, Film, ImagePlus, LoaderCircle, Palette, WandSparkles } from 'lucide-react'
import { buildCheckpointImage } from '../lib/checkpointImage'
import { buildAnima } from '../lib/anima'
import { choices, type ObjectInfo } from '../lib/comfyInfo'
import { RenderSize } from './RenderSize'
import type { MediaFile } from '../types'

type ModelType = 'anima' | 'checkpoint'

type StoredWorkspace = {
  modelType: ModelType
  prompt: string
  negativePrompt: string
  resolution: string
  checkpoint: string
  unetName: string
  clipName: string
  vaeName: string
  samplerName: string
  scheduler: string
  seed: number
  steps: number
  cfg: number
  clipSkip: number
}

const animaDefaults = { steps: 30, cfg: 4, samplerName: 'er_sde', scheduler: 'simple', negativePrompt: 'worst quality, low quality, score_1, score_2, score_3, blurry, jpeg artifacts, sepia' }
const checkpointDefaults = { steps: 28, cfg: 7, samplerName: 'euler_ancestral', scheduler: 'normal', negativePrompt: 'lowres, bad anatomy, bad hands, extra digits, worst quality, low quality, jpeg artifacts, blurry' }

const defaults: StoredWorkspace = {
  modelType: 'anima',
  prompt: '',
  negativePrompt: animaDefaults.negativePrompt,
  resolution: '1024x1024',
  checkpoint: '',
  unetName: '',
  clipName: '',
  vaeName: '',
  samplerName: animaDefaults.samplerName,
  scheduler: animaDefaults.scheduler,
  seed: Math.floor(Math.random() * 1_000_000_000),
  steps: animaDefaults.steps,
  cfg: animaDefaults.cfg,
  clipSkip: 1,
}

function readWorkspace(): StoredWorkspace {
  try {
    const saved = JSON.parse(localStorage.getItem('anime.workspace') ?? '{}') as Partial<StoredWorkspace>
    return { ...defaults, ...saved, modelType: saved.modelType === 'checkpoint' ? 'checkpoint' : 'anima' }
  }
  catch { return defaults }
}

export function AnimeWorkspace({
  url, info, connected, ollamaAvailable, llmProvider, ollamaUrl, ollamaModel, outputDirectory, onUse, onUseLtx,
}: {
  url: string
  info: ObjectInfo
  connected: boolean
  ollamaAvailable: boolean
  llmProvider: 'ollama' | 'lmstudio'
  ollamaUrl: string
  ollamaModel: string
  outputDirectory: string
  onUse(file: MediaFile, resolution: string): void
  onUseLtx(file: MediaFile): void
}) {
  const initial = useMemo(readWorkspace, [])
  const [modelType, setModelType] = useState<ModelType>(initial.modelType)
  const [prompt, setPrompt] = useState(initial.prompt)
  const [negativePrompt, setNegativePrompt] = useState(initial.negativePrompt)
  const [resolution, setResolution] = useState(initial.resolution)
  const [checkpoint, setCheckpoint] = useState(initial.checkpoint)
  const [unetName, setUnetName] = useState(initial.unetName)
  const [clipName, setClipName] = useState(initial.clipName)
  const [vaeName, setVaeName] = useState(initial.vaeName)
  const [samplerName, setSamplerName] = useState(initial.samplerName)
  const [scheduler, setScheduler] = useState(initial.scheduler)
  const [seed, setSeed] = useState(initial.seed)
  const [steps, setSteps] = useState(initial.steps)
  const [cfg, setCfg] = useState(initial.cfg)
  const [clipSkip, setClipSkip] = useState(initial.clipSkip)
  const [job, setJob] = useState<{ id: string; url: string } | null>(null)
  const [result, setResult] = useState<MediaFile | null>(null)
  const [busy, setBusy] = useState(false)
  const [assisting, setAssisting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)

  const installedCheckpoints = choices(info, 'CheckpointLoaderSimple', 'ckpt_name')
  const installedUnets = choices(info, 'UNETLoader', 'unet_name')
  const installedClips = choices(info, 'CLIPLoader', 'clip_name')
  const installedVaes = choices(info, 'VAELoader', 'vae_name')
  const installedSamplers = choices(info, 'KSampler', 'sampler_name')
  const installedSchedulers = choices(info, 'KSampler', 'scheduler')

  useEffect(() => {
    if (!checkpoint && installedCheckpoints.length) setCheckpoint(installedCheckpoints[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installedCheckpoints.join('|')])

  useEffect(() => {
    if (!installedUnets.length) return
    const preferred = installedUnets.find((name) => /anima.?2\.?9b/i.test(name))
    const autoPicked = !unetName || unetName === 'anima-base-v1.0.safetensors' || unetName === 'cappixel_turboV01.safetensors'
    if (preferred && autoPicked && unetName !== preferred) { setUnetName(preferred); return }
    if (!unetName) setUnetName(installedUnets.find((name) => /anima|cappixel/i.test(name)) ?? installedUnets[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installedUnets.join('|')])

  useEffect(() => {
    if (!clipName && installedClips.length) setClipName(installedClips.find((name) => /qwen_3_06b|qwen_3_600m|qwen3_06b/i.test(name)) ?? installedClips[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installedClips.join('|')])

  // buildAnima() (the only consumer of clipName) expects the small Qwen3-0.6B
  // text encoder — Anima and its CapPixel/hakushi-mix merges share that hidden
  // size. Any other CLIP (e.g. MiniMax H3's 32B Qwen3-VL encoder) is a hard
  // KSampler crash (mismatched conditioning tensor shape). Warn instead of
  // silently overriding a deliberate choice — someone may be testing a
  // different encoder on purpose.
  const clipLikelyIncompatible = Boolean(clipName) && !/qwen_3_06b|qwen_3_600m|qwen3_06b/i.test(clipName)

  useEffect(() => {
    if (!vaeName && installedVaes.length) setVaeName(installedVaes.find((name) => /qwen_image_vae/i.test(name)) ?? installedVaes[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installedVaes.join('|')])

  useEffect(() => {
    const loadPrompt = (event: Event) => {
      const value = (event as CustomEvent<string>).detail
      if (value?.trim()) { setPrompt(value.trim()); setMessage('Image prompt loaded from Studio copilot.'); setError(false) }
    }
    window.addEventListener('minimax:load-image-prompt', loadPrompt)
    return () => window.removeEventListener('minimax:load-image-prompt', loadPrompt)
  }, [])

  useEffect(() => {
    localStorage.setItem('anime.workspace', JSON.stringify({ modelType, prompt, negativePrompt, resolution, checkpoint, unetName, clipName, vaeName, samplerName, scheduler, seed, steps, cfg, clipSkip }))
  }, [checkpoint, cfg, clipName, clipSkip, modelType, negativePrompt, prompt, resolution, samplerName, scheduler, seed, steps, unetName, vaeName])

  useEffect(() => {
    if (!job) return
    let disposed = false
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const history = await window.minimax.getHistory(job.url, job.id)
        const entry = history[job.id] as { status?: { status_str: string }; outputs?: Record<string, { images?: Array<{ filename: string; subfolder?: string; type?: string }> }> } | undefined
        if (entry?.status?.status_str === 'error') throw new Error('Generation failed. Check the selected model components and ComfyUI log.')
        const image = Object.values(entry?.outputs ?? {}).flatMap((output) => output.images ?? [])[0]
        if (image) {
          const preview = await window.minimax.getOutputImage(job.url, image)
          const saved = await window.minimax.saveComfyOutputImage(job.url, image, outputDirectory)
          if (!disposed) {
            setResult({ ...saved, preview, kind: 'image' })
            setJob(null); setBusy(false); setError(false); setMessage('Image complete and ready to use.')
          }
          return
        }
        if (!disposed) setMessage('Rendering the image in ComfyUI…')
      } catch (caught) {
        if (!disposed) { setMessage(caught instanceof Error ? caught.message : String(caught)); setError(true); setBusy(false); setJob(null) }
        return
      }
      if (!disposed) timer = setTimeout(poll, 2000)
    }
    void poll()
    return () => { disposed = true; clearTimeout(timer) }
  }, [job, outputDirectory])

  const switchModelType = (next: ModelType) => {
    if (busy || next === modelType) return
    setModelType(next)
    const preset = next === 'anima' ? animaDefaults : checkpointDefaults
    setSteps(preset.steps); setCfg(preset.cfg); setSamplerName(preset.samplerName); setScheduler(preset.scheduler); setNegativePrompt(preset.negativePrompt)
    setMessage(next === 'anima' ? 'Anima (split UNet + CLIP + VAE) selected.' : 'Single-file checkpoint selected.')
    setError(false)
  }

  const available = modelType === 'checkpoint'
    ? Boolean(checkpoint) && installedCheckpoints.includes(checkpoint) && (installedSamplers.length === 0 || installedSamplers.includes(samplerName)) && (installedSchedulers.length === 0 || installedSchedulers.includes(scheduler))
    : Boolean(unetName) && installedUnets.includes(unetName) && Boolean(clipName) && installedClips.includes(clipName) && Boolean(vaeName) && installedVaes.includes(vaeName)
      && (installedSamplers.length === 0 || installedSamplers.includes(samplerName)) && (installedSchedulers.length === 0 || installedSchedulers.includes(scheduler))

  const create = async () => {
    if (!connected || !available || !prompt.trim()) return
    setBusy(true); setResult(null); setError(false); setMessage(`Submitting ${modelType === 'anima' ? 'Anima' : 'checkpoint'} workflow…`)
    try {
      const [width, height] = resolution.split('x').map(Number)
      const workflow = modelType === 'anima'
        ? buildAnima(prompt.trim(), negativePrompt.trim(), width, height, seed, unetName, clipName, vaeName, steps, cfg, samplerName, scheduler)
        : buildCheckpointImage(prompt.trim(), negativePrompt.trim(), width, height, seed, checkpoint, steps, cfg, samplerName, scheduler, clipSkip)
      const response = await window.minimax.submitPrompt(url, workflow)
      setJob({ id: response.prompt_id, url })
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : String(caught)); setError(true); setBusy(false)
    }
  }

  const cancel = async () => {
    if (!job) return
    try {
      await window.minimax.cancelPrompt(job.url, job.id)
      setMessage('Image generation cancelled.'); setError(false)
    } catch (caught) {
      setMessage(`Could not cancel: ${caught instanceof Error ? caught.message : String(caught)}`); setError(true)
    } finally { setJob(null); setBusy(false) }
  }

  const enhance = async () => {
    if (!ollamaAvailable || !prompt.trim() || assisting) return
    setAssisting(true); setError(false); setMessage('Asking the local prompt assistant…')
    try {
      const instruction = `Rewrite this as one polished still-image prompt for an anime-style image model. Preserve the subject and intent while improving composition, character design, line art, coloring, lighting, and background detail using booru-style comma-separated tags where natural. Do not describe motion, sound, timelines, or multiple shots. Return only the finished prompt.\n\nDRAFT:\n${prompt.trim()}`
      setPrompt(await window.minimax.generateWithOllama(ollamaUrl, ollamaModel, instruction, llmProvider))
      setMessage('Prompt enhanced locally. Review it before generating.')
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : String(caught)); setError(true) }
    finally { setAssisting(false) }
  }

  return <div className="standard-page zimage-workspace">
    <div className="page-heading">
      <div><p className="eyebrow">CREATE · ANIME</p><h1>Anime &amp; Checkpoint Image</h1><p>Generate stills with Anima-family split models (Anima, CapPixel) or any single-file SD1.5/SDXL checkpoint installed in ComfyUI.</p></div>
      <div className="heading-state"><span className={connected && available ? 'ok' : 'warn'}>{connected && available ? <Check size={15} /> : <AlertCircle size={15} />}{connected ? available ? 'Model ready' : 'Choose a model' : 'Engine offline'}</span></div>
    </div>

    <div className="zimage-workspace-grid">
      <section className="zimage-composer">
        <fieldset className="zimage-mode-picker" disabled={busy}>
          <legend>Model type</legend>
          <label className={modelType === 'anima' ? 'selected' : ''}><input type="radio" name="anime-model-type" checked={modelType === 'anima'} onChange={() => switchModelType('anima')} /><Palette size={18} /><span><strong>Anima (split)</strong><small>anima-base, CapPixel and other Anima-family diffusion models · UNETLoader + CLIPLoader + VAELoader</small></span><em className={installedUnets.some((name) => /anima|cappixel/i.test(name)) ? 'installed' : ''}>{installedUnets.some((name) => /anima|cappixel/i.test(name)) ? 'Installed' : 'Model needed'}</em></label>
          <label className={modelType === 'checkpoint' ? 'selected' : ''}><input type="radio" name="anime-model-type" checked={modelType === 'checkpoint'} onChange={() => switchModelType('checkpoint')} /><ImagePlus size={18} /><span><strong>Checkpoint</strong><small>Single-file SD1.5/SDXL checkpoints (e.g. RealVisXL) · CheckpointLoaderSimple</small></span><em className={installedCheckpoints.length ? 'installed' : ''}>{installedCheckpoints.length ? 'Installed' : 'Model needed'}</em></label>
        </fieldset>

        {modelType === 'checkpoint' ? <div className="field-group">
          <div className="field-label"><label htmlFor="anime-checkpoint">Checkpoint model</label><span>{installedCheckpoints.length} installed</span></div>
          <select id="anime-checkpoint" value={checkpoint} disabled={busy} onChange={(event) => setCheckpoint(event.target.value)}>
            {!installedCheckpoints.length && <option value="">No checkpoints found — install one in ComfyUI's models/checkpoints folder</option>}
            {checkpoint && !installedCheckpoints.includes(checkpoint) && <option value={checkpoint}>{checkpoint} · unavailable</option>}
            {installedCheckpoints.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div> : <div className="zimage-models anime-split-models">
          <label>Diffusion model<select value={unetName} disabled={busy} onChange={(event) => setUnetName(event.target.value)}>
            {!installedUnets.length && <option value="">No diffusion models found in models/diffusion_models</option>}
            {unetName && !installedUnets.includes(unetName) && <option value={unetName}>{unetName} · unavailable</option>}
            {installedUnets.map((name) => <option key={name} value={name}>{name}</option>)}
          </select></label>
          <label>Text encoder<select value={clipName} disabled={busy} onChange={(event) => setClipName(event.target.value)}>
            {!installedClips.length && <option value="">No text encoders found in models/text_encoders</option>}
            {clipName && !installedClips.includes(clipName) && <option value={clipName}>{clipName} · unavailable</option>}
            {installedClips.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          {clipLikelyIncompatible && <p className="field-help upscale-warning">Anima expects the small Qwen3‑0.6B text encoder (qwen_3_06b…). This one is a different size and will likely crash the sampler with a tensor shape mismatch.</p>}
          </label>
          <label>VAE<select value={vaeName} disabled={busy} onChange={(event) => setVaeName(event.target.value)}>
            {!installedVaes.length && <option value="">No VAEs found in models/vae</option>}
            {vaeName && !installedVaes.includes(vaeName) && <option value={vaeName}>{vaeName} · unavailable</option>}
            {installedVaes.map((name) => <option key={name} value={name}>{name}</option>)}
          </select></label>
        </div>}

        <div className="field-group">
          <div className="field-label"><label htmlFor="anime-prompt">Image prompt</label><span>{prompt.length.toLocaleString()} characters</span></div>
          <textarea id="anime-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe the character, pose, expression, outfit, background, and art style. Booru-style tags work well…" disabled={busy} />
          <div className="zimage-prompt-actions"><button className="secondary-button" onClick={() => void enhance()} disabled={busy || assisting || !ollamaAvailable || !prompt.trim()} title={ollamaAvailable ? `Enhance with ${ollamaModel}` : `Configure ${llmProvider === 'lmstudio' ? 'LM Studio' : 'Ollama'} in Settings`}>{assisting ? <LoaderCircle size={15} className="spin" /> : <WandSparkles size={15} />}Enhance with {llmProvider === 'lmstudio' ? 'LM Studio' : 'Ollama'}</button><small>{ollamaAvailable ? `${ollamaModel} · local` : `${llmProvider === 'lmstudio' ? 'LM Studio' : 'Ollama'} unavailable`}</small></div>
        </div>

        <div className="field-group zimage-negative-prompt"><div className="field-label"><label htmlFor="anime-negative-prompt">Negative prompt</label><span>{negativePrompt.length.toLocaleString()} characters</span></div><textarea id="anime-negative-prompt" value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} placeholder="Describe artifacts or unwanted elements to suppress…" disabled={busy} /></div>

        <RenderSize value={resolution} onChange={setResolution} provider="zimage" />
        <div className="zimage-seed-row"><label>Seed<input type="number" min="0" max="999999999999" value={seed} disabled={busy} onChange={(event) => setSeed(Number(event.target.value))} /></label><button className="secondary-button" disabled={busy} onClick={() => setSeed(Math.floor(Math.random() * 1_000_000_000))}><Dices size={15} />Randomize</button></div>

        <details className="zimage-model-settings">
          <summary>Sampling settings <small>Advanced</small></summary>
          <div className="zimage-quality-controls">
            <label>Sampling steps<input type="number" min={4} max={60} value={steps} disabled={busy} onChange={(event) => setSteps(Math.max(4, Math.min(60, Number(event.target.value))))} /></label>
            <label>CFG scale<input type="number" min={1} max={15} step="0.5" value={cfg} disabled={busy} onChange={(event) => setCfg(Math.max(1, Math.min(15, Number(event.target.value))))} /></label>
            {modelType === 'checkpoint' && <label>CLIP skip<input type="number" min={1} max={4} value={clipSkip} disabled={busy} onChange={(event) => setClipSkip(Math.max(1, Math.min(4, Number(event.target.value))))} /></label>}
          </div>
          {modelType === 'checkpoint' && <p className="field-help">Most anime SD1.5 checkpoints recommend CLIP skip 2. SDXL-family checkpoints (including most modern anime checkpoints) usually want CLIP skip 1.</p>}
          {modelType === 'anima' && <p className="field-help">Anima's official default is er_sde / simple, 30 steps, CFG 4. Distilled/turbo merges (e.g. CapPixel Turbo) usually look best around 8–12 steps and CFG 1 with euler_ancestral.</p>}
          <div className="zimage-models">
            <label>Sampler<select value={samplerName} disabled={busy} onChange={(event) => setSamplerName(event.target.value)}>{!installedSamplers.includes(samplerName) && <option value={samplerName}>{samplerName} · unavailable</option>}{installedSamplers.map((name) => <option key={name}>{name}</option>)}</select></label>
            <label>Scheduler<select value={scheduler} disabled={busy} onChange={(event) => setScheduler(event.target.value)}>{!installedSchedulers.includes(scheduler) && <option value={scheduler}>{scheduler} · unavailable</option>}{installedSchedulers.map((name) => <option key={name}>{name}</option>)}</select></label>
          </div>
          {!available && <p className="field-help">{modelType === 'checkpoint' ? "Choose a checkpoint registered with ComfyUI's CheckpointLoaderSimple node (models/checkpoints)." : 'Choose a diffusion model, text encoder, and VAE registered with ComfyUI (models/diffusion_models, models/text_encoders, models/vae).'}</p>}
        </details>

        {message && <div className={`zimage-message ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{busy && <LoaderCircle size={16} className="spin" />}<span>{message}</span></div>}
        <div className="zimage-generate-bar">{busy && <button className="danger-button" onClick={() => void cancel()}><CircleStop size={16} />Cancel</button>}<button className="primary-button" disabled={busy || !connected || !available || !prompt.trim()} onClick={() => void create()}>{busy ? <LoaderCircle size={18} className="spin" /> : <Palette size={18} />}{busy ? 'Creating image…' : 'Create image'}</button></div>
      </section>

      <aside className="zimage-preview-panel">
        <div className="panel-heading"><div><span>OUTPUT</span><strong>Image preview</strong></div>{result && <span className="zimage-complete"><Check size={13} />Ready</span>}</div>
        <div className="zimage-preview-stage">{result?.preview ? <img src={result.preview} alt="Generated output" /> : busy ? <div className="render-state"><LoaderCircle className="spin" /><strong>Creating your image</strong><span>{resolution.replace('x', ' × ')}</span></div> : <div className="empty-preview"><div className="preview-icon"><ImagePlus size={28} /></div><strong>Your image will appear here</strong><span>Pick a model, describe the still, and generate it locally.</span></div>}</div>
        <div className="zimage-preview-actions"><span>{result ? `${result.name} · ${resolution.replace('x', ' × ')}` : 'Saved to ComfyUI · MiniMax_first_frames'}</span><div><button className="secondary-button" disabled={!result} onClick={() => result && onUse(result, resolution)}><ImagePlus size={16} />MiniMax I2V</button><button className="primary-button" disabled={!result} onClick={() => result && onUseLtx(result)} title="Loads an identity-preserving LTX image-to-video prompt"><Film size={16} />Send to LTX 2.5</button></div></div>
      </aside>
    </div>
  </div>
}
