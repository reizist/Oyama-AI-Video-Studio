import { app, BrowserWindow, dialog, ipcMain, nativeTheme, net, protocol, session, shell } from 'electron'
import { constants, createReadStream, createWriteStream, existsSync } from 'node:fs'
import { copyFile, cp, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { writeAtomicFile } from './atomicFile.js'
import { trashOutput } from './trashOutput.js'
import { basename, dirname, extname, isAbsolute, join, normalize, relative, resolve } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { networkInterfaces } from 'node:os'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import WebSocket from 'ws'

type ModelKind = 'diffusion_models' | 'text_encoders' | 'vae' | 'loras' | 'vae_approx' | 'clip_vision'
type GpuRouteDevice = 'auto' | 'cpu' | `gpu:${number}`
type GpuRoutingSettings = { preset: 'automatic' | 'single' | 'split' | 'custom'; strategy: 'resident' | 'sequential' | 'cpu-fallback'; diffusion: GpuRouteDevice; textEncoder: GpuRouteDevice; videoVae: GpuRouteDevice; audioVae: GpuRouteDevice; previewVae: GpuRouteDevice; allowOvercommit: boolean; preloadDiffusionDuringTextEncoding: boolean }

type GenerationDefaults = {
  resolution: string
  duration: number
  turbo: 'off' | '4' | '8'
  steps: number
  sampler: string
  scheduler: string
  experimentalSampling: boolean
  refImageSize: 'match' | 'max'
  livePreview: boolean
  sigmaShiftMode: 'model' | 'custom'
  shiftVideo: number
  shiftAudio: number
  loraStrength: number
  upscaleMode: 'off' | 'refine' | 'h3' | 'ltx' | 'rtx'
  textEncoderPreference: 'fast' | 'quality'
  turbo8Profile: 'stable' | 'balanced' | 'motion'
}
type RenderIntentValues = GenerationDefaults & {
  userLoras: Array<{ name: string; strength: number }>
  rtxModel: string
  livePreviewMode: 'auto' | 'standard' | 'h3-override'
  noDialogue: boolean
  naturalMovement: boolean
  clothingPolicy: 'wardrobe' | 'underwear' | 'unrestricted'
  seed: number
  seedLocked: boolean
}
type RenderSettingsPreset = { id: string; name: string; values: RenderIntentValues; createdAt: number; updatedAt: number }

type AppSettings = {
  llmProvider: 'ollama' | 'lmstudio'
  comfyUrl: string
  ollamaUrl: string
  ollamaModel: string
  lmStudioUrl: string
  lmStudioModel: string
  modelRoot: string
  paths: Record<ModelKind, string>
  outputDirectory: string
  clipMasterOutputDirectory: string
  ffmpegPath: string
  uiScale: number
  attentionBackend: 'automatic' | 'sol' | 'kitchen' | 'sage' | 'native'
  solAttnTau: number
  solCacheEnabled: boolean
  h3DiffusionPrecision: 'int8' | 'nvfp4'
  gpuRouting: GpuRoutingSettings
  h3ParallelAttentionEnabled: boolean
  experimentalLtxMsrEnabled: boolean
  blurNsfwLivePreviews: boolean
  queueDelaySeconds: number
  characterDetailReferencesEnabled: boolean
  renderSettingsPresets: RenderSettingsPreset[]
  generationDefaults: GenerationDefaults
}

type LanStatus = { running: boolean; url?: string; desktopUrl?: string; port?: number; error?: string }
type GpuTelemetryDevice = { index: number; name: string; usagePercent: number; vramPercent: number; vramUsedMb: number; vramTotalMb: number; vramFreeMb: number }
type GpuTelemetry = { available: boolean; name?: string; usagePercent?: number; vramPercent?: number; vramUsedMb?: number; vramTotalMb?: number; devices?: GpuTelemetryDevice[] }
type RenderBenchmark = { jobId: string; hardwareKey: string; hardwareLabel: string; provider: 'minimax'; mode: string; turbo: string; attention: string; width: number; height: number; duration: number; steps: number; engineMs: number; measuredAt: number }
const ltxUpscaleRequiredNodes = ['VAEEncodeTiled', 'LatentUpscaleModelLoader', 'LTXVLatentUpsampler', 'VAEDecodeTiled', 'ImageFromBatch', 'RepeatImageBatch', 'ImageBatch']
const ltxNativeRequiredNodes = ['LTXVConditioning', 'LTXVEmptyLatentAudio', 'EmptyLTXVLatentVideo', 'LTXVDualCFGGuider', 'LTXVSeparateAVLatent', 'LTXVConcatAVLatent', 'LTXVLatentUpsampler', 'LTXVAudioVAEDecode', 'ManualSigmas', 'VAEDecodeTiled', 'CLIPTextEncode', 'KSamplerSelect', 'SamplerCustomAdvanced']
let lanToken = ''
let mobileCharacterLibrary: unknown[] = []
let lanServer: Server | null = null
let lanStatus: LanStatus = { running: false }

function readGpuTelemetry(): Promise<GpuTelemetry> {
  return new Promise((resolve) => {
    const child = spawn('nvidia-smi', ['--query-gpu=name,utilization.gpu,memory.used,memory.total', '--format=csv,noheader,nounits'], { windowsHide: true })
    let output = ''
    let settled = false
    const finish = (value: GpuTelemetry) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    const timer = setTimeout(() => { child.kill(); finish({ available: false }) }, 1800)
    child.stdout.on('data', (chunk) => { output += String(chunk) })
    child.on('error', () => finish({ available: false }))
    child.on('close', (code) => {
      if (code !== 0 || !output.trim()) { finish({ available: false }); return }
      const devices = output.trim().split(/\r?\n/).map((line, index) => {
        const [name = `GPU ${index}`, usage = '', used = '', total = ''] = line.split(',').map((part) => part.trim())
        const usagePercent = Number(usage) || 0
        const vramUsedMb = Number(used) || 0
        const vramTotalMb = Number(total) || 0
        return { index, name, usagePercent, vramUsedMb, vramTotalMb, vramFreeMb: Math.max(0, vramTotalMb - vramUsedMb), vramPercent: vramTotalMb > 0 ? Math.round(vramUsedMb / vramTotalMb * 100) : 0 }
      })
      const primary = devices[0]
      finish({ available: devices.length > 0, name: primary?.name, usagePercent: primary?.usagePercent, vramUsedMb: primary?.vramUsedMb, vramTotalMb: primary?.vramTotalMb, vramPercent: primary?.vramPercent, devices })
    })
  })
}

const modelKinds: ModelKind[] = ['diffusion_models', 'text_encoders', 'vae', 'loras', 'vae_approx', 'clip_vision']
const modelExtensions = new Set(['.safetensors', '.pt', '.pth', '.gguf', '.onnx'])
const mediaExtensions = new Set(['.mp4', '.webm', '.mov', '.mkv'])
const audioExtensions = new Set(['.flac', '.wav', '.mp3', '.ogg', '.m4a', '.aac', '.opus'])
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp'])
const selectedMediaExtensions = new Set([...mediaExtensions, ...audioExtensions, ...imageExtensions])

const mediaMimeTypes: Record<string, string> = {
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska', '.webm': 'video/webm',
  '.flac': 'audio/flac', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.opus': 'audio/opus',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.bmp': 'image/bmp',
}

async function localMediaResponse(filePath: string, request: Request) {
  const details = await stat(filePath)
  if (!details.isFile() || details.size === 0) return new Response('Media file is empty', { status: 404 })
  const size = details.size
  const range = request.headers.get('range')
  const etag = `W/"${size}-${Math.trunc(details.mtimeMs)}"`
  if (!range && request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { etag, 'cache-control': 'private, max-age=3600' } })
  }
  let start = 0
  let end = size - 1
  let status = 200
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim())
    if (!match) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } })
    if (match[1]) start = Number(match[1])
    if (match[2]) end = Number(match[2])
    if (!match[1] && match[2]) {
      const suffixLength = Math.min(size, Number(match[2]))
      start = size - suffixLength
      end = size - 1
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
      return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } })
    }
    end = Math.min(end, size - 1)
    status = 206
  }
  const headers = new Headers({
    'accept-ranges': 'bytes',
    'content-length': String(end - start + 1),
    'content-type': mediaMimeTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'private, max-age=3600',
    'content-disposition': 'inline',
    'last-modified': details.mtime.toUTCString(),
    'x-content-type-options': 'nosniff',
    etag,
  })
  if (status === 206) headers.set('content-range', `bytes ${start}-${end}/${size}`)
  if (request.method === 'HEAD') return new Response(null, { status, headers })
  const stream = createReadStream(filePath, { start, end })
  return new Response(Readable.toWeb(stream) as ReadableStream, { status, headers })
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'minimax-media', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
])

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
// WSLg's native Wayland/Ozone backend has broken IME support for CJK input
// (ibus never receives composition events) and an unstable GPU process init.
// Forcing XWayland fixes both without affecting native Linux/Windows/macOS.
if (process.platform === 'linux') app.commandLine.appendSwitch('ozone-platform-hint', 'x11')

function defaultSettings(): AppSettings {
  const root = join(app.getPath('documents'), 'ComfyUI', 'models')
  return {
    llmProvider: 'ollama',
    comfyUrl: 'http://127.0.0.1:8188',
    ollamaUrl: 'http://127.0.0.1:11434',
    ollamaModel: 'qwen3:latest',
    lmStudioUrl: 'http://127.0.0.1:1234',
    lmStudioModel: '',
    modelRoot: root,
    paths: Object.fromEntries(modelKinds.map((kind) => [kind, join(root, kind)])) as Record<ModelKind, string>,
    outputDirectory: join(app.getPath('documents'), 'ComfyUI', 'output'),
    clipMasterOutputDirectory: join(app.getPath('documents'), 'ComfyUI', 'output', 'video'),
    ffmpegPath: existsSync('C:\\FFMPEG\\bin\\ffmpeg.exe') ? 'C:\\FFMPEG\\bin\\ffmpeg.exe' : 'ffmpeg',
    uiScale: 100,
    attentionBackend: 'automatic',
    solAttnTau: 1,
    solCacheEnabled: true,
    h3DiffusionPrecision: 'int8',
    gpuRouting: { preset: 'automatic', strategy: 'sequential', diffusion: 'auto', textEncoder: 'auto', videoVae: 'auto', audioVae: 'auto', previewVae: 'auto', allowOvercommit: false, preloadDiffusionDuringTextEncoding: false },
    h3ParallelAttentionEnabled: false,
    experimentalLtxMsrEnabled: false,
    blurNsfwLivePreviews: false,
    queueDelaySeconds: 0,
    characterDetailReferencesEnabled: false,
    renderSettingsPresets: [],
    generationDefaults: {
      resolution: '1344x768', duration: 5, turbo: 'off', steps: 30,
      sampler: 'res_multistep', scheduler: 'simple', experimentalSampling: false,
      refImageSize: 'match', livePreview: true, sigmaShiftMode: 'model', shiftVideo: 12, shiftAudio: 3, loraStrength: 1, upscaleMode: 'refine', textEncoderPreference: 'fast', turbo8Profile: 'balanced',
    },
  }
}

function finalOllamaAnswer(value: string) {
  let answer = value.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '').replace(/<analysis\b[^>]*>[\s\S]*?<\/analysis>/gi, '')
  const unclosedThink = answer.search(/<(?:think|analysis)\b[^>]*>/i)
  if (unclosedThink >= 0) answer = answer.slice(0, unclosedThink)
  return answer.replace(/<\/?(?:think|analysis)\b[^>]*>/gi, '').trim()
}

type LlmProvider = AppSettings['llmProvider']

function llmLabel(provider: LlmProvider) {
  return provider === 'lmstudio' ? 'LM Studio' : 'Ollama'
}

function lmStudioPath(url: string, path: string) {
  return /\/v1\/?$/i.test(cleanUrl(url)) ? path : `/v1${path}`
}

function assertLocalLmStudioUrl(value: string) {
  let parsed: URL
  try { parsed = new URL(value) } catch { throw new Error('Enter a valid LM Studio server URL.') }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!['127.0.0.1', 'localhost', '::1'].includes(hostname)) throw new Error('LM Studio is restricted to this computer. Use localhost, 127.0.0.1, or ::1.')
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('LM Studio must use an HTTP or HTTPS URL.')
}

