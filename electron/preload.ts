import { contextBridge, ipcRenderer } from 'electron'

let nextStreamingRequestId = 0

async function invokeLocalLlm(channel: string, ...args: unknown[]) {
  try {
    return await ipcRenderer.invoke(channel, ...args)
  } catch (cause) {
    const raw = cause instanceof Error ? cause.message : String(cause)
    const message = raw.replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/i, '').trim()
    throw new Error(message || 'The local AI provider request failed.')
  }
}

async function invokeStreamingLocalLlm(channel: string, args: unknown[], onUpdate: (update: { thinking: string; content: string }) => void) {
  const requestId = `llm-${Date.now()}-${++nextStreamingRequestId}`
  let latest: { thinking: string; content: string } | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const listener = (_event: Electron.IpcRendererEvent, id: string, update: { thinking: string; content: string }) => {
    if (id !== requestId) return
    latest = update
    if (!timer) timer = setTimeout(() => { timer = null; if (latest) onUpdate(latest) }, 80)
  }
  ipcRenderer.on('llm:stream-update', listener)
  try { return await invokeLocalLlm(channel, ...args, requestId) }
  finally {
    ipcRenderer.removeListener('llm:stream-update', listener)
    if (timer) clearTimeout(timer)
    if (latest) onUpdate(latest)
  }
}

