export type View = 'create' | 'continue' | 'scratchpad' | 'ltx25' | 'music' | 'anime' | 'zimage' | 'referenceprep' | 'characters' | 'hair' | 'wardrobes' | 'accessories' | 'locations' | 'queue' | 'library' | 'clipmaster' | 'movie' | 'settings'
export type GenerationMode = 'text' | 'image' | 'frames' | 'reference'
export type ModelKind = 'diffusion_models' | 'text_encoders' | 'vae' | 'loras' | 'vae_approx' | 'clip_vision'
export type MediaKind = 'image' | 'video' | 'audio'
export type UpscaleMode = 'off' | 'refine' | 'h3' | 'ltx' | 'rtx'
export type Turbo8Profile = 'stable' | 'balanced' | 'motion' | 'euler-beta'
export type AttentionBackendPreference = 'automatic' | 'sol' | 'kitchen' | 'sage' | 'native'
export type H3DiffusionPrecision = 'int8' | 'nvfp4'
export type GpuRouteDevice = 'auto' | 'cpu' | `gpu:${number}`
export type GpuRoutingPreset = 'automatic' | 'single' | 'split' | 'custom'
export type GpuRoutingStrategy = 'resident' | 'sequential' | 'cpu-fallback'
export type GpuRoutingSettings = {
  preset: GpuRoutingPreset
  strategy: GpuRoutingStrategy
  diffusion: GpuRouteDevice
  textEncoder: GpuRouteDevice
  videoVae: GpuRouteDevice
  audioVae: GpuRouteDevice
  previewVae: GpuRouteDevice
  allowOvercommit: boolean
  preloadDiffusionDuringTextEncoding: boolean
}
export type WorkflowComponentRoute = {
  device: Exclude<GpuRouteDevice, 'auto'>
  method: 'loader' | 'selector' | 'inline'
  nodeType: string
  offloadDevice?: Exclude<GpuRouteDevice, 'auto'>
}
export type WorkflowGpuRouting = {
  strategy: GpuRoutingStrategy
  diffusion?: WorkflowComponentRoute
  textEncoder?: WorkflowComponentRoute
  videoVae?: WorkflowComponentRoute
  audioVae?: WorkflowComponentRoute
  previewVae?: WorkflowComponentRoute
  preloadDiffusion?: { startNodeType: string; awaitNodeType: string }
}
export type AppliedLora = { name: string; strength: number }
export type ReferencePurpose = 'character' | 'character-angle' | 'detail' | 'hair' | 'wardrobe' | 'accessory' | 'location' | 'continuity' | 'product' | 'style' | 'generic'
export type PromptPresetCategory = 'camera' | 'shot' | 'angle' | 'lens' | 'lighting' | 'audio' | 'style' | 'movement' | 'transition' | 'continuity' | 'character' | 'wardrobe' | 'location'
export type PromptPreset = { id: string; category: PromptPresetCategory; label: string; keywords: string[]; description: string; insertion: string }
export type MovieReferenceBinding = { file: MediaFile; purpose: ReferencePurpose; label: string; detailNotes?: string; characterId?: string; hairStyleId?: string; wardrobeId?: string; accessoryId?: string; locationId?: string; locationEnvironmentMode?: LocationProject['environmentMode']; locationContext?: LocationProject['locationContext']; locationAccuracyDetails?: string; source: 'character-studio' | 'hair-studio' | 'wardrobe-studio' | 'accessory-studio' | 'location-studio' | 'movie' | 'shot' | 'continuity' }
export type ResolvedMovieShot = { preferredMode: GenerationMode; effectiveMode: GenerationMode; references: MovieReferenceBinding[]; compiledPrompt: string; sceneState?: import('./lib/scenePromptState').ScenePromptState; conflicts?: import('./lib/scenePromptState').Conflict[]; routeReason: string; omittedReferences: MovieReferenceBinding[] }