function assertLlmUrl(value: string, provider: LlmProvider) {
  let parsed: URL
  try { parsed = new URL(value) } catch { throw new Error(`Enter a valid ${llmLabel(provider)} server URL.`) }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`${llmLabel(provider)} must use an HTTP or HTTPS URL.`)
  if (provider === 'lmstudio') assertLocalLmStudioUrl(value)
}

async function llmFetch(url: string, path: string, provider: LlmProvider, init?: RequestInit, timeoutMs = 600_000) {
  assertLlmUrl(url, provider)
  const label = llmLabel(provider)
  let response: Response
  try {
    response = await fetch(`${cleanUrl(url)}${path}`, { ...init, signal: init?.signal ?? AbortSignal.timeout(timeoutMs) })
  } catch (cause) {
    const timedOut = cause instanceof Error && (cause.name === 'TimeoutError' || cause.name === 'AbortError')
    if (timedOut) throw new Error(`${label} did not respond in time. Confirm the selected model is loaded, then try again.`)
    throw new Error(`Could not reach ${label} at ${cleanUrl(url)}. ${provider === 'ollama' ? 'Start Ollama' : 'Start the LM Studio local server'}, check the server URL, then try again.`)
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    let detail = body.trim()
    try {
      const parsed = JSON.parse(body) as { error?: string | { message?: string }; message?: string }
      detail = typeof parsed.error === 'string' ? parsed.error : parsed.error?.message ?? parsed.message ?? detail
    } catch { /* Keep a non-JSON provider response as the detail. */ }
    if (response.status === 404 && /model/i.test(detail)) throw new Error(`${detail.replace(/\s+/g, ' ')} Refresh models in Settings and choose an installed model.`)
    throw new Error(`${label} returned ${response.status}${detail ? `: ${detail.replace(/\s+/g, ' ').slice(0, 500)}` : '.'}`)
  }
  const contentType = response.headers.get('content-type') ?? ''
  return contentType.includes('application/json') ? response.json() : response.text()
}

async function listLlmModels(url: string, provider: LlmProvider) {
  if (provider === 'lmstudio') {
    const result = await llmFetch(url, lmStudioPath(url, '/models'), provider, undefined, 10_000) as { data?: Array<{ id?: string; owned_by?: string }> }
    return (result.data ?? []).filter((model) => model.id).map((model) => ({ name: model.id!, size: 0, family: model.owned_by ?? 'lmstudio', parameterSize: '', local: true }))
  }
  const data = await llmFetch(url, '/api/tags', provider, undefined, 10_000) as { models?: Array<{ name: string; size?: number; remote_model?: string; details?: { family?: string; parameter_size?: string } }> }
  return (data.models ?? []).map((model) => ({ name: model.name, size: model.size ?? 0, family: model.details?.family ?? '', parameterSize: model.details?.parameter_size ?? '', local: !model.remote_model && model.size !== 342 }))
}

async function generateWithLlm(url: string, model: string, prompt: string, provider: LlmProvider) {
  if (provider === 'lmstudio') {
    const data = await llmFetch(url, lmStudioPath(url, '/chat/completions'), provider, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: false, temperature: 0.65, max_tokens: 1800 }) }) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } | string }
    const answer = finalOllamaAnswer(data.choices?.[0]?.message?.content ?? '')
    if (!answer) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || 'LM Studio returned an empty response.')
    return answer
  }
  const data = await llmFetch(url, '/api/generate', provider, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, prompt, stream: false, keep_alive: '10m', think: false, options: { temperature: 0.65, num_predict: 1200 } }) }) as { response?: string; error?: string }
  const answer = data.response ? finalOllamaAnswer(data.response) : ''
  if (!answer) throw new Error(data.error || 'Ollama returned an empty response.')
  return answer
}

function settingsPath() {
  return join(app.getPath('userData'), 'settings.json')
}

function renderBenchmarksPath() {
  return join(app.getPath('userData'), 'render-benchmarks.json')
}

function validRenderBenchmark(value: unknown): value is RenderBenchmark {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return item.provider === 'minimax'
    && typeof item.jobId === 'string' && typeof item.hardwareKey === 'string' && typeof item.hardwareLabel === 'string'
    && typeof item.mode === 'string' && typeof item.turbo === 'string' && typeof item.attention === 'string'
    && ['width', 'height', 'duration', 'steps', 'engineMs', 'measuredAt'].every((key) => Number.isFinite(Number(item[key])) && Number(item[key]) > 0)
}

async function loadRenderBenchmarks(): Promise<RenderBenchmark[]> {
  try {
    const stored = JSON.parse(await readFile(renderBenchmarksPath(), 'utf8'))
    return Array.isArray(stored) ? stored.filter(validRenderBenchmark).slice(0, 180) : []
  } catch { return [] }
}

async function saveRenderBenchmarks(value: unknown): Promise<RenderBenchmark[]> {
  const benchmarks = Array.isArray(value) ? value.filter(validRenderBenchmark).sort((a, b) => b.measuredAt - a.measuredAt).slice(0, 180) : []
  await writeAtomicFile(renderBenchmarksPath(), `${JSON.stringify(benchmarks, null, 2)}\n`)
  return benchmarks
}

function lanTokenPath() {
  return join(app.getPath('userData'), 'lan-access-token.txt')
}

function legacyUserDataPaths() {
  const appData = app.getPath('appData')
  const current = normalize(app.getPath('userData')).toLowerCase()
  return ['minimax-desktop', 'MiniMax Studio', 'MiniMax H3 Studio']
    .map((name) => join(appData, name))
    .filter((path) => normalize(path).toLowerCase() !== current)
}

function legacyMigrationMarkerPath() {
  return join(app.getPath('userData'), 'migrated-from-minimax-studio-v1.json')
}

function pendingBrowserStorageMigrationPath() {
  return join(app.getPath('userData'), 'pending-minimax-browser-storage-migration-v1.json')
}

/**
 * The rename changes Electron's app-data directory.  Carry the complete old
 * profile forward once so settings, intents, local projects, media references,
 * LAN pairing, and downloaded tools all stay available after the upgrade.
 */
const legacyBrowserStateEntries = ['Local Storage', 'IndexedDB', 'Session Storage', 'SharedStorage', 'Preferences']

async function copyLegacyBrowserState(source: string, destination: string) {
  for (const entry of legacyBrowserStateEntries) {
    const from = join(source, entry)
    if (!existsSync(from)) continue
    await cp(from, join(destination, entry), { recursive: true, force: true, errorOnExist: false, filter: (path) => basename(path) !== 'LOCK' })
  }
}

async function migrateLegacyUserData(options: { force?: boolean; replaceBrowserStorage?: boolean } = {}) {
  if (!options.force && existsSync(legacyMigrationMarkerPath())) return
  const legacy = legacyUserDataPaths().find((path) => existsSync(path))
  if (!legacy) return

  const destination = app.getPath('userData')
  const destinationWasFresh = !existsSync(settingsPath())
  await mkdir(destination, { recursive: true })
  // Never replace data created by the Oyama build: this makes the migration
  // safe to retry and preserves any changes made after the rename.
  await cp(legacy, destination, { recursive: true, force: false, errorOnExist: false, filter: (path) => basename(path) !== 'LOCK' })
  const browserStorageMigrated = destinationWasFresh || options.replaceBrowserStorage === true
  if (browserStorageMigrated) await copyLegacyBrowserState(legacy, destination)
  await writeAtomicFile(legacyMigrationMarkerPath(), `${JSON.stringify({ source: legacy, migratedAt: new Date().toISOString(), browserStorageMigrated }, null, 2)}\n`)
}

async function legacyMigrationStatus() {
  let migratedAt: string | undefined
  let browserStorageMigrated = false
  try {
    const marker = JSON.parse(await readFile(legacyMigrationMarkerPath(), 'utf8')) as { migratedAt?: unknown; browserStorageMigrated?: unknown }
    if (typeof marker.migratedAt === 'string') migratedAt = marker.migratedAt
    browserStorageMigrated = marker.browserStorageMigrated === true
  } catch { /* No completed migration marker yet. */ }
  return { available: legacyUserDataPaths().some((path) => existsSync(path)), migrated: Boolean(migratedAt), migratedAt, needsBrowserStorageRepair: Boolean(migratedAt) && !browserStorageMigrated }
}

async function saveLanToken(token: string) {
  await writeAtomicFile(lanTokenPath(), token)
}

async function loadLanToken() {
  try {
    const stored = (await readFile(lanTokenPath(), 'utf8')).trim()
    if (/^[a-f0-9]{32}$/i.test(stored)) return stored
  } catch { /* Create the persistent token on first launch. */ }
  const created = randomUUID().replace(/-/g, '')
  await saveLanToken(created)
  return created
}

async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = JSON.parse(await readFile(settingsPath(), 'utf8')) as Partial<AppSettings>
    const defaults = defaultSettings()
    const generationDefaults = { ...defaults.generationDefaults, ...raw.generationDefaults }
    generationDefaults.steps = Math.max(4, Math.min(30, Number(generationDefaults.steps) || 30))
    generationDefaults.textEncoderPreference = raw.generationDefaults?.textEncoderPreference === 'quality' ? 'quality' : 'fast'
    generationDefaults.turbo8Profile = raw.generationDefaults?.turbo8Profile === 'stable' || raw.generationDefaults?.turbo8Profile === 'motion' ? raw.generationDefaults.turbo8Profile : 'balanced'
    const uiScale = Math.max(75, Math.min(150, Number(raw.uiScale) || defaults.uiScale))
    const renderIntentDefaults: RenderIntentValues = { ...generationDefaults, userLoras: [], rtxModel: '', livePreviewMode: 'auto', noDialogue: true, naturalMovement: true, clothingPolicy: 'wardrobe', seed: 0, seedLocked: true }
    const renderSettingsPresets = Array.isArray(raw.renderSettingsPresets) ? raw.renderSettingsPresets.filter((preset) => preset && typeof preset.name === 'string' && preset.name.trim()).slice(0, 30).map((preset) => {
      const rawValues = preset.values && typeof preset.values === 'object' ? preset.values as Record<string, unknown> : {}
      const userLoras = Array.isArray(rawValues.userLoras) ? rawValues.userLoras.reduce<Array<{ name: string; strength: number }>>((items, item) => {
        if (!item || typeof item !== 'object' || typeof (item as { name?: unknown }).name !== 'string') return items
        const lora = item as { name: string; strength?: unknown }
        items.push({ name: lora.name, strength: Number.isFinite(Number(lora.strength)) ? Number(lora.strength) : 1 })
        return items
      }, []).slice(0, 3) : []
      const values: RenderIntentValues = { ...renderIntentDefaults, ...(rawValues as Partial<RenderIntentValues>), userLoras, rtxModel: typeof rawValues.rtxModel === 'string' ? rawValues.rtxModel : '', livePreviewMode: rawValues.livePreviewMode === 'h3-override' || rawValues.livePreviewMode === 'standard' ? rawValues.livePreviewMode : 'auto', noDialogue: rawValues.noDialogue !== false, naturalMovement: rawValues.naturalMovement !== false, clothingPolicy: rawValues.clothingPolicy === 'underwear' || rawValues.clothingPolicy === 'unrestricted' ? rawValues.clothingPolicy : 'wardrobe', seed: Math.max(0, Math.min(999999999999, Math.floor(Number(rawValues.seed) || 0))), seedLocked: rawValues.seedLocked !== false }
      return { id: typeof preset.id === 'string' ? preset.id : randomUUID(), name: preset.name.trim().slice(0, 60), values, createdAt: Number(preset.createdAt) || Date.now(), updatedAt: Number(preset.updatedAt) || Date.now() }
    }) : []
    const attentionBackend = raw.attentionBackend === 'sol' || raw.attentionBackend === 'kitchen' || raw.attentionBackend === 'sage' || raw.attentionBackend === 'native' ? raw.attentionBackend : 'automatic'
    const solAttnTau = Math.max(-1000, Math.min(10, Number(raw.solAttnTau) || 1))
    const outputDirectory = typeof raw.outputDirectory === 'string' && raw.outputDirectory.trim() ? raw.outputDirectory.trim() : defaults.outputDirectory
    const clipMasterOutputDirectory = typeof raw.clipMasterOutputDirectory === 'string' && raw.clipMasterOutputDirectory.trim() ? raw.clipMasterOutputDirectory.trim() : join(outputDirectory, 'video')
    const rawRouting = raw.gpuRouting
    const validDevice = (value: unknown): GpuRouteDevice => typeof value === 'string' && (value === 'auto' || value === 'cpu' || /^gpu:\d+$/.test(value)) ? value as GpuRouteDevice : 'auto'
    const gpuRouting: GpuRoutingSettings = { ...defaults.gpuRouting, ...rawRouting, preset: rawRouting?.preset === 'single' || rawRouting?.preset === 'split' || rawRouting?.preset === 'custom' ? rawRouting.preset : 'automatic', strategy: rawRouting?.strategy === 'resident' || rawRouting?.strategy === 'cpu-fallback' ? rawRouting.strategy : 'sequential', diffusion: validDevice(rawRouting?.diffusion), textEncoder: validDevice(rawRouting?.textEncoder), videoVae: validDevice(rawRouting?.videoVae), audioVae: validDevice(rawRouting?.audioVae), previewVae: validDevice(rawRouting?.previewVae), allowOvercommit: rawRouting?.allowOvercommit === true, preloadDiffusionDuringTextEncoding: rawRouting?.preloadDiffusionDuringTextEncoding === true }
    return { ...defaults, ...raw, outputDirectory, clipMasterOutputDirectory, uiScale, attentionBackend, solAttnTau, solCacheEnabled: raw.solCacheEnabled !== false, h3DiffusionPrecision: raw.h3DiffusionPrecision === 'nvfp4' ? 'nvfp4' : 'int8', gpuRouting, h3ParallelAttentionEnabled: raw.h3ParallelAttentionEnabled === true, queueDelaySeconds: Math.max(0, Math.min(600, Number(raw.queueDelaySeconds) || 0)), experimentalLtxMsrEnabled: raw.experimentalLtxMsrEnabled === true, blurNsfwLivePreviews: raw.blurNsfwLivePreviews === true, llmProvider: raw.llmProvider === 'lmstudio' ? 'lmstudio' : 'ollama', characterDetailReferencesEnabled: raw.characterDetailReferencesEnabled === true, renderSettingsPresets, paths: { ...defaults.paths, ...raw.paths }, generationDefaults }
  } catch {
    return defaultSettings()
  }
}

