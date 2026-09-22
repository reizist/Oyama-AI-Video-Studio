import { useEffect, useState } from 'react'
import { createId } from './createId'

export type LiveProgress = { progress?: number; label: string; currentStep?: number; totalSteps?: number; samplerPass?: 'first' | 'refine' }
export type LivePreview = {
  promptId: string
  url: string
  mime: string
  animated: boolean
  fps?: number
  step?: number
  totalSteps?: number
}

function previewBlob(base64: string, mime: string) {
  const binary = atob(base64.replace(/^data:[^,]*,/, '').replace(/\s/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mime })
}

function binaryPreviewImage(data: ArrayBuffer) {
  const bytes = new Uint8Array(data)
  const header = new DataView(data)
  // H3's motion override carries a 32-byte envelope around each JPEG frame.
  if (bytes.length > 34 && header.getUint32(4) === 1 && header.getUint32(8) === 1 && bytes[32] === 0xff && bytes[33] === 0xd8) {
    return { offset: 32, mime: 'image/jpeg', animated: true }
  }
  // ComfyUI's normal sampler frame starts after its 8-byte envelope. KJNodes'
  // LTX override adds frame and node metadata before the JPEG, so identify the
  // image itself instead of assuming one particular envelope length.
  for (let offset = 0; offset <= Math.min(64, bytes.length - 2); offset += 1) {
    if (bytes[offset] === 0xff && bytes[offset + 1] === 0xd8) return { offset, mime: 'image/jpeg', animated: false }
    if (offset <= bytes.length - 8 && bytes[offset] === 0x89 && bytes[offset + 1] === 0x50 && bytes[offset + 2] === 0x4e && bytes[offset + 3] === 0x47) return { offset, mime: 'image/png', animated: false }
    if (offset <= bytes.length - 12 && bytes[offset] === 0x52 && bytes[offset + 1] === 0x49 && bytes[offset + 2] === 0x46 && bytes[offset + 3] === 0x46 && bytes[offset + 8] === 0x57 && bytes[offset + 9] === 0x45 && bytes[offset + 10] === 0x42 && bytes[offset + 11] === 0x50) return { offset, mime: 'image/webp', animated: true }
  }
  return null
}

function nodeStageLabel(node: string) {
  const h3Stages: Record<string, string> = {
    '161': 'Preparing motion context',
    '170': 'Loading source video for continuation',
    '1701': 'Loading source audio for continuation',
    '171': 'Trimming continuity overlap',
    '172': 'Merging source and new beat',
    '173': 'Encoding new beat',
    '174': 'Saving new beat',
    '190': 'Saving reusable motion context',
  }
  if (h3Stages[node]) return h3Stages[node]
  if (/^UNETLoader$/i.test(node)) return 'Loading diffusion model'
  if (/^(CLIPLoader|DualCLIPLoader)$/i.test(node)) return 'Loading text encoder'
  if (/ModelAttentionBackend/i.test(node)) return 'Applying attention backend'
  if (/LoraLoader/i.test(node)) return 'Applying LoRA adapters'
  if (/MiniMaxH3.*(?:Reference|Image)ToVideo/i.test(node)) return 'Preparing H3 conditioning and references'
  if (/SamplerCustomAdvanced|KSampler$/i.test(node)) return 'Starting sampler'
  if (/VAEDecode/i.test(node)) return 'Decoding video frames'
  if (/CreateVideo/i.test(node)) return 'Encoding video and audio'
  if (/Save(?:Video|Image|Audio)/i.test(node)) return 'Saving output'
  return `Processing ${node}`
}