export type GenerationDefaults = {
  resolution: string
  duration: number
  turbo: 'off' | '4' | '8' | 'fast'
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
  upscaleMode: UpscaleMode
  textEncoderPreference: 'fast' | 'quality'
  turbo8Profile: Turbo8Profile
}

export type RenderIntentValues = GenerationDefaults & {
  h3RefineSteps?: number
  h3RefineDenoise?: number
  userLoras: AppliedLora[]
  rtxModel: string
  livePreviewMode: 'auto' | 'standard' | 'h3-override'
  noDialogue: boolean
  naturalMovement: boolean
  clothingPolicy: 'wardrobe' | 'underwear' | 'unrestricted'
  seed: number
  seedLocked: boolean
}

export type RenderSettingsPreset = { id: string; name: string; values: RenderIntentValues; createdAt: number; updatedAt: number }

export type AppSettings = {
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
  attentionBackend: AttentionBackendPreference
  solAttnTau: number
  solCacheEnabled: boolean
  h3DiffusionPrecision: H3DiffusionPrecision
  gpuRouting: GpuRoutingSettings
  h3ParallelAttentionEnabled: boolean
  experimentalLtxMsrEnabled: boolean
  blurNsfwLivePreviews: boolean
  queueDelaySeconds: number
  characterDetailReferencesEnabled: boolean
  renderSettingsPresets: RenderSettingsPreset[]
  generationDefaults: GenerationDefaults
}

export type ClipItem = { id: string; name: string; source: string; createdAt: number; start?: number; end?: number; duration?: number; mediaKind?: MediaKind; thumbnailUrl?: string }
export type ClipProject = { id: string; name: string; createdAt: number; updatedAt: number; media: ClipItem[]; clips: ClipItem[] }

/** Frame-based timing keeps edits stable across save/load and avoids accumulated float drift. */
export type MovieEditorTrackKind = 'video' | 'audio' | 'image' | 'title' | 'overlay'
export type MovieEditorTrack = { id: string; name: string; kind: MovieEditorTrackKind; locked?: boolean; hidden?: boolean; muted?: boolean; syncLocked?: boolean }
export type MovieEditorClip = ClipItem & {
  trackId: string
  startFrame: number
  sourceInFrame: number
  sourceOutFrame?: number
  assetId: string
  generation?: { jobId: string; model?: string; prompt?: string; width?: number; height?: number }
  transform?: { x: number; y: number; scale: number; rotation: number; opacity: number }
  audio?: { volume: number; fadeInFrames: number; fadeOutFrames: number; muted: boolean }
}
export type MovieEditorProject = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  frameRate: number
  media: ClipItem[]
  tracks: MovieEditorTrack[]
  clips: MovieEditorClip[]
  markers?: Array<{ id: string; frame: number; label: string; color: 'violet' | 'yellow' | 'red' }>
}