async function saveSettings(settings: AppSettings) {
  await writeAtomicFile(settingsPath(), `${JSON.stringify(settings, null, 2)}\n`)
  return settings
}

function factoryResetMarkerPath() { return join(app.getPath('userData'), 'pending-factory-reset.json') }
async function factoryResetSettings(confirmation: unknown) {
  if (confirmation !== 'Reset') throw new Error('Type Reset exactly to confirm factory reset.')
  await writeAtomicFile(factoryResetMarkerPath(), JSON.stringify({ requestedAt: Date.now() }))
  // Apply before any window opens on the next launch so a second editor or
  // autosave cannot restore the cleared projects from stale in-memory state.
  setTimeout(() => { app.relaunch(); app.exit(0) }, 300)
}

async function scanDirectory(root: string, kind: ModelKind) {
  const results: Array<{ name: string; path: string; kind: ModelKind; bytes: number }> = []
  if (!root || !existsSync(root)) return results
  const pending = [normalize(root)]
  while (pending.length) {
    const current = pending.pop()!
    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.')) pending.push(fullPath)
      } else if (entry.isFile() && modelExtensions.has(extname(entry.name).toLowerCase())) {
        try {
          const info = await stat(fullPath)
          results.push({ name: entry.name, path: fullPath, kind, bytes: info.size })
        } catch { /* Skip one unreadable entry instead of losing the full scan. */ }
      }
    }
  }
  return results
}

async function findLatestMedia(root: string, since: number, kind: 'video' | 'audio' = 'video') {
  if (!root || !existsSync(root)) return null
  const pending = [normalize(root)]
  let latest: { path: string; modified: number } | null = null
  while (pending.length) {
    const current = pending.pop()!
    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) pending.push(fullPath)
      else if (entry.isFile() && (kind === 'audio' ? audioExtensions : mediaExtensions).has(extname(entry.name).toLowerCase())) {
        const info = await stat(fullPath)
        if (info.mtimeMs >= since - 5000 && (!latest || info.mtimeMs > latest.modified)) latest = { path: fullPath, modified: info.mtimeMs }
      }
    }
  }
  return latest?.path ?? null
}

function resolveComfyOutput(outputDirectory: string, file: { filename?: unknown; subfolder?: unknown; type?: unknown }) {
  if (file.type && file.type !== 'output') return null
  if (typeof file.filename !== 'string' || !file.filename || typeof file.subfolder !== 'undefined' && typeof file.subfolder !== 'string') return null
  const root = resolve(outputDirectory)
  const candidate = resolve(root, file.subfolder ?? '', file.filename)
  const pathInsideOutput = !isAbsolute(relative(root, candidate)) && !relative(root, candidate).startsWith('..') && relative(root, candidate) !== '..'
  return pathInsideOutput && existsSync(candidate) ? candidate : null
}

function cleanUrl(url: string) {
  return url.trim().replace(/\/+$/, '')
}

async function comfyFetch(url: string, path: string, init?: RequestInit) {
  const response = await fetch(`${cleanUrl(url)}${path}`, init)
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    let message = body
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } | string; node_errors?: Record<string, { errors?: Array<{ message?: string; details?: string }> }> }
      const promptError = typeof parsed.error === 'string' ? parsed.error : parsed.error?.message
      const nodeError = Object.entries(parsed.node_errors ?? {}).flatMap(([nodeId, value]) => (value.errors ?? []).map(error => `Node ${nodeId}: ${error.message ?? error.details ?? 'invalid input'}`))[0]
      message = [promptError, nodeError].filter(Boolean).join(' · ')
    } catch { /* Preserve non-JSON server errors verbatim. */ }
    throw new Error(message || `ComfyUI returned ${response.status}`)
  }
  const contentType = response.headers.get('content-type') ?? ''
  return contentType.includes('application/json') ? response.json() : response.text()
}

function lanAddress() {
  const candidates = Object.entries(networkInterfaces()).flatMap(([name, entries]) => (entries ?? [])
    .filter((entry) => entry.family === 'IPv4' && !entry.internal)
    .map((entry) => {
      const privateAddress = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.address)
      const preferredAdapter = /wi-?fi|wireless|ethernet/i.test(name)
      const virtualAdapter = /virtual|vethernet|wsl|docker|vmware|vpn|tailscale|hamachi/i.test(name)
      return { address: entry.address, score: (privateAddress ? 4 : 0) + (preferredAdapter ? 2 : 0) - (virtualAdapter ? 5 : 0) }
    }))
  return candidates.sort((left, right) => right.score - left.score)[0]?.address ?? '127.0.0.1'
}

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(value))
}

function comfyChoices(info: Record<string, unknown>, node: string, field: string) {
  const definition = info[node] as { input?: { required?: Record<string, unknown[]> } } | undefined
  const values = definition?.input?.required?.[field]?.[0]
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : []
}

function streamLanEvents(request: IncomingMessage, response: ServerResponse, search: URLSearchParams, comfyUrl: string) {
  const clientId = search.get('clientId') ?? ''
  if (!/^[a-f0-9-]{16,64}$/i.test(clientId)) return sendJson(response, 400, { error: 'A valid preview client ID is required.' })
  response.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' })
  response.write(': connected\n\n')
  const address = new URL(cleanUrl(comfyUrl))
  address.protocol = address.protocol === 'https:' ? 'wss:' : 'ws:'
  address.pathname = `${address.pathname.replace(/\/$/, '')}/ws`
  address.search = new URLSearchParams({ clientId }).toString()
  const socket = new WebSocket(address)
  const send = (value: unknown) => { if (!response.destroyed) response.write(`data: ${JSON.stringify(value)}\n\n`) }
  socket.on('open', () => send({ type: 'stream_ready', data: {} }))
  socket.on('message', (data, binary) => {
    if (!binary) {
      try { send(JSON.parse(data.toString())) } catch { /* Ignore malformed ComfyUI status messages. */ }
      return
    }
    const buffer = Buffer.from(data as Buffer)
    if (buffer.length <= 8 || buffer.readUInt32BE(0) !== 1) return
    const animatedH3Frame = buffer.length > 32 && buffer.readUInt32BE(4) === 1 && buffer.readUInt32BE(8) === 1 && buffer.readUInt16BE(32) === 0xffd8
    const imageOffset = animatedH3Frame ? 32 : 8
    const mime = !animatedH3Frame && buffer.readUInt32BE(4) === 2 ? 'image/png' : 'image/jpeg'
    send({ type: 'preview', data: { image: `data:${mime};base64,${buffer.subarray(imageOffset).toString('base64')}` } })
  })
  socket.on('error', (error) => send({ type: 'preview_error', data: { message: error.message } }))
  const heartbeat = setInterval(() => { if (!response.destroyed) response.write(': keepalive\n\n') }, 15_000)
  request.once('close', () => { clearInterval(heartbeat); socket.close() })
}

async function readJson(request: IncomingMessage, maximumBytes = 36_000_000) {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk)
    total += buffer.length
    if (total > maximumBytes) throw new Error('Request is too large.')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Record<string, unknown>
}

function historyOutput(history: Record<string, unknown>, promptId: string, kind: 'video' | 'image' = 'video') {
  const entry = history[promptId] as { outputs?: Record<string, unknown> } | undefined
  const files: Array<{ filename: string; subfolder?: string; type?: string }> = []
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!value || typeof value !== 'object') return
    const item = value as Record<string, unknown>
    if (typeof item.filename === 'string') files.push({ filename: item.filename, subfolder: typeof item.subfolder === 'string' ? item.subfolder : undefined, type: typeof item.type === 'string' ? item.type : undefined })
    Object.values(item).forEach(visit)
  }
  if (entry?.outputs?.['84']) visit(entry.outputs['84'])
  else if (entry?.outputs?.['70']) visit(entry.outputs['70'])
  else if (entry?.outputs) visit(entry.outputs)
  return files.find((file) => kind === 'image' ? /\.(png|jpe?g|webp)$/i.test(file.filename) : /\.(mp4|webm|mov|mkv)$/i.test(file.filename))
}

async function proxyLanMedia(request: IncomingMessage, response: ServerResponse, search: URLSearchParams) {
  const filename = search.get('filename') ?? ''
  if (!filename || filename.includes('/') || filename.includes('\\')) return sendJson(response, 400, { error: 'Invalid output filename.' })
  const settings = await loadSettings()
  const query = new URLSearchParams({ filename, subfolder: search.get('subfolder') ?? '', type: search.get('type') ?? 'output' })
  const upstream = await fetch(`${cleanUrl(settings.comfyUrl)}/view?${query}`, { headers: typeof request.headers.range === 'string' ? { Range: request.headers.range } : undefined })
  if (!upstream.ok || !upstream.body) return sendJson(response, upstream.status, { error: 'The generated video is unavailable.' })
  const headers: Record<string, string> = { 'content-type': upstream.headers.get('content-type') ?? 'video/mp4', 'accept-ranges': upstream.headers.get('accept-ranges') ?? 'bytes' }
  const length = upstream.headers.get('content-length')
  if (length) headers['content-length'] = length
  const contentRange = upstream.headers.get('content-range')
  if (contentRange) headers['content-range'] = contentRange
  if (search.get('download') === '1') headers['content-disposition'] = `attachment; filename="${basename(filename)}"`
  response.writeHead(upstream.status, headers)
  Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(response)
}

