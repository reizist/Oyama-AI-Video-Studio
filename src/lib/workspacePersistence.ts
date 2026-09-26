import type { ScenePromptState } from './scenePromptState'
import type { GenerationJob, GenerationMode, MediaFile, Turbo8Profile, UpscaleMode } from '../types'

export type PersistedWorkspace = {
  sceneState?: ScenePromptState
  mode: GenerationMode
  prompt: string
  duration: number
  resolution: string
  turbo: 'off' | '4' | '8' | 'fast'
  steps: number
  sampler: string
  scheduler: string
  experimentalSampling: boolean
  refImageSize: 'match' | 'max'
  noDialogue: boolean
  naturalMovement: boolean
  clothingPolicy: 'wardrobe' | 'underwear' | 'unrestricted'
  sigmaShiftMode: 'model' | 'custom'
  shiftVideo: number
  shiftAudio: number
  loraStrength: number
  userLoras: Array<{ name: string; strength: number }>
  seed: number
  ref2vaSeed: number
  seedLocked: boolean
  advanced: boolean
  liveEnabled: boolean
  livePreviewMode: 'auto' | 'standard' | 'h3-override'
  previewModeVersion: number
  upscaleMode: UpscaleMode
  h3ProReview: boolean
  h3ProRefineSteps: number
  h3RefineSteps: number
  h3RefineDenoise: number
  textEncoderPreference: 'fast' | 'quality'
  turbo8Profile: Turbo8Profile
  rtxModel: string
  firstFrame: MediaFile | null
  lastFrame: MediaFile | null
  referenceImages: MediaFile[]
  referenceVideos: MediaFile[]
  referenceAudios: MediaFile[]
  selectedReferenceCharacterIds: string[]
  selectedReferenceLocationIds: string[]
  activeJobId: string | null
}

const H3_RANDOM_SEED_LIMIT = 1_000_000_000
export const H3_PREVIEW_FPS = 12

export function randomH3Seed(previous?: number) {
  const next = Math.floor(Math.random() * H3_RANDOM_SEED_LIMIT)
  return next === previous ? (next + 1) % H3_RANDOM_SEED_LIMIT : next
}

const defaultH3Seed = randomH3Seed()
export const workspaceDefaults: PersistedWorkspace = {
  mode: 'text', prompt: '', duration: 5, resolution: '1056x608', turbo: 'off', steps: 30,
  sampler: 'res_multistep', scheduler: 'simple', experimentalSampling: false, refImageSize: 'match', noDialogue: true, naturalMovement: true, clothingPolicy: 'wardrobe',
  sigmaShiftMode: 'model', shiftVideo: 12, shiftAudio: 3, loraStrength: 1, userLoras: [{ name: '', strength: 1 }, { name: '', strength: 1 }, { name: '', strength: 1 }], seed: defaultH3Seed, ref2vaSeed: defaultH3Seed, seedLocked: true,
  advanced: false, liveEnabled: true, livePreviewMode: 'auto', previewModeVersion: 1, upscaleMode: 'refine', h3ProReview: true, h3ProRefineSteps: 6, h3RefineSteps: 3, h3RefineDenoise: 0.3, textEncoderPreference: 'fast', turbo8Profile: 'balanced', rtxModel: '', firstFrame: null,
  lastFrame: null, referenceImages: [], referenceVideos: [], referenceAudios: [], selectedReferenceCharacterIds: [], selectedReferenceLocationIds: [], activeJobId: null,
}

function savedMediaFiles(value: unknown): MediaFile[] {
  return Array.isArray(value)
    ? value.filter((file): file is MediaFile => file !== null && typeof file === 'object' && typeof file.path === 'string' && typeof file.name === 'string' && ['image', 'video', 'audio'].includes(file.kind))
    : []
}

function savedIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
}

export function readWorkspace(): PersistedWorkspace {
  try {
    const stored = JSON.parse(localStorage.getItem('minimax.workspace') ?? '{}') as Partial<PersistedWorkspace>
    const workspace = { ...workspaceDefaults, ...stored }
    // Older or interrupted saves can contain null media collections. Keep the UI iterable.
    workspace.firstFrame = savedMediaFiles([stored.firstFrame]).find(file => file.kind === 'image') ?? null
    workspace.lastFrame = savedMediaFiles([stored.lastFrame]).find(file => file.kind === 'image') ?? null
    workspace.referenceImages = savedMediaFiles(stored.referenceImages)
    workspace.referenceVideos = savedMediaFiles(stored.referenceVideos)
    workspace.referenceAudios = savedMediaFiles(stored.referenceAudios)
    workspace.selectedReferenceCharacterIds = savedIds(stored.selectedReferenceCharacterIds)
    workspace.selectedReferenceLocationIds = savedIds(stored.selectedReferenceLocationIds)
    if (stored.previewModeVersion !== 1 && stored.livePreviewMode === 'standard') workspace.livePreviewMode = 'auto'
    if (!['auto', 'standard', 'h3-override'].includes(workspace.livePreviewMode)) workspace.livePreviewMode = 'auto'
    workspace.previewModeVersion = 1
    // Pre-Ref2VA workspaces had one seed. Keep that seed authoritative for identity references.
    workspace.ref2vaSeed = Number.isFinite(Number(stored.ref2vaSeed)) ? Number(stored.ref2vaSeed) : Number(workspace.seed)
    workspace.userLoras = Array.isArray(stored.userLoras) ? stored.userLoras.slice(0, 3).map((item) => ({ name: typeof item?.name === 'string' ? item.name : '', strength: Math.max(0, Math.min(2, Number(item?.strength) || 1)) })) : workspaceDefaults.userLoras.map((item) => ({ ...item }))
    while (workspace.userLoras.length < 3) workspace.userLoras.push({ name: '', strength: 1 })
    // A saved false is an intentional opt-out; only migrate workspaces without the field.
    if (stored.experimentalSampling === undefined) {
      workspace.sampler = 'res_multistep'
      workspace.scheduler = 'simple'
      workspace.experimentalSampling = false
    }
    workspace.steps = Number.isFinite(Number(workspace.steps)) ? Number(workspace.steps) : workspaceDefaults.steps
    workspace.h3ProRefineSteps = Math.max(1, Math.min(30, Math.round(Number(workspace.h3ProRefineSteps) || workspaceDefaults.h3ProRefineSteps)))
    workspace.h3RefineSteps = Math.max(1, Math.min(30, Math.round(Number(workspace.h3RefineSteps) || workspaceDefaults.h3RefineSteps)))
    workspace.h3RefineDenoise = Number.isFinite(Number(workspace.h3RefineDenoise)) ? Math.max(0.01, Math.min(1, Number(workspace.h3RefineDenoise))) : workspaceDefaults.h3RefineDenoise
    return workspace
  } catch {
    return workspaceDefaults
  }
}

export function withoutPreview(file: MediaFile | null) {
  if (!file) return null
  const stored = { ...file }
  delete stored.preview
  return stored
}

export function compactSceneState(state: ScenePromptState): ScenePromptState {
  return { ...state, references: state.references.map(ref => ({ ...ref, file: withoutPreview(ref.file)! })) }
}

export function compactJob(job: GenerationJob): GenerationJob {
  return {
    ...job,
    referenceFiles: job.referenceFiles?.map(file => withoutPreview(file)!),
    continuityState: job.continuityState && compactSceneState(job.continuityState),
  }
}