export type CharacterProject = {
  id: string
  name: string
  description: string
  wardrobe: string
  voiceNotes: string
  visualStyle: string
  referencePrompt: string
  createdAt: number
  updatedAt: number
  referenceMode: 'single' | 'set'
  selectedReferencePaths?: string[]
  baseImage?: MediaFile
  turntableVideo?: MediaFile
  referenceImages: MediaFile[]
  detailReferences: CharacterDetailReference[]
  wardrobeIds: string[]
  accessoryIds: string[]
  hairStyleIds: string[]
  identityTemplate: 'custom' | 'cinematic' | 'editorial' | 'everyday'
  hairPreset: string
  skinTone: string
  /** Canonical emphasis used when the reference budget cannot preserve every identity angle equally. */
  identityPriority: 'balanced' | 'face' | 'full-body'
  bodyNotes: string
  voiceSpeakerId: string
  voiceLanguage: string
  favorite: boolean
}
export type CharacterDetailReference = { id: string; label: string; notes: string; images: MediaFile[]; image?: MediaFile }
export type WardrobeProject = { id: string; name: string; description: string; accessories: string[]; materials: string; colors: string; visualStyle: string; referencePrompt: string; referenceImages: MediaFile[]; selectedReferencePaths?: string[]; createdAt: number; updatedAt: number }
export type AccessoryProject = { id: string; name: string; category: 'jewelry' | 'eyewear' | 'watch' | 'bag' | 'headwear' | 'prop' | 'other'; description: string; materials: string; colors: string; visualStyle: string; referencePrompt: string; referenceImage?: MediaFile; createdAt: number; updatedAt: number }
export type HairStyleProject = { id: string; name: string; description: string; texture: string; length: string; color: string; hairline: string; finish: string; visualStyle: string; referencePrompt: string; referenceImage?: MediaFile; createdAt: number; updatedAt: number }
export type LocationProject = {
  id: string
  name: string
  environmentMode: 'mixed' | 'nature' | 'built'
  locationContext: 'interior' | 'exterior' | 'mixed'
  description: string
  atmosphere: string
  timeOfDay: string
  continuityAnchors: string
  accuracyDetails: string
  visualStyle: string
  referencePrompt: string
  createdAt: number
  updatedAt: number
  referenceMode: 'single' | 'set'
  selectedReferencePaths?: string[]
  baseImage?: MediaFile
  walkthroughVideo?: MediaFile
  referenceImages: MediaFile[]
}
export type MovieCharacter = { id: string; libraryCharacterId?: string; libraryUpdatedAt?: number; name: string; description: string; wardrobe: string; voiceNotes: string; referenceImages: MediaFile[] }
export type MovieLocation = { id: string; libraryLocationId?: string; libraryUpdatedAt?: number; environmentMode?: LocationProject['environmentMode']; name: string; description: string; referenceImages: MediaFile[] }
export type MovieChatArea = 'setup' | 'bible' | 'shots' | 'preview'
export type MovieChatMessage = { id: string; role: 'user' | 'assistant'; content: string; createdAt: number; appliedChanges?: string[]; areas?: MovieChatArea[] }
export type MovieShot = {
  sceneState?: import('./lib/scenePromptState').ScenePromptState
  id: string
  title: string
  duration: number
  prompt: string
  dialogue: string
  mode: GenerationMode
  preferredMode?: GenerationMode
  characterIds: string[]
  referenceImages?: MediaFile[]
  referenceVideos?: MediaFile[]
  referenceAudios?: MediaFile[]
  stage: 'planned' | 'ready' | 'rendering' | 'review' | 'approved' | 'locked'
  outputUrl?: string
  /** Exact local file retained for continuation, replacement, and assembly after restart. */
  outputPath?: string
  renderedAt?: number
  renderJobId?: string
}
export type MovieScene = {
  id: string
  title: string
  summary: string
  locationId: string
  transition: 'connected' | 'cut'
  shots: MovieShot[]
  stage?: 'planned' | 'ready' | 'rendering' | 'review' | 'approved' | 'locked'
  previewUrl?: string
  continuityFrame?: MediaFile
  continuityState?: string
  approvedAt?: number
  lockedAt?: number
}
export type MovieProject = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  status: 'planning' | 'paused'
  targetRuntime: number
  computeBudgetMinutes: number
  aspectRatio: '16:9' | '9:16' | '1:1'
  genre: string
  visualStyle: string
  autoContinueCleanScenes?: boolean
  productionSettings?: { resolution: string; turbo: 'off' | '4' | '8' | 'fast'; steps: number; seed?: number; noDialogue?: boolean; naturalMovement?: boolean }
  story: string
  visualRules: string
  characters: MovieCharacter[]
  locations: MovieLocation[]
  scenes: MovieScene[]
  chatMessages: MovieChatMessage[]
}

export type ModelFile = {
  name: string
  path: string
  kind: ModelKind
  bytes: number
}