async function handleLanRequest(request: IncomingMessage, response: ServerResponse) {
  try {
    const url = new URL(request.url ?? '/', 'http://minimax.local')
    if (url.pathname.startsWith('/api/lan/')) {
      const token = request.headers['x-minimax-token'] ?? url.searchParams.get('token')
      if (token !== lanToken) return sendJson(response, 401, { error: 'This LAN link is no longer authorized. Open the current sharing panel again.' })
      const settings = await loadSettings()
      if (url.pathname === '/api/lan/bootstrap' && request.method === 'GET') {
        const groups = await Promise.all(modelKinds.map((kind) => scanDirectory(settings.paths[kind], kind)))
        const started = Date.now()
        try {
          await comfyFetch(settings.comfyUrl, '/system_stats')
          const info = await comfyFetch(settings.comfyUrl, '/object_info').catch(() => ({})) as Record<string, unknown>
          const upscalers = comfyChoices(info, 'UpscaleModelLoader', 'model_name')
          const latentUpscalers = comfyChoices(info, 'LatentUpscaleModelLoader', 'model_name')
          const vaes = comfyChoices(info, 'VAELoader', 'vae_name')
          const ltxUpscaleMissing = ltxUpscaleRequiredNodes.filter((node) => !info[node])
          const ltxNativeMissing = ltxNativeRequiredNodes.filter((node) => !info[node])
          const llmProvider = settings.llmProvider ?? 'ollama'
          const llmUrl = llmProvider === 'lmstudio' ? settings.lmStudioUrl : settings.ollamaUrl
          const llmModel = llmProvider === 'lmstudio' ? settings.lmStudioModel : settings.ollamaModel
          const llmModels = await listLlmModels(llmUrl, llmProvider).catch(() => [])
          return sendJson(response, 200, { connected: true, latencyMs: Date.now() - started, models: groups.flat(), upscalers, ltxModel: latentUpscalers.find((name) => /ltx-2\.5.*spatial.*x2/i.test(name)) ?? '', ltxVae: vaes.find((name) => /ltx-2\.5.*video.*vae/i.test(name)) ?? '', ltxUpscaleReady: ltxUpscaleMissing.length === 0, ltxUpscaleMissing, ltxNativeReady: ltxNativeMissing.length === 0, ltxNativeMissing, ollamaModels: llmModels.map((item) => item.name), ollamaModel: llmModel, llmProvider, llmModels: llmModels.map((item) => item.name), llmModel })
        } catch (error) {
          return sendJson(response, 200, { connected: false, latencyMs: Date.now() - started, models: groups.flat(), error: error instanceof Error ? error.message : String(error) })
        }
      }
      if (url.pathname === '/api/lan/characters' && request.method === 'GET') return sendJson(response, 200, { characters: mobileCharacterLibrary })
      if (url.pathname === '/api/lan/upload' && request.method === 'POST') {
        const body = await readJson(request)
        const data = typeof body.data === 'string' ? body.data : ''
        if (!data.startsWith('data:image/png;base64,') || data.length > 35_000_000) return sendJson(response, 400, { error: 'Invalid prepared image.' })
        const form = new FormData()
        form.append('image', new Blob([Buffer.from(data.split(',')[1], 'base64')], { type: 'image/png' }), `mobile-frame-${randomUUID()}.png`)
        form.append('type', 'input'); form.append('subfolder', 'minimax-mobile')
        return sendJson(response, 200, await comfyFetch(settings.comfyUrl, '/upload/image', { method: 'POST', body: form }))
      }
      if (url.pathname === '/api/lan/upload-media' && request.method === 'POST') {
        const body = await readJson(request, 180_000_000)
        const data = typeof body.data === 'string' ? body.data : ''
        const name = typeof body.name === 'string' ? basename(body.name).replace(/[^a-z0-9._-]/gi, '_') : ''
        const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,(.+)$/is.exec(data)
        if (!match || !name || data.length > 175_000_000) return sendJson(response, 400, { error: 'Invalid reference media.' })
        const allowed = /^(image\/(png|jpeg|webp)|video\/(mp4|webm|quicktime)|audio\/(mpeg|wav|x-wav|ogg|mp4))$/i
        if (!allowed.test(match[1])) return sendJson(response, 400, { error: 'Unsupported reference media type.' })
        const form = new FormData()
        form.append('image', new Blob([Buffer.from(match[2], 'base64')], { type: match[1] }), name)
        form.append('type', 'input'); form.append('subfolder', 'minimax-mobile-references'); form.append('overwrite', 'true')
        return sendJson(response, 200, await comfyFetch(settings.comfyUrl, '/upload/image', { method: 'POST', body: form }))
      }
      if (url.pathname === '/api/lan/prompt' && request.method === 'POST') {
        const body = await readJson(request, 5_000_000)
        if (!body.prompt || typeof body.prompt !== 'object') return sendJson(response, 400, { error: 'A ComfyUI workflow is required.' })
        const clientId = typeof body.clientId === 'string' && /^[a-f0-9-]{16,64}$/i.test(body.clientId) ? body.clientId : randomUUID()
        const result = await comfyFetch(settings.comfyUrl, '/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: body.prompt, client_id: clientId }) })
        return sendJson(response, 200, result)
      }
      if (url.pathname === '/api/lan/events' && request.method === 'GET') return streamLanEvents(request, response, url.searchParams, settings.comfyUrl)
      if (url.pathname === '/api/lan/ollama' && request.method === 'POST') {
        const body = await readJson(request, 80_000)
        const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
        if (!prompt || prompt.length > 50_000) return sendJson(response, 400, { error: 'A shorter prompt-assistant request is required.' })
        const provider = settings.llmProvider ?? 'ollama'
        const llmUrl = provider === 'lmstudio' ? settings.lmStudioUrl : settings.ollamaUrl
        const llmModel = provider === 'lmstudio' ? settings.lmStudioModel : settings.ollamaModel
        if (!llmModel) return sendJson(response, 503, { error: `No ${provider === 'lmstudio' ? 'LM Studio' : 'Ollama'} model is selected.` })
        const answer = await generateWithLlm(llmUrl, llmModel, prompt, provider)
        return sendJson(response, 200, { response: answer })
      }
      if (url.pathname === '/api/lan/cancel' && request.method === 'POST') {
        const body = await readJson(request, 10_000)
        const promptId = typeof body.promptId === 'string' ? body.promptId : ''
        if (!promptId) return sendJson(response, 400, { error: 'A prompt ID is required.' })
        const queue = await comfyFetch(settings.comfyUrl, '/queue') as { queue_running?: unknown[][]; queue_pending?: unknown[][] }
        const running = (queue.queue_running ?? []).some((item) => item[1] === promptId)
        if (running) await comfyFetch(settings.comfyUrl, '/interrupt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt_id: promptId }) })
        else await comfyFetch(settings.comfyUrl, '/queue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delete: [promptId] }) })
        return sendJson(response, 200, { cancelled: true })
      }
      if (url.pathname.startsWith('/api/lan/history/') && request.method === 'GET') {
        const promptId = decodeURIComponent(url.pathname.slice('/api/lan/history/'.length))
        const history = await comfyFetch(settings.comfyUrl, `/history/${encodeURIComponent(promptId)}`) as Record<string, unknown>
        const output = historyOutput(history, promptId, url.searchParams.get('kind') === 'image' ? 'image' : 'video')
        const entry = history[promptId] as { status?: { status_str?: string } } | undefined
        return sendJson(response, 200, { finished: Boolean(entry), error: entry?.status?.status_str === 'error' ? 'ComfyUI reported an execution error. Check the desktop console for the failed node.' : undefined, output })
      }
      if (url.pathname === '/api/lan/media' && request.method === 'GET') return proxyLanMedia(request, response, url.searchParams)
      return sendJson(response, 404, { error: 'Unknown mobile API route.' })
    }

    const distRoot = normalize(join(__dirname, '..', 'dist'))
    const requested = url.pathname === '/' || url.pathname === '/mobile' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '')
    const filePath = normalize(join(distRoot, requested))
    if (!(filePath === distRoot || filePath.startsWith(`${distRoot}\\`)) || !existsSync(filePath)) {
      const fallback = join(distRoot, 'index.html')
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' }); return createReadStream(fallback).pipe(response)
    }
    const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }
    response.writeHead(200, { 'content-type': mime[extname(filePath).toLowerCase()] ?? 'application/octet-stream', 'cache-control': requested === 'index.html' ? 'no-cache' : 'public, max-age=86400', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' })
    createReadStream(filePath).pipe(response)
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) })
  }
}

async function startLanServer() {
  const configuredPort = Number(process.env.MINIMAX_LAN_PORT)
  const port = Number.isInteger(configuredPort) && configuredPort >= 1024 && configuredPort <= 65535 ? configuredPort : 4178
  lanToken = await loadLanToken()
  return new Promise<void>((resolve) => {
    lanServer = createServer((request, response) => void handleLanRequest(request, response))
    lanServer.once('error', (error) => { lanStatus = { running: false, port, error: error.message }; resolve() })
    lanServer.listen(port, '0.0.0.0', () => {
      const origin = `http://${lanAddress()}:${port}`
      lanStatus = { running: true, port, url: `${origin}/?mobile=1&token=${lanToken}`, desktopUrl: `${origin}/?desktop=1&token=${lanToken}` }
      resolve()
    })
  })
}