export function useLivePreview(url: string | undefined, enabled: boolean, onProgress: (id: string, update: LiveProgress) => void) {
  const [clientId] = useState(createId)
  const [preview, setPreview] = useState<LivePreview | null>(null)
  const [connected, setConnected] = useState(false)
  useEffect(() => {
    if (!url || !enabled) { setConnected(false); setPreview(null); return }
    let stopped = false, active = '', blobUrl = '', sawH3Frames = false, samplerStage = '', lastPreviewAt = 0
    let samplerPass: LiveProgress['samplerPass']
    let socket: WebSocket
    let timer: ReturnType<typeof setTimeout>
    const replacePreview = (next: LivePreview) => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
      blobUrl = next.url.startsWith('blob:') ? next.url : ''
      setPreview(next)
    }
    const connect = () => {
      const address = new URL(url)
      address.protocol = address.protocol === 'https:' ? 'wss:' : 'ws:'
      address.pathname = `${address.pathname.replace(/\/$/, '')}/ws`
      address.search = new URLSearchParams({ clientId }).toString()
      socket = new WebSocket(address)
      socket.binaryType = 'arraybuffer'
      socket.onopen = () => setConnected(true)
      socket.onerror = () => setConnected(false)
      socket.onclose = () => { setConnected(false); if (!stopped) timer = setTimeout(connect, 3000) }
      socket.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          let msg: { type: string; data: { prompt_id?: string; node?: string | null; value?: number; max?: number; image?: string; mime?: string; fps?: number; rate?: number; step?: number; total?: number; output?: { images?: Array<{ filename: string; subfolder?: string; type?: string }> } } }
          try { msg = JSON.parse(event.data) } catch { return }
          const promptId = msg.data.prompt_id ?? active
          // ComfyUI can reconnect the event socket after a prompt has already
          // started. In that case execution_start is not replayed, so use the
          // prompt id carried by later node/progress events as the active job.
          // Without this, valid LTX preview frames are discarded until a new
          // render happens to start while the socket is connected.
          if (msg.data.prompt_id) active = msg.data.prompt_id
          if (msg.type === 'execution_start') {
            active = msg.data.prompt_id ?? ''
            sawH3Frames = false
            samplerStage = ''
            samplerPass = undefined
            if (blobUrl) URL.revokeObjectURL(blobUrl)
            blobUrl = ''
            setPreview(null)
            onProgress(active, { progress: 1, label: 'Starting workflow' })
          }
          if (msg.type === 'execution_cached') onProgress(promptId, { label: 'Reusing cached model data' })
          if (msg.type === 'executing' && msg.data.node) {
            if (msg.data.node === '15') { samplerStage = 'First sampling pass'; samplerPass = 'first' }
            else if (msg.data.node === '111') { samplerStage = 'Refinement pass'; samplerPass = 'refine' }
            onProgress(promptId, { label: samplerStage && (msg.data.node === '15' || msg.data.node === '111') ? samplerStage : nodeStageLabel(msg.data.node), ...(msg.data.node === '15' || msg.data.node === '111' ? { samplerPass } : {}) })
          }
          // KJNodes announces its LTX outer-sampler stream before it begins
          // sending binary PREVIEW_IMAGE frames. Surface that separately from
          // generic socket connectivity so a missing frame stream is obvious.
          if (msg.type === 'VHS_latentpreview') onProgress(promptId, { label: `LTX sampling preview stream · ${msg.data.fps ?? msg.data.rate ?? 24} fps` })
          if (msg.type === 'progress' && msg.data.max) {
            const currentStep = Math.max(0, msg.data.value ?? 0)
            const totalSteps = msg.data.max
            onProgress(promptId, { progress: Math.min(95, (currentStep / totalSteps) * 95), label: `${samplerStage || 'Sampling'} · step ${currentStep} of ${totalSteps}`, currentStep, totalSteps, samplerPass })
          }
          if (msg.type === 'execution_success') onProgress(promptId, { progress: 98, label: 'Finalizing saved output' })
          if (msg.type === 'minimax_h3_preview_override' && msg.data.image && promptId) {
            const now = Date.now()
            if (now - lastPreviewAt < 300) return
            lastPreviewAt = now
            const mime = msg.data.mime ?? 'image/jpeg'
            if (!/^(?:image\/(?:jpeg|png|webp)|video\/mp4)$/.test(mime)) return
            let nextUrl: string
            try { nextUrl = URL.createObjectURL(previewBlob(msg.data.image, mime)) } catch { return }
            sawH3Frames = true
            replacePreview({
              promptId,
              url: nextUrl,
              mime,
              animated: true,
              fps: msg.data.fps,
              step: msg.data.step,
              totalSteps: msg.data.total,
            })
          }
          if (msg.type === 'executed' && msg.data.output?.images?.[0] && !sawH3Frames) {
            // Some video save nodes also report their MP4 under `images`.
            // Keep the sampler preview instead of loading a video into <img>.
            const file = msg.data.output.images.find((image) => /\.(png|jpe?g|webp)$/i.test(image.filename))
            if (!file) return
            const query = new URLSearchParams({ filename: file.filename, subfolder: file.subfolder ?? '', type: file.type ?? 'temp' })
            const upstream = `${url.replace(/\/+$/, '')}/view?${query}`
            replacePreview({ promptId: msg.data.prompt_id ?? active, url: `minimax-media://comfy?url=${encodeURIComponent(upstream)}`, mime: 'image/jpeg', animated: false })
          }
        } else {
          const now = Date.now()
          if (now - lastPreviewAt < 300) return
          lastPreviewAt = now
          const promptId = active
          const binary = event.data instanceof ArrayBuffer ? event.data : event.data instanceof Blob ? await event.data.arrayBuffer() : null
          if (!binary || binary.byteLength <= 8 || !promptId) return
          const header = new DataView(binary)
          if (header.getUint32(0) !== 1) return
          const image = binaryPreviewImage(binary)
          if (!image) return
          const nextUrl = URL.createObjectURL(new Blob([binary.slice(image.offset)], { type: image.mime }))
          if (image.animated) sawH3Frames = true
          replacePreview({ promptId, url: nextUrl, mime: image.mime, animated: image.animated })
        }
      }
    }
    try { connect() } catch { setConnected(false) }
    return () => { stopped = true; clearTimeout(timer); socket?.close(); if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [url, clientId, enabled, onProgress])
  return { clientId, preview, connected }
}