export type ReferenceImageType = 'master' | 'face' | 'full-body' | 'three-quarter' | 'profile' | 'back' | 'detail' | 'other'
export type ReferenceHandoffRole = 'subject' | 'wardrobe' | 'prop' | 'location' | 'composition' | 'lighting-style'
export type ReferenceRetention = 'preserve' | 'guide'
export type OpeningFrameTreatment = 'match' | 'reframe' | 'arc'

export type MediaFile = {
  path: string
  name: string
  kind: MediaKind
  preview?: string
  crop?: { x: number; y: number; zoom: number; fit: 'crop' | 'contain'; background?: 'auto' | 'smart' | 'neutral' }
  clip?: { sourcePath: string; sourceName: string; start: number; end: number }
  /** The visual coverage this image provides when it is used as a character reference. */
  referenceType?: ReferenceImageType
  /** How a standalone image should be described and retained during reference handoff. */
  referenceRole?: ReferenceHandoffRole
  referenceRetention?: ReferenceRetention
  /** The intentional opening-shot relationship for an extracted video final frame. */
  openingFrameTreatment?: OpeningFrameTreatment
}

export type ModelSelection = {
  fl2va: string
  ref2va: string
  /** FastVideo FastH3 8-Step V2; text-to-audio-video only. */
  fastH3: string
  textEncoder: string
  videoVae: string
  audioVae: string
  previewVae: string
  fl2vLora: string
  ref2vLora: string
}

export type Ltx25ModelSelection = {
  diffusion: string
  textEncoder: string
  videoVae: string
  audioVae: string
  latentUpscaler: string
}

export type Ltx25GenerationOptions = {
  mode: 'text' | 'image'
  prompt: string
  width: number
  height: number
  renderWidth?: number
  renderHeight?: number
  duration: number
  turbo?: 'off' | '4' | '8' | 'fast'
  steps?: number
  noDialogue?: boolean
  naturalMovement?: boolean
  loraStrength?: number
  seed: number
  preset: 'quality' | 'turbo'
  previewOverride?: { nodeType: string; fps: number }
  attentionBackend?: string
  gpuRouting?: WorkflowGpuRouting
  h3ParallelAttention?: { nodeType: string; devices: 'auto' | number }
  msr?: { loraName: string; references: string[] }
  filenamePrefix: string
}

export type AceStepModelSelection = {
  base: string
  sft: string
  textEncoderSmall: string
  textEncoderLarge: string
  vae: string
}

export type AceStepGenerationOptions = {
  model: 'sft' | 'base'
  tags: string
  lyrics: string
  instrumental: boolean
  duration: number
  bpm: number
  timeSignature: string
  language: string
  keyScale: string
  seed: number
  generateAudioCodes: boolean
  attentionBackend?: string
  gpuRouting?: WorkflowGpuRouting
  filenamePrefix: string
}

export type GenerationOptions = {
  latentCapture?: { filenamePrefix: string }
  motionContext?: { latentPath: string; contextFrames: number; blendFrames: number; carryAudio: boolean; suppressAudio?: boolean }
  continuationAssembly?: { sourceVideo: UploadedFile; trimFrames: number; blendFrames: number; useMotionTrim?: boolean }
  /** Explicit user override of scene validation; transport validation still runs. */
  ignoreSceneConflicts?: boolean
  sceneState?: import('./lib/scenePromptState').ScenePromptState
  mode: GenerationMode
  prompt: string
  width: number
  height: number
  duration: number
  seed: number
  steps: number
  turbo: 'off' | '4' | '8' | 'fast'
  experimentalSampling?: boolean
  attentionBackend?: string
  solAttention?: { nodeType: string; tau: number }
  solCache?: { nodeType: string; threshold: number; maxSteps: number }
  h3ParallelAttention?: { nodeType: string; devices: 'auto' | number }
  gpuRouting?: WorkflowGpuRouting
  previewOverride?: { frames: number; fps: number; nodeType?: string; vaeName?: string; jpegQuality?: number }
  loraStrength?: number
  userLoras?: AppliedLora[]
  sampler: string
  scheduler: string
  refImageSize: 'match' | 'max'
  sigmaShift?: { video: number; audio: number }
  filenamePrefix: string
  upscale?: { type: 'refine'; steps: number; denoise: number } | { type: 'h3'; model: string; scale: number; refineSteps: number; refineDenoise: number } | { type: 'ltx'; model: string; vae: string } | { type: 'rtx'; model: string }
  firstFrame?: string
  lastFrame?: string
  referenceImages: string[]
  referenceVideos: string[]
  referenceAudios: string[]
}