function runFfmpeg(executable: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const configured = executable.trim().replace(/^(["'])|(["'])$/g, '') || 'ffmpeg'
    const executableInFolder = join(configured, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
    const resolvedExecutable = existsSync(executableInFolder) ? executableInFolder : configured
    const child = spawn(resolvedExecutable, args, { windowsHide: true })
    let errorText = ''
    child.stderr.on('data', (chunk) => { errorText = `${errorText}${chunk}`.slice(-8000) })
    child.once('error', (error) => reject(new Error(`Could not start FFmpeg: ${error.message}`)))
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg failed (${code}). ${errorText.split('\n').slice(-5).join(' ')}`)))
  })
}

function resolveMediaTool(executable: string, name: 'ffmpeg' | 'ffprobe') {
  const configured = executable.trim().replace(/^("')|("')$/g, '')
  if (configured && extname(configured).toLowerCase() === (process.platform === 'win32' ? '.exe' : '')) {
    const sibling = join(dirname(configured), process.platform === 'win32' ? `${name}.exe` : name)
    if (existsSync(sibling)) return sibling
    return name === 'ffmpeg' ? configured : name
  }
  const candidate = configured ? join(configured, process.platform === 'win32' ? `${name}.exe` : name) : ''
  return candidate && existsSync(candidate) ? candidate : name
}

function runFfprobe(executable: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(resolveMediaTool(executable, 'ffprobe'), args, { windowsHide: true })
    let stdout = ''; let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-8000) })
    child.once('error', (error) => reject(new Error(`Could not start FFprobe: ${error.message}`)))
    child.once('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(`FFprobe failed (${code}). ${stderr.split('\n').slice(-5).join(' ')}`)))
  })
}

type ClipVideoMetadata = { duration: number; fps: number; frameCount: number; width: number; height: number }

async function probeClipVideoMetadata(input: string, ffmpegPath: string): Promise<ClipVideoMetadata> {
  const raw = await runFfprobe(ffmpegPath, ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=width,height,avg_frame_rate,r_frame_rate,nb_frames,nb_read_frames,duration:format=duration', '-of', 'json', input])
  const payload = JSON.parse(raw) as { streams?: Array<{ width?: number; height?: number; avg_frame_rate?: string; r_frame_rate?: string; nb_frames?: string | number; nb_read_frames?: string | number; duration?: string | number }>; format?: { duration?: string | number } }
  const stream = payload.streams?.[0]
  if (!stream) throw new Error('No video stream was found in the selected clip.')
  const parseRate = (value?: string) => { const [numerator, denominator] = String(value ?? '').split('/').map(Number); return denominator > 0 ? numerator / denominator : Number(value) }
  const parsedFps = parseRate(stream.avg_frame_rate) || parseRate(stream.r_frame_rate) || 24
  const fps = Number.isFinite(parsedFps) && parsedFps > 0 ? parsedFps : 24
  const parsedDuration = Number(stream.duration ?? payload.format?.duration ?? 0)
  const duration = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 0
  const countedFrames = Number(stream.nb_read_frames)
  const declaredFrames = Number(stream.nb_frames)
  const frameCount = Number.isFinite(countedFrames) && countedFrames > 0 ? Math.round(countedFrames) : Number.isFinite(declaredFrames) && declaredFrames > 0 ? Math.round(declaredFrames) : Math.max(1, Math.round(duration * fps))
  return { duration: duration || frameCount / fps, fps, frameCount, width: Number(stream.width) || 0, height: Number(stream.height) || 0 }
}

function clipMasterSlug(value: string) {
  const stem = basename(value).replace(/\.[^.]+$/, '')
  return (stem || 'clip').replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'clip'
}

async function nextClipMasterPath(folder: string, stem: string, extension: string, alwaysVersion = false) {
  let version = 1
  const candidate = (value: number) => join(folder, `${stem}${alwaysVersion || value > 1 ? `_v${String(value).padStart(3, '0')}` : ''}.${extension}`)
  while (existsSync(candidate(version))) version += 1
  return candidate(version)
}

function runTool(executable: string, args: string[], label: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true })
    let errorText = ''
    child.stderr.on('data', (chunk) => { errorText = `${errorText}${chunk}`.slice(-8000) })
    child.once('error', (error) => reject(new Error(`Could not start ${label}: ${error.message}`)))
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`${label} failed (${code}). ${errorText.split('\n').slice(-5).join(' ')}`)))
  })
}

const RIFE_RELEASE_URL = 'https://github.com/nihui/rife-ncnn-vulkan/releases/download/20221029/rife-ncnn-vulkan-20221029-windows.zip'
function rifeDirectory() { return join(app.getPath('userData'), 'tools', 'rife-ncnn-vulkan') }
async function findRifeExecutable(root = rifeDirectory()): Promise<string | null> {
  try {
    const entries = await readdir(root, { withFileTypes: true })
    for (const entry of entries) {
      const candidate = join(root, entry.name)
      if (entry.isFile() && entry.name.toLowerCase() === 'rife-ncnn-vulkan.exe') return candidate
      if (entry.isDirectory()) { const nested = await findRifeExecutable(candidate); if (nested) return nested }
    }
  } catch { /* Not installed yet. */ }
  return null
}

async function resolveUploadSource(source: string) {
  if (!source.startsWith('minimax-media:')) {
    if (!existsSync(source) || !selectedMediaExtensions.has(extname(source).toLowerCase())) throw new Error('The selected media file is unavailable.')
    return source
  }
  const parsed = new URL(source)
  if (parsed.hostname === 'local' || parsed.hostname === 'selected') {
    const path = parsed.searchParams.get('path') ?? ''
    if (!existsSync(path) || !selectedMediaExtensions.has(extname(path).toLowerCase())) throw new Error('The selected media file is unavailable.')
    return path
  }
  if (parsed.hostname === 'comfy') {
    const upstream = parsed.searchParams.get('url')
    if (!upstream) throw new Error('The ComfyUI video address is missing.')
    const configured = new URL(cleanUrl((await loadSettings()).comfyUrl))
    const target = new URL(upstream)
    if (target.origin !== configured.origin || target.pathname !== '/view') throw new Error('The video is outside the configured ComfyUI server.')
    const response = await fetch(target, { signal: AbortSignal.timeout(90_000) }).catch((error: unknown) => {
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw new Error('ComfyUI did not return the source video within 90 seconds. Check its connection and retry.')
      throw error
    })
    if (!response.ok) throw new Error(`Could not retrieve the ComfyUI video (${response.status}).`)
    if (!response.body) throw new Error('ComfyUI returned an empty video response.')
    const extension = extname(target.searchParams.get('filename') ?? '').toLowerCase()
    if (!selectedMediaExtensions.has(extension)) throw new Error('The ComfyUI media type is unsupported.')
    const temporary = join(app.getPath('temp'), `minimax-upload-${randomUUID()}${extension}`)
    try { await pipeline(Readable.fromWeb(response.body as unknown as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(temporary)) }
    catch (error) { await unlink(temporary).catch(() => undefined); throw error }
    return temporary
  }
  throw new Error('Unsupported media source.')
}

async function resolveVideoSource(source: string) {
  const resolved = await resolveUploadSource(source)
  if (!mediaExtensions.has(extname(resolved).toLowerCase())) throw new Error('The selected video file is unavailable.')
  return resolved
}

let movieEditorWindow: BrowserWindow | null = null
let studioWindow: BrowserWindow | null = null

function createMovieEditorWindow() {
  if (movieEditorWindow && !movieEditorWindow.isDestroyed()) { movieEditorWindow.focus(); return }
  nativeTheme.themeSource = 'dark'
  const window = new BrowserWindow({
    width: 1480, height: 940, minWidth: 980, minHeight: 680,
    backgroundColor: '#171719', title: 'Oyama AI Movie',
    autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  })
  movieEditorWindow = window
  window.setMenuBarVisibility(false)
  void loadSettings().then((settings) => window.webContents.setZoomFactor(settings.uiScale / 100))
  window.on('closed', () => { if (movieEditorWindow === window) movieEditorWindow = null })
  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) void window.loadURL(`${devUrl}${devUrl.includes('?') ? '&' : '?'}movieEditor=1`)
  else void window.loadFile(join(__dirname, '..', 'dist', 'index.html'), { query: { movieEditor: '1' } })
}

function createWindow() {
  nativeTheme.themeSource = 'dark'
  const window = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 860,
    minHeight: 620,
    backgroundColor: '#071524',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#243c53', symbolColor: '#d8ebff', height: 48 },
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  studioWindow = window
  window.on('closed', () => { if (studioWindow === window) studioWindow = null })
  window.setMenuBarVisibility(false)
  void loadSettings().then((settings) => window.webContents.setZoomFactor(settings.uiScale / 100))
  window.webContents.setWindowOpenHandler(({ url, frameName }) => {
    if (url !== 'about:blank') return { action: 'deny' }
    const isPreviewMonitor = frameName === 'oyama-ai-video-studio-preview' || frameName === 'oyama-continuation'
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        // The monitor is intentionally a wide, independently movable surface.
        // Other popouts (for example, the copilot) retain their compact layout.
        width: isPreviewMonitor ? 1080 : 560,
        height: isPreviewMonitor ? 720 : 780,
        minWidth: isPreviewMonitor ? 560 : 420,
        minHeight: isPreviewMonitor ? 420 : 560,
        resizable: true,
        movable: true,
        backgroundColor: isPreviewMonitor ? '#07100b' : '#071524',
        titleBarStyle: 'hidden',
        titleBarOverlay: { color: '#243c53', symbolColor: '#d8ebff', height: 48 },
        webPreferences: {
          preload: join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
        },
      },
    }
  })
  window.webContents.on('did-create-window', (child) => child.setMenuBarVisibility(false))
  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) void window.loadURL(devUrl)
  else void window.loadFile(join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(async () => {
  if (existsSync(factoryResetMarkerPath())) {
    await session.defaultSession.clearStorageData()
    await saveSettings(defaultSettings())
    await saveLanToken(randomUUID().replace(/-/g, ''))
    await writeAtomicFile(legacyMigrationMarkerPath(), JSON.stringify({ factoryReset: true, browserStorageMigrated: true }))
    if (existsSync(pendingBrowserStorageMigrationPath())) await unlink(pendingBrowserStorageMigrationPath())
    await unlink(factoryResetMarkerPath())
  }
  const repairBrowserStorage = existsSync(pendingBrowserStorageMigrationPath())
  await migrateLegacyUserData({ force: repairBrowserStorage, replaceBrowserStorage: repairBrowserStorage })
  if (repairBrowserStorage) await unlink(pendingBrowserStorageMigrationPath()).catch(() => undefined)
  await startLanServer()
  protocol.handle('minimax-media', async (request) => {
    const requestUrl = new URL(request.url)
    if (requestUrl.hostname === 'comfy') {
      const target = requestUrl.searchParams.get('url')
      if (!target) return new Response('Missing ComfyUI media URL', { status: 400 })
      const configuredUrl = new URL(cleanUrl((await loadSettings()).comfyUrl))
      const targetUrl = new URL(target)
      if (targetUrl.origin !== configuredUrl.origin || targetUrl.pathname !== '/view') {
        return new Response('Media URL is outside the configured ComfyUI server', { status: 403 })
      }
      const upstream = await net.fetch(targetUrl.toString(), { headers: request.headers })
      const headers = new Headers(upstream.headers)
      headers.delete('content-security-policy')
      headers.delete('content-disposition')
      headers.set('access-control-allow-origin', '*')
      return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers })
    }

    const requestedPath = requestUrl.searchParams.get('path')
    if (!requestedPath) return new Response('Missing media path', { status: 400 })
    if (requestUrl.hostname === 'thumbnail') {
      const root = resolve(app.getPath('userData'), 'video-thumbnails')
      const candidate = resolve(requestedPath)
      const child = relative(root, candidate)
      if (!child || child.startsWith('..') || isAbsolute(child) || extname(candidate).toLowerCase() !== '.jpg' || !existsSync(candidate)) return new Response('Thumbnail is unavailable', { status: 404 })
      return localMediaResponse(candidate, request)
    }
    if (requestUrl.hostname === 'selected') {
      if (!existsSync(requestedPath) || !selectedMediaExtensions.has(extname(requestedPath).toLowerCase())) return new Response('Selected media is unavailable', { status: 404 })
      return localMediaResponse(requestedPath, request)
    }
    const configured = normalize((await loadSettings()).outputDirectory)
    const candidate = normalize(requestedPath)
    const insideOutput = candidate.toLowerCase().startsWith(`${configured.toLowerCase()}\\`) || candidate.toLowerCase() === configured.toLowerCase()
    if (!insideOutput || !existsSync(candidate)) return new Response('Media is outside the configured output directory', { status: 403 })
    return localMediaResponse(candidate, request)
  })
  ipcMain.handle('settings:get', () => loadSettings())
  ipcMain.handle('migration:legacy-status', () => legacyMigrationStatus())
  ipcMain.handle('migration:run', async (_event, replaceBrowserStorage = false) => {
    if (replaceBrowserStorage === true) {
      await writeAtomicFile(pendingBrowserStorageMigrationPath(), `${JSON.stringify({ requestedAt: new Date().toISOString() })}\n`)
      app.relaunch()
      app.exit(0)
      return { available: true, migrated: false, needsBrowserStorageRepair: false }
    }
    await migrateLegacyUserData({ force: true, replaceBrowserStorage: replaceBrowserStorage === true })
    return legacyMigrationStatus()
  })
  ipcMain.handle('system:gpu-telemetry', () => readGpuTelemetry())
  ipcMain.handle('render-benchmarks:get', () => loadRenderBenchmarks())
  ipcMain.handle('render-benchmarks:save', (_event, benchmarks: unknown) => saveRenderBenchmarks(benchmarks))
  ipcMain.handle('window:set-always-on-top', (event, enabled: boolean) => {
    const target = BrowserWindow.fromWebContents(event.sender)
    if (!target) return false
    target.setAlwaysOnTop(Boolean(enabled), 'floating')
    return target.isAlwaysOnTop()
  })
  ipcMain.handle('window:open-studio', () => { if (!studioWindow || studioWindow.isDestroyed()) createWindow(); if (studioWindow?.isMinimized()) studioWindow.restore(); studioWindow?.show(); studioWindow?.focus() })
  ipcMain.handle('window:open-movie-editor', () => { createMovieEditorWindow() })
  ipcMain.handle('video:continuation-source', async (_event, sources: string[], throughTime: number | null, outputDirectory: string, ffmpegPath: string) => {
    if (!Array.isArray(sources) || !sources.length || sources.length > 8) throw new Error('Select a valid continuation source.')
    if (throughTime !== null && (!Number.isFinite(throughTime) || throughTime < 0)) throw new Error('Choose a valid source frame.')
    let input = ''
    let temporaryInput = false
    let lastError: unknown
    for (const source of sources) {
      try {
        input = await resolveVideoSource(source)
        temporaryInput = source.startsWith('minimax-media:') && new URL(source).hostname === 'comfy'
        break
      } catch (error) { lastError = error }
    }
    if (!input) throw lastError ?? new Error('The source video is unavailable.')
    try {
    const metadata = await probeClipVideoMetadata(input, ffmpegPath)
    if (throughTime !== null && throughTime >= metadata.duration) throw new Error('The chosen frame is outside this source. Choose a frame within the video.')
    // LoadVideo preserves native cadence, while the H3 merger uses 24 fps.
    // Normalize before loading so a 30/60 fps source cannot play in slow motion.
    const frames = throughTime === null ? Math.max(1, Math.round(metadata.duration * 24)) : Math.floor(throughTime * 24) + 1
    const folder = join(outputDirectory, 'continuations', '_sources')
    await mkdir(folder, { recursive: true })
    const output = join(folder, `source-${randomUUID()}.mp4`)
    const audioStreams = JSON.parse(await runFfprobe(ffmpegPath, ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=index', '-of', 'json', input])) as { streams?: unknown[] }
    const hasAudio = Boolean(audioStreams.streams?.length)
    await runFfmpeg(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', input,
      ...(!hasAudio ? ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo'] : []),
      '-map', '0:v:0', '-map', hasAudio ? '0:a:0' : '1:a:0', '-vf', `fps=24,trim=end_frame=${frames},setpts=PTS-STARTPTS,pad=ceil(iw/2)*2:ceil(ih/2)*2`,
      '-af', `apad,atrim=duration=${frames / 24},asetpts=PTS-STARTPTS`,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '24', '-fps_mode', 'cfr',
      '-c:a', 'aac', '-movflags', '+faststart', '-n', output]).catch(async error => {
        await unlink(output).catch(() => undefined)
        throw error
      })
    return output
    } finally {
      if (temporaryInput) await unlink(input).catch(() => undefined)
    }
  })
  ipcMain.handle('window:open-dev-tools', (event) => {
    const target = BrowserWindow.fromWebContents(event.sender)
    if (!target || target.isDestroyed()) throw new Error('The current window is unavailable. Reopen the studio and try again.')
    target.webContents.openDevTools({ mode: 'detach', activate: true })
  })
  ipcMain.handle('video:export', async (event, source: string, suggestedName: string) => {
    const input = await resolveVideoSource(source)
    const extension = extname(input).slice(1)
    const owner = BrowserWindow.fromWebContents(event.sender)
    const options = { title: 'Export video', defaultPath: `${basename(suggestedName).replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*]/g, '-')}.${extension}`, filters: [{ name: 'Video', extensions: [extension] }] }
    const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    if (resolve(input) === resolve(result.filePath)) throw new Error('Choose a different destination to preserve the source video.')
    // An export must never replace a source or an earlier saved version.
    await copyFile(input, result.filePath, constants.COPYFILE_EXCL).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'EEXIST') throw new Error('That file already exists. Choose a new filename for this export.')
      throw error
    })
    return result.filePath
  })
  ipcMain.handle('lan:status', () => lanStatus)
  ipcMain.handle('lan:sync-characters', (_event, characters: unknown[]) => { mobileCharacterLibrary = Array.isArray(characters) ? characters : []; return { synced: mobileCharacterLibrary.length } })
  ipcMain.handle('lan:rotate-token', async () => {
    lanToken = randomUUID().replace(/-/g, '')
    await saveLanToken(lanToken)
    if (lanStatus.running) {
      const origin = `http://${lanAddress()}:${lanStatus.port ?? 4178}`
      lanStatus = { ...lanStatus, url: `${origin}/?mobile=1&token=${lanToken}`, desktopUrl: `${origin}/?desktop=1&token=${lanToken}` }
    }
    return lanStatus
  })
  ipcMain.handle('settings:save', (_event, settings: AppSettings) => saveSettings(settings))
  ipcMain.handle('settings:factory-reset', (_event, confirmation: unknown) => factoryResetSettings(confirmation))
  ipcMain.handle('workflow:export-json', async (_event, suggestedName: string, workflow: unknown) => {
    const safeName = basename(String(suggestedName || 'minimax-workflow.json')).replace(/[^a-z0-9._ -]/gi, '_')
    const result = await dialog.showSaveDialog({
      title: 'Export ComfyUI API workflow',
      defaultPath: join(app.getPath('documents'), safeName.toLowerCase().endsWith('.json') ? safeName : `${safeName}.json`),
      filters: [{ name: 'ComfyUI workflow JSON', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return null
    const filePath = result.filePath.toLowerCase().endsWith('.json') ? result.filePath : `${result.filePath}.json`
    await writeAtomicFile(filePath, `${JSON.stringify(workflow, null, 2)}\n`)
    return filePath
  })
  ipcMain.handle('window:set-ui-scale', (event, scale: number) => {
    const target = BrowserWindow.fromWebContents(event.sender)
    const value = Math.max(0.75, Math.min(1.5, Number(scale) || 1))
    target?.webContents.setZoomFactor(value)
    return Math.round(value * 100)
  })
  ipcMain.handle('dialog:directory', async (_event, initialPath?: string) => {
    const result = await dialog.showOpenDialog({
      defaultPath: initialPath && existsSync(initialPath) ? initialPath : undefined,
      properties: ['openDirectory', 'createDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('dialog:media', async (_event, type: 'image' | 'video' | 'audio') => {
    const filters = {
      image: { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
      video: { name: 'Videos', extensions: ['mp4', 'mov', 'mkv', 'webm'] },
      audio: { name: 'Audio', extensions: ['wav', 'mp3', 'flac', 'm4a', 'ogg'] },
    }
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [filters[type]] })
    return result.canceled ? null : { path: result.filePaths[0], name: basename(result.filePaths[0]) }
  })
  ipcMain.handle('dialog:videos', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'mkv', 'webm'] }] })
    if (result.canceled) return []
    return result.filePaths.map((path) => ({ path, name: basename(path) }))
  })
  ipcMain.handle('models:scan', async (_event, settings: AppSettings) => {
    const groups = await Promise.all(modelKinds.map((kind) => scanDirectory(settings.paths[kind], kind)))
    return groups.flat().sort((a, b) => a.name.localeCompare(b.name))
  })
  ipcMain.handle('comfy:status', async (_event, url: string) => {
    const started = Date.now()
    try {
      const stats = await comfyFetch(url, '/system_stats', { signal: AbortSignal.timeout(15_000) }) as { system?: { argv?: string[] } }
      const argv = stats.system?.argv ?? []
      const outputIndex = argv.findIndex(value => value === '--output-directory')
      const detectedOutputDirectory = outputIndex >= 0 ? argv[outputIndex + 1] : argv.find(value => value.startsWith('--output-directory='))?.slice('--output-directory='.length)
      return { connected: true, latencyMs: Date.now() - started, stats, detectedOutputDirectory }
    } catch (error) {
      return { connected: false, latencyMs: Date.now() - started, error: error instanceof Error ? error.message : String(error) }
    }
  })
  ipcMain.handle('comfy:submit', async (_event, url: string, prompt: unknown, clientId?: string) => {
    try {
      const result = await comfyFetch(url, '/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, client_id: clientId ?? randomUUID() }),
      signal: AbortSignal.timeout(60_000),
      }) as { prompt_id?: unknown; node_errors?: unknown }
      if (typeof result.prompt_id !== 'string' || !result.prompt_id) throw new Error('ComfyUI accepted the request but did not return a prompt ID. Check its queue before retrying to avoid a duplicate render.')
      return result
    } catch (error) {
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw new Error('ComfyUI did not respond to the workflow submission within one minute. Check its queue before retrying to avoid a duplicate render.')
      throw error
    }
  })
  ipcMain.handle('comfy:queue', (_event, url: string) => comfyFetch(url, '/queue', { signal: AbortSignal.timeout(10_000) }))
  ipcMain.handle('comfy:info', (_event, url: string) => comfyFetch(url, '/object_info', { signal: AbortSignal.timeout(30_000) }))
  ipcMain.handle('comfy:upload-data', async (_event, url: string, data: string) => {
    if (!data.startsWith('data:image/png;base64,') || data.length > 64_000_000) throw new Error('Invalid prepared image.')
    const form = new FormData()
    form.append('image', new Blob([Buffer.from(data.split(',')[1], 'base64')], { type: 'image/png' }), `frame-${randomUUID()}.png`)
    form.append('type', 'input')
    form.append('subfolder', 'minimax-desktop')
    return comfyFetch(url, '/upload/image', { method: 'POST', body: form })
  })
  ipcMain.handle('comfy:output-image', async (_event, url: string, file: { filename: string; subfolder?: string; type?: string }) => {
    const query = new URLSearchParams({ filename: file.filename, subfolder: file.subfolder ?? '', type: file.type ?? 'output' })
    const response = await fetch(`${cleanUrl(url)}/view?${query}`)
    if (!response.ok) throw new Error(`Image download failed (${response.status}).`)
    const mime = response.headers.get('content-type')?.split(';')[0] ?? ''
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime)) throw new Error('ComfyUI did not return a supported image.')
    return `data:${mime};base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`
  })
  ipcMain.handle('comfy:save-output-image', async (_event, url: string, file: { filename: string; subfolder?: string; type?: string }, requestedOutput: string) => {
    const settings = await loadSettings()
    const outputDirectory = normalize(requestedOutput)
    if (outputDirectory.toLowerCase() !== normalize(settings.outputDirectory).toLowerCase()) throw new Error('Character images must be saved inside the configured output folder.')
    const query = new URLSearchParams({ filename: basename(file.filename), subfolder: file.subfolder ?? '', type: file.type ?? 'output' })
    const response = await fetch(`${cleanUrl(url)}/view?${query}`)
    if (!response.ok) throw new Error(`Character image download failed (${response.status}).`)
    const mime = response.headers.get('content-type')?.split(';')[0] ?? ''
    const extension = mime === 'image/jpeg' ? '.jpg' : mime === 'image/webp' ? '.webp' : mime === 'image/png' ? '.png' : ''
    if (!extension) throw new Error('ComfyUI did not return a supported character image.')
    const directory = join(outputDirectory, 'MiniMax Character References')
    await mkdir(directory, { recursive: true })
    const target = join(directory, `character-${Date.now()}-${randomUUID().slice(0, 8)}${extension}`)
    await writeFile(target, Buffer.from(await response.arrayBuffer()))
    return { path: target, name: basename(target) }
  })
  ipcMain.handle('comfy:save-still-image', async (_event, url: string, file: { filename: string; subfolder?: string; type?: string }, requestedOutput: string) => {
    const settings = await loadSettings()
    const outputDirectory = normalize(requestedOutput)
    if (outputDirectory.toLowerCase() !== normalize(settings.outputDirectory).toLowerCase()) throw new Error('Reference stills must be saved inside the configured output folder.')
    const query = new URLSearchParams({ filename: basename(file.filename), subfolder: file.subfolder ?? '', type: file.type ?? 'output' })
    const response = await fetch(`${cleanUrl(url)}/view?${query}`)
    if (!response.ok) throw new Error(`Reference still download failed (${response.status}).`)
    const mime = response.headers.get('content-type')?.split(';')[0] ?? ''
    const extension = mime === 'image/jpeg' ? '.jpg' : mime === 'image/webp' ? '.webp' : mime === 'image/png' ? '.png' : ''
    if (!extension) throw new Error('ComfyUI did not return a supported reference still.')
    const directory = join(outputDirectory, 'MiniMax Reference Stills')
    await mkdir(directory, { recursive: true })
    const target = join(directory, `ref2va-still-${Date.now()}-${randomUUID().slice(0, 8)}${extension}`)
    await writeFile(target, Buffer.from(await response.arrayBuffer()))
    return { path: target, name: basename(target) }
  })
  ipcMain.handle('comfy:history', (_event, url: string, promptId: string) => comfyFetch(url, `/history/${encodeURIComponent(promptId)}`, { signal: AbortSignal.timeout(10_000) }))
  ipcMain.handle('comfy:cancel', async (_event, url: string, promptId: string) => {
    if (!promptId || typeof promptId !== 'string') throw new Error('A ComfyUI prompt ID is required to cancel a generation.')
    const queue = await comfyFetch(url, '/queue') as { queue_running?: unknown[][]; queue_pending?: unknown[][] }
    const running = (queue.queue_running ?? []).some((item) => item[1] === promptId)
    const pending = (queue.queue_pending ?? []).some((item) => item[1] === promptId)
    if (running) {
      await comfyFetch(url, '/interrupt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_id: promptId }),
      })
      return { cancelled: true, state: 'running' as const }
    }
    if (pending) {
      await comfyFetch(url, '/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delete: [promptId] }),
      })
      return { cancelled: true, state: 'pending' as const }
    }
    const history = await comfyFetch(url, `/history/${encodeURIComponent(promptId)}`) as Record<string, unknown>
    return { cancelled: false, state: promptId in history ? 'finished' as const : 'unknown' as const }
  })
  ipcMain.handle('outputs:trash', async (_event, source: string, mode: 'trash' | 'permanent' = 'trash') => {
    if (typeof source !== 'string' || !source) throw new Error('An output file is required.')
    const settings = await loadSettings()
    return trashOutput(source, settings.outputDirectory, settings.comfyUrl, (path) => shell.trashItem(path), mode)
  })
  ipcMain.handle('outputs:latest', async (_event, outputDirectory: string, since: number, kind: 'video' | 'audio' = 'video') => {
    return findLatestMedia(outputDirectory, since, kind)
  })
  ipcMain.handle('outputs:resolve', async (_event, outputDirectory: string, file: { filename?: unknown; subfolder?: unknown; type?: unknown }) => {
    const settings = await loadSettings()
    if (normalize(outputDirectory).toLowerCase() !== normalize(settings.outputDirectory).toLowerCase()) return null
    // DesktopApi.resolveOutput promises a filesystem path. Callers persist this
    // value for frame extraction and create a media URL separately. Returning a
    // minimax-media URL here caused that URL to be treated as a path and made
    // continuation fail after otherwise successful renders.
    return resolveComfyOutput(outputDirectory, file)
  })
  ipcMain.handle('comfy:upload', async (_event, url: string, filePath: string, subfolder = 'minimax-desktop') => {
    // Completed jobs may persist a minimax-media URL instead of a filesystem
    // path. Resolve it through the same guarded media loader used by frame
    // extraction so continuation can reuse a video that already previews.
    const source = await resolveUploadSource(filePath)
    const temporarySource = filePath.startsWith('minimax-media:') && new URL(filePath).hostname === 'comfy'
    try {
      const bytes = await readFile(source)
      const form = new FormData()
      form.append('image', new Blob([bytes]), basename(source))
      form.append('type', 'input')
      form.append('subfolder', subfolder)
      form.append('overwrite', 'true')
      try { return await comfyFetch(url, '/upload/image', { method: 'POST', body: form, signal: AbortSignal.timeout(90_000) }) }
      catch (error) {
        if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw new Error(`ComfyUI did not finish uploading ${basename(source)} within 90 seconds. Check that ComfyUI is responsive, then retry this beat.`)
        throw error
      }
    } finally {
      if (temporarySource) await unlink(source).catch(() => undefined)
    }
  })
  ipcMain.handle('ollama:status', async (_event, url: string, provider: LlmProvider = 'ollama') => ({ connected: true, models: await listLlmModels(url, provider) }))
  ipcMain.handle('ollama:generate', async (_event, url: string, model: string, prompt: string, provider: LlmProvider = 'ollama') => generateWithLlm(url, model, prompt, provider))
  ipcMain.handle('ollama:vision', async (_event, url: string, model: string, prompt: string, imagePaths: string[], provider: LlmProvider = 'ollama') => {
    const allowedImages = new Set(['.png', '.jpg', '.jpeg', '.webp'])
    const validPaths = [...new Set(imagePaths)].filter((filePath) => existsSync(filePath) && allowedImages.has(extname(filePath).toLowerCase())).slice(0, 6)
    const images: Array<{ base64: string; mime: string }> = []
    for (const filePath of validPaths) {
      const bytes = await readFile(filePath)
      if (bytes.length <= 25_000_000) {
        const extension = extname(filePath).toLowerCase()
        const mime = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg'
        images.push({ base64: bytes.toString('base64'), mime })
      }
    }
    if (!images.length) throw new Error('No readable local reference images were available to the copilot.')
    const data = provider === 'lmstudio'
      ? await llmFetch(url, lmStudioPath(url, '/chat/completions'), provider, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, ...images.map((image) => ({ type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.base64}` } }))] }], stream: false, temperature: 0.45, max_tokens: 1800 }) }) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } | string }
      : await llmFetch(url, '/api/chat', provider, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt, images: images.map((image) => image.base64) }], stream: false, keep_alive: 0, think: false, options: { temperature: 0.45, num_predict: 1800 } }) }) as { message?: { content?: string }; error?: string }
    const answer = provider === 'lmstudio' ? finalOllamaAnswer(('choices' in data ? data.choices?.[0]?.message?.content : '') ?? '') : finalOllamaAnswer(('message' in data ? data.message?.content : '') ?? '')
    const error = 'error' in data ? data.error : undefined
    if (!answer) throw new Error(typeof error === 'string' ? error : error?.message || `${provider === 'lmstudio' ? 'LM Studio' : 'Ollama'} could not inspect the supplied reference images. Choose a local vision-capable model in Settings.`)
    return answer
  })
  ipcMain.handle('ollama:structured', async (_event, url: string, model: string, prompt: string, schema: Record<string, unknown>, provider: LlmProvider = 'ollama', imagePaths: string[] = []) => {
    const allowedImages = new Set(['.png', '.jpg', '.jpeg', '.webp'])
    const requestedPaths = imagePaths.slice(0, 6)
    const images: Array<{ base64: string; mime: string }> = []
    let totalImageBytes = 0
    for (const filePath of requestedPaths) {
      // Keep reference-to-pixel indexing intact: stop at the first invalid or
      // oversized source rather than silently shifting later images forward.
      if (!existsSync(filePath) || !allowedImages.has(extname(filePath).toLowerCase())) break
      const bytes = await readFile(filePath)
      if (bytes.length > 25_000_000 || totalImageBytes + bytes.length > 50_000_000) break
      totalImageBytes += bytes.length
      const extension = extname(filePath).toLowerCase()
      const mime = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg'
      images.push({ base64: bytes.toString('base64'), mime })
    }
    const data = await llmFetch(url, provider === 'lmstudio' ? lmStudioPath(url, '/chat/completions') : '/api/chat', provider, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(provider === 'lmstudio' ? { model, messages: [{ role: 'user', content: images.length ? [{ type: 'text', text: prompt }, ...images.map((image) => ({ type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.base64}` } }))] : prompt }], stream: false, response_format: { type: 'json_schema', json_schema: { name: 'oyama_ai_video_studio_response', strict: true, schema } }, temperature: 0.2, max_tokens: 6000 } : {
        model,
        messages: [{ role: 'user', content: prompt, ...(images.length ? { images: images.map((image) => image.base64) } : {}) }],
        stream: false,
        keep_alive: 0,
        think: false,
        format: schema,
        options: { temperature: 0.2, num_predict: 6000 },
      }),
    }) as { message?: { content?: string }; choices?: Array<{ message?: { content?: string } }>; error?: string | { message?: string } }
    const content = finalOllamaAnswer(provider === 'lmstudio' ? data.choices?.[0]?.message?.content ?? '' : data.message?.content ?? '')
    if (!content) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || `${provider === 'lmstudio' ? 'LM Studio' : 'Ollama'} returned an empty structured response.`)
    try { return JSON.parse(content) }
    catch { throw new Error(`${provider === 'lmstudio' ? 'LM Studio' : 'Ollama'} returned a response that was not valid JSON.`) }
  })
  ipcMain.handle('file:data-url', async (_event, filePath: string) => {
    const extension = extname(filePath).toLowerCase()
    const mime = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg'
    return `data:${mime};base64,${(await readFile(filePath)).toString('base64')}`
  })
  ipcMain.handle('file:media-url', (_event, filePath: string) => {
    if (!existsSync(filePath) || !selectedMediaExtensions.has(extname(filePath).toLowerCase())) throw new Error('The selected media is unavailable.')
    return `minimax-media://selected?path=${encodeURIComponent(filePath)}`
  })
  ipcMain.handle('media:validate', async (_event, files: Array<{ path?: unknown; kind?: unknown }>) => {
    if (!Array.isArray(files) || files.length > 16) throw new Error('Validate no more than 16 media files at once.')
    return Promise.all(files.map(async (file) => {
      const path = typeof file?.path === 'string' ? file.path : ''
      const kind = file?.kind === 'image' || file?.kind === 'video' || file?.kind === 'audio' ? file.kind : 'image'
      if (!path) return { path, valid: false, reason: 'Missing file path.' }
      if (path.startsWith('minimax-media:')) return { path, valid: true }
      const extensions = kind === 'image' ? imageExtensions : kind === 'video' ? mediaExtensions : new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'])
      if (!extensions.has(extname(path).toLowerCase())) return { path, valid: false, reason: `Expected a supported ${kind} file.` }
      const details = await stat(path).catch(() => null)
      if (!details?.isFile() || details.size < 1) return { path, valid: false, reason: 'File is missing or empty.' }
      return { path, valid: true }
    }))
  })
  ipcMain.handle('video:metadata', async (_event, source: string, ffmpegPath: string) => {
    const input = await resolveVideoSource(source)
    return probeClipVideoMetadata(input, ffmpegPath)
  })
  ipcMain.handle('clip-master:frames', async (_event, source: string, frames: Array<{ index: number; role: 'start' | 'end' | 'frame' }>, outputDirectory: string, ffmpegPath: string, sourceName: string) => {
    if (!Array.isArray(frames) || !frames.length || frames.length > 100) throw new Error('Choose between 1 and 100 frames to save.')
    const settings = await loadSettings()
    if (normalize(outputDirectory).toLowerCase() !== normalize(settings.clipMasterOutputDirectory).toLowerCase()) throw new Error('Clip Master frames must be saved inside the configured Clip Master output folder.')
    const input = await resolveVideoSource(source)
    const metadata = await probeClipVideoMetadata(input, ffmpegPath)
    if (frames.some((item) => !Number.isFinite(Number(item.index)) || Number(item.index) < 0 || Math.floor(Number(item.index)) >= metadata.frameCount)) throw new Error(`Choose frame indexes between 0 and ${metadata.frameCount - 1}.`)
    const folder = join(outputDirectory, 'ClipMaster', clipMasterSlug(sourceName))
    await mkdir(folder, { recursive: true })
    const files: Array<{ path: string; name: string; index: number; role: 'start' | 'end' | 'frame' }> = []
    for (const item of frames) {
      const index = Math.max(0, Math.floor(Number(item.index)))
      if (!Number.isFinite(index)) continue
      const label = item.role === 'start' ? 'start_frame' : item.role === 'end' ? 'end_frame' : 'frame'
      const output = await nextClipMasterPath(folder, `${clipMasterSlug(sourceName)}_${label}_${String(index).padStart(4, '0')}`, 'png')
      await runFfmpeg(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', input, '-vf', `select=eq(n\\,${index})`, '-vsync', 'vfr', '-frames:v', '1', '-update', '1', '-y', output])
      const created = await stat(output).catch(() => null)
      if (!created?.size) throw new Error(`FFmpeg did not produce frame ${index}.`)
      files.push({ path: output, name: basename(output), index, role: item.role })
    }
    return { folder, files }
  })
  ipcMain.handle('clip-master:choose-export-path', async (_event, outputDirectory: string, sourceName: string) => {
    const folder = join(outputDirectory, 'ClipMaster', clipMasterSlug(sourceName))
    const suggested = await nextClipMasterPath(folder, `${clipMasterSlug(sourceName)}_clipmaster`, 'mp4', true)
    const result = await dialog.showSaveDialog({
      title: 'Export Clip Master video',
      defaultPath: suggested,
      filters: [{ name: 'MP4 video', extensions: ['mp4'] }],
    })
    return result.canceled || !result.filePath ? null : result.filePath
  })
  ipcMain.handle('clip-master:trim', async (_event, source: string, startFrame: number, endFrame: number, fps: number, outputPath: string, ffmpegPath: string) => {
    const start = Math.max(0, Math.floor(Number(startFrame))); const end = Math.max(start, Math.floor(Number(endFrame))); const requestedRate = Number(fps)
    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(requestedRate) || requestedRate <= 0) throw new Error('Choose a valid frame range and frame rate.')
    if (!isAbsolute(outputPath) || extname(outputPath).toLowerCase() !== '.mp4') throw new Error('Choose a valid .mp4 export file location.')
    if (existsSync(outputPath)) throw new Error(`“${basename(outputPath)}” already exists. Choose a new versioned filename so no earlier export is overwritten.`)
    const input = await resolveVideoSource(source)
    const metadata = await probeClipVideoMetadata(input, ffmpegPath)
    if (end >= metadata.frameCount) throw new Error(`End frame ${end} is outside this clip. The final frame is ${metadata.frameCount - 1}.`)
    const rate = metadata.fps
    const folder = dirname(outputPath); await mkdir(folder, { recursive: true })
    const duration = (end - start + 1) / rate
    const startSeconds = start / rate
    const endSeconds = startSeconds + duration
    const outputRate = Number.isInteger(rate) ? String(rate) : rate.toFixed(6)
    // select + setpts produces a frame-indexed CFR timeline. Do not combine
    // output -r with VFR fps_mode: newer FFmpeg rejects that contradictory pair.
    try {
      await runFfmpeg(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', input, '-vf', `select=between(n\\,${start}\\,${end}),setpts=N/${outputRate}/TB`, '-af', `atrim=start=${startSeconds}:end=${endSeconds},asetpts=PTS-STARTPTS`, '-t', duration.toFixed(6), '-map', '0:v:0', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', outputRate, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-y', outputPath])
    } catch (error) {
      // A failed encode can leave a tiny, unusable MP4 behind. Remove only
      // that newly requested export so retrying the same save path is safe.
      await unlink(outputPath).catch(() => undefined)
      throw error
    }
    const created = await stat(outputPath).catch(() => null); if (!created?.size) throw new Error('FFmpeg completed without producing the Clip Master export.')
    return { path: outputPath, name: basename(outputPath), url: `minimax-media://local?path=${encodeURIComponent(outputPath)}`, folder, frameCount: end - start + 1, duration }
  })
  ipcMain.handle('video:frame', async (_event, source: string, position: number | 'last', outputDirectory: string, ffmpegPath: string) => {
    const input = await resolveVideoSource(source)
    const framesDirectory = join(outputDirectory, 'Oyama AI Video Studio Frames')
    await mkdir(framesDirectory, { recursive: true })
    const label = position === 'last' ? 'last' : `at_${Math.max(0, position).toFixed(2).replace('.', '-')}`
    const name = `frame_${label}_${Date.now()}.png`
    const output = join(framesDirectory, name)
    if (position === 'last') {
      const metadata = await probeClipVideoMetadata(input, ffmpegPath)
      const lastFrame = Math.max(0, metadata.frameCount - 1)
      await runFfmpeg(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', input, '-map', '0:v:0', '-vf', `select=eq(n\\,${lastFrame})`, '-vsync', 'vfr', '-frames:v', '1', '-update', '1', '-y', output])
    } else {
      await runFfmpeg(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-ss', String(Math.max(0, position)), '-i', input, '-map', '0:v:0', '-frames:v', '1', '-update', '1', '-y', output])
    }
    const extracted = await stat(output).catch(() => null)
    if (!extracted?.size) throw new Error('FFmpeg completed without producing a frame. Check that the clip contains a video stream.')
    return { path: output, name }
  })
  ipcMain.handle('video:thumbnail', async (_event, source: string, ffmpegPath: string) => {
    // A completed render may only have a guarded ComfyUI URL when its output
    // directory differs from the configured local folder.
    const remote = source.startsWith('minimax-media:') && new URL(source).hostname === 'comfy'
    const localInput = remote ? null : await resolveVideoSource(source)
    const sourceStat = localInput ? await stat(localInput) : null
    const root = join(app.getPath('userData'), 'video-thumbnails')
    await mkdir(root, { recursive: true })
    const key = createHash('sha256').update(`v2|${localInput ?? source}|${sourceStat?.size ?? ''}|${sourceStat?.mtimeMs ?? ''}`).digest('hex')
    const output = join(root, `${key}.jpg`)
    if (!existsSync(output)) {
      const temporary = join(root, `${key}-${randomUUID()}.jpg`)
      let input: string | null = localInput
      try {
        if (!input) input = await resolveVideoSource(source)
        const videoInput = input
        const metadata = await probeClipVideoMetadata(videoInput, ffmpegPath).catch(() => null)
        const position = metadata?.duration ? Math.min(2, metadata.duration / 3) : 0.2
        const extract = (at: number) => runFfmpeg(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-ss', String(at), '-i', videoInput, '-map', '0:v:0', '-frames:v', '1', '-vf', 'scale=480:270:force_original_aspect_ratio=decrease:force_divisible_by=2', '-q:v', '4', '-y', temporary])
        await extract(position).catch(() => extract(0))
        if (!(await stat(temporary)).size) throw new Error('FFmpeg did not create a thumbnail.')
        await rename(temporary, output).catch(async (error) => { if (!existsSync(output)) throw error })
      } finally {
        await unlink(temporary).catch(() => undefined)
        if (remote && input) await unlink(input).catch(() => undefined)
      }
    }
    return `minimax-media://thumbnail?path=${encodeURIComponent(output)}&v=2`
  })
  ipcMain.handle('video:frames', async (_event, source: string, positions: number[], outputDirectory: string, ffmpegPath: string) => {
    if (!Array.isArray(positions) || positions.length === 0 || positions.length > 100 || positions.some((position) => !Number.isFinite(position) || position < 0)) {
      throw new Error('Choose between 1 and 100 valid frame bookmarks.')
    }
    const input = await resolveVideoSource(source)
    const framesDirectory = join(outputDirectory, 'Oyama AI Video Studio Frames')
    await mkdir(framesDirectory, { recursive: true })
    const batchId = Date.now()
    const outputs: Array<{ path: string; name: string }> = []
    for (let index = 0; index < positions.length; index += 1) {
      const position = positions[index]
      const label = `at_${position.toFixed(2).replace('.', '-')}`
      const name = `frame_${label}_${batchId}_${index + 1}.png`
      const output = join(framesDirectory, name)
      await runFfmpeg(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-ss', String(position), '-i', input, '-map', '0:v:0', '-frames:v', '1', '-update', '1', '-y', output])
      const extracted = await stat(output).catch(() => null)
      if (!extracted?.size) throw new Error(`FFmpeg did not produce the bookmarked frame at ${position.toFixed(3)} seconds.`)
      outputs.push({ path: output, name })
    }
    return outputs
  })
  ipcMain.handle('video:trim', async (_event, source: string, start: number, end: number, outputDirectory: string, ffmpegPath: string) => {
    const input = await resolveVideoSource(source)
    const from = Number(start)
    const to = Number(end)
    const length = to - from
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || length < 2 || length > 15) {
      throw new Error('Reference clips must be between 2 and 15 seconds long.')
    }
    const directory = join(outputDirectory, 'Oyama AI Video Studio Reference Clips')
    await mkdir(directory, { recursive: true })
    const name = `Reference_Clip_${Date.now()}.mp4`
    const output = join(directory, name)
    await runFfmpeg(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-ss', from.toFixed(3), '-i', input, '-t', length.toFixed(3),
      '-map', '0:v:0', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-y', output,
    ])
    const created = await stat(output).catch(() => null)
    if (!created?.size) throw new Error('FFmpeg completed without producing a reference clip.')
    return { path: output, name }
  })
  ipcMain.handle('clip-master:splice', async (_event, clips: Array<{ source: string; startFrame: number; endFrame: number }>, outputDirectory: string, ffmpegPath: string) => {
    if (!Array.isArray(clips) || !clips.length || clips.length > 100) throw new Error('Select between 1 and 100 segments.')
    const temporary: string[] = []
    const directory = join(outputDirectory, 'ClipMaster')
    await mkdir(directory, { recursive: true })
    const output = join(directory, `Sequence_${randomUUID()}.mp4`)
    try {
      let target: ClipVideoMetadata | undefined
      for (const clip of clips) {
        const input = await resolveVideoSource(clip.source)
        const meta = await probeClipVideoMetadata(input, ffmpegPath)
        if (!Number.isInteger(clip.startFrame) || !Number.isInteger(clip.endFrame) || clip.startFrame < 0 || clip.endFrame < clip.startFrame || clip.endFrame >= meta.frameCount) throw new Error('Invalid segment frame range.')
        target ??= meta
        const duration = (clip.endFrame - clip.startFrame + 1) / meta.fps
        const audio = JSON.parse(await runFfprobe(ffmpegPath, ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=index', '-of', 'json', input])) as { streams?: unknown[] }
        const segment = join(app.getPath('temp'), `oyama-segment-${randomUUID()}.mp4`)
        temporary.push(segment)
        const width = Math.ceil(target.width / 2) * 2, height = Math.ceil(target.height / 2) * 2
        const args = ['-hide_banner', '-loglevel', 'error', '-i', input]
        if (!audio.streams?.length) args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo')
        args.push('-vf', `trim=start_frame=${clip.startFrame}:end_frame=${clip.endFrame + 1},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${target.fps}`, '-af', audio.streams?.length ? `atrim=start=${clip.startFrame / meta.fps}:duration=${duration},asetpts=PTS-STARTPTS,apad` : 'anull', '-map', '0:v:0', '-map', audio.streams?.length ? '0:a:0' : '1:a:0', '-t', String(duration), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-video_track_timescale', '90000', '-y', segment)
        await runFfmpeg(ffmpegPath, args)
      }
      const list = join(app.getPath('temp'), `oyama-sequence-${randomUUID()}.txt`)
      await writeFile(list, temporary.map(path => `file '${path.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'))
      temporary.push(list)
      await runFfmpeg(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', '-n', output])
      return { path: output, url: `minimax-media://local?path=${encodeURIComponent(output)}` }
    } catch (error) { await unlink(output).catch(() => undefined); throw error }
    finally { await Promise.all(temporary.map(path => unlink(path).catch(() => undefined))) }
  })
  ipcMain.handle('video:join', async (_event, clips: Array<{ source: string; start?: number; end?: number }>, outputDirectory: string, ffmpegPath: string) => {
    if (!Array.isArray(clips) || clips.length < 2) throw new Error('Add at least two clips to join.')
    const inputs = await Promise.all(clips.map((clip) => resolveVideoSource(clip.source)))
    const directory = join(outputDirectory, 'video')
    await mkdir(directory, { recursive: true })
    const listPath = join(app.getPath('temp'), `minimax-concat-${randomUUID()}.txt`)
    const escapePath = (path: string) => path.replace(/\\/g, '/').replace(/'/g, "'\\''")
    const list = inputs.map((path, index) => {
      const clip = clips[index]
      return [`file '${escapePath(path)}'`, clip.start && clip.start > 0 ? `inpoint ${clip.start}` : '', clip.end && clip.end > (clip.start ?? 0) ? `outpoint ${clip.end}` : ''].filter(Boolean).join('\n')
    }).join('\n')
    await writeFile(listPath, list, 'utf8')
    const output = join(directory, `MiniMax_Joined_${Date.now()}.mp4`)
    await runFfmpeg(ffmpegPath, ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-map', '0', '-c', 'copy', '-movflags', '+faststart', output])
    return { path: output, url: `minimax-media://local?path=${encodeURIComponent(output)}` }
  })
  ipcMain.handle('rife:status', async () => {
    const executable = await findRifeExecutable()
    return { installed: Boolean(executable), executable: executable ?? undefined }
  })
  ipcMain.handle('rife:install', async () => {
    try {
      const root = rifeDirectory()
      await mkdir(root, { recursive: true })
      const archive = join(root, 'rife-ncnn-vulkan-windows.zip')
      const response = await fetch(RIFE_RELEASE_URL)
      if (!response.ok) throw new Error(`Official RIFE download failed (${response.status}).`)
      await writeFile(archive, Buffer.from(await response.arrayBuffer()))
      await runTool('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath '${archive.replace(/'/g, "''")}' -DestinationPath '${root.replace(/'/g, "''")}' -Force`], 'RIFE setup')
      const executable = await findRifeExecutable()
      if (!executable) throw new Error('RIFE was extracted but its Windows executable was not found.')
      return { installed: true, executable }
    } catch (error) { return { installed: false, error: error instanceof Error ? error.message : String(error) } }
  })
  ipcMain.handle('rife:interpolate', async (_event, source: string, outputDirectory: string, ffmpegPath: string, mode: 'fps-2x' | 'slow-motion') => {
    const executable = await findRifeExecutable()
    if (!executable) throw new Error('RIFE is not installed. Install it from the Clip Editor first.')
    const input = await resolveVideoSource(source)
    const id = String(Date.now())
    const working = join(outputDirectory, 'Oyama AI Video Studio RIFE', id)
    const frames = join(working, 'frames')
    const interpolated = join(working, 'interpolated')
    await mkdir(frames, { recursive: true }); await mkdir(interpolated, { recursive: true })
    await runFfmpeg(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', input, '-vf', 'fps=24', '-vsync', '0', '-start_number', '0', '-y', join(frames, '%08d.png')])
    const frameCount = (await readdir(frames)).filter((file) => /\.png$/i.test(file)).length
    if (frameCount < 2) throw new Error('RIFE needs a clip with at least two decoded frames.')
    await runTool(executable, ['-i', frames, '-o', interpolated, '-n', String(frameCount * 2 - 1), '-m', join(dirname(executable), 'models', 'rife-v4.6')], 'RIFE optical-flow interpolation')
    const outputRoot = join(outputDirectory, 'Oyama AI Video Studio RIFE')
    await mkdir(outputRoot, { recursive: true })
    const output = join(outputRoot, `RIFE_${mode === 'slow-motion' ? 'Cinematic_Slow_Motion' : '48fps'}_${id}.mp4`)
    const outputFps = mode === 'slow-motion' ? '24' : '48'
    await runFfmpeg(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-framerate', outputFps, '-start_number', '0', '-i', join(interpolated, '%08d.png'), '-map', '0:v:0', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', '-y', output])
    const created = await stat(output).catch(() => null)
    if (!created?.size) throw new Error('RIFE completed without producing a video.')
    return { path: output, url: `minimax-media://local?path=${encodeURIComponent(output)}` }
  })
  ipcMain.handle('shell:show-output', async (_event, outputPath: string) => {
    if (!existsSync(outputPath)) await mkdir(outputPath, { recursive: true })
    const { shell } = await import('electron')
    shell.showItemInFolder(join(outputPath, '.'))
  })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}).catch((error) => {
  dialog.showErrorBox('Oyama AI Video Studio failed to start', `Startup failed before the window could open:\n\n${error instanceof Error ? error.stack ?? error.message : String(error)}\n\nThe application will close.`)
  app.quit()
})

app.on('window-all-closed', () => {
  lanServer?.close()
  if (process.platform !== 'darwin') app.quit()
})