contextBridge.exposeInMainWorld('minimax', {
  getObjectInfo: (url: string) => ipcRenderer.invoke('comfy:info', url),
  uploadImageData: (url: string, data: string) => ipcRenderer.invoke('comfy:upload-data', url, data),
  getOutputImage: (url: string, file: unknown) => ipcRenderer.invoke('comfy:output-image', url, file),
  saveComfyOutputImage: (url: string, file: unknown, outputDirectory: string, purpose?: 'character' | 'photo-edit' | 'image-creation') => ipcRenderer.invoke('comfy:save-output-image', url, file, outputDirectory, purpose),
  saveStillImage: (url: string, file: unknown, outputDirectory: string) => ipcRenderer.invoke('comfy:save-still-image', url, file, outputDirectory),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  getLegacyMigrationStatus: () => ipcRenderer.invoke('migration:legacy-status'),
  migrateLegacyData: (replaceBrowserStorage = false) => ipcRenderer.invoke('migration:run', replaceBrowserStorage),
  getGpuTelemetry: () => ipcRenderer.invoke('system:gpu-telemetry'),
  getRenderBenchmarks: () => ipcRenderer.invoke('render-benchmarks:get'),
  saveRenderBenchmarks: (benchmarks: unknown[]) => ipcRenderer.invoke('render-benchmarks:save', benchmarks),
  saveSettings: (settings: unknown) => ipcRenderer.invoke('settings:save', settings),
  factoryResetSettings: (confirmation: string) => ipcRenderer.invoke('settings:factory-reset', confirmation),
  exportWorkflowJson: (suggestedName: string, workflow: unknown) => ipcRenderer.invoke('workflow:export-json', suggestedName, workflow),
  setUiScale: (scale: number) => ipcRenderer.invoke('window:set-ui-scale', scale),
  chooseDirectory: (initialPath?: string) => ipcRenderer.invoke('dialog:directory', initialPath),
  chooseMedia: (type: 'image' | 'video' | 'audio') => ipcRenderer.invoke('dialog:media', type),
  chooseVideos: () => ipcRenderer.invoke('dialog:videos'),
  scanModels: (settings: unknown) => ipcRenderer.invoke('models:scan', settings),
  getComfyStatus: (url: string) => ipcRenderer.invoke('comfy:status', url),
  submitPrompt: (url: string, prompt: unknown, clientId?: string) => ipcRenderer.invoke('comfy:submit', url, prompt, clientId),
  getQueue: (url: string) => ipcRenderer.invoke('comfy:queue', url),
  getHistory: (url: string, promptId: string) => ipcRenderer.invoke('comfy:history', url, promptId),
  cancelPrompt: (url: string, promptId: string) => ipcRenderer.invoke('comfy:cancel', url, promptId),
  uploadInput: (url: string, filePath: string) => ipcRenderer.invoke('comfy:upload', url, filePath),
  fileDataUrl: (filePath: string) => ipcRenderer.invoke('file:data-url', filePath),
  mediaUrl: (filePath: string) => ipcRenderer.invoke('file:media-url', filePath),
  validateMediaFiles: (files: unknown[]) => ipcRenderer.invoke('media:validate', files),
  extractVideoFrame: (source: string, position: number | 'last', outputDirectory: string, ffmpegPath: string) => ipcRenderer.invoke('video:frame', source, position, outputDirectory, ffmpegPath),
  getVideoThumbnail: (source: string, ffmpegPath: string) => ipcRenderer.invoke('video:thumbnail', source, ffmpegPath),
  extractVideoFrames: (source: string, positions: number[], outputDirectory: string, ffmpegPath: string) => ipcRenderer.invoke('video:frames', source, positions, outputDirectory, ffmpegPath),
  trimVideo: (source: string, start: number, end: number, outputDirectory: string, ffmpegPath: string) => ipcRenderer.invoke('video:trim', source, start, end, outputDirectory, ffmpegPath),
  getVideoMetadata: (source: string, ffmpegPath: string) => ipcRenderer.invoke('video:metadata', source, ffmpegPath),
  extractClipMasterFrames: (source: string, frames: unknown[], outputDirectory: string, ffmpegPath: string, sourceName: string) => ipcRenderer.invoke('clip-master:frames', source, frames, outputDirectory, ffmpegPath, sourceName),
  chooseClipMasterExportPath: (outputDirectory: string, sourceName: string) => ipcRenderer.invoke('clip-master:choose-export-path', outputDirectory, sourceName),
  trimClipMaster: (source: string, startFrame: number, endFrame: number, fps: number, outputPath: string, ffmpegPath: string) => ipcRenderer.invoke('clip-master:trim', source, startFrame, endFrame, fps, outputPath, ffmpegPath),
  spliceClipMaster: (clips: unknown[], outputDirectory: string, ffmpegPath: string) => ipcRenderer.invoke('clip-master:splice', clips, outputDirectory, ffmpegPath),
  joinVideos: (clips: unknown[], outputDirectory: string, ffmpegPath: string) => ipcRenderer.invoke('video:join', clips, outputDirectory, ffmpegPath),
  getRifeStatus: () => ipcRenderer.invoke('rife:status'),
  installRife: () => ipcRenderer.invoke('rife:install'),
  interpolateVideo: (source: string, outputDirectory: string, ffmpegPath: string, mode: 'fps-2x' | 'slow-motion') => ipcRenderer.invoke('rife:interpolate', source, outputDirectory, ffmpegPath, mode),
  showOutput: (outputPath: string) => ipcRenderer.invoke('shell:show-output', outputPath),
  trashOutput: (source: string, mode: 'trash' | 'permanent' = 'trash') => ipcRenderer.invoke('outputs:trash', source, mode),
  findLatestOutput: (outputPath: string, since: number, kind: 'video' | 'audio' = 'video') => ipcRenderer.invoke('outputs:latest', outputPath, since, kind),
  resolveOutput: (outputPath: string, file: { filename: string; subfolder?: string; type?: string }) => ipcRenderer.invoke('outputs:resolve', outputPath, file),
  getLocalLlmStatus: (url: string, provider: 'ollama' | 'lmstudio' = 'ollama') => invokeLocalLlm('ollama:status', url, provider),
  generateWithOllama: (url: string, model: string, prompt: string, provider: 'ollama' | 'lmstudio' = 'ollama', onUpdate?: (update: { thinking: string; content: string }) => void) => onUpdate ? invokeStreamingLocalLlm('ollama:generate', [url, model, prompt, provider], onUpdate) : invokeLocalLlm('ollama:generate', url, model, prompt, provider),
  generatePromptCompletion: (url: string, model: string, context: string, provider: 'ollama' | 'lmstudio' = 'ollama') => invokeLocalLlm('llm:prompt-completion', url, model, context, provider),
  generateWithOllamaVision: (url: string, model: string, prompt: string, imagePaths: string[], provider: 'ollama' | 'lmstudio' = 'ollama') => invokeLocalLlm('ollama:vision', url, model, prompt, imagePaths, provider),
  generateStructuredWithOllama: (url: string, model: string, prompt: string, schema: Record<string, unknown>, provider: 'ollama' | 'lmstudio' = 'ollama', imagePaths: string[] = [], onUpdate?: (update: { thinking: string; content: string }) => void) => onUpdate ? invokeStreamingLocalLlm('ollama:structured', [url, model, prompt, schema, provider, imagePaths], onUpdate) : invokeLocalLlm('ollama:structured', url, model, prompt, schema, provider, imagePaths),
  getLanStatus: () => ipcRenderer.invoke('lan:status'),
  syncMobileCharacters: (characters: unknown[]) => ipcRenderer.invoke('lan:sync-characters', characters),
  rotateLanToken: () => ipcRenderer.invoke('lan:rotate-token'),
  setWindowAlwaysOnTop: (enabled: boolean) => ipcRenderer.invoke('window:set-always-on-top', enabled),
  openDevTools: () => ipcRenderer.invoke('window:open-dev-tools'),
  openStudio: () => ipcRenderer.invoke('window:open-studio'),
  openMovieEditor: () => ipcRenderer.invoke('window:open-movie-editor'),
  exportVideo: (source: string, suggestedName: string) => ipcRenderer.invoke('video:export', source, suggestedName),
  prepareContinuationSource: (sources: string[], throughTime: number | null, outputDirectory: string, ffmpegPath: string) => ipcRenderer.invoke('video:continuation-source', sources, throughTime, outputDirectory, ffmpegPath),
  prepareRippleChunkSource: (source: string, startFrame: number, sourceFrames: number, outputDirectory: string, ffmpegPath: string) => ipcRenderer.invoke('video:ripple-chunk-source', source, startFrame, sourceFrames, outputDirectory, ffmpegPath),
  assembleRippleChunks: (clips: Array<{ source: string; sourceFrames: number; overlapFrames: number }>, originalSource: string, duration: number, width: number, height: number, blend: boolean, outputDirectory: string, ffmpegPath: string) => ipcRenderer.invoke('video:ripple-assemble', clips, originalSource, duration, width, height, blend, outputDirectory, ffmpegPath),
})