export type ComfyStatus = {
  connected: boolean
  latencyMs: number
  detectedOutputDirectory?: string
  stats?: {
    system?: {
      os?: string
      python_version?: string
      comfyui_version?: string
      pytorch_version?: string
      /** Present on ComfyUI builds that expose their launch arguments. */
      argv?: string[]
    }
    devices?: Array<{ name?: string; type?: string; vram_total?: number; vram_free?: number }>
  }
  error?: string
}

export type OllamaModel = {
  name: string
  size: number
  family: string
  parameterSize: string
  local: boolean
}

export type LanStatus = {
  running: boolean
  url?: string
  desktopUrl?: string
  port?: number
  error?: string
}

export type GpuTelemetry = {
  available: boolean
  name?: string
  usagePercent?: number
  vramPercent?: number
  vramUsedMb?: number
  vramTotalMb?: number
  devices?: Array<{ index: number; name: string; usagePercent: number; vramPercent: number; vramUsedMb: number; vramTotalMb: number; vramFreeMb: number }>
}

export type RenderBenchmark = {
  jobId: string
  hardwareKey: string
  hardwareLabel: string
  provider: 'minimax'
  mode: GenerationMode
  turbo: NonNullable<GenerationJob['turbo']>
  attention: string
  width: number
  height: number
  duration: number
  steps: number
  engineMs: number
  measuredAt: number
}

export type LocalLlmStatus = {
  connected: boolean
  models: OllamaModel[]
  error?: string
  provider?: AppSettings['llmProvider']
  url?: string
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export type JobExecutionInfo = {
  diffusionModel?: string
  diffusionPrecision?: string
  textEncoder?: string
  attentionBackend?: string
  sampler?: string
  scheduler?: string
  preview?: string
  upscale?: string
  referenceCount?: number
  adapters?: string[]
  gpuRouting?: string
}

export type H3RenderSettings = {
  resolution: string
  turbo: 'off' | '4' | '8' | 'fast'
  turbo8Profile: Turbo8Profile
  steps: number
  sampler: string
  scheduler: string
  experimentalSampling: boolean
  textEncoderPreference: 'fast' | 'quality'
  refImageSize: 'match' | 'max'
  sigmaShiftMode: 'model' | 'custom'
  shiftVideo: number
  shiftAudio: number
  loraStrength: number
  userLoras: AppliedLora[]
  noDialogue: boolean
  naturalMovement: boolean
  clothingPolicy: 'wardrobe' | 'underwear' | 'unrestricted'
  seed: number
}

export type GenerationJob = {
  segmentOutputUrl?: string
  segmentOutputPath?: string
  id: string
  outputName?: string
  continuation?: { scriptId: string; beatId: string; sourceJobId?: string; beatSignature: string; requestedDuration?: number; deliveredDuration?: number }
  latentFile?: string
  latentPath?: string
  promptId?: string
  mode: GenerationMode
  prompt: string
  createdAt: number
  status: JobStatus
  progress: number
  progressLabel?: string
  currentStep?: number
  totalSteps?: number
  samplerPass?: 'first' | 'refine'
  refinementSteps?: number
  refinementStepCostMultiplier?: number
  lastSamplerStepAt?: number
  estimatedSamplerStepMs?: number
  /** Timestamp when ComfyUI first confirmed that it began executing this prompt. */
  startedAt?: number
  /** A small, persisted transcript of meaningful ComfyUI state transitions. */
  comfyActivity?: Array<{ at: number; level: 'info' | 'success' | 'warning' | 'error'; message: string }>
  queueMissingAt?: number
  queuePosition?: number
  execution?: JobExecutionInfo
  outputUrl?: string
  localOutputPath?: string
  thumbnailUrl?: string
  seed?: number
  referenceAssets?: string[]
  referenceFiles?: MediaFile[]
  continuityState?: import('./lib/scenePromptState').ScenePromptState
  /** Content-generation controls inherited by continuation beats. */
  renderSettings?: H3RenderSettings
  sourceMode?: 'ref2va-still'
  modelName?: string
  sampler?: string
  scheduler?: string
  refImageSize?: 'match' | 'max'
  error?: string
  width: number
  height: number
  renderWidth?: number
  renderHeight?: number
  duration: number
  renderDurationMs?: number
  turbo?: 'off' | '4' | '8' | 'fast'
  steps?: number
  h3ProReviewPending?: boolean
  h3ProSourceSignature?: string
  h3ProParentJobId?: string
  noDialogue?: boolean
  naturalMovement?: boolean
  loraStrength?: number
  userLoras?: AppliedLora[]
  provider?: 'minimax' | 'ltx25' | 'acestep' | 'music3'
  mediaType?: 'video' | 'audio' | 'image'
  movieLink?: { projectId: string; sceneId: string; shotId: string }
  characterProjectId?: string
  locationProjectId?: string
}

export type UploadedFile = { name: string; subfolder?: string; type?: string }

export type DesktopApi = {
  getObjectInfo(url: string): Promise<Record<string, { input: { required: Record<string, unknown[]> } }>>
  uploadImageData(url: string, data: string): Promise<UploadedFile>
  getOutputImage(url: string, file: { filename: string; subfolder?: string; type?: string }): Promise<string>
  saveComfyOutputImage(url: string, file: { filename: string; subfolder?: string; type?: string }, outputDirectory: string): Promise<{ path: string; name: string }>
  saveStillImage(url: string, file: { filename: string; subfolder?: string; type?: string }, outputDirectory: string): Promise<{ path: string; name: string }>
  getSettings(): Promise<AppSettings>
  getLegacyMigrationStatus(): Promise<{ available: boolean; migrated: boolean; migratedAt?: string; needsBrowserStorageRepair: boolean }>
  migrateLegacyData(replaceBrowserStorage?: boolean): Promise<{ available: boolean; migrated: boolean; migratedAt?: string; needsBrowserStorageRepair: boolean }>
  getGpuTelemetry(): Promise<GpuTelemetry>
  getRenderBenchmarks(): Promise<RenderBenchmark[]>
  saveRenderBenchmarks(benchmarks: RenderBenchmark[]): Promise<RenderBenchmark[]>
  saveSettings(settings: AppSettings): Promise<AppSettings>
  factoryResetSettings(confirmation: string): Promise<void>
  exportWorkflowJson(suggestedName: string, workflow: unknown): Promise<string | null>
  setUiScale(scale: number): Promise<number>
  openDevTools(): Promise<void>
  chooseDirectory(initialPath?: string): Promise<string | null>
  chooseMedia(type: MediaKind): Promise<{ path: string; name: string } | null>
  chooseVideos(): Promise<Array<{ path: string; name: string }>>
  scanModels(settings: AppSettings): Promise<ModelFile[]>
  getComfyStatus(url: string): Promise<ComfyStatus>
  submitPrompt(url: string, prompt: unknown, clientId?: string): Promise<{ prompt_id: string; number?: number; node_errors?: unknown }>
  getQueue(url: string): Promise<unknown>
  getHistory(url: string, promptId: string): Promise<Record<string, unknown>>
  cancelPrompt(url: string, promptId: string): Promise<{ cancelled: boolean; state: 'running' | 'pending' | 'finished' | 'unknown' }>
  uploadInput(url: string, filePath: string): Promise<UploadedFile>
  fileDataUrl(filePath: string): Promise<string>
  mediaUrl(filePath: string): Promise<string>
  validateMediaFiles(files: Array<Pick<MediaFile, 'path' | 'kind'>>): Promise<Array<{ path: string; valid: boolean; reason?: string }>>
  extractVideoFrame(source: string, position: number | 'last', outputDirectory: string, ffmpegPath: string): Promise<{ path: string; name: string }>
  getVideoThumbnail(source: string, ffmpegPath: string): Promise<string>
  extractVideoFrames(source: string, positions: number[], outputDirectory: string, ffmpegPath: string): Promise<Array<{ path: string; name: string }>>
  trimVideo(source: string, start: number, end: number, outputDirectory: string, ffmpegPath: string): Promise<{ path: string; name: string }>
  exportVideo(source: string, suggestedName: string): Promise<string | null>
  prepareContinuationSource(sources: string[], throughTime: number | null, outputDirectory: string, ffmpegPath: string): Promise<string>
  getVideoMetadata(source: string, ffmpegPath: string): Promise<{ duration: number; fps: number; frameCount: number; width: number; height: number }>
  extractClipMasterFrames(source: string, frames: Array<{ index: number; role: 'start' | 'end' | 'frame' }>, outputDirectory: string, ffmpegPath: string, sourceName: string): Promise<{ folder: string; files: Array<{ path: string; name: string; index: number; role: 'start' | 'end' | 'frame' }> }>
  chooseClipMasterExportPath(outputDirectory: string, sourceName: string): Promise<string | null>
  trimClipMaster(source: string, startFrame: number, endFrame: number, fps: number, outputPath: string, ffmpegPath: string): Promise<{ path: string; name: string; url: string; folder: string; frameCount: number; duration: number }>
  spliceClipMaster(clips: Array<{ source: string; startFrame: number; endFrame: number }>, outputDirectory: string, ffmpegPath: string): Promise<{ path: string; url: string }>
  joinVideos(clips: Array<Pick<ClipItem, 'source' | 'start' | 'end'>>, outputDirectory: string, ffmpegPath: string): Promise<{ path: string; url: string }>
  getRifeStatus(): Promise<{ installed: boolean; executable?: string; error?: string }>
  installRife(): Promise<{ installed: boolean; executable?: string; error?: string }>
  interpolateVideo(source: string, outputDirectory: string, ffmpegPath: string, mode: 'fps-2x' | 'slow-motion'): Promise<{ path: string; url: string }>
  showOutput(path: string): Promise<void>
  trashOutput(source: string, mode?: 'trash' | 'permanent'): Promise<'trashed' | 'deleted' | 'missing'>
  /** Absolute filesystem path, not a playback URL. */
  findLatestOutput(outputDirectory: string, since: number, kind?: 'video' | 'audio'): Promise<string | null>
  /** Absolute filesystem path, not a playback URL. */
  resolveOutput(outputDirectory: string, file: { filename: string; subfolder?: string; type?: string }): Promise<string | null>
  getLocalLlmStatus(url: string, provider?: AppSettings['llmProvider']): Promise<LocalLlmStatus>
  generateWithOllama(url: string, model: string, prompt: string, provider?: AppSettings['llmProvider']): Promise<string>
  generateWithOllamaVision(url: string, model: string, prompt: string, imagePaths: string[], provider?: AppSettings['llmProvider']): Promise<string>
  generateStructuredWithOllama(url: string, model: string, prompt: string, schema: Record<string, unknown>, provider?: AppSettings['llmProvider'], imagePaths?: string[]): Promise<unknown>
  getLanStatus(): Promise<LanStatus>
  syncMobileCharacters(characters: unknown[]): Promise<{ synced: number }>
  rotateLanToken(): Promise<LanStatus>
  setWindowAlwaysOnTop(enabled: boolean): Promise<boolean>
  openStudio(): Promise<void>
  openMovieEditor(): Promise<void>
}
