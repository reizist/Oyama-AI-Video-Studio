import { Dialog, DialogContent, DialogTitle } from './components/ui'
import { WorkspaceNavigator } from './components/WorkspaceNavigator'
import { writeLocalJson } from './lib/localPersistence'
import { useLocalPersistence } from './lib/useLocalPersistence'
import { workspaceLabel, workspaceProjectScope, workspaceProjectLabel, workspaceStorageKey, type WorkspaceProjectScope } from './lib/workspaceNavigation'
import { PreviewPanel } from './components/Workspace'
import { importSceneDraft } from './lib/sceneLegacyAdapter'
import { analyzeSceneReference } from './lib/referenceAnalysis'
import { SceneComposer, type SceneInspectorSelection } from './components/SceneComposer'
import { SceneContextPanels, SceneSelectionInspector } from './components/SceneContextPanels'
import { H3PromptEditor } from './components/H3PromptEditor'
import { VideoPromptModal } from './components/VideoPromptModal'
import { VideoCompare } from './components/VideoCompare'
import { VideoExportButtons } from './components/VideoExportButtons'
import { ContinueWorkspace, type ContinueBeat, type ContinueMethod, type ContinueScript } from './components/ContinueWorkspace'
import { continuationReferenceReplaced, continuationSourceState, continuationBeatSignature, continuationOutputName, continuationPreviousAction, continuationTiming, nextContinuationOpenRequest, type ContinuationOpenRequest } from './lib/continuation'
import { buildCharacterDialogueRequest } from './lib/dialogPolicy'
import { compileScene, promptMarkupLegend } from './lib/h3SceneCompiler'
import { bindSceneReferences, createSceneState, defaultPreservedAttributes, resizeScene, setFrameZeroGuide, value, type ScenePromptState, type SceneReference } from './lib/scenePromptState'
import { MOVIE_HANDOFF_KEY, parseMovieHandoff, type MovieFrameTarget } from './lib/movieHandoff'
import { MovieEditor } from './components/MovieEditor'
import { MovieMediaThumbnail } from './components/MovieMediaThumbnail'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal, flushSync } from 'react-dom'
import QRCode from 'qrcode'
import { DeleteGenerationButton } from './components/DeleteGenerationButton'
import { createId } from './lib/createId'
import {
  Activity,
  AlertCircle,
  Aperture,
  Bookmark,
  Check,
  ChevronDown,
  Clapperboard,
  CircleStop,
  Columns3,
  Clock3,
  Dices,
  Download,
  ExternalLink,
  FileText,
  Film,
  Folder,
  FolderOpen,
  Gauge,
  HelpCircle,
  HardDrive,
  History,
  Image as ImageIcon,
  ImagePlus,
  Library,
  LockKeyhole,
  ListVideo,
  LoaderCircle,
  MapPin,
  Menu,
  MessageSquareText,
  Minus,
  Music2,
  Palette,
  PanelLeftClose,
  PanelTopOpen,
  Pencil,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  Save,
  Scan,
  Search,
  Scissors,
  Settings,
  Shirt,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Trash2,
  Users,
  Volume2,
  WandSparkles,
  Watch,
  X,
} from 'lucide-react'
import { buildMiniMaxReferenceStillWorkflow, buildMiniMaxWorkflow, continuationSourceCandidates, extractOutputFile, extractOutputUrl, frameCount, h3SamplingSteps, outputFileFromUrl } from './lib/workflow'
import { buildLtx25Workflow } from './lib/ltx25Workflow'
import { buildZImage } from './lib/zimage'
import { attentionBackendLabel, resolveAttentionBackend } from './lib/attentionBackend'
import { hasSensitivePreviewWording } from './lib/previewSafety'
import { appendLtxVisionGrounding, buildLtxImageHandoffPrompt } from './lib/ltxImageHandoff'
import './video-workspace.css'
import './studio-system.css'
import './scratchpad.css'
import './original-theme.css'
import { buildCharacterIdentitySurveyPrompt } from './lib/characterSurvey'
import { ACE_STEP_REQUIRED_NODES, buildAceStepWorkflow, inferAceStepSelections } from './lib/aceStepWorkflow'
import { MUSIC3_REQUIRED_NODES, buildMusic3Workflow, inferMusic3Selection, type Music3GenerationOptions } from './lib/music3Workflow'
import { fitWholeCharacter, prepareImage } from './lib/imageCrop'
import { inferLtx25Selections, inferSelections } from './lib/modelSelection'
import { choices, type ObjectInfo } from './lib/comfyInfo'
import { estimatedComponentBytes, formatGiB, resolveGpuRouting, routingGpus, type RoutingComponent } from './lib/gpuRouting'
import { parseSolRuntimeDiagnostics, solRuntimeLabel } from './lib/solDiagnostics'
import { MINIMAX_VIDEO_RESOLUTIONS, MINIMAX_VIDEO_RESOLUTION_GROUPS, videoResolutionLabel } from './lib/videoResolutions'
import { benchmarkFromJob, estimateRenderMs, renderHardware, type RenderBenchmark } from './lib/renderBenchmarks'
import { useLivePreview, type LivePreview, type LiveProgress } from './lib/useLivePreview'
import { samplerProgressSummary } from './lib/renderProgress'

type ContinuationGenerationControl = {
  scriptId: string
  beatId: string
  beatSignature: string
  outputName: string
  sourceJobId?: string
  requestedDuration: number
  deliveredDuration: number
  assembly: { sourcePath: string; trimFrames: number; blendFrames: number; useMotionTrim: boolean }
  motion?: { latentPath: string; contextFrames: number; blendFrames: number; carryAudio: boolean; suppressAudio: boolean }
}
import { RenderSize } from './components/RenderSize'
import { snapToMinimaxResolution } from './lib/minimaxResolutions'
import { ImageCrop } from './components/ImageCrop'
import { ReferenceHandoffInspector } from './components/ReferenceHandoffInspector'
import { ZImageWorkspace } from './components/ZImageWorkspace'
import { AnimeWorkspace } from './components/AnimeWorkspace'
import { ClipMasterBeta } from './components/ClipMasterBeta'
import { FrameBookmarkStudio, type BookmarkVideo } from './components/FrameBookmarkStudio'
import { Ltx25Workspace } from './components/Ltx25Workspace'
import { AceStepWorkspace } from './components/AceStepWorkspace'
import { Music3Workspace } from './components/Music3Workspace'
import { VideoReferenceClipper } from './components/VideoReferenceClipper'
import { ReferencePrepStudio } from './components/ReferencePrepStudio'
import { CharacterStudio, type CharacterSurveyRenderOptions } from './components/CharacterStudio'
import { HairStudio } from './components/HairStudio'
import { WardrobeStudio } from './components/WardrobeStudio'
import { LocationStudio } from './components/LocationStudio'
import { AccessoryStudio } from './components/AccessoryStudio'
import { ScratchpadWorkspace } from './components/ScratchpadWorkspace'
import type { ScratchpadTarget } from './lib/scratchpadCompiler'
import { CharacterDialogueModal, type CharacterDialogueDraft } from './components/CharacterDialogueModal'
import { RenderConstruction } from './components/RenderConstruction'
import { CHARACTER_LIBRARY_EVENT, characterIdentityReferences, characterReferences, loadCharacterProjects, updateCharacterProject } from './lib/characterLibrary'
import { loadWardrobeProjects, wardrobeReferences, WARDROBE_LIBRARY_EVENT } from './lib/wardrobeLibrary'
import { loadLocationProjects, locationReferences, updateLocationProject, LOCATION_LIBRARY_EVENT } from './lib/locationLibrary'
import { loadHairStyleProjects } from './lib/hairLibrary'
import { ACCESSORY_LIBRARY_EVENT, loadAccessoryProjects } from './lib/accessoryLibrary'
import { allocateWorkspaceReferences, buildPromptAssistantRequest, composeReferenceInstructions, h3PromptDirectionSchema } from './lib/promptComposer'
import { COPILOT_DECISION_EVENT, offerCopilotSuggestion } from './lib/copilot'
import { resolveLlmConnection } from './lib/llmProvider'
import type {
  AppSettings,
  AccessoryProject,
  AceStepGenerationOptions,
  CharacterProject,
  ComfyStatus,
  GenerationJob,
  GenerationMode,
  GpuTelemetry,
  Ltx25GenerationOptions,
  LocationProject,
  LanStatus,
  MediaFile,
  ClipItem,
  MediaKind,
  ModelFile,
  ModelKind,
  ModelSelection,
  Turbo8Profile,
  MovieReferenceBinding,
  RenderSettingsPreset,
  WardrobeProject,
  OllamaModel,
  LocalLlmStatus,
  UpscaleMode,
  View,
} from './types'

type PersistedWorkspace = {
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

type WorkspaceProject = { id: string; name: string; scope: WorkspaceProjectScope; snapshot: Record<string, unknown>; createdAt: number; updatedAt: number }
const WORKSPACE_PROJECTS_KEY = 'minimax.workspace-projects'

function loadWorkspaceProjects(): WorkspaceProject[] {
  try {
    const stored = JSON.parse(localStorage.getItem(WORKSPACE_PROJECTS_KEY) ?? '[]') as WorkspaceProject[]
    return Array.isArray(stored) ? stored.filter((project) => project && typeof project.id === 'string' && typeof project.name === 'string' && ['create', 'ltx25', 'zimage', 'music', 'music3'].includes(project.scope) && project.snapshot && typeof project.snapshot === 'object').slice(0, 80) : []
  } catch { return [] }
}

type WorkspaceSearchEntry = {
  id: string
  label: string
  context: string
  searchableText: string
  target: HTMLElement
  focusElement: HTMLElement
}

function compactSearchText(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function highlightWorkspaceSearchText(text: string, query: string) {
  const terms = compactSearchText(query).split(' ').filter(Boolean)
  if (!terms.length) return text
  const matcher = new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return text.split(matcher).map((part, index) => terms.some((term) => part.toLowerCase() === term.toLowerCase()) ? <mark key={`${part}-${index}`}>{part}</mark> : part)
}

function searchLabelText(label: HTMLLabelElement | null) {
  if (!label) return ''
  const strong = compactSearchText(label.querySelector('strong')?.textContent)
  if (strong) return strong
  const clone = label.cloneNode(true) as HTMLElement
  clone.querySelectorAll('input, select, textarea, button, small, svg, output').forEach((node) => node.remove())
  return compactSearchText(clone.textContent)
}

function searchContextText(control: HTMLElement) {
  const section = control.closest<HTMLElement>('section, fieldset, .create-section, .composer-panel, .preview-panel')
  if (!section) return ''
  const heading = section.querySelector<HTMLElement>('.settings-heading strong, .ref2va-setting-heading strong, .create-section-heading strong, h1, h2, h3, legend')
  return compactSearchText(heading?.textContent)
}

function searchTargetForControl(control: HTMLElement, label: HTMLLabelElement | null) {
  return control.closest<HTMLElement>('.field-group, .settings-check, .connection-row, .path-row, .ui-scale-control, .user-lora-slot, .render-controls > label, .render-extras > label, .upscale-options > label') ?? label ?? control
}

function isHiddenWorkspaceSearchControl(control: HTMLElement) {
  let current: HTMLElement | null = control
  while (current) {
    if (current.hidden) return true
    current = current.parentElement
  }
  return false
}

function collectWorkspaceSearchEntries(root: HTMLElement): WorkspaceSearchEntry[] {
  const controls = Array.from(root.querySelectorAll<HTMLElement>('input:not([type="hidden"]), select, textarea'))
  return controls.flatMap((control, index) => {
    if (isHiddenWorkspaceSearchControl(control)) return []
    const parentLabel = control.closest('label') as HTMLLabelElement | null
    const id = control.getAttribute('id')
    const associatedLabel = id
      ? Array.from(root.querySelectorAll<HTMLLabelElement>('label[for]')).find((candidate) => candidate.htmlFor === id) ?? null
      : null
    const label = searchLabelText(parentLabel ?? associatedLabel)
      || compactSearchText(control.getAttribute('aria-label'))
      || compactSearchText(control.getAttribute('placeholder'))
      || compactSearchText(control.getAttribute('title'))
      || compactSearchText(id)
      || 'Workspace setting'
    const context = searchContextText(control)
    const target = searchTargetForControl(control, parentLabel ?? associatedLabel)
    const searchableText = compactSearchText([
      label,
      context,
      control.getAttribute('aria-label'),
      control.getAttribute('placeholder'),
      control.getAttribute('title'),
      control.getAttribute('name'),
      id,
      target.textContent,
    ].filter(Boolean).join(' ')).toLowerCase()
    return [{ id: `workspace-setting-${index}`, label, context, searchableText, target, focusElement: control }]
  })
}

const H3_RANDOM_SEED_LIMIT = 1_000_000_000
const H3_PREVIEW_FPS = 12

function randomH3Seed(previous?: number) {
  const next = Math.floor(Math.random() * H3_RANDOM_SEED_LIMIT)
  return next === previous ? (next + 1) % H3_RANDOM_SEED_LIMIT : next
}

function turbo8Sampling(profile: Turbo8Profile) {
  switch (profile) {
    case 'stable': return { sampler: 'euler', scheduler: 'simple' }
    case 'euler-beta': return { sampler: 'euler', scheduler: 'beta' }
    case 'motion': return { sampler: 'res_multistep', scheduler: 'beta' }
    default: return { sampler: 'res_multistep', scheduler: 'simple' }
  }
}

function h3PreviewFrameCount(duration: number) {
  return Math.max(1, Math.ceil(frameCount(duration) / 2))
}

function h3LatentUpscaleSize(value: number) {
  return Math.max(32, Math.round((value * 2) / 32) * 32)
}

const defaultH3Seed = randomH3Seed()
const workspaceDefaults: PersistedWorkspace = {
  mode: 'text', prompt: '', duration: 5, resolution: '1056x608', turbo: 'off', steps: 30,
  sampler: 'res_multistep', scheduler: 'simple', experimentalSampling: false, refImageSize: 'match', noDialogue: true, naturalMovement: true, clothingPolicy: 'wardrobe',
  sigmaShiftMode: 'model', shiftVideo: 12, shiftAudio: 3, loraStrength: 1, userLoras: [{ name: '', strength: 1 }, { name: '', strength: 1 }, { name: '', strength: 1 }], seed: defaultH3Seed, ref2vaSeed: defaultH3Seed, seedLocked: true,
  advanced: false, liveEnabled: true, livePreviewMode: 'auto', previewModeVersion: 1, upscaleMode: 'refine', h3ProReview: true, h3ProRefineSteps: 6, h3RefineSteps: 3, h3RefineDenoise: 0.3, textEncoderPreference: 'fast', turbo8Profile: 'balanced', rtxModel: '', firstFrame: null,
  lastFrame: null, referenceImages: [], referenceVideos: [], referenceAudios: [], selectedReferenceCharacterIds: [], selectedReferenceLocationIds: [], activeJobId: null,
}

const LTX_UPSCALE_REQUIRED_NODES = [
  'VAEEncodeTiled', 'LatentUpscaleModelLoader', 'LTXVLatentUpsampler',
  'VAEDecodeTiled', 'ImageFromBatch', 'RepeatImageBatch', 'ImageBatch',
] as const

const LTX_NATIVE_REQUIRED_NODES = [
  'LTXVConditioning', 'LTXVEmptyLatentAudio', 'EmptyLTXVLatentVideo',
  'LTXVDualCFGGuider', 'LTXVSeparateAVLatent', 'LTXVConcatAVLatent',
  'LTXVLatentUpsampler', 'LTXVAudioVAEDecode', 'ManualSigmas',
  'VAEDecodeTiled', 'CLIPTextEncode', 'KSamplerSelect', 'SamplerCustomAdvanced',
] as const

const H3_LEARNED_UPSCALE_REQUIRED_NODES = [
  'MinimaxH3LatentUpscaler3DRefineHandoff',
] as const

function findH3PreviewOverrideNode(info: ObjectInfo) {
  return Object.keys(info).find((name) => name === 'MiniMaxH3PreviewOverrideCS')
    ?? Object.keys(info).find((name) => /minimax.*h3.*preview.*override/i.test(name))
}

function findH3ParallelAttentionNode(info: ObjectInfo) {
  return Object.keys(info).find((name) => /minimax.*h3.*attention.*parallel/i.test(name))
    ?? Object.keys(info).find((name) => /h3.*parallel.*attention/i.test(name))
}

function findSolAttentionNode(info: ObjectInfo) {
  return Object.keys(info).find((name) => name === 'SolAttnH3')
    ?? Object.keys(info).find((name) => /sol.*attn.*h3/i.test(name))
}

function findSolCompatibleCacheNode(info: ObjectInfo) {
  return Object.keys(info).find((name) => name === 'MiniMaxH3Cache')
}

function findLtxSamplingPreviewOverrideNode(info: ObjectInfo) {
  return Object.keys(info).find((name) => name === 'LTX2SamplingPreviewOverride')
    ?? Object.keys(info).find((name) => /ltx2.*sampling.*preview.*override/i.test(name))
}

function formatRuntime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatStepDuration(milliseconds: number) {
  const seconds = Math.max(0, milliseconds / 1000)
  return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s/step`
}

function appendComfyActivity(job: GenerationJob, event: NonNullable<GenerationJob['comfyActivity']>[number]) {
  const activity = job.comfyActivity ?? []
  const previous = activity.at(-1)
  // Polling and the event socket can report the same transition. Keep a useful
  // transcript rather than filling the console with duplicate heartbeat lines.
  if (previous?.message === event.message && event.at - previous.at < 3_000) return job
  return { ...job, comfyActivity: [...activity, event].slice(-32) }
}

function comfyHistoryActivity(messages: unknown[] | undefined) {
  if (!messages?.length) return []
  return messages.slice(-4).flatMap((message) => {
    if (!Array.isArray(message)) return []
    const node = message[0] === undefined ? '' : `Node ${String(message[0])}: `
    const kind = typeof message[1] === 'string' ? message[1] : ''
    const detail = message[2] && typeof message[2] === 'object' ? message[2] as { exception_message?: unknown; message?: unknown } : undefined
    const text = detail?.exception_message ?? detail?.message ?? kind
    if (!text || typeof text !== 'string') return []
    const readable = text.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (!readable) return []
    const tinyVaeMismatch = /taeh3.*(?:decoder|decode).*?(?:mismatch|shape|channel)|(?:mismatch|shape|channel).*taeh3/i.test(readable)
    const notice = tinyVaeMismatch
      ? 'H3 Tiny VAE preview is incompatible with this latent shape. Preview decoder disabled; final full Video VAE decode continues without retrying Tiny VAE.'
      : `${node}${readable}`.slice(0, 260)
    return [{ level: tinyVaeMismatch ? 'warning' as const : /error|fail|interrupt/i.test(kind) ? 'error' as const : 'info' as const, message: notice }]
  })
}

function formatStepCountdown(milliseconds: number) {
  const seconds = Math.max(0, milliseconds / 1000)
  if (seconds < 0.25) return 'due now'
  return `${seconds < 10 ? seconds.toFixed(1) : Math.ceil(seconds)}s`
}

function readWorkspace(): PersistedWorkspace {
  try {
    const stored = JSON.parse(localStorage.getItem('minimax.workspace') ?? '{}') as Partial<PersistedWorkspace>
    const workspace = { ...workspaceDefaults, ...stored }
    if (stored.previewModeVersion !== 1 && stored.livePreviewMode === 'standard') workspace.livePreviewMode = 'auto'
    if (!['auto', 'standard', 'h3-override'].includes(workspace.livePreviewMode)) workspace.livePreviewMode = 'auto'
    workspace.previewModeVersion = 1
    // Older workspaces had a single seed. Treat that value as the first
    // authoritative Ref2VA seed so the working-seed indicator starts aligned.
    workspace.ref2vaSeed = Number.isFinite(Number(stored.ref2vaSeed)) ? Number(stored.ref2vaSeed) : Number(workspace.seed)
    workspace.userLoras = Array.isArray(stored.userLoras) ? stored.userLoras.slice(0, 3).map((item) => ({ name: typeof item?.name === 'string' ? item.name : '', strength: Math.max(0, Math.min(2, Number(item?.strength) || 1)) })) : workspaceDefaults.userLoras.map((item) => ({ ...item }))
    while (workspace.userLoras.length < 3) workspace.userLoras.push({ name: '', strength: 1 })
    // Only migrate workspaces that existed before the experimental opt-in was
    // introduced. A saved false is an intentional user choice and must remain
    // untouched along with every other workspace setting.
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

function withoutPreview(file: MediaFile | null) {
  if (!file) return null
  const stored = { ...file }
  delete stored.preview
  return stored
}

function compactSceneState(state: ScenePromptState): ScenePromptState {
  return { ...state, references: state.references.map(ref => ({ ...ref, file: withoutPreview(ref.file)! })) }
}

function compactJob(job: GenerationJob): GenerationJob {
  return {
    ...job,
    referenceFiles: job.referenceFiles?.map(file => withoutPreview(file)!),
    continuityState: job.continuityState && compactSceneState(job.continuityState),
  }
}

const modeInfo: Array<{ id: GenerationMode; label: string; note: string; icon: typeof Film }> = [
  { id: 'text', label: 'Text video', note: 'Create from a scene prompt', icon: WandSparkles },
  { id: 'image', label: 'Image video', note: 'Animate one opening frame', icon: ImageIcon },
  { id: 'frames', label: 'Keyframes', note: 'Guide the start and ending', icon: Aperture },
  { id: 'reference', label: 'References', note: 'Use images, video, and audio', icon: Sparkles },
]

const diagnosticPrompt = 'A woman standing beside a window in soft daylight, natural skin texture, subtle head movement, realistic cinematic photography.'
type H3BenchmarkBackend = 'kitchen' | 'sage' | 'sol'
type H3BenchmarkConfig = { duration: number; resolution: string }
type H3BenchmarkResult = {
  backend: H3BenchmarkBackend
  label: string
  status: 'idle' | 'running' | 'completed' | 'failed' | 'unavailable'
  elapsedMs?: number
  renderMs?: number
  error?: string
  completedAt?: number
}
const h3BenchmarkBackends: Array<{ backend: H3BenchmarkBackend; label: string }> = [
  { backend: 'kitchen', label: 'Kitchen INT8' },
  { backend: 'sage', label: 'SageAttention' },
  { backend: 'sol', label: 'NVIDIA Sol-Attn' },
]
const H3_BENCHMARK_STORAGE_KEY = 'oyama.h3-attention-benchmark.v1'
const H3_BENCHMARK_CONFIG_STORAGE_KEY = 'oyama.h3-attention-benchmark-config.v1'
const defaultH3BenchmarkConfig: H3BenchmarkConfig = { duration: 3, resolution: '864x480' }

function loadH3BenchmarkConfig(): H3BenchmarkConfig {
  try {
    const stored = JSON.parse(localStorage.getItem(H3_BENCHMARK_CONFIG_STORAGE_KEY) ?? '{}') as Partial<H3BenchmarkConfig>
    const duration = Math.max(1, Math.min(60, Math.round(Number(stored.duration) || defaultH3BenchmarkConfig.duration)))
    const resolution = typeof stored.resolution === 'string' && MINIMAX_VIDEO_RESOLUTIONS.includes(stored.resolution) ? stored.resolution : defaultH3BenchmarkConfig.resolution
    return { duration, resolution }
  } catch {
    return defaultH3BenchmarkConfig
  }
}

function loadH3BenchmarkResults(): H3BenchmarkResult[] {
  try {
    const stored = JSON.parse(localStorage.getItem(H3_BENCHMARK_STORAGE_KEY) ?? '[]') as H3BenchmarkResult[]
    if (!Array.isArray(stored)) return []
    return stored.filter((item) => item && typeof item.backend === 'string' && typeof item.label === 'string' && ['completed', 'failed', 'unavailable'].includes(item.status))
  } catch {
    return []
  }
}

function formatBenchmarkDuration(ms?: number) {
  if (ms === undefined || !Number.isFinite(ms)) return '—'
  return ms >= 60_000 ? `${(ms / 60_000).toFixed(1)} min` : `${(ms / 1000).toFixed(1)} s`
}

function benchmarkResultPatch(results: H3BenchmarkResult[], backend: H3BenchmarkBackend, patch: Partial<H3BenchmarkResult>) {
  return results.map((item) => item.backend === backend ? { ...item, ...patch } : item)
}

async function waitForBenchmarkCompletion(comfyUrl: string, promptId: string, submittedAt: number) {
  const timeoutMs = 30 * 60_000
  let startedAt: number | undefined
  while (Date.now() - submittedAt < timeoutMs) {
    let history: Record<string, unknown>
    try {
      history = await window.minimax.getHistory(comfyUrl, promptId)
    } catch {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 500))
      continue
    }
    const queue = await window.minimax.getQueue(comfyUrl).catch(() => undefined)
    if (!startedAt && queuePromptState(queue, promptId) === 'running') startedAt = Date.now()
    const entry = history[promptId] as { status?: { status_str?: string; completed?: boolean } } | undefined
    const terminalState = comfyTerminalState(entry)
    if (terminalState === 'failed') throw new Error('ComfyUI reported an execution error.')
    if (terminalState === 'completed') {
      if (!extractOutputFile(history, promptId, 'video')) throw new Error('ComfyUI completed without reporting a video output.')
      const finishedAt = Date.now()
      return { elapsedMs: finishedAt - submittedAt, renderMs: finishedAt - (startedAt ?? submittedAt) }
    }
    await new Promise<void>((resolve) => window.setTimeout(resolve, 500))
  }
  await window.minimax.cancelPrompt(comfyUrl, promptId).catch(() => undefined)
  throw new Error('Benchmark timed out after 30 minutes.')
}

const validatedH3Files = [
  { label: 'FL2VA', kind: 'diffusion_models' as const, expected: 'minimax_h3_fl2va_pruned_int8_convrot.safetensors', fallback: /^minimax_h3_fl2va.*\.safetensors$/i },
  { label: 'Ref2VA', kind: 'diffusion_models' as const, expected: 'minimax_h3_ref2va_pruned_int8_convrot.safetensors', fallback: /^minimax_h3_ref2va.*\.safetensors$/i },
  { label: 'Text encoder', kind: 'text_encoders' as const, expected: 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors', alternatives: ['qwen3vl_32b_minimax_h3_int8_convrot.safetensors'], fallback: /^qwen3vl_32b_minimax_h3.*\.safetensors$/i },
  { label: 'Video VAE', kind: 'vae' as const, expected: 'minimax_h3_video_vae_fp16.safetensors', fallback: /^minimax_h3_video_vae.*\.safetensors$/i },
  { label: 'Audio VAE', kind: 'vae' as const, expected: 'minimax_h3_audio_vae_fp32.safetensors', fallback: /^minimax_h3_audio_vae.*\.safetensors$/i },
  { label: 'FL2V Turbo 8 LoRA', kind: 'loras' as const, expected: 'minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors', fallback: /^minimax_h3_fl2v_turbo_8step.*\.safetensors$/i },
  { label: 'Ref2V Turbo 8 LoRA', kind: 'loras' as const, expected: 'minimax_h3_ref2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors', fallback: /^minimax_h3_ref2v_turbo_8step.*\.safetensors$/i },
  { label: 'Ref2V Turbo 4 LoRA', kind: 'loras' as const, expected: 'minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors', fallback: /^minimax_h3_ref2v_turbo_4step.*\.safetensors$/i, optional: true },
]

function h3StackReport(models: ModelFile[]) {
  const rows = validatedH3Files.map((definition) => {
    const files = models.filter((model) => model.kind === definition.kind)
    const exact = files.find((model) => [definition.expected, ...(definition.alternatives ?? [])].some((name) => model.name.toLowerCase() === name.toLowerCase()))
    const fallback = files.find((model) => definition.fallback.test(model.name))
    return { ...definition, selected: exact?.name ?? fallback?.name ?? '', validated: Boolean(exact) }
  })
  return { rows, validated: rows.every((row) => row.optional || row.validated), ready: rows.every((row) => row.optional || row.selected) }
}

function playableOutputUrl(value?: string) {
  if (!value || value.startsWith('minimax-media:')) return value
  try {
    const url = new URL(value)
    return url.pathname === '/view' ? `minimax-media://comfy?url=${encodeURIComponent(value)}` : value
  } catch {
    return value
  }
}

const initialJobs = (): GenerationJob[] => {
  try {
    const stored = JSON.parse(localStorage.getItem('minimax.jobs') ?? '[]') as GenerationJob[]
    return stored.map((job) => ({
      ...job,
      outputUrl: playableOutputUrl(job.outputUrl),
      ...(!job.promptId && ['queued', 'running'].includes(job.status) ? {
        status: 'failed' as const,
        error: 'The app lost this render before it received a prompt ID. Check ComfyUI queue or history before retrying to avoid a duplicate; your source and script are safe.',
        progressLabel: 'Submission interrupted',
      } : {}),
    }))
  } catch {
    return []
  }
}

function recordCharacterTurntable(characterProjectId: string | undefined, outputUrl: string) {
  if (!characterProjectId) return
  updateCharacterProject(characterProjectId, { turntableVideo: { path: outputUrl, name: 'Generated character turntable', kind: 'video', preview: outputUrl } })
}

function recordLocationWalkthrough(locationProjectId: string | undefined, outputUrl: string) {
  if (!locationProjectId) return
  updateLocationProject(locationProjectId, { walkthroughVideo: { path: outputUrl, name: 'Generated location walkthrough', kind: 'video', preview: outputUrl } })
}

async function extractAutomatedReferenceSet(kind: 'character' | 'location', projectId: string | undefined, source: string, duration: number, settings: AppSettings) {
  if (!projectId || !source) return null
  try {
    const positions = [0.05, .25, .5, .75, .95].map((ratio) => Math.max(0, Math.min(duration - .04, duration * ratio)))
    const characterTypes = ['full-body', 'face', 'three-quarter', 'profile', 'back'] as const
    const references = await Promise.all(positions.map(async (position, index) => {
      const result = await window.minimax.extractVideoFrame(source, position, settings.outputDirectory, settings.ffmpegPath)
      return { ...result, kind: 'image' as const, referenceType: kind === 'character' ? characterTypes[index] : undefined, preview: await window.minimax.mediaUrl(result.path) }
    }))
    if (kind === 'character') updateCharacterProject(projectId, { referenceMode: 'set', referenceImages: references, selectedReferencePaths: undefined })
    else updateLocationProject(projectId, { referenceMode: 'set', referenceImages: references, selectedReferencePaths: undefined })
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

function formatBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unit]}`
}

function shortPrompt(prompt: string) {
  return prompt.length > 76 ? `${prompt.slice(0, 76)}…` : prompt
}

function libraryPromptTitle(prompt: string) {
  const authored = prompt.match(/(?:integrated_multimodal_description|detailed_description):\s*([\s\S]*?)(?=\n\s*(?:overall_soundscape|non_diegetic_music):|$)/i)?.[1] || prompt
  const line = authored.split(/\r?\n/).map(part => part.replace(/\[Shot\s+\d+\](?:\s+At\s+[\d:.]+,?\s+the\s+camera\s+cuts\s+to)?/gi, '').replace(/<[^>]+>/g, '').trim()).find(Boolean)
  return shortPrompt(line || 'Untitled render')
}

function syncReferencePrompt(value: string, previous: MovieReferenceBinding[], next: MovieReferenceBinding[]) {
  let result = value
    // The automatic reference direction is one generated line. Remove it as a
    // unit so changed wardrobe/hair assignments cannot leave a stale block.
    .replace(/^References:[^\r\n]*(?:\r?\n\r?\n|$)/m, '')
    .replace(/Character:\s*([^—\n]+?)\s*—\s*(?=<Picture \d+>)[^\n]*?from another character\./g, (_match, name: string) => `Character: ${name.trim()}.`)
    .replace(/Location:\s*preserve the approved ([^;\n]+?) environment from [^;\n]+;\s*keep its architecture, layout, materials, lighting, landmarks, and geography consistent\./gi, (_match, name: string) => `Location: ${name.trim()}.`)
  const previousInstructions = composeReferenceInstructions(previous)
  const previousCharacters = [...new Set(previous.filter((binding) => binding.characterId).map((binding) => binding.label.replace(/^Character:\s*/, '').replace(/^Wardrobe:\s*/, '').split(' / ')[0].split(' for ').at(-1)!))]
  for (const name of previousCharacters) {
    const instructions = previousInstructions.filter((line) => line.includes(name)).join(' ')
    result = result.replace(`Character: ${name} — ${instructions}`, `Character: ${name}`)
  }
  for (const line of previousInstructions) result = result.replace(line, '')
  result = result.replace(/References:\s*(?=\n|$)/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  // The compiler derives reference direction from the active bindings. Keep
  // generated assignment prose out of the editable scene so it cannot linger.
  void next
  return result
}

function removeLegacyReferencePrompt(state: ScenePromptState): ScenePromptState {
  const scene = syncReferencePrompt(state.scene, [], [])
  return scene === state.scene ? state : { ...state, scene }
}

function queuePromptState(queue: unknown, promptId: string): 'queued' | 'running' | null {
  if (!queue || typeof queue !== 'object') return null
  const source = queue as { queue_running?: unknown; queue_pending?: unknown }
  const contains = (entries: unknown) => Array.isArray(entries) && entries.some((entry) => Array.isArray(entry) && String(entry[1]) === promptId)
  return contains(source.queue_running) ? 'running' : contains(source.queue_pending) ? 'queued' : null
}

function queuePromptPosition(queue: unknown, promptId: string) {
  if (!queue || typeof queue !== 'object') return undefined
  const pending = (queue as { queue_pending?: unknown }).queue_pending
  if (!Array.isArray(pending)) return undefined
  const index = pending.findIndex((entry) => Array.isArray(entry) && String(entry[1]) === promptId)
  return index >= 0 ? index + 1 : undefined
}

function comfyTerminalState(entry: { status?: { status_str?: string; completed?: boolean } } | undefined) {
  const status = entry?.status?.status_str?.toLowerCase() ?? ''
  if (entry?.status?.completed || /^(success|completed)$/.test(status)) return 'completed' as const
  if (/(?:error|failed|cancelled|interrupted)/.test(status)) return 'failed' as const
  return null
}

// A render can finish and land on disk even when the app fails to notice: a
// downstream node (preview, upscale, reference-frame extraction) can error
// after the main SaveVideo/SaveImage already wrote its file, ComfyUI's history
// can be queried before it is done being written, or a restart can wipe
// ComfyUI's in-memory history outright. Before any code path gives up on a
// job, re-check history once and, failing that, fall back to scanning the
// output folder for a file ComfyUI wrote after this job was created — so a
// transient hiccup here never hides a render that actually completed.
async function resolveJobOutputFile(
  comfyUrl: string,
  outputDirectory: string,
  promptId: string,
  mediaType: 'video' | 'audio' | 'image',
  since: number,
): Promise<string | null> {
  try {
    const history = await window.minimax.getHistory(comfyUrl, promptId)
    const outputFile = extractOutputFile(history, promptId, mediaType)
    const resolved = outputFile ? await window.minimax.resolveOutput(outputDirectory, outputFile) : null
    if (resolved) return resolved
  } catch { /* ComfyUI may no longer know this prompt; fall back to a directory scan. */ }
  if (mediaType === 'image') return null
  try { return await window.minimax.findLatestOutput(outputDirectory, since, mediaType) } catch { return null }
}

function modelPrecisionLabel(model?: string) {
  if (!model) return undefined
  if (/nvfp4/i.test(model)) return 'NVFP4'
  if (/int8.*convrot|convrot.*int8/i.test(model)) return 'INT8 ConvRot'
  if (/bf16/i.test(model)) return 'BF16'
  if (/fp16/i.test(model)) return 'FP16'
  if (/int8/i.test(model)) return 'INT8'
  return undefined
}

function modelLabel(model?: string) {
  if (!model) return undefined
  return model.replace(/\.safetensors$/i, '').replace(/^minimax_h3_/i, 'H3 ').replace(/^ltx-2\.5-/i, 'LTX 2.5 ').replace(/[_-]+/g, ' ')
}

function resolveRenderReferenceBindings(files: MediaFile[], bindings: MovieReferenceBinding[], clothingPolicy: 'wardrobe' | 'underwear' | 'unrestricted') {
  const activeBindings = clothingPolicy === 'wardrobe' ? bindings : bindings.filter((binding) => binding.purpose !== 'wardrobe')
  const libraryPaths = new Set(bindings.map((binding) => binding.file.path))
  const roleForPurpose = (purpose: MovieReferenceBinding['purpose']): NonNullable<MediaFile['referenceRole']> => purpose === 'wardrobe' ? 'wardrobe' : purpose === 'accessory' || purpose === 'product' ? 'prop' : purpose === 'location' ? 'location' : purpose === 'style' ? 'lighting-style' : 'subject'
  const assigned = activeBindings.map((binding) => {
    const source = files.find((file) => file.path === binding.file.path) ?? binding.file
    return { ...binding, file: { ...source, referenceRole: source.referenceRole ?? roleForPurpose(binding.purpose), referenceRetention: source.referenceRetention ?? 'preserve' as const } }
  })
  const standalone = files.filter((file) => !libraryPaths.has(file.path) && !(clothingPolicy !== 'wardrobe' && file.referenceRole === 'wardrobe'))
  const roleLabels: Record<NonNullable<MediaFile['referenceRole']>, string> = { subject: 'subject or identity', wardrobe: 'wardrobe', prop: 'prop or product', location: 'location or set', composition: 'composition or pose', 'lighting-style': 'lighting or visual style' }
  return [...assigned, ...standalone.map((file) => {
    // Keep a standalone wardrobe handoff typed as wardrobe all the way into
    // ScenePromptState. Treating it as generic loses the canonical clothing
    // contract in downstream prompt composition even when the file itself has
    // referenceRole=wardrobe.
    const purpose = file.referenceRole === 'wardrobe' ? 'wardrobe' as const : 'generic' as const
    const label = file.referenceRole === 'wardrobe' ? `Wardrobe reference: ${file.name}` : `Shot reference: ${roleLabels[file.referenceRole ?? 'composition']} — ${file.name}`
    return { file, purpose, label, source: 'shot' as const }
  })].slice(0, 9)
}

function App() {
  const legacyMigrationDismissalKey = 'oyama.legacy-migration-banner-dismissed.v1'
  const persisted = useMemo(readWorkspace, [])
  const [view, setView] = useState<View>('create')
  const [navigatorOpen, setNavigatorOpen] = useState(false)
  const [bootError, setBootError] = useState('')
  const [bootAttempt, setBootAttempt] = useState(0)
  const { persist, failedKeys, retry: retryLocalSave } = useLocalPersistence()
  const [continuationPreparing, setContinuationPreparing] = useState(false)
  const [continuationOpenRequest, setContinuationOpenRequest] = useState<ContinuationOpenRequest>({ id: 0, sourceId: null })
  const mainAreaRef = useRef<HTMLElement>(null)
  useEffect(() => { mainAreaRef.current?.scrollTo({ top: 0, left: 0 }) }, [view])
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 680)
  const [compareOpen, setCompareOpen] = useState(false)
  const closeVideoCompare = useCallback(() => setCompareOpen(false), [])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [models, setModels] = useState<ModelFile[]>([])
  const [scanning, setScanning] = useState(false)
  const [status, setStatus] = useState<ComfyStatus>({ connected: false, latencyMs: 0 })
  // The active ComfyUI process is authoritative while connected. This keeps a
  // stale saved preference from making a successful render appear to vanish.
  const activeOutputDirectory = status.detectedOutputDirectory?.trim() || settings?.outputDirectory || ''
  const [checking, setChecking] = useState(false)
  const [gpu, setGpu] = useState<GpuTelemetry | null>(null)
  const [renderBenchmarks, setRenderBenchmarks] = useState<RenderBenchmark[]>([])
  const [sceneState, setSceneState] = useState<ScenePromptState>(() => removeLegacyReferencePrompt(persisted.sceneState?.version === 1 ? persisted.sceneState : { ...importSceneDraft(persisted.prompt, persisted.duration, persisted.mode), noDialogue: persisted.noDialogue, naturalMovement: persisted.naturalMovement }))
  const mode = sceneState.mode, prompt = sceneState.scene, duration = sceneState.duration
  const setMode = (mode: GenerationMode) => setSceneState(current => ({ ...current, mode }))
  const setPrompt = (next: string | ((current: string) => string)) => setSceneState(current => ({ ...current, scene: typeof next === 'function' ? next(current.scene) : next }))
  const setDuration = (duration: number) => setSceneState(current => resizeScene(current, duration))
  const [resolution, setResolution] = useState(persisted.resolution)
  const [turbo, setTurbo] = useState<'off' | '4' | '8' | 'fast'>(persisted.turbo)
  const [textEncoderPreference, setTextEncoderPreference] = useState<'fast' | 'quality'>(persisted.textEncoderPreference)
  const [turbo8Profile, setTurbo8Profile] = useState<Turbo8Profile>(persisted.turbo8Profile)
  const [steps, setSteps] = useState(persisted.steps)
  const [sampler, setSampler] = useState(persisted.sampler)
  const [scheduler, setScheduler] = useState(persisted.scheduler)
  const [experimentalSampling, setExperimentalSampling] = useState(persisted.experimentalSampling)
  const [refImageSize, setRefImageSize] = useState<'match' | 'max'>(persisted.refImageSize)
  const noDialogue = sceneState.noDialogue, naturalMovement = sceneState.naturalMovement
  const setNoDialogue = (noDialogue: boolean) => setSceneState(current => ({ ...current, noDialogue }))
  const setNaturalMovement = (naturalMovement: boolean) => setSceneState(current => ({ ...current, naturalMovement }))
  const [clothingPolicy, setClothingPolicy] = useState<'wardrobe' | 'underwear' | 'unrestricted'>(persisted.clothingPolicy)
  const [sigmaShiftMode, setSigmaShiftMode] = useState<'model' | 'custom'>(persisted.sigmaShiftMode)
  const [shiftVideo, setShiftVideo] = useState(persisted.shiftVideo)
  const [shiftAudio, setShiftAudio] = useState(persisted.shiftAudio)

  const [loraStrength, setLoraStrength] = useState(persisted.loraStrength)
  const [userLoras, setUserLoras] = useState(() => persisted.userLoras.map((item) => ({ ...item })))
  const [info, setInfo] = useState<ObjectInfo>({})
  const h3PreviewOverrideNode = findH3PreviewOverrideNode(info)
  const h3ParallelAttentionNode = findH3ParallelAttentionNode(info)
  const solAttentionNode = findSolAttentionNode(info)
  const solCacheNode = findSolCompatibleCacheNode(info)
  const h3AttentionBackends = choices(info, 'ModelAttentionBackend', 'attention')
  const resolvedH3AttentionBackend = resolveAttentionBackend(settings?.attentionBackend ?? 'automatic', h3AttentionBackends)
  const ltxSamplingPreviewOverrideNode = findLtxSamplingPreviewOverrideNode(info)
  const [liveEnabled, setLiveEnabled] = useState(persisted.liveEnabled)
  const [livePreviewMode, setLivePreviewMode] = useState<'auto' | 'standard' | 'h3-override'>(persisted.livePreviewMode)
  const [upscaleMode, setUpscaleMode] = useState<UpscaleMode>(persisted.upscaleMode)
  const [h3ProReview, setH3ProReview] = useState(persisted.h3ProReview)
  const [h3ProRefineSteps, setH3ProRefineSteps] = useState(persisted.h3ProRefineSteps)
  const [h3RefineSteps, setH3RefineSteps] = useState(persisted.h3RefineSteps)
  const [h3RefineDenoise, setH3RefineDenoise] = useState(persisted.h3RefineDenoise)
  const upscaleModel = choices(info, 'LatentUpscaleModelLoader', 'model_name').find((n) => /ltx-2\.5.*spatial.*x2/i.test(n)) ?? ''
  const upscaleVae = choices(info, 'VAELoader', 'vae_name').find((n) => /ltx-2\.5.*video.*vae/i.test(n)) ?? ''
  const missingLtxUpscaleNodes = LTX_UPSCALE_REQUIRED_NODES.filter((node) => !info[node])
  const ltxUpscaleReady = Boolean(upscaleModel && upscaleVae && missingLtxUpscaleNodes.length === 0)
  const h3LearnedUpscaleChoices = [...new Set([...choices(info, 'MinimaxH3LatentUpscaler3DRefineHandoff', 'model_name'), ...choices(info, 'MinimaxH3LatentUpscaler3D', 'model_name')])]
  const h3LearnedUpscaleModel = h3LearnedUpscaleChoices.find((name) => /minimax.*h3.*latent.*upscaler.*3d.*\.(?:safetensors|pth)$/i.test(name)) ?? ''
  const h3LearnedUpscaleDirectory = h3LearnedUpscaleChoices.map((name) => name.match(/place models in:\s*(.+?)\)?$/i)?.[1]).find(Boolean) ?? ''
  const missingH3LearnedUpscaleNodes = H3_LEARNED_UPSCALE_REQUIRED_NODES.filter((node) => !info[node])
  const h3LearnedUpscaleReady = Boolean(h3LearnedUpscaleModel && missingH3LearnedUpscaleNodes.length === 0)
  const rtxModels = choices(info, 'UpscaleModelLoader', 'model_name')
  const [rtxModel, setRtxModel] = useState(persisted.rtxModel)
  const [seed, setSeed] = useState(persisted.seed)
  const [ref2vaSeed, setRef2vaSeed] = useState(persisted.ref2vaSeed)
  const [seedLocked, setSeedLocked] = useState(persisted.seedLocked)
  const [advanced, setAdvanced] = useState(true)
  const [renderAnyway, setRenderAnyway] = useState(false)
  const [firstFrame, setFirstFrame] = useState<MediaFile | null>(persisted.firstFrame)
  const [lastFrame, setLastFrame] = useState<MediaFile | null>(persisted.lastFrame)
  const [referenceImages, setReferenceImages] = useState<MediaFile[]>(persisted.referenceImages)
  const [referenceVideos, setReferenceVideos] = useState<MediaFile[]>(persisted.referenceVideos)
  const [referenceAudios, setReferenceAudios] = useState<MediaFile[]>(persisted.referenceAudios)
  // Tracks only the paths injected by checked character/location libraries.
  // Loose pictures and prop-library selections must survive a library refresh.
  const managedLibraryReferencePaths = useRef<Set<string>>(new Set())
  const libraryBindingRevision = useRef(0)
  const [characterProjects, setCharacterProjects] = useState<CharacterProject[]>(loadCharacterProjects)
  const [wardrobeProjects, setWardrobeProjects] = useState<WardrobeProject[]>(loadWardrobeProjects)
  const [locationProjects, setLocationProjects] = useState<LocationProject[]>(loadLocationProjects)
  const [accessoryProjects, setAccessoryProjects] = useState<AccessoryProject[]>(loadAccessoryProjects)
  const [selectedReferenceCharacterIds, setSelectedReferenceCharacterIds] = useState<string[]>(persisted.selectedReferenceCharacterIds)
  const [selectedReferenceLocationIds, setSelectedReferenceLocationIds] = useState<string[]>(persisted.selectedReferenceLocationIds)
  const [jobs, setJobs] = useState<GenerationJob[]>(initialJobs)
  const [activeJobId, setActiveJobId] = useState<string | null>(persisted.activeJobId)
  const [runtimeNow, setRuntimeNow] = useState(() => Date.now())
  const [characterHandoff, setCharacterHandoff] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [stillSubmitting, setStillSubmitting] = useState(false)
  const [ltxSubmitting, setLtxSubmitting] = useState(false)
  const [aceSubmitting, setAceSubmitting] = useState(false)
  const [music3Submitting, setMusic3Submitting] = useState(false)
  const [musicEngine, setMusicEngine] = useState<'acestep' | 'music3'>('acestep')
  const [diagnosticRunning, setDiagnosticRunning] = useState(false)
  const [benchmarkRunning, setBenchmarkRunning] = useState(false)
  const [benchmarkConfig, setBenchmarkConfig] = useState<H3BenchmarkConfig>(loadH3BenchmarkConfig)
  const [benchmarkResults, setBenchmarkResults] = useState<H3BenchmarkResult[]>(loadH3BenchmarkResults)
  const benchmarkConfigInitialized = useRef(false)
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(() => new Set())
  const cancellationRequests = useRef(new Set<string>())
  const generateRef = useRef<((target?: 'video' | 'image', renderAnyway?: boolean, control?: { continuation?: ContinuationGenerationControl }) => Promise<string | undefined>) | null>(null)
  const mediaHydrated = useRef(false)
  const thumbnailAttempts = useRef(new Set<string>())
  const [thumbnailScanNonce, setThumbnailScanNonce] = useState(0)
  const [notice, setNotice] = useState<{ tone: 'error' | 'success' | 'neutral'; text: string } | null>(null)
  const [legacyMigration, setLegacyMigration] = useState<{ available: boolean; migrated: boolean; migratedAt?: string; needsBrowserStorageRepair: boolean } | null>(null)
  const [legacyMigrationRunning, setLegacyMigrationRunning] = useState(false)
  const [legacyMigrationDismissed, setLegacyMigrationDismissed] = useState(() => localStorage.getItem(legacyMigrationDismissalKey) === 'true')
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([])
  const [localLlmStatus, setLocalLlmStatus] = useState<LocalLlmStatus | null>(null)
  const [localLlmChecking, setLocalLlmChecking] = useState(false)
  const activeLlmProvider = useRef<AppSettings['llmProvider'] | null>(null)
  const activeLlmUrl = useRef<string | null>(null)
  const loadedSettingsSnapshot = useRef<string | null>(null)
  const settingsSaveQueue = useRef<Promise<void>>(Promise.resolve())
  const queueSettingsSave = useCallback((nextSettings: AppSettings) => {
    const snapshot = JSON.stringify(nextSettings)
    const queued = settingsSaveQueue.current
      .catch(() => undefined)
      .then(async () => {
        await window.minimax.saveSettings(nextSettings)
        loadedSettingsSnapshot.current = snapshot
      })
    settingsSaveQueue.current = queued.catch((error) => {
      setNotice({ tone: 'error', text: `Settings changed for this session, but could not be saved: ${error instanceof Error ? error.message : String(error)}` })
      throw error
    })
    return settingsSaveQueue.current
  }, [])
  const [promptSuggestion, setPromptSuggestion] = useState('')
  const [promptSuggestionId, setPromptSuggestionId] = useState('')
  const [promptingTool, setPromptingTool] = useState<'enhance' | 'timeline' | 'audio' | null>(null)
  const [dialogueGenerating, setDialogueGenerating] = useState(false)
  const [lanOpen, setLanOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [projectManagerOpen, setProjectManagerOpen] = useState(false)
  const [workspaceSearchOpen, setWorkspaceSearchOpen] = useState(false)
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState('')
  const [workspaceSearchEntries, setWorkspaceSearchEntries] = useState<WorkspaceSearchEntry[]>([])
  const [workspaceSearchIndex, setWorkspaceSearchIndex] = useState(0)
  const workspaceSearchInputRef = useRef<HTMLInputElement>(null)
  const workspaceSearchHighlightTimer = useRef<number | null>(null)
  const [workspaceProjects, setWorkspaceProjects] = useState<WorkspaceProject[]>(loadWorkspaceProjects)
  const [activeWorkspaceProjectId, setActiveWorkspaceProjectId] = useState<string | null>(null)
  const [lanStatus, setLanStatus] = useState<LanStatus>({ running: false })
  const [lanQr, setLanQr] = useState<{ mobile: string; desktop: string }>({ mobile: '', desktop: '' })
  const [videoClipDraft, setVideoClipDraft] = useState<{ source: MediaFile; replaceIndex?: number } | null>(null)
  const [clipMasterClip, setClipMasterClip] = useState<ClipItem | null>(null)
  const [clipMasterFromMovie, setClipMasterFromMovie] = useState(false)
  const [createResetKey, setCreateResetKey] = useState(0)
  const [ltxResetKey, setLtxResetKey] = useState(0)
  const [zImageResetKey, setZImageResetKey] = useState(0)
  const [animeResetKey, setAnimeResetKey] = useState(0)
  const [aceResetKey, setAceResetKey] = useState(0)
  const [music3ResetKey, setMusic3ResetKey] = useState(0)
  const [ltxResetAt, setLtxResetAt] = useState(0)
  useEffect(() => {
    const decide = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; decision: 'approve' | 'dismiss' }>).detail
      if (!promptSuggestionId || detail.id !== promptSuggestionId) return
      if (detail.decision === 'approve') { setPrompt(promptSuggestion); setNotice({ tone: 'success', text: 'Copilot refinement approved and applied to Create.' }) }
      setPromptSuggestion(''); setPromptSuggestionId('')
    }
    window.addEventListener(COPILOT_DECISION_EVENT, decide)
    return () => window.removeEventListener(COPILOT_DECISION_EVENT, decide)
  }, [promptSuggestion, promptSuggestionId])
  const onLiveProgress = useCallback((id: string, update: LiveProgress) => {
    if (!id) return
    const receivedAt = Date.now()
    setJobs((current) => {
      let changed = false
      const nextJobs = current.map((j) => {
      if (j.promptId !== id || !['running', 'queued'].includes(j.status)) return j
      if (j.status === 'running' && j.progressLabel === update.label && (update.currentStep === undefined || update.currentStep === j.currentStep) && (update.totalSteps === undefined || update.totalSteps === j.totalSteps) && (update.progress === undefined || update.progress <= j.progress) && (update.samplerPass === undefined || update.samplerPass === j.samplerPass)) return j
      changed = true
      const samplerPass = update.samplerPass ?? j.samplerPass
      const passChanged = Boolean(update.samplerPass && update.samplerPass !== j.samplerPass)
      const currentStep = passChanged ? update.currentStep ?? 0 : update.currentStep ?? j.currentStep
      const totalSteps = passChanged ? update.totalSteps ?? (samplerPass === 'refine' ? j.refinementSteps : j.steps) : update.totalSteps ?? j.totalSteps
      const advancedSamplerStep = update.currentStep !== undefined && !passChanged && update.currentStep > (j.currentStep ?? -1)
      const measuredStepMs = advancedSamplerStep && j.lastSamplerStepAt && j.currentStep !== undefined
        ? receivedAt - j.lastSamplerStepAt
        : undefined
      const estimatedSamplerStepMs = passChanged && samplerPass === 'refine' && j.estimatedSamplerStepMs
        ? Math.round(j.estimatedSamplerStepMs * (j.refinementStepCostMultiplier ?? 1))
        : measuredStepMs
        ? j.estimatedSamplerStepMs ? Math.round(j.estimatedSamplerStepMs * 0.65 + measuredStepMs * 0.35) : measuredStepMs
        : j.estimatedSamplerStepMs
      const refinementProgress = j.refinementSteps && j.steps && currentStep !== undefined && (update.currentStep !== undefined || passChanged)
        ? Math.min(95, ((samplerPass === 'refine' ? j.steps : 0) + currentStep) / (j.steps + j.refinementSteps) * 95)
        : undefined
      const next: GenerationJob = {
        ...j,
        ...update,
        currentStep,
        totalSteps,
        samplerPass,
        progress: Math.max(j.progress, refinementProgress ?? update.progress ?? j.progress),
        status: 'running' as const,
        startedAt: j.startedAt ?? receivedAt,
        queueMissingAt: undefined,
        lastSamplerStepAt: passChanged ? undefined : advancedSamplerStep ? receivedAt : j.lastSamplerStepAt,
        estimatedSamplerStepMs,
      }
      const samplerMilestone = update.currentStep !== undefined && update.totalSteps !== undefined && (update.currentStep === 0 || update.currentStep === update.totalSteps || update.currentStep % Math.max(1, Math.ceil(update.totalSteps / 4)) === 0)
      const stageChanged = Boolean(update.label && update.label !== j.progressLabel)
      return stageChanged && (!update.currentStep || samplerMilestone)
        ? appendComfyActivity(next, { at: receivedAt, level: 'info', message: update.label })
        : next
      })
      return changed ? nextJobs : current
    })
  }, [])
  // Keep the lightweight ComfyUI event socket active even when image previews
  // are hidden so queue, node, and sampler-step progress remain real-time.
  const live = useLivePreview(settings?.comfyUrl, true, onLiveProgress)

  const selection = useMemo(() => inferSelections(models, turbo, textEncoderPreference, settings?.h3DiffusionPrecision ?? 'int8'), [models, turbo, textEncoderPreference, settings?.h3DiffusionPrecision])
  const h3AnimatedPreviewReady = Boolean(h3PreviewOverrideNode && selection.previewVae)
  const userLoraChoices = useMemo(() => models.filter((model) => model.kind === 'loras' && !/^minimax_h3_(?:fl2v|ref2v)_turbo_/i.test(model.name)).map((model) => model.name).sort((a, b) => a.localeCompare(b)), [models])
  const h3Report = useMemo(() => h3StackReport(models), [models])
  const ltxSelection = useMemo(() => inferLtx25Selections(models, choices(info, 'LatentUpscaleModelLoader', 'model_name')), [models, info])
  const aceSelection = useMemo(() => inferAceStepSelections(models), [models])
  const music3Selection = useMemo(() => inferMusic3Selection(models), [models])
  const activeModel = turbo === 'fast' ? selection.fastH3 : mode === 'reference' ? selection.ref2va : selection.fl2va
  const activeLora = mode === 'reference' ? selection.ref2vLora : selection.fl2vLora
  const requiredModels = [activeModel, selection.textEncoder, selection.videoVae, selection.audioVae]
  const modelReady = requiredModels.every(Boolean) && (turbo === 'off' || turbo === 'fast' || Boolean(activeLora))
  const detectedRoutingGpus = useMemo(() => routingGpus(gpu, status.stats?.devices), [gpu, status.stats?.devices])
  const routingPlanFor = useCallback((names: Partial<Record<RoutingComponent, string>>, previewNode?: string) => {
    if (!settings) return null
    const sizes = Object.fromEntries(Object.entries(names).map(([component, name]) => {
      const file = models.find((model) => model.name === name)
      return [component, estimatedComponentBytes(file?.bytes, component as RoutingComponent)]
    }))
    return resolveGpuRouting(settings.gpuRouting, detectedRoutingGpus, info, sizes, previewNode)
  }, [detectedRoutingGpus, info, models, settings])
  const h3GpuRouting = useMemo(() => routingPlanFor({ diffusion: activeModel, textEncoder: selection.textEncoder, videoVae: selection.videoVae, audioVae: selection.audioVae, previewVae: selection.previewVae }, h3PreviewOverrideNode), [activeModel, h3PreviewOverrideNode, routingPlanFor, selection.audioVae, selection.previewVae, selection.textEncoder, selection.videoVae])
  const h3ProSourceSignature = useMemo(() => JSON.stringify({
    sceneState, resolution, turbo, steps, sampler, scheduler, experimentalSampling, refImageSize, h3ProRefineSteps,
    seed, firstFrame: firstFrame?.path, lastFrame: lastFrame?.path,
    images: referenceImages.map((file) => file.path), videos: referenceVideos.map((file) => file.path), audios: referenceAudios.map((file) => file.path),
    attention: settings?.attentionBackend, solTau: settings?.solAttnTau, solCache: settings?.solCacheEnabled,
  }), [experimentalSampling, firstFrame?.path, h3ProRefineSteps, lastFrame?.path, refImageSize, referenceAudios, referenceImages, referenceVideos, resolution, sampler, sceneState, scheduler, seed, settings?.attentionBackend, settings?.solAttnTau, settings?.solCacheEnabled, steps, turbo])
  const pendingJobs = jobs.filter((job) => job.status === 'queued' || job.status === 'running')
  const activeRenderJob = activeJobId ? jobs.find((job) => job.id === activeJobId) : undefined
  const pendingH3ProJob = jobs.find((job) => job.h3ProReviewPending && job.status === 'completed' && Boolean(job.outputUrl))
  useEffect(() => {
    if (!pendingJobs.length) return
    // Elapsed time needs seconds, not four full workspace renders per second.
    const timer = window.setInterval(() => setRuntimeNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [pendingJobs.length])
  const activeRenderRuntime = activeRenderJob
    ? activeRenderJob.renderDurationMs ?? (['queued', 'running'].includes(activeRenderJob.status) ? Math.max(0, runtimeNow - activeRenderJob.createdAt) : undefined)
    : undefined
  const activeEngineRuntime = activeRenderJob?.startedAt && activeRenderJob.status === 'running'
    ? Math.max(0, runtimeNow - activeRenderJob.startedAt)
    : undefined
  const activeQueueWait = activeRenderJob?.startedAt
    ? Math.max(0, activeRenderJob.startedAt - activeRenderJob.createdAt)
    : undefined
  const activeSamplerProgress = samplerProgressSummary(activeRenderJob, runtimeNow)
  const currentH3AttentionLabel = settings?.attentionBackend === 'sol' && solAttentionNode
    ? `NVIDIA Sol-Attn${settings.solCacheEnabled && solCacheNode ? ' + H3 cache' : ''} · tau ${settings.solAttnTau}`
    : settings?.h3ParallelAttentionEnabled && h3ParallelAttentionNode && /kitchen|int8/i.test(resolvedH3AttentionBackend ?? '')
      ? 'H3 multi-GPU parallel · Kitchen INT8'
      : attentionBackendLabel(resolvedH3AttentionBackend)
  const plannedRenderEstimate = useMemo(() => {
    const [width, height] = resolution.split('x').map(Number)
    if (!settings || !width || !height) return null
    return estimateRenderMs(renderBenchmarks, renderHardware(gpu).key, {
      provider: 'minimax', mode, turbo, attention: currentH3AttentionLabel,
      width, height, duration, steps: h3SamplingSteps(turbo, steps),
    })
  }, [currentH3AttentionLabel, duration, gpu, mode, renderBenchmarks, resolution, settings, steps, turbo])
  const pendingKey = pendingJobs.map((job) => job.id).join(',')
  const jobsRef = useRef(jobs)
  jobsRef.current = jobs
  const deleteGeneration = async (job: GenerationJob, mode: 'history' | 'trash' | 'permanent') => {
    const current = jobsRef.current.find((item) => item.id === job.id)
    if (!current) return
    if (['queued', 'running'].includes(current.status)) throw new Error('Stop the generation before deleting its history.')
    let result: 'trashed' | 'deleted' | 'missing' | undefined
    if (mode !== 'history') {
      const source = current.localOutputPath || current.outputUrl
      if (!source) throw new Error('No output file is recorded. Choose history-only deletion.')
      result = await window.minimax.trashOutput(source, mode)
    }
    setJobs((items) => items.filter((item) => item.id !== job.id))
    setActiveJobId((id) => id === job.id ? null : id)
    setNotice({ tone: 'success', text: result === 'deleted' ? 'Generation removed from Library and Queue. Output file permanently deleted.' : result === 'trashed' ? 'Generation removed from Library and Queue. Output file moved to Trash.' : result === 'missing' ? 'The output file was already missing. Generation history removed.' : 'Generation removed from Library and Queue. Output file kept.' })
  }
  const selectActiveJob = useCallback((nextJobId: string) => {
    setActiveJobId((currentId) => {
      const current = currentId ? jobsRef.current.find((job) => job.id === currentId) : undefined
      return current && ['queued', 'running'].includes(current.status) ? currentId : nextJobId
    })
  }, [])

  const scanModels = useCallback(async (nextSettings: AppSettings) => {
    setScanning(true)
    try {
      const found = await window.minimax.scanModels(nextSettings)
      setModels(found)
      return true
    } catch (error) {
      setNotice({ tone: 'error', text: `Could not scan model folders. Check the paths in Settings and retry. ${error instanceof Error ? error.message : String(error)}` })
      return false
    } finally {
      setScanning(false)
    }
  }, [])

  const connectionRequest = useRef(0)
  const checkConnection = useCallback(async (url: string) => {
    const request = ++connectionRequest.current
    setChecking(true)
    setInfo({})
    try {
      const nextStatus = await window.minimax.getComfyStatus(url)
      if (request !== connectionRequest.current) return nextStatus
      setStatus(nextStatus)
      if (nextStatus.connected) {
        const nextInfo = await window.minimax.getObjectInfo(url)
        if (request === connectionRequest.current) {
          setInfo(nextInfo)
          setNotice(current => current?.text.startsWith('Could not connect to ComfyUI.') ? { tone: 'success', text: 'Connected to ComfyUI. Engine information refreshed.' } : current)
        }
      }
      return nextStatus
    } catch (error) {
      const failed: ComfyStatus = { connected: false, latencyMs: 0, error: error instanceof Error ? error.message : String(error) }
      if (request === connectionRequest.current) {
        setStatus(failed)
        setInfo({})
        setNotice({ tone: 'error', text: `Could not connect to ComfyUI. Start ComfyUI, check its address in Settings, then choose Test connection. ${failed.error}` })
      }
      return failed
    } finally {
      if (request === connectionRequest.current) setChecking(false)
    }
  }, [])

  const refreshOllama = useCallback(async (nextSettings: AppSettings, announce = false) => {
    const connection = resolveLlmConnection(nextSettings)
    setLocalLlmChecking(true)
    try {
      const result = await window.minimax.getLocalLlmStatus(connection.url, connection.provider)
      const usable = result.models.filter((model) => model.local && model.family !== 'nomic-bert')
      setOllamaModels(usable)
      setLocalLlmStatus({ connected: true, models: usable, provider: connection.provider, url: connection.url })
      if (usable.length && !usable.some((model) => model.name === connection.model)) {
        setSettings((current) => current && current.llmProvider === connection.provider
          ? { ...current, [connection.provider === 'lmstudio' ? 'lmStudioModel' : 'ollamaModel']: usable[0].name }
          : current)
      }
      if (announce) setNotice(usable.length
        ? { tone: 'success', text: `${connection.label} connected. Found ${usable.length} usable local model${usable.length === 1 ? '' : 's'}.` }
        : { tone: 'neutral', text: `${connection.label} is connected, but no usable local generation models are installed.` })
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause)
      setOllamaModels([])
      setLocalLlmStatus({ connected: false, models: [], error, provider: connection.provider, url: connection.url })
      if (announce) setNotice({ tone: 'error', text: error })
    } finally {
      setLocalLlmChecking(false)
    }
  }, [])

  useEffect(() => {
    let disposed = false
    setBootError('')
    void window.minimax.getSettings().then((loaded) => {
      if (disposed) return
      activeLlmProvider.current = loaded.llmProvider
      activeLlmUrl.current = resolveLlmConnection(loaded).url
      loadedSettingsSnapshot.current = JSON.stringify(loaded)
      setSettings(loaded)
      void Promise.all([scanModels(loaded), checkConnection(loaded.comfyUrl), refreshOllama(loaded)])
    }).catch((error: unknown) => {
      if (!disposed) setBootError(error instanceof Error ? error.message : String(error))
    })
    return () => { disposed = true }
  }, [bootAttempt, checkConnection, refreshOllama, scanModels])

  useEffect(() => {
    if (!settings || loadedSettingsSnapshot.current === null) return
    const snapshot = JSON.stringify(settings)
    if (snapshot === loadedSettingsSnapshot.current) return
    const timer = window.setTimeout(() => {
      void queueSettingsSave(settings).catch(() => undefined)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [queueSettingsSave, settings])

  useEffect(() => {
    void window.minimax.getLegacyMigrationStatus().then(setLegacyMigration).catch(() => setLegacyMigration({ available: false, migrated: false, needsBrowserStorageRepair: false }))
  }, [])

  useEffect(() => {
    if (!settings || activeLlmProvider.current === null || activeLlmProvider.current === settings.llmProvider) return
    activeLlmProvider.current = settings.llmProvider
    setOllamaModels([])
    setLocalLlmStatus(null)
    void refreshOllama(settings)
  }, [settings, refreshOllama])

  useEffect(() => {
    if (!settings || activeLlmUrl.current === null) return
    const nextUrl = resolveLlmConnection(settings).url
    if (activeLlmUrl.current === nextUrl) return
    activeLlmUrl.current = nextUrl
    setOllamaModels([])
    setLocalLlmStatus(null)
  }, [settings])

  useEffect(() => {
    void window.minimax.getLanStatus().then(setLanStatus).catch(() => undefined)
  }, [])

  useEffect(() => {
    let disposed = false
    const refresh = () => {
      if (document.hidden) return
      void window.minimax.getGpuTelemetry().then((value) => { if (!disposed) setGpu(value) }).catch(() => { if (!disposed) setGpu({ available: false }) })
    }
    refresh()
    const timer = window.setInterval(refresh, 4000)
    return () => { disposed = true; window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    let disposed = false
    void window.minimax.getRenderBenchmarks().then((value) => { if (!disposed) setRenderBenchmarks(value) }).catch(() => undefined)
    return () => { disposed = true }
  }, [])

  useEffect(() => {
    if (!lanOpen || !lanStatus.url) {
      setLanQr({ mobile: '', desktop: '' })
      return
    }
    const desktopUrl = lanStatus.desktopUrl ?? lanStatus.url.replace('?mobile=1', '?desktop=1')
    void Promise.all([
      QRCode.toDataURL(lanStatus.url, { width: 300, margin: 2, color: { dark: '#07111f', light: '#ffffff' } }),
      QRCode.toDataURL(desktopUrl, { width: 300, margin: 2, color: { dark: '#07111f', light: '#ffffff' } }),
    ]).then(([mobile, desktop]) => setLanQr({ mobile, desktop })).catch(() => setLanQr({ mobile: '', desktop: '' }))
  }, [lanOpen, lanStatus.url, lanStatus.desktopUrl])

  useEffect(() => {
    if (!lanOpen) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setLanOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [lanOpen])

  const jobsToPersist = useRef(jobs)
  const jobsPersistTimer = useRef<number | null>(null)
  const persistedJobCheckpoint = useRef(jobs.slice(0, 100).map(job => `${job.id}:${job.promptId ?? ''}:${job.status}`).join('|'))
  jobsToPersist.current = jobs
  useEffect(() => {
    const checkpoint = jobs.slice(0, 100).map(job => `${job.id}:${job.promptId ?? ''}:${job.status}`).join('|')
    if (checkpoint !== persistedJobCheckpoint.current) {
      persistedJobCheckpoint.current = checkpoint
      if (jobsPersistTimer.current !== null) window.clearTimeout(jobsPersistTimer.current)
      jobsPersistTimer.current = null
      persist('minimax.jobs', jobs.slice(0, 100).map(compactJob))
      return
    }
    // Sampler progress can arrive many times per second. Persist the latest
    // snapshot on a fixed cadence, even during a long continuous render.
    if (jobsPersistTimer.current !== null) return
    jobsPersistTimer.current = window.setTimeout(() => {
      jobsPersistTimer.current = null
      persist('minimax.jobs', jobsToPersist.current.slice(0, 100).map(compactJob))
    }, 1200)
  }, [jobs, persist])
  useEffect(() => {
    const flush = (force = false) => {
      if (!force && document.visibilityState !== 'hidden') return
      if (jobsPersistTimer.current !== null) window.clearTimeout(jobsPersistTimer.current)
      jobsPersistTimer.current = null
      persist('minimax.jobs', jobsToPersist.current.slice(0, 100).map(compactJob))
    }
    const onVisibilityChange = () => flush()
    const onPageHide = () => flush(true)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)
    return () => { document.removeEventListener('visibilitychange', onVisibilityChange); window.removeEventListener('pagehide', onPageHide); if (jobsPersistTimer.current !== null) window.clearTimeout(jobsPersistTimer.current) }
  }, [persist])

  useEffect(() => {
    if (!settings?.ffmpegPath) return
    const pending = jobs.find(job => job.status === 'completed' && job.mediaType !== 'image' && job.mediaType !== 'audio' && (job.localOutputPath || job.outputUrl) && (!job.thumbnailUrl || !job.thumbnailUrl.includes('&v=2')) && !thumbnailAttempts.current.has(job.id))
    if (!pending) return
    thumbnailAttempts.current.add(pending.id)
    void window.minimax.getVideoThumbnail(pending.localOutputPath || pending.outputUrl!, settings.ffmpegPath)
      .then(thumbnailUrl => { setJobs(current => current.map(job => job.id === pending.id ? { ...job, thumbnailUrl } : job)) })
      .catch(() => setThumbnailScanNonce(value => value + 1))
  }, [jobs, settings?.ffmpegPath, thumbnailScanNonce])

  useEffect(() => {
    if (!gpu?.available) return
    const additions = jobs.flatMap((job) => {
      const sample = benchmarkFromJob(job, gpu)
      return sample && !renderBenchmarks.some((existing) => existing.jobId === sample.jobId) ? [sample] : []
    })
    if (!additions.length) return
    setRenderBenchmarks((current) => {
      const next = [...additions, ...current.filter((sample) => !additions.some((added) => added.jobId === sample.jobId))].slice(0, 180)
      void window.minimax.saveRenderBenchmarks(next).catch(() => undefined)
      return next
    })
  }, [gpu, jobs, renderBenchmarks])

  useEffect(() => {
    if (!notice || notice.tone === 'error') return
    const timer = window.setTimeout(() => setNotice(null), 4500)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const refresh = () => setCharacterProjects(loadCharacterProjects())
    window.addEventListener(CHARACTER_LIBRARY_EVENT, refresh)
    return () => window.removeEventListener(CHARACTER_LIBRARY_EVENT, refresh)
  }, [])
  useEffect(() => {
    let disposed = false
    void Promise.all(characterProjects.map(async (character) => {
      const bindings = allocateWorkspaceReferences([{ id: character.id, name: character.name, identity: characterReferences(character), detailReferences: settings?.characterDetailReferencesEnabled ? character.detailReferences : [], hairStyleIds: character.hairStyleIds, wardrobeIds: character.wardrobeIds, accessoryIds: character.accessoryIds }], wardrobeProjects, [])
      const wardrobe = wardrobeProjects.find((item) => item.id === character.wardrobeIds[0])
      const references = await Promise.all(bindings.map(async (binding) => {
        let preview = binding.file.preview ?? ''
        if (!preview.startsWith('data:')) {
          try { preview = await window.minimax.fileDataUrl(binding.file.path) } catch { /* Omit inaccessible media from the phone library. */ }
        }
        return { name: binding.file.name, preview, purpose: binding.purpose, label: binding.label }
      }))
      return { id: character.id, name: character.name, description: character.description, wardrobe: wardrobe && wardrobeReferences(wardrobe).length ? wardrobe.name : '', voiceNotes: character.voiceNotes, visualStyle: character.visualStyle, referenceInstructions: composeReferenceInstructions(bindings), references: references.filter((file) => file.preview.startsWith('data:')) }
    })).then((characters) => { if (!disposed) return window.minimax.syncMobileCharacters(characters) }).catch(() => undefined)
    return () => { disposed = true }
  }, [characterProjects, settings?.characterDetailReferencesEnabled, wardrobeProjects])
  useEffect(() => {
    const refresh = () => setWardrobeProjects(loadWardrobeProjects())
    window.addEventListener(WARDROBE_LIBRARY_EVENT, refresh)
    return () => window.removeEventListener(WARDROBE_LIBRARY_EVENT, refresh)
  }, [])
  useEffect(() => {
    const refresh = () => setLocationProjects(loadLocationProjects())
    window.addEventListener(LOCATION_LIBRARY_EVENT, refresh)
    return () => window.removeEventListener(LOCATION_LIBRARY_EVENT, refresh)
  }, [])
  useEffect(() => {
    const refresh = () => setAccessoryProjects(loadAccessoryProjects())
    window.addEventListener(ACCESSORY_LIBRARY_EVENT, refresh)
    return () => window.removeEventListener(ACCESSORY_LIBRARY_EVENT, refresh)
  }, [])

  useEffect(() => {
    const workspace: PersistedWorkspace = {
      sceneState: compactSceneState(sceneState),
      mode, prompt, duration, resolution, turbo, steps, sampler, scheduler, experimentalSampling, refImageSize, noDialogue, naturalMovement, clothingPolicy,
      sigmaShiftMode, shiftVideo, shiftAudio, loraStrength, userLoras, seed, ref2vaSeed, seedLocked, advanced, liveEnabled, livePreviewMode, previewModeVersion: 1,
      upscaleMode, h3ProReview, h3ProRefineSteps, h3RefineSteps, h3RefineDenoise, turbo8Profile, rtxModel, firstFrame: withoutPreview(firstFrame), lastFrame: withoutPreview(lastFrame),
      referenceImages: referenceImages.map((file) => withoutPreview(file)!),
      referenceVideos: referenceVideos.map((file) => withoutPreview(file)!), textEncoderPreference,
      referenceAudios: referenceAudios.map((file) => withoutPreview(file)!), selectedReferenceCharacterIds, selectedReferenceLocationIds, activeJobId,
    }
    persist('minimax.workspace', workspace)
  }, [persist, sceneState, activeJobId, advanced, clothingPolicy, duration, experimentalSampling, firstFrame, h3ProRefineSteps, h3RefineSteps, h3RefineDenoise, h3ProReview, lastFrame, liveEnabled, livePreviewMode, loraStrength, mode, naturalMovement, noDialogue, prompt, refImageSize, referenceAudios, referenceImages, referenceVideos, ref2vaSeed, resolution, rtxModel, sampler, scheduler, seed, seedLocked, selectedReferenceCharacterIds, selectedReferenceLocationIds, shiftAudio, shiftVideo, sigmaShiftMode, steps, textEncoderPreference, turbo, turbo8Profile, upscaleMode, userLoras])

  useEffect(() => {
    const completed = benchmarkResults.filter((item) => ['completed', 'failed', 'unavailable'].includes(item.status))
    if (completed.length) persist(H3_BENCHMARK_STORAGE_KEY, completed)
  }, [benchmarkResults, persist])

  useEffect(() => {
    if (benchmarkConfigInitialized.current) {
      setBenchmarkResults([])
      localStorage.removeItem(H3_BENCHMARK_STORAGE_KEY)
    } else benchmarkConfigInitialized.current = true
    persist(H3_BENCHMARK_CONFIG_STORAGE_KEY, benchmarkConfig)
  }, [benchmarkConfig, persist])

  useEffect(() => {
    if (!settings || mediaHydrated.current) return
    mediaHydrated.current = true
    const hydrate = async (file: MediaFile | null) => {
      if (!file || file.kind !== 'image' || file.preview) return file
      try { return { ...file, preview: await window.minimax.fileDataUrl(file.path) } } catch { return file }
    }
    void Promise.all([hydrate(firstFrame), hydrate(lastFrame)]).then(([first, last]) => {
      setFirstFrame(first); setLastFrame(last)
    })
    void Promise.all(referenceImages.map(hydrate)).then((files) => setReferenceImages(files.filter(Boolean) as MediaFile[]))
  }, [firstFrame, lastFrame, referenceImages, settings])

  useEffect(() => {
    if (!rtxModel && rtxModels.length) setRtxModel(rtxModels[0])
  }, [rtxModel, rtxModels])

  useEffect(() => {
    if (!settings || !pendingKey || !status.connected) return
    const historyInFlight = new Set<string>()
    let queueInFlight = false
    let disposed = false
    const timer = window.setInterval(() => {
      for (const job of jobsRef.current.filter((j) => j.status === 'queued' || j.status === 'running')) {
        const promptId = job.promptId
        if (!promptId || historyInFlight.has(promptId)) continue
        historyInFlight.add(promptId)
        void window.minimax.getHistory(settings.comfyUrl, promptId).then(async (history) => {
          if (disposed) return
          const entry = history[promptId] as { status?: { status_str?: string; completed?: boolean; messages?: unknown[] } } | undefined
          const mediaType = job.mediaType ?? 'video'
          const outputUrl = playableOutputUrl(extractOutputUrl(history, promptId, settings.comfyUrl, mediaType))
          const terminalState = comfyTerminalState(entry)
          if (terminalState === 'failed') {
            // A node after the main save (preview, upscale, extraction) can be
            // what actually errored. Don't discard an output that already made
            // it to disk just because the overall prompt status is "error".
            const recovered = await resolveJobOutputFile(settings.comfyUrl, activeOutputDirectory, promptId, mediaType, job.createdAt)
            if (recovered) {
              const localUrl = await window.minimax.mediaUrl(recovered)
              setJobs((current) => current.map((item) => item.id === job.id ? { ...item, status: 'completed', progress: 100, renderDurationMs: Date.now() - item.createdAt, outputUrl: localUrl, localOutputPath: recovered, progressLabel: 'Rendered, but a later step (preview/upscale/extraction) reported an error.' } : item))
            } else {
              const historyEvents = comfyHistoryActivity(entry?.status?.messages).map((event) => ({ ...event, at: Date.now() }))
              const failureDetail = [...historyEvents].reverse().find(event => event.level === 'error')?.message
              setJobs((current) => current.map((item) => {
                if (item.id !== job.id) return item
                const failed = { ...item, status: 'failed' as const, error: failureDetail ? `ComfyUI execution failed: ${failureDetail}` : 'ComfyUI reported an execution error. Open render activity for details; the original may still be saved if upscaling failed.' }
                return historyEvents.reduce((next, event) => appendComfyActivity(next, event), appendComfyActivity(failed, { at: Date.now(), level: 'error', message: 'ComfyUI reported an execution error.' }))
              }))
            }
          } else if (mediaType === 'image' && outputUrl && terminalState === 'completed') {
            const outputFile = extractOutputFile(history, promptId, 'image')
            if (!outputFile) return
            try {
              const saved = await window.minimax.saveStillImage(settings.comfyUrl, outputFile, activeOutputDirectory)
              const localUrl = await window.minimax.mediaUrl(saved.path)
              setJobs((current) => current.map((item) => item.id === job.id ? appendComfyActivity({ ...item, status: 'completed', progress: 100, renderDurationMs: Date.now() - item.createdAt, outputUrl: localUrl, localOutputPath: saved.path, progressLabel: 'Reference still ready' }, { at: Date.now(), level: 'success', message: 'Output saved locally and ready to use.' }) : item))
            } catch (error) {
              setJobs((current) => current.map((item) => item.id === job.id ? { ...item, status: 'failed', error: `The still rendered, but could not be saved locally: ${error instanceof Error ? error.message : String(error)}` } : item))
            }
          } else if (outputUrl && terminalState === 'completed') {
            const outputFile = extractOutputFile(history, promptId, mediaType)
            // Resolve the exact output reported by ComfyUI. Never credit a
            // concurrent render merely because it is the newest disk file.
            const localOutput = outputFile ? await window.minimax.resolveOutput(activeOutputDirectory, outputFile) : null
            // Movie continuity needs a local file, not ComfyUI's /view URL.
            // Store a playable local URL on the planner while retaining the
            // exact filesystem path on the job for frame extraction.
            const localUrl = localOutput ? await window.minimax.mediaUrl(localOutput) : outputUrl
            const segmentFile = job.continuation ? extractOutputFile(history, promptId, 'video', '174') : undefined
            const segmentOutputPath = segmentFile ? await window.minimax.resolveOutput(activeOutputDirectory, segmentFile).catch(() => null) : null
            const segmentOutputUrl = segmentOutputPath ? await window.minimax.mediaUrl(segmentOutputPath) : segmentFile ? extractOutputUrl({ [promptId]: { outputs: { '19': { videos: [segmentFile] } } } }, promptId, settings.comfyUrl) : undefined
            const latentPath = job.latentFile ? await window.minimax.resolveOutput(activeOutputDirectory, { filename: job.latentFile.split('/').at(-1)!, subfolder: 'h3_context', type: 'output' }).catch(() => null) : null
            const completedMetadata = localOutput && job.continuation
              ? await window.minimax.getVideoMetadata(localOutput, settings.ffmpegPath).catch(() => null)
              : null
            let extractionError: string | null = null
            if (job.characterProjectId) {
              recordCharacterTurntable(job.characterProjectId, localOutput ?? outputUrl)
              if (localOutput) extractionError = await extractAutomatedReferenceSet('character', job.characterProjectId, localOutput, job.duration, settings)
            } else if (job.locationProjectId) {
              recordLocationWalkthrough(job.locationProjectId, localOutput ?? outputUrl)
              if (localOutput) extractionError = await extractAutomatedReferenceSet('location', job.locationProjectId, localOutput, job.duration, settings)
            }
            if (extractionError) setNotice({ tone: 'error', text: `The video rendered, but its reference frames could not be extracted: ${extractionError}` })
            setJobs((current) => current.map((item) => item.id === job.id ? appendComfyActivity({ ...item, status: 'completed', progress: 100, renderDurationMs: Date.now() - item.createdAt, outputUrl: localUrl, localOutputPath: localOutput ?? undefined, latentPath: latentPath ?? undefined, segmentOutputPath: segmentOutputPath ?? undefined, segmentOutputUrl, duration: completedMetadata?.duration ?? item.duration, width: completedMetadata?.width ?? item.width, height: completedMetadata?.height ?? item.height }, { at: Date.now(), level: 'success', message: item.latentFile ? 'Video and synchronized H3 AV latent saved for continuation.' : 'Output saved locally and ready to use.' }) : item))
          } else if (terminalState === 'completed') {
            const outputFile = extractOutputFile(history, promptId, mediaType)
            const localOutput = outputFile
              ? await window.minimax.resolveOutput(activeOutputDirectory, outputFile)
              : await resolveJobOutputFile(settings.comfyUrl, activeOutputDirectory, promptId, mediaType, job.createdAt)
            const localUrl = localOutput ? await window.minimax.mediaUrl(localOutput) : null
            if (localOutput) recordCharacterTurntable(job.characterProjectId, localOutput)
            if (localOutput) recordLocationWalkthrough(job.locationProjectId, localOutput)
            const extractionError = localOutput && job.characterProjectId ? await extractAutomatedReferenceSet('character', job.characterProjectId, localOutput, job.duration, settings) : localOutput && job.locationProjectId ? await extractAutomatedReferenceSet('location', job.locationProjectId, localOutput, job.duration, settings) : null
            if (extractionError) setNotice({ tone: 'error', text: `The video rendered, but its reference frames could not be extracted: ${extractionError}` })
            setJobs((current) => current.map((item) => item.id === job.id ? localOutput && localUrl ? appendComfyActivity({ ...item, status: 'completed', progress: 100, renderDurationMs: Date.now() - item.createdAt, outputUrl: localUrl, localOutputPath: localOutput }, { at: Date.now(), level: 'success', message: 'Output saved locally and ready to use.' }) : appendComfyActivity({ ...item, status: 'failed', progress: 100, renderDurationMs: Date.now() - item.createdAt, error: 'ComfyUI completed this prompt, but no matching output was found. Check the output folder and ComfyUI history.' }, { at: Date.now(), level: 'error', message: 'ComfyUI completed, but no matching output could be resolved.' }) : item))
          }
        }).catch(() => undefined).finally(() => historyInFlight.delete(promptId))
      }
      if (queueInFlight) return
      queueInFlight = true
      const checkedAt = Date.now()
      void window.minimax.getQueue(settings.comfyUrl).then(async (queue) => {
        if (disposed) return
        // Jobs that have been missing from the queue for 30+ seconds get one
        // last recovery attempt (history, then a directory scan) before being
        // declared failed. A restart clears ComfyUI's in-memory history, and a
        // slow save/extraction step can leave the completion handler above
        // still mid-flight — neither means the render itself was lost.
        const recoveries = new Map<string, string | null>()
        for (const job of jobsRef.current) {
          if (!job.promptId || !['queued', 'running'].includes(job.status)) continue
          if (queuePromptState(queue, job.promptId)) continue
          const missingSince = job.queueMissingAt ?? checkedAt
          if (checkedAt - missingSince < 30_000) continue
          recoveries.set(job.id, await resolveJobOutputFile(settings.comfyUrl, activeOutputDirectory, job.promptId, job.mediaType ?? 'video', job.createdAt))
        }
        const recoveredUrls = new Map<string, string>()
        for (const [jobId, path] of recoveries) {
          if (path) recoveredUrls.set(jobId, await window.minimax.mediaUrl(path))
        }
        if (disposed) return
        setJobs((current) => {
        let changed = false
        const next = current.map((job) => {
        if (!job.promptId || !['queued', 'running'].includes(job.status)) return job
        const queueState = queuePromptState(queue, job.promptId)
        if (queueState === 'running') {
          if (job.status === 'running' && !job.queueMissingAt && !job.queuePosition) return job
          changed = true
          return appendComfyActivity({ ...job, status: 'running', startedAt: job.startedAt ?? checkedAt, queueMissingAt: undefined, queuePosition: undefined, progressLabel: 'ComfyUI started rendering' }, { at: checkedAt, level: 'info', message: 'ComfyUI accepted the workflow and began executing it.' })
        }
        if (queueState === 'queued') {
          const queuePosition = queuePromptPosition(queue, job.promptId)
          if (job.status === 'queued' && !job.queueMissingAt && job.queuePosition === queuePosition) return job
          changed = true
          return appendComfyActivity({ ...job, status: 'queued', queueMissingAt: undefined, queuePosition, progress: Math.min(job.progress, 8), progressLabel: 'Waiting in the ComfyUI queue' }, { at: checkedAt, level: 'info', message: `Waiting in the ComfyUI queue${queuePosition ? ` · position ${queuePosition}` : ''}.` })
        }
        const missingSince = job.queueMissingAt ?? checkedAt
        if (checkedAt - missingSince < 30_000) {
          if (job.queueMissingAt) return job
          changed = true
          return appendComfyActivity({ ...job, queueMissingAt: missingSince, progressLabel: 'ComfyUI finished; waiting for saved output…' }, { at: checkedAt, level: 'warning', message: 'Prompt left the queue; waiting for ComfyUI history and output persistence.' })
        }
        if (!recoveries.has(job.id)) return job
        const recoveredPath = recoveries.get(job.id)
        const recoveredUrl = recoveredUrls.get(job.id)
        if (recoveredPath && recoveredUrl) {
          changed = true
          return appendComfyActivity({ ...job, status: 'completed', progress: 100, renderDurationMs: Date.now() - job.createdAt, outputUrl: recoveredUrl, localOutputPath: recoveredPath, queueMissingAt: undefined, progressLabel: 'Recovered from the output folder after ComfyUI lost track of this prompt.' }, { at: Date.now(), level: 'success', message: 'Recovered saved output after the prompt left the queue and history.' })
        }
        changed = true
        return appendComfyActivity({ ...job, status: 'failed', queueMissingAt: undefined, error: 'ComfyUI no longer reports this prompt in its queue or history. It may have been interrupted, cleared, or rejected before execution.' }, { at: checkedAt, level: 'error', message: 'Prompt disappeared from the ComfyUI queue and history.' })
        })
        return changed ? next : current
      }) }).catch(() => undefined).finally(() => { queueInFlight = false })
    }, 1000)
    return () => { disposed = true; window.clearInterval(timer) }
  }, [activeOutputDirectory, pendingKey, settings, status.connected])

  const chooseMedia = async (kind: MediaKind, setter: (file: MediaFile) => void) => {
    const picked = await window.minimax.chooseMedia(kind)
    if (!picked) return
    let preview: string | undefined
    if (kind === 'image') preview = await window.minimax.fileDataUrl(picked.path)
    setter({ ...picked, kind, preview })
  }

  const extractCompletedVideoFinalFrame = async (job: GenerationJob) => {
    if (!settings) throw new Error('Open Settings and configure the output folder first.')
    const outputFile = job.outputUrl ? outputFileFromUrl(job.outputUrl) : undefined
    const resolvedOutput = outputFile ? await window.minimax.resolveOutput(activeOutputDirectory, outputFile) : null
    const candidates = continuationSourceCandidates(job, resolvedOutput)
    if (!candidates.length) throw new Error('This completed job has no saved video location. Open the video in Library and verify that its output still exists.')
    let lastError = ''
    for (const source of candidates) {
      try {
        return await window.minimax.extractVideoFrame(source, 'last', activeOutputDirectory, settings.ffmpegPath)
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
    throw new Error(`The saved local path is unavailable and ComfyUI could not provide the completed video${lastError ? `: ${lastError}` : '.'}`)
  }

  const startVideoContinuation = async (job: GenerationJob) => {
    setContinuationOpenRequest(current => nextContinuationOpenRequest(current, job.id))
  }

  const addVideoLastFrameAsReference = async (job: GenerationJob, opening: { mode: 'match' | 'reframe' | 'arc'; cameraAngle?: string }) => {
    if (!settings) return
    const existingBindings = resolveRenderReferenceBindings(referenceImages, workspaceBindingsFor(selectedReferenceCharacterIds, selectedReferenceLocationIds), clothingPolicy)
    if (existingBindings.length >= 9) throw new Error('All 9 picture reference slots are already in use. Remove one picture before adding this final frame.')
    const extracted = await extractCompletedVideoFinalFrame(job)
    const frame: MediaFile = {
      ...extracted,
      name: `Final frame reference · ${extracted.name}`,
      kind: 'image',
      preview: await window.minimax.mediaUrl(extracted.path),
      referenceRole: 'composition',
      referenceRetention: opening.mode === 'reframe' ? 'guide' : 'preserve',
      openingFrameTreatment: opening.mode,
      crop: { x: .5, y: .5, zoom: 1, fit: 'crop', background: 'auto' },
    }
    setReferenceImages(current => [...current, { ...frame, referenceRole: opening.mode === 'reframe' ? 'location' : 'composition', referenceRetention: 'preserve' }])
    setSceneState(current => ({ ...current, camera: opening.cameraAngle ? { ...current.camera, angle: value(opening.cameraAngle) } : current.camera, continuity: { ...current.continuity, scene: true, exactFrame: opening.mode !== 'reframe' } }))
    setMode('reference')
    setActiveJobId(null)
    setView('create')
    setNotice({ tone: 'success', text: opening.mode === 'reframe' ? 'Previous frame added as a reference-only source. It guides scene continuity but does not lock frame 0.' : 'Previous frame assigned as the native Frame 0 anchor. Ref2VA references remain available for identity, wardrobe, location, motion, and sound.' })
  }

  const startRef2vaContinuation = async (job: GenerationJob) => {
    try {
      await addVideoLastFrameAsReference(job, { mode: 'match' })
    } catch (error) {
      setNotice({ tone: 'error', text: `Could not add the continuation frame to Ref2VA: ${error instanceof Error ? error.message : String(error)}` })
    }
  }

  const chooseMany = async (kind: MediaKind) => {
    if (kind === 'video') {
      const picked = await window.minimax.chooseMedia('video')
      if (!picked) return
      const preview = await window.minimax.mediaUrl(picked.path)
      setVideoClipDraft({ source: { ...picked, kind: 'video', preview } })
      return
    }
    await chooseMedia(kind, (file) => {
      if (kind === 'image') setReferenceImages((current) => current.length < 9 ? [...current, { ...file, referenceRole: 'composition', referenceRetention: 'guide', crop: { x: .5, y: .5, zoom: 1, fit: 'crop', background: 'auto' } }] : current)
      if (kind === 'audio') setReferenceAudios((current) => current.length < 3 ? [...current, file] : current)
    })
  }

  const workspaceBindingsFor = (characterIds: string[], locationIds: string[]) => {
    // Resolve every linked record from storage at selection time. A Character
    // Studio save and a Source Media click can occur before React has committed
    // the library event, which previously left the character's new wardrobe out.
    const currentCharacters = loadCharacterProjects()
    const currentLocations = loadLocationProjects()
    const selectedCharacters = characterIds.map((id) => currentCharacters.find((project) => project.id === id)).filter(Boolean) as CharacterProject[]
    const selectedLocations = locationIds.map((id) => currentLocations.find((project) => project.id === id)).filter(Boolean) as LocationProject[]
    const currentWardrobes = loadWardrobeProjects()
    return allocateWorkspaceReferences(
      selectedCharacters.map((character) => ({ id: character.id, name: character.name, identity: characterReferences(character), detailReferences: settings?.characterDetailReferencesEnabled ? character.detailReferences : [], hairStyleIds: character.hairStyleIds, wardrobeIds: character.wardrobeIds, accessoryIds: character.accessoryIds })),
      currentWardrobes,
      selectedLocations.map((location) => ({ id: location.id, name: location.name, images: locationReferences(location), environmentMode: location.environmentMode })),
    )
  }

  const applyWorkspaceBindings = async (previous: MovieReferenceBinding[], next: MovieReferenceBinding[]) => {
    const revision = ++libraryBindingRevision.current
    const images = await Promise.all(next.map(async ({ file: source }) => {
      if (source.preview) return source
      try { return { ...source, preview: await window.minimax.fileDataUrl(source.path) } }
      catch { return source }
    }))
    const previousPaths = new Set(previous.map((binding) => binding.file.path))
    const nextPaths = new Set(next.map((binding) => binding.file.path))
    if (revision !== libraryBindingRevision.current) return images
    managedLibraryReferencePaths.current = nextPaths
    setReferenceImages((current) => {
      const standalone = current.filter((file) => !previousPaths.has(file.path) && !nextPaths.has(file.path))
      return [...images, ...standalone].slice(0, 9)
    })
    // Approved source assignments are a locked prompt layer. Keep them out of
    // the editable scene field, but remove any legacy generated text that may
    // have been inserted by an earlier version before the render-time composer
    // attaches the current assignment instructions.
    setPrompt((current) => syncReferencePrompt(current, [...previous, ...next], []))
    setPromptSuggestion('')
    setPromptSuggestionId('')
    return images
  }

  const refreshSourceMedia = async () => {
    const previous = workspaceBindingsFor(selectedReferenceCharacterIds, selectedReferenceLocationIds)
    setCharacterProjects(loadCharacterProjects())
    setWardrobeProjects(loadWardrobeProjects())
    setLocationProjects(loadLocationProjects())
    setAccessoryProjects(loadAccessoryProjects())
    const next = workspaceBindingsFor(selectedReferenceCharacterIds, selectedReferenceLocationIds)
    if (selectedReferenceCharacterIds.length || selectedReferenceLocationIds.length) await applyWorkspaceBindings(previous, next)
  }

  // Keep selected library assets authoritative. Character Studio and Wardrobe
  // Studio can change a link while this workspace (and even its modal) remains
  // mounted. Rebuild the actual render inputs whenever either library changes
  // so the checked active outfit cannot remain UI-only state.
  useEffect(() => {
    if (!selectedReferenceCharacterIds.length && !selectedReferenceLocationIds.length) return
    let disposed = false
    const revision = ++libraryBindingRevision.current
    const selectedCharacters = selectedReferenceCharacterIds.map((id) => characterProjects.find((project) => project.id === id)).filter(Boolean) as CharacterProject[]
    const selectedLocations = selectedReferenceLocationIds.map((id) => locationProjects.find((project) => project.id === id)).filter(Boolean) as LocationProject[]
    const next = allocateWorkspaceReferences(
      selectedCharacters.map((character) => ({ id: character.id, name: character.name, identity: characterReferences(character), detailReferences: settings?.characterDetailReferencesEnabled ? character.detailReferences : [], hairStyleIds: character.hairStyleIds, wardrobeIds: character.wardrobeIds, accessoryIds: character.accessoryIds })),
      wardrobeProjects,
      selectedLocations.map((location) => ({ id: location.id, name: location.name, images: locationReferences(location), environmentMode: location.environmentMode })),
    )
    void Promise.all(next.map(async ({ file }) => {
      if (file.preview) return file
      try { return { ...file, preview: await window.minimax.fileDataUrl(file.path) } } catch { return file }
    })).then((images) => {
      if (disposed || revision !== libraryBindingRevision.current) return
      const nextPaths = new Set(images.map((file) => file.path))
      setReferenceImages((current) => {
        const standalone = current.filter((file) => !managedLibraryReferencePaths.current.has(file.path) && !nextPaths.has(file.path))
        return [...images, ...standalone].slice(0, 9)
      })
      managedLibraryReferencePaths.current = nextPaths
      setPrompt(current => syncReferencePrompt(current, next, []))
      setPromptSuggestion('')
      setPromptSuggestionId('')
      setSceneState(current => ({ ...current }))
    })
    return () => { disposed = true }
  }, [characterProjects, locationProjects, selectedReferenceCharacterIds, selectedReferenceLocationIds, settings?.characterDetailReferencesEnabled, wardrobeProjects])

  const loadReferenceCharacter = async (characterId: string) => {
    const previousBindings = workspaceBindingsFor(selectedReferenceCharacterIds, selectedReferenceLocationIds)
    const selectedIds = characterId ? (selectedReferenceCharacterIds.includes(characterId) ? selectedReferenceCharacterIds.filter((id) => id !== characterId) : [...selectedReferenceCharacterIds, characterId]) : []
    setMode('reference')
    const selectedCharacters = selectedIds.map((id) => characterProjects.find((project) => project.id === id)).filter(Boolean) as CharacterProject[]
    if (selectedCharacters.some((character) => characterIdentityReferences(character).length === 0)) {
      setNotice({ tone: 'error', text: 'Every selected character needs at least one approved identity image.' })
      return
    }
    setSelectedReferenceCharacterIds(selectedIds)
    const bindings = workspaceBindingsFor(selectedIds, selectedReferenceLocationIds)
    await applyWorkspaceBindings(previousBindings, bindings)
    const identityCount = bindings.filter((item) => item.purpose === 'character' || item.purpose === 'character-angle').length
    const hairCount = bindings.filter((item) => item.purpose === 'hair').length
    const wardrobeCount = bindings.filter((item) => item.purpose === 'wardrobe').length
    const locationCount = bindings.filter((item) => item.purpose === 'location').length
    setNotice({ tone: 'success', text: selectedCharacters.length ? `Using ${identityCount} identity, ${hairCount} hair, ${wardrobeCount} wardrobe, and ${locationCount} location picture${locationCount === 1 ? '' : 's'} across ${bindings.length} of 9 slots.` : locationCount ? `Cast cleared. Keeping ${locationCount} location picture${locationCount === 1 ? '' : 's'}.` : 'Cleared character references.' })
  }

  const loadReferenceLocation = async (locationId: string) => {
    const previousBindings = workspaceBindingsFor(selectedReferenceCharacterIds, selectedReferenceLocationIds)
    if (!locationId) {
      setSelectedReferenceLocationIds([]); setMode('reference')
      const bindings = workspaceBindingsFor(selectedReferenceCharacterIds, [])
      await applyWorkspaceBindings(previousBindings, bindings)
      setNotice({ tone: 'success', text: bindings.length ? `Locations cleared. Keeping ${bindings.length} character and wardrobe picture${bindings.length === 1 ? '' : 's'}.` : 'Cleared location references.' })
      return
    }
    const location = locationProjects.find((project) => project.id === locationId)
    if (!location) return
    const sources = locationReferences(location)
    if (!sources.length) { setNotice({ tone: 'error', text: `${location.name} needs an approved reference image first.` }); return }
    const selectedIds = selectedReferenceLocationIds.includes(locationId) ? selectedReferenceLocationIds.filter((id) => id !== locationId) : [...selectedReferenceLocationIds, locationId]
    setSelectedReferenceLocationIds(selectedIds); setMode('reference')
    const bindings = workspaceBindingsFor(selectedReferenceCharacterIds, selectedIds)
    await applyWorkspaceBindings(previousBindings, bindings)
    const locationCount = bindings.filter((item) => item.purpose === 'location').length
    setNotice({ tone: 'success', text: selectedIds.includes(locationId) ? `Added ${location.name}. Characters, wardrobe, and locations now use ${bindings.length} of 9 picture slots.` : `${location.name} removed. ${locationCount} location picture${locationCount === 1 ? '' : 's'} remain.` })
  }

  const loadReferenceWardrobe = async (wardrobeId: string) => {
    const wardrobe = wardrobeProjects.find((project) => project.id === wardrobeId)
    if (!wardrobe) return
    const approved = wardrobeReferences(wardrobe).slice(0, 9).map((file) => ({ ...fitWholeCharacter(file), referenceRole: 'wardrobe' as const, referenceRetention: 'preserve' as const }))
    if (!approved.length) { setNotice({ tone: 'error', text: `${wardrobe.name} has no approved wardrobe images yet.` }); return }
    const images = await Promise.all(approved.map(async (file) => { if (file.preview) return file; try { return { ...file, preview: await window.minimax.fileDataUrl(file.path) } } catch { return file } }))
    // Choosing an approved outfit from the library is an explicit wardrobe
    // request. Make that intent authoritative so an older Underwear or
    // Unrestricted setting cannot silently discard the selected source.
    setClothingPolicy('wardrobe'); setSelectedReferenceCharacterIds([]); setSelectedReferenceLocationIds([]); setMode('reference'); setReferenceImages(images)
    setNotice({ tone: 'success', text: `Loaded ${images.length} approved wardrobe reference${images.length === 1 ? '' : 's'} for ${wardrobe.name}.` })
  }

  const editVideoReference = async (index: number) => {
    const file = referenceVideos[index]
    if (!file) return
    const sourcePath = file.clip?.sourcePath ?? file.path
    const preview = await window.minimax.mediaUrl(sourcePath)
    setVideoClipDraft({ source: { ...file, path: sourcePath, name: file.clip?.sourceName ?? file.name, preview }, replaceIndex: index })
  }

  const createVideoReferenceClip = async (start: number, end: number) => {
    if (!settings || !videoClipDraft) return
    const source = videoClipDraft.source
    const result = await window.minimax.trimVideo(source.path, start, end, activeOutputDirectory, settings.ffmpegPath)
    const clipped: MediaFile = { ...result, kind: 'video', clip: { sourcePath: source.path, sourceName: source.name, start, end } }
    setReferenceVideos((current) => videoClipDraft.replaceIndex === undefined
      ? current.length < 3 ? [...current, clipped] : current
      : current.map((file, index) => index === videoClipDraft.replaceIndex ? clipped : file))
    setVideoClipDraft(null)
    setNotice({ tone: 'success', text: `${(end - start).toFixed(1)}s reference clip created. The original video was not changed.` })
  }

  const saveAppSettings = async () => {
    if (!settings) return
    try {
      await queueSettingsSave(settings)
      const scanned = await scanModels(settings)
      const connection = await checkConnection(settings.comfyUrl)
      await refreshOllama(settings)
      if (scanned && connection.connected) setNotice({ tone: 'success', text: 'Settings saved and model folders rescanned.' })
      else if (scanned) setNotice({ tone: 'error', text: 'Settings saved, but ComfyUI is unavailable. Start ComfyUI and choose Test connection to retry.' })
    } catch {
      // queueSettingsSave keeps the concrete save error visible.
    }
  }

  const applyGenerationDefaults = () => {
    if (!settings) return
    const defaults = settings.generationDefaults
    setResolution(defaults.resolution)
    setDuration(defaults.duration)
    setTurbo(defaults.turbo)
    setTurbo8Profile(defaults.turbo8Profile)
    setTextEncoderPreference(defaults.textEncoderPreference)
    setSteps(defaults.steps)
    setSampler(defaults.sampler)
    setScheduler(defaults.scheduler)
    setExperimentalSampling(defaults.experimentalSampling)
    setRefImageSize(defaults.refImageSize)
    setLiveEnabled(defaults.livePreview)
    setSigmaShiftMode(defaults.sigmaShiftMode)
    setShiftVideo(defaults.shiftVideo)
    setShiftAudio(defaults.shiftAudio)
    setLoraStrength(defaults.loraStrength)
    setUserLoras(workspaceDefaults.userLoras.map((item) => ({ ...item })))
    setUpscaleMode(defaults.upscaleMode)
    setNotice({ tone: 'success', text: 'Saved generation defaults applied to the current Create workspace.' })
  }

  const runPromptTool = async (tool: 'enhance' | 'timeline' | 'audio') => {
    if (!settings || !prompt.trim()) {
      setNotice({ tone: 'error', text: 'Write a rough prompt first, then ask the local assistant to refine it.' })
      return
    }
    const llm = resolveLlmConnection(settings)
    if (!llm.model || ollamaModels.length === 0) {
      setNotice({ tone: 'error', text: `No local ${llm.label} model is available. Check the local AI provider in Settings.` })
      return
    }
    const workspaceBindings = workspaceBindingsFor(selectedReferenceCharacterIds, selectedReferenceLocationIds)
    const referenceMap = mode === 'reference' ? [
      ...referenceImages.map((file, index) => `<Picture ${index + 1}> = ${workspaceBindings[index]?.label ?? file.name}`),
      ...referenceVideos.map((file, index) => `<Video ${index + 1}> = ${file.name}`),
      ...referenceAudios.map((file, index) => `<Audio ${index + 1}> = ${file.name}`),
    ] : undefined
    const request = buildPromptAssistantRequest(tool, prompt, { duration, mode, referenceMap, noDialogue })
    setPromptingTool(tool)
    setPromptSuggestion('')
    try {
      const imagePaths = mode === 'reference' ? referenceImages.map((file) => file.path) : [firstFrame?.path, lastFrame?.path].filter(Boolean) as string[]
      const structuredRequest = `${request}\n\nReturn the required structured fields. The direction field must contain only the complete shot direction. Keep the summary to one concise sentence. Inspect attached images in reference-map order and use only visible details; do not invent unseen traits.`
      let result: unknown
      try {
        result = await window.minimax.generateStructuredWithOllama(llm.url, llm.model, structuredRequest, h3PromptDirectionSchema, llm.provider, imagePaths)
      } catch (error) {
        if (!imagePaths.length) throw error
        result = await window.minimax.generateStructuredWithOllama(llm.url, llm.model, `${request}\n\nImage inspection was unavailable. Use only the authoritative reference map and do not claim visual observations. Return only the required structured fields.`, h3PromptDirectionSchema, llm.provider)
      }
      if (!result || typeof result !== 'object') throw new Error('The local model returned a response outside the MiniMax H3 prompt format. Try again or choose another model.')
      const payload = result as { summary?: unknown; direction?: unknown }
      if (typeof payload.direction !== 'string') throw new Error('The local model did not return a usable MiniMax H3 shot direction. Try again or choose another model.')
      const response = payload.direction
      const suggestionId = createId()
      setPromptSuggestion(response); setPromptSuggestionId(suggestionId)
      offerCopilotSuggestion({ id: suggestionId, title: tool === 'timeline' ? 'Review timeline rewrite' : tool === 'audio' ? 'Review sound and dialogue pass' : 'Review MiniMax-ready refinement', text: response, target: 'create-prompt', sourceLabel: `${llm.model} · ${llm.label}` })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setPromptingTool(null)
    }
  }

  const resetCreateWorkspace = () => {
    const defaults = settings?.generationDefaults
    setSceneState(createSceneState())
    setPromptSuggestion('')
    setPromptingTool(null)
    setDialogueGenerating(false)
    setDuration(defaults?.duration ?? workspaceDefaults.duration)
    setResolution(defaults?.resolution ?? workspaceDefaults.resolution)
    setTurbo(defaults?.turbo ?? workspaceDefaults.turbo)
    setTurbo8Profile(defaults?.turbo8Profile ?? workspaceDefaults.turbo8Profile)
    setTextEncoderPreference(defaults?.textEncoderPreference ?? workspaceDefaults.textEncoderPreference)
    setSteps(defaults?.steps ?? workspaceDefaults.steps)
    setSampler(defaults?.sampler ?? workspaceDefaults.sampler)
    setScheduler(defaults?.scheduler ?? workspaceDefaults.scheduler)
    setExperimentalSampling(defaults?.experimentalSampling ?? workspaceDefaults.experimentalSampling)
    setRefImageSize(defaults?.refImageSize ?? workspaceDefaults.refImageSize)
    setNoDialogue(true)
    setClothingPolicy('wardrobe')
    setSigmaShiftMode(defaults?.sigmaShiftMode ?? workspaceDefaults.sigmaShiftMode)
    setShiftVideo(defaults?.shiftVideo ?? workspaceDefaults.shiftVideo)
    setShiftAudio(defaults?.shiftAudio ?? workspaceDefaults.shiftAudio)
    setLoraStrength(defaults?.loraStrength ?? workspaceDefaults.loraStrength)
    setUserLoras(workspaceDefaults.userLoras.map((item) => ({ ...item })))
    setLiveEnabled(defaults?.livePreview ?? workspaceDefaults.liveEnabled)
    setLivePreviewMode('auto')
    setUpscaleMode(defaults?.upscaleMode ?? workspaceDefaults.upscaleMode)
    setH3ProReview(workspaceDefaults.h3ProReview)
    setH3ProRefineSteps(workspaceDefaults.h3ProRefineSteps)
    setH3RefineSteps(workspaceDefaults.h3RefineSteps)
    setH3RefineDenoise(workspaceDefaults.h3RefineDenoise)
    setRtxModel('')
    setSeed(randomH3Seed(seed))
    setSeedLocked(workspaceDefaults.seedLocked)
    setAdvanced(false)
    setFirstFrame(null)
    setLastFrame(null)
    setReferenceImages([])
    setReferenceVideos([])
    setReferenceAudios([])
    setActiveWorkspaceProjectId(null)
    setVideoClipDraft(null)
    setActiveJobId(null)
    setCharacterHandoff(null)
    setSelectedReferenceCharacterIds([])
    setSelectedReferenceLocationIds([])
    setCreateResetKey((value) => value + 1)
    setNotice({ tone: 'success', text: 'MiniMax Create reset. Saved libraries, rendered files, and queue history were not deleted.' })
  }

  const generateCharacterDialogue = async (draft: CharacterDialogueDraft) => {
    if (!settings) throw new Error('Studio settings are still loading.')
    const llm = resolveLlmConnection(settings)
    if (!llm.model || ollamaModels.length === 0) throw new Error(`No local ${llm.label} text model is available. Check the local AI provider in Settings.`)
    setDialogueGenerating(true)
    try {
      return await window.minimax.generateWithOllama(llm.url, llm.model, buildCharacterDialogueRequest({
        characterName: draft.character.name,
        characterDescription: draft.character.description,
        voiceNotes: draft.character.voiceNotes,
        shotPrompt: prompt,
        intent: draft.intent,
        requiredWords: draft.requiredWords,
        delivery: draft.delivery,
        length: draft.length,
        language: draft.language,
        duration,
      }), llm.provider)
    } finally {
      setDialogueGenerating(false)
    }
  }

  const captureWorkspaceProject = (scope: WorkspaceProjectScope): Record<string, unknown> => {
    if (scope === 'create') return {
      sceneState: compactSceneState(sceneState),
      mode, prompt, duration, resolution, turbo, steps, sampler, scheduler, experimentalSampling, refImageSize, noDialogue, naturalMovement, clothingPolicy, sigmaShiftMode, shiftVideo, shiftAudio, loraStrength, userLoras,
      seed, ref2vaSeed, seedLocked, advanced, liveEnabled, livePreviewMode, previewModeVersion: 1, upscaleMode, h3ProReview, h3ProRefineSteps, h3RefineSteps, h3RefineDenoise, textEncoderPreference, turbo8Profile, rtxModel, firstFrame: withoutPreview(firstFrame), lastFrame: withoutPreview(lastFrame),
      referenceImages: referenceImages.map((file) => withoutPreview(file)), referenceVideos: referenceVideos.map((file) => withoutPreview(file)), referenceAudios: referenceAudios.map((file) => withoutPreview(file)), selectedReferenceCharacterIds, selectedReferenceLocationIds,
    }
    const storageKey = workspaceStorageKey(scope)
    try { return JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Record<string, unknown> } catch { return {} }
  }

  const commitWorkspaceProjects = (next: WorkspaceProject[]): boolean => {
    if (!writeLocalJson(WORKSPACE_PROJECTS_KEY, next.slice(0, 80))) {
      setNotice({ tone: 'error', text: 'Project changes could not be saved. Local storage may be full or unavailable. Keep this window open and retry after freeing space.' })
      return false
    }
    setWorkspaceProjects(next.slice(0, 80))
    return true
  }

  const saveWorkspaceProject = (name: string, scope: WorkspaceProjectScope) => {
    const trimmed = name.trim().slice(0, 80)
    if (!trimmed) return false
    const now = Date.now()
    const existing = workspaceProjects.find((project) => project.name.toLowerCase() === trimmed.toLowerCase() && project.scope === scope)
    if (!existing && workspaceProjects.length >= 80) {
      setNotice({ tone: 'error', text: 'The 80-project limit has been reached. Rename or update an existing project, or remove a saved snapshot before creating another.' })
      return false
    }
    const project: WorkspaceProject = { id: existing?.id ?? createId(), name: trimmed, scope, snapshot: captureWorkspaceProject(scope), createdAt: existing?.createdAt ?? now, updatedAt: now }
    const next = [...workspaceProjects.filter((item) => item.id !== project.id), project].sort((a, b) => b.updatedAt - a.updatedAt)
    if (!commitWorkspaceProjects(next)) return false
    setActiveWorkspaceProjectId(project.id)
    setNotice({ tone: 'success', text: `${trimmed} saved with its full prompt, workspace controls, and reference assignments.` })
    return true
  }

  const loadWorkspaceProject = (project: WorkspaceProject) => {
    if (project.scope === 'create') {
      setActiveWorkspaceProjectId(project.id)
      const saved = { ...workspaceDefaults, ...project.snapshot } as PersistedWorkspace
      if (project.snapshot.previewModeVersion !== 1 && saved.livePreviewMode === 'standard') saved.livePreviewMode = 'auto'
      setSceneState(removeLegacyReferencePrompt(saved.sceneState?.version === 1 ? saved.sceneState : { ...importSceneDraft(saved.prompt, saved.duration, saved.mode), noDialogue: saved.noDialogue, naturalMovement: saved.naturalMovement })); setResolution(saved.resolution); setTurbo(saved.turbo); setSteps(saved.steps); setSampler(saved.sampler); setScheduler(saved.scheduler); setExperimentalSampling(saved.experimentalSampling); setRefImageSize(saved.refImageSize); setNoDialogue(saved.noDialogue); setNaturalMovement(saved.naturalMovement); setClothingPolicy(saved.clothingPolicy); setSigmaShiftMode(saved.sigmaShiftMode); setShiftVideo(saved.shiftVideo); setShiftAudio(saved.shiftAudio); setLoraStrength(saved.loraStrength); setUserLoras(Array.isArray(saved.userLoras) ? saved.userLoras : workspaceDefaults.userLoras); setSeed(saved.seed); setRef2vaSeed(saved.ref2vaSeed ?? saved.seed); setSeedLocked(saved.seedLocked); setAdvanced(saved.advanced); setLiveEnabled(saved.liveEnabled); setLivePreviewMode(saved.livePreviewMode); setUpscaleMode(saved.upscaleMode); setH3ProReview(saved.h3ProReview); setH3ProRefineSteps(Math.max(1, Math.min(30, Math.round(Number(saved.h3ProRefineSteps) || workspaceDefaults.h3ProRefineSteps)))); setH3RefineSteps(Math.max(1, Math.min(30, Math.round(Number(saved.h3RefineSteps) || workspaceDefaults.h3RefineSteps)))); setH3RefineDenoise(Number.isFinite(Number(saved.h3RefineDenoise)) ? Math.max(0.01, Math.min(1, Number(saved.h3RefineDenoise))) : workspaceDefaults.h3RefineDenoise); setTextEncoderPreference(saved.textEncoderPreference); setTurbo8Profile(saved.turbo8Profile); setRtxModel(saved.rtxModel); setFirstFrame(saved.firstFrame); setLastFrame(saved.lastFrame); setReferenceImages(saved.referenceImages); setReferenceVideos(saved.referenceVideos); setReferenceAudios(saved.referenceAudios); setSelectedReferenceCharacterIds(saved.selectedReferenceCharacterIds); setSelectedReferenceLocationIds(saved.selectedReferenceLocationIds); setActiveJobId(null); setView('create'); setCreateResetKey((value) => value + 1)
    } else {
      const storageKey = workspaceStorageKey(project.scope)
      if (!writeLocalJson(storageKey, project.snapshot)) {
        setNotice({ tone: 'error', text: 'Could not open the saved project because local storage is unavailable or full. Your current workspace has not been replaced. Free space and retry.' })
        return
      }
      if (project.scope === 'ltx25') { setLtxResetAt(Date.now()); setLtxResetKey((value) => value + 1) }
      if (project.scope === 'anime') setAnimeResetKey((value) => value + 1)
      if (project.scope === 'zimage') setZImageResetKey((value) => value + 1)
      if (project.scope === 'music') { setAceResetKey((value) => value + 1); setMusicEngine('acestep') }
      if (project.scope === 'music3') { setMusic3ResetKey((value) => value + 1); setMusicEngine('music3') }
      setView(project.scope === 'music3' ? 'music' : project.scope)
    }
    setActiveWorkspaceProjectId(project.id)
    setProjectManagerOpen(false)
    setNotice({ tone: 'success', text: `${project.name} loaded into ${workspaceProjectLabel(project.scope)}.` })
  }

  const deleteWorkspaceProject = (project: WorkspaceProject) => {
    const next = workspaceProjects.filter((item) => item.id !== project.id)
    if (!commitWorkspaceProjects(next)) return false
    if (activeWorkspaceProjectId === project.id) setActiveWorkspaceProjectId(null)
  }

  const renameWorkspaceProject = (project: WorkspaceProject) => {
    const name = window.prompt('Project name', project.name)?.trim().slice(0, 80)
    if (!name) return
    const next = workspaceProjects.map((item) => item.id === project.id ? { ...item, name, updatedAt: Date.now() } : item)
    if (!commitWorkspaceProjects(next)) return false
  }

  const resetCurrentWorkspace = () => {
    if (view === 'create') {
      resetCreateWorkspace()
      return
    }
    if (view === 'ltx25') {
      localStorage.removeItem('ltx25.workspace')
      setLtxResetAt(Date.now())
      setLtxResetKey((value) => value + 1)
      setNotice({ tone: 'success', text: 'LTX 2.5 reset. Its prompt, first frame, options, and current preview were cleared.' })
      return
    }
    if (view === 'zimage') {
      localStorage.removeItem('minimax.zimage-workspace')
      setZImageResetKey((value) => value + 1)
      setNotice({ tone: 'success', text: 'Create Image reset. Its prompt, options, selection, and current preview were cleared.' })
      return
    }
    if (view === 'anime') {
      localStorage.removeItem('anime.workspace')
      setAnimeResetKey((value) => value + 1)
      setNotice({ tone: 'success', text: 'Anime & Checkpoint reset. Its prompt, options, selection, and current preview were cleared.' })
    }
  }

  const factoryResetWorkspace = async () => {
    try {
      if (pendingJobs.length || submitting || stillSubmitting || ltxSubmitting || aceSubmitting) throw new Error('Finish or cancel active generations before resetting.')
      await window.minimax.factoryResetSettings('Reset')
    } catch (error) {
      setNotice({ tone: 'error', text: `Factory reset could not complete: ${error instanceof Error ? error.message : String(error)}` })
    }
  }

  const cancelJob = async (job: GenerationJob) => {
    if (!settings) return
    if (!['queued', 'running'].includes(job.status) || cancellingIds.has(job.id)) return
    cancellationRequests.current.add(job.id)
    setCancellingIds((current) => new Set(current).add(job.id))
    if (!job.promptId) {
      setJobs((current) => current.map((item) => item.id === job.id ? { ...item, status: 'cancelled', error: undefined } : item))
      setNotice({ tone: 'neutral', text: 'Cancelling input preparation…' })
      setCancellingIds((current) => { const next = new Set(current); next.delete(job.id); return next })
      return
    }
    try {
      const result = await window.minimax.cancelPrompt(settings.comfyUrl, job.promptId)
      if (result.cancelled) {
        setJobs((current) => current.map((item) => item.id === job.id ? { ...item, status: 'cancelled', error: undefined } : item))
        setNotice({ tone: 'success', text: result.state === 'pending' ? 'Queued generation removed.' : 'Running generation stopped.' })
      } else {
        setNotice({ tone: 'neutral', text: result.state === 'finished' ? 'That generation already finished.' : 'That generation is no longer in the ComfyUI queue.' })
      }
    } catch (error) {
      cancellationRequests.current.delete(job.id)
      setNotice({ tone: 'error', text: `Could not stop generation: ${error instanceof Error ? error.message : String(error)}` })
    } finally {
      setCancellingIds((current) => { const next = new Set(current); next.delete(job.id); return next })
    }
  }

  const loadReferenceAccessory = async (accessoryId: string) => {
    const accessory = loadAccessoryProjects().find((item) => item.id === accessoryId)
    if (!accessory?.referenceImage) {
      setNotice({ tone: 'error', text: 'This prop or accessory needs an approved reference image first.' })
      return
    }
    const selected = referenceImages.some((file) => file.path === accessory.referenceImage!.path)
    if (!selected && referenceImages.length >= 9) {
      setNotice({ tone: 'error', text: 'All 9 picture slots are in use. Remove a reference before adding this prop.' })
      return
    }
    const source = accessory.referenceImage
    let preview = source.preview
    if (!preview) { try { preview = await window.minimax.fileDataUrl(source.path) } catch { /* The renderer will report an unavailable file at submission. */ } }
    setReferenceImages((current) => selected
      ? current.filter((file) => file.path !== source.path)
      : [...current, { ...source, preview, referenceRole: 'prop' as const, referenceRetention: 'preserve' as const, crop: source.crop ?? { x: .5, y: .5, zoom: 1, fit: 'contain' as const, background: 'neutral' as const } }].slice(0, 9))
    setMode('reference')
    setNotice({ tone: 'success', text: selected ? `${accessory.name} removed from this render.` : `${accessory.name} added as a must-preserve prop reference.` })
  }

  const chooseLtxImage = async (): Promise<MediaFile | null> => {
    const picked = await window.minimax.chooseMedia('image')
    if (!picked) return null
    return { ...picked, kind: 'image', preview: await window.minimax.fileDataUrl(picked.path) }
  }

  const loadStartFrameInLtx = (file: MediaFile, identityPrompt?: string, msrReferences: MediaFile[] = []) => {
    let workspace: Record<string, unknown> = {}
    try { workspace = JSON.parse(localStorage.getItem('ltx25.workspace') ?? '{}') as Record<string, unknown> } catch { /* Replace malformed legacy workspace data. */ }
    const storedFrame = { ...file }
    delete storedFrame.preview
    localStorage.setItem('ltx25.workspace', JSON.stringify({ ...workspace, mode: 'image', firstFrame: storedFrame, ...(identityPrompt ? { identityPrompt } : {}), ...(msrReferences.length ? { referenceMode: 'msr', msrReferences: msrReferences.slice(0, 5).map((reference) => { const stored = { ...reference }; delete stored.preview; return stored }) } : {}) }))
    setLtxResetAt(Date.now())
    setLtxResetKey((value) => value + 1)
    setView('ltx25')
    setNotice({ tone: 'success', text: `${file.name} loaded as the LTX 2.5 image-to-video starting frame${identityPrompt ? ' with an Identity Prompt chip' : ''}.` })
  }

  const receiveMovieFrame = (file: MediaFile, target: MovieFrameTarget) => {
    if (target === 'save') { setNotice({ tone: 'success', text: `${file.name} saved to the output folder.` }); return }
    if (target === 'ltx') { loadStartFrameInLtx(file); return }
    if (target === 'h3-reference-first' || target === 'h3-reference') {
      const bindings = resolveRenderReferenceBindings(referenceImages, workspaceBindingsFor(selectedReferenceCharacterIds, selectedReferenceLocationIds), clothingPolicy)
      if (bindings.length >= 9) throw new Error('All 9 H3 picture slots are in use. Remove a reference, then send this frame again.')
      const pictureNumber = bindings.length + 1
      const frame: MediaFile = { ...file, referenceRole: 'composition', referenceRetention: target === 'h3-reference-first' ? 'preserve' : 'guide', ...(target === 'h3-reference-first' ? { openingFrameTreatment: 'match' as const } : {}), crop: { x: .5, y: .5, zoom: 1, fit: 'crop', background: 'auto' } }
      setReferenceImages([...bindings.map((binding) => binding.file), frame])
      if (target === 'h3-reference-first') setSceneState(current => ({ ...current, continuity: { ...current.continuity, exactFrame: true } }))
      setMode('reference')
      setNotice({ tone: 'success', text: `${file.name} added as H3 Picture ${pictureNumber}${target === 'h3-reference-first' ? ' with a matching first-frame instruction' : ''}.` })
    } else {
      if (target === 'h3-last') setLastFrame(file)
      else setFirstFrame(file)
      setMode(target === 'h3-i2v' ? 'image' : 'frames')
      setNotice({ tone: 'success', text: `${file.name} loaded as the H3 ${target === 'h3-last' ? 'closing' : 'opening'} frame. Review the prompt and render settings before generating.` })
    }
    setCharacterHandoff(null)
    setActiveJobId(null)
    setView('create')
  }
  const movieReceiverRef = useRef(receiveMovieFrame)
  movieReceiverRef.current = receiveMovieFrame
  useEffect(() => {
    if (!settings) return
    const receive = () => {
      const request = parseMovieHandoff(localStorage.getItem(MOVIE_HANDOFF_KEY))
      if (!request) return
      localStorage.removeItem(MOVIE_HANDOFF_KEY)
      try { movieReceiverRef.current(request.file, request.target) }
      catch (error) { setNotice({ tone: 'error', text: `Frame from ${request.sourceName} could not be loaded: ${error instanceof Error ? error.message : String(error)}. It remains saved in the output folder.` }) }
    }
    const onStorage = (event: StorageEvent) => { if (event.key === MOVIE_HANDOFF_KEY) receive() }
    receive()
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [settings])

  const sendGeneratedStillToLtx = async (file: MediaFile) => {
    let handoffPrompt = buildLtxImageHandoffPrompt()
    const msrReferences = settings?.experimentalLtxMsrEnabled
      ? [...selectedReferenceCharacterIds.flatMap((id) => { const character = characterProjects.find((item) => item.id === id); return character ? characterReferences(character, settings.characterDetailReferencesEnabled) : [] }), ...selectedReferenceLocationIds.flatMap((id) => { const location = locationProjects.find((item) => item.id === id); return location ? locationReferences(location) : [] })].filter((reference, index, all) => all.findIndex((item) => item.path === reference.path) === index).slice(0, 5)
      : []
    const llm = settings ? resolveLlmConnection(settings) : null
    if (llm?.model.trim() && ollamaModels.length) {
      setNotice({ tone: 'neutral', text: 'Inspecting the generated still locally to ground the LTX identity prompt…' })
      try {
        const description = await window.minimax.generateWithOllamaVision(llm.url, llm.model, 'Inspect this generated still and return one concise visible-reference grounding paragraph for an image-to-video prompt. Describe only stable visible details: number of people or subjects, non-sensitive facial geometry and expression, hairstyle, clothing and accessories, body pose, environment, objects, composition, lighting, and color treatment. Do not identify people, infer ethnicity, age, health, personality, or hidden details. Do not describe motion, sound, camera instructions, quality advice, or any text that is not visibly present. Return plain text only, under 110 words.', [file.path], llm.provider)
        handoffPrompt = appendLtxVisionGrounding(handoffPrompt, description)
        loadStartFrameInLtx(file, handoffPrompt, msrReferences)
        setNotice({ tone: 'success', text: `${file.name} loaded into LTX 2.5 with identity protection and local visual grounding.` })
        return
      } catch {
        // Vision support is model-dependent. The handoff remains fully usable
        // with the deterministic image-authority prompt when inspection fails.
      }
    }
    loadStartFrameInLtx(file, handoffPrompt, msrReferences)
  }

  const generateCharacterIdentitySurvey = async (project: CharacterProject, options: CharacterSurveyRenderOptions): Promise<string | null> => {
    if (!settings) return 'Studio settings are still loading.'
    if (!status.connected) {
      const message = 'Start ComfyUI and verify the server connection in Settings.'
      setNotice({ tone: 'error', text: message })
      return message
    }
    if (!project.baseImage) return 'Approve a character identity image before rendering the survey.'

    const references = [project.baseImage, ...characterIdentityReferences(project)]
      .filter((file, index, all) => all.findIndex((item) => item.path === file.path) === index)
      .slice(0, 9)
    if (!references.length) return 'Approve at least one character identity reference before rendering the Ref2VA survey.'

    const surveyModels = inferSelections(models, options.turbo, textEncoderPreference, settings.h3DiffusionPrecision)
    if (!surveyModels.ref2va || !surveyModels.textEncoder || !surveyModels.videoVae || !surveyModels.audioVae || (options.turbo !== 'off' && !surveyModels.ref2vLora)) {
      const message = `The MiniMax H3 Ref2VA model, ${options.turbo === 'off' ? '' : 'Turbo 8-step Ref2V LoRA, '}Qwen3-VL encoder, video VAE, or audio VAE is missing. Install the required H3 components and rescan models.`
      setNotice({ tone: 'error', text: message })
      return message
    }
    const surveyGpuRouting = routingPlanFor({ diffusion: surveyModels.ref2va, textEncoder: surveyModels.textEncoder, videoVae: surveyModels.videoVae, audioVae: surveyModels.audioVae })
    if (surveyGpuRouting?.vramWarnings.length && !settings.gpuRouting.allowOvercommit) {
      const message = `${surveyGpuRouting.vramWarnings.join(' ')} Review GPU Routing or explicitly allow the VRAM warning.`
      setNotice({ tone: 'error', text: message })
      return message
    }

    const { width, height, steps, turbo } = options
    const duration = 10
    const sampler = 'res_multistep'
    const scheduler = 'simple'
    const prompt = buildCharacterIdentitySurveyPrompt(project.name, references.length)
    const localId = createId()
    const attentionBackend = settings.attentionBackend === 'sol' ? undefined : resolvedH3AttentionBackend
    const job: GenerationJob = {
      id: localId,
      provider: 'minimax',
      mediaType: 'video',
      mode: 'reference',
      prompt,
      createdAt: Date.now(),
      status: 'queued',
      progress: 2,
      progressLabel: 'Preparing Ref2VA identity references',
      seed: Math.floor(Math.random() * 1_000_000_000),
      referenceAssets: references.map((file) => file.path),
      modelName: surveyModels.ref2va,
      sampler,
      scheduler,
      refImageSize: 'max',
      width,
      height,
      renderWidth: width,
      renderHeight: height,
      duration,
      turbo,
      steps,
      noDialogue: true,
      naturalMovement: false,
      execution: {
        diffusionModel: surveyModels.ref2va,
        diffusionPrecision: modelPrecisionLabel(surveyModels.ref2va),
        textEncoder: surveyModels.textEncoder,
        attentionBackend: settings.attentionBackend === 'sol' && solAttentionNode ? `NVIDIA Sol-Attn${settings.solCacheEnabled && solCacheNode ? ' + H3 cache' : ''} · tau ${settings.solAttnTau}` : attentionBackendLabel(resolvedH3AttentionBackend),
        sampler,
        scheduler,
        preview: 'Standard first frame',
        referenceCount: references.length,
        adapters: turbo === 'off' ? [] : [`Turbo 8 · ${steps} steps`],
        gpuRouting: surveyGpuRouting?.summary,
      },
      characterProjectId: project.id,
    }
    setJobs((current) => [job, ...current])
    selectActiveJob(localId)
    const surveyQualityLabel = turbo === 'off' ? `Native · ${steps} steps` : `Turbo · ${steps} steps`
    setNotice({ tone: 'neutral', text: `Preparing the MiniMax H3 Ref2VA ${surveyQualityLabel} identity survey…` })

    try {
      const validation = await window.minimax.validateMediaFiles(references)
      const invalid = validation.filter((file) => !file.valid)
      if (invalid.length) {
        const labels = invalid.slice(0, 3).map((file) => file.path.split(/[\\/]/).at(-1) || 'reference').join(', ')
        throw new Error(`Cannot start this survey: ${labels}${invalid.length > 3 ? ` and ${invalid.length - 3} more` : ''} ${invalid.length === 1 ? 'is' : 'are'} unavailable or unsupported.`)
      }
      const images = await Promise.all(references.map(async (file) => {
        const prepared = file.referenceType === 'face' ? file : fitWholeCharacter(file)
        return window.minimax.uploadImageData(settings.comfyUrl, await prepareImage(prepared, width, height))
      }))
      if (cancellationRequests.current.has(localId)) throw new Error('Generation cancelled before submission.')
      const graph = buildMiniMaxWorkflow({
        mode: 'reference', prompt, width, height, duration, seed: job.seed ?? 0, steps, turbo,
        sampler, scheduler, refImageSize: 'max', loraStrength: 1,
        attentionBackend,
        solAttention: settings.attentionBackend === 'sol' && solAttentionNode ? { nodeType: solAttentionNode, tau: settings.solAttnTau } : undefined,
        solCache: settings.attentionBackend === 'sol' && settings.solCacheEnabled && solCacheNode ? { nodeType: solCacheNode, threshold: 0.1, maxSteps: 5 } : undefined,
        gpuRouting: surveyGpuRouting?.workflow,
        filenamePrefix: `video/MiniMax_H3_Character_Identity_Survey_${Date.now()}`,
        referenceImages: references.map((file) => file.path), referenceVideos: [], referenceAudios: [],
      }, surveyModels, { images, videos: [], audios: [] })
      if (surveyGpuRouting) console.info(`[GPU Routing] MiniMax H3 character survey | ${surveyGpuRouting.logLine} | Strategy: ${surveyGpuRouting.workflow.strategy}`)
      const response = await window.minimax.submitPrompt(settings.comfyUrl, graph, live.clientId)
      if (cancellationRequests.current.has(localId)) {
        await window.minimax.cancelPrompt(settings.comfyUrl, response.prompt_id)
        setJobs((current) => current.map((item) => item.id === localId ? { ...item, promptId: response.prompt_id, status: 'cancelled', error: undefined } : item))
        return 'The Ref2VA identity survey was cancelled before it started.'
      }
      setJobs((current) => current.map((item) => item.id === localId ? { ...item, promptId: response.prompt_id, status: 'running', progress: 4, progressLabel: `Rendering MiniMax H3 Ref2VA · ${surveyQualityLabel}` } : item))
      setNotice({ tone: 'success', text: `MiniMax H3 Ref2VA ${surveyQualityLabel} identity survey added to the local ComfyUI queue.` })
      return null
    } catch (error) {
      const cancelled = cancellationRequests.current.has(localId)
      const message = cancelled ? 'Ref2VA identity survey cancelled.' : error instanceof Error ? error.message : String(error)
      setJobs((current) => current.map((item) => item.id === localId ? { ...item, status: cancelled ? 'cancelled' : 'failed', error: cancelled ? undefined : message } : item))
      setNotice(cancelled ? { tone: 'success', text: message } : { tone: 'error', text: message })
      return message
    } finally {
      cancellationRequests.current.delete(localId)
    }
  }

  const generateLtx = async (options: Ltx25GenerationOptions, input: MediaFile | null, handoff?: { characterProjectId?: string; locationProjectId?: string }) => {
    if (!settings) return 'Studio settings are still loading.'
    if (!status.connected) {
      const message = 'Start ComfyUI and verify the server connection in Settings.'
      setNotice({ tone: 'error', text: message })
      return message
    }
    if (!options.prompt) {
      const message = 'Add an LTX prompt before generating.'
      setNotice({ tone: 'error', text: message })
      return message
    }
    if (!Number.isInteger(options.width) || !Number.isInteger(options.height) || options.width < 64 || options.height < 64 || options.width % 32 !== 0 || options.height % 32 !== 0) {
      const message = 'Choose a valid LTX output size (whole numbers aligned to 32 pixels) before generating.'
      setNotice({ tone: 'error', text: message })
      return message
    }
    if (options.mode === 'image' && !input) {
      const message = 'Choose a first frame for LTX image-to-video.'
      setNotice({ tone: 'error', text: message })
      return message
    }
    if (!ltxSelection.diffusion || !ltxSelection.textEncoder || !ltxSelection.videoVae || !ltxSelection.audioVae || !ltxSelection.latentUpscaler) {
      const message = 'The LTX‑2.5 distilled transformer, Gemma encoder, video/audio VAEs, or latent spatial upscaler is missing.'
      setNotice({ tone: 'error', text: message })
      return message
    }
    const ltxGpuRouting = routingPlanFor({ diffusion: ltxSelection.diffusion, textEncoder: ltxSelection.textEncoder, videoVae: ltxSelection.videoVae, audioVae: ltxSelection.audioVae })
    if (ltxGpuRouting?.vramWarnings.length && !settings.gpuRouting.allowOvercommit) {
      const message = `${ltxGpuRouting.vramWarnings.join(' ')} Review GPU Routing or explicitly allow the VRAM warning.`
      setNotice({ tone: 'error', text: message })
      return message
    }
    const missingNodes = LTX_NATIVE_REQUIRED_NODES.filter((node) => !info[node])
    if (missingNodes.length) {
      const message = `Update ComfyUI before using LTX‑2.5. Missing core nodes: ${missingNodes.join(', ')}.`
      setNotice({ tone: 'error', text: message })
      return message
    }
    if (options.previewOverride && !ltxSamplingPreviewOverrideNode) {
      const message = 'LTX sampling preview is selected, but LTX2SamplingPreviewOverride was not detected. Install or enable ComfyUI-KJNodes, restart ComfyUI, then refresh the Local engine.'
      setNotice({ tone: 'error', text: message })
      return message
    }

    const localId = createId()
    const ltxAttentionBackend = resolveAttentionBackend(settings.attentionBackend, h3AttentionBackends)
    const job: GenerationJob = { id: localId, provider: 'ltx25', mode: options.mode, prompt: options.prompt, createdAt: Date.now(), status: 'queued', progress: 2, progressLabel: input ? 'Preparing first frame' : 'Preparing workflow', width: options.width, height: options.height, duration: options.duration, execution: { diffusionModel: ltxSelection.diffusion, diffusionPrecision: modelPrecisionLabel(ltxSelection.diffusion), textEncoder: ltxSelection.textEncoder, attentionBackend: attentionBackendLabel(ltxAttentionBackend), sampler: 'Euler ancestral', scheduler: options.preset === 'quality' ? 'Official 8 + 3 sigmas' : 'Official distilled 8 sigmas', preview: options.previewOverride ? `LTX sampling · ${options.previewOverride.fps} fps` : 'Standard decoded frame', adapters: options.msr ? ['Licon MSR'] : [] }, characterProjectId: handoff?.characterProjectId ?? characterHandoff ?? undefined, locationProjectId: handoff?.locationProjectId }
    setJobs((current) => [job, ...current])
    selectActiveJob(localId)
    setLtxSubmitting(true)
    setNotice({ tone: 'neutral', text: 'Preparing the official LTX‑2.5 ComfyUI graph…' })
    try {
      const uploaded = input ? await window.minimax.uploadImageData(settings.comfyUrl, await prepareImage(input, options.width, options.height)) : undefined
      const uploadedMsrReferences = options.msr ? await Promise.all(options.msr.references.slice(0, 5).map((path) => window.minimax.uploadInput(settings.comfyUrl, path))) : []
      if (cancellationRequests.current.has(localId)) throw new Error('Generation cancelled before submission.')
      const graph = buildLtx25Workflow({ ...options, attentionBackend: ltxAttentionBackend, gpuRouting: ltxGpuRouting?.workflow }, ltxSelection, uploaded, uploadedMsrReferences)
      if (ltxGpuRouting) console.info(`[GPU Routing] LTX 2.5 | ${ltxGpuRouting.logLine} | Strategy: ${ltxGpuRouting.workflow.strategy}`)
      const response = await window.minimax.submitPrompt(settings.comfyUrl, graph, live.clientId)
      if (cancellationRequests.current.has(localId)) {
        await window.minimax.cancelPrompt(settings.comfyUrl, response.prompt_id)
        setJobs((current) => current.map((item) => item.id === localId ? { ...item, promptId: response.prompt_id, status: 'cancelled' } : item))
        return 'The LTX 2.5 survey was cancelled before it started.'
      } else {
        setJobs((current) => current.map((item) => item.id === localId ? { ...item, promptId: response.prompt_id, status: 'running', progress: 4, progressLabel: 'Waiting for ComfyUI to start' } : item))
        setNotice({ tone: 'success', text: `${options.preset === 'quality' ? 'Two-stage quality' : 'Single-stage Turbo'} LTX‑2.5 generation added to ComfyUI.` })
        if (!handoff) setCharacterHandoff(null)
        return null
      }
    } catch (error) {
      const cancelled = cancellationRequests.current.has(localId)
      const message = cancelled ? 'LTX generation cancelled.' : error instanceof Error ? error.message : String(error)
      setJobs((current) => current.map((item) => item.id === localId ? { ...item, status: cancelled ? 'cancelled' : 'failed', error: cancelled ? undefined : error instanceof Error ? error.message : String(error) } : item))
      setNotice(cancelled ? { tone: 'success', text: message } : { tone: 'error', text: message })
      return message
    } finally {
      cancellationRequests.current.delete(localId)
      setLtxSubmitting(false)
    }
  }

  const generateAceStep = async (options: AceStepGenerationOptions) => {
    if (!settings) return
    if (!status.connected) {
      setNotice({ tone: 'error', text: 'Start ComfyUI and verify the server connection in Settings.' })
      return
    }
    const selectedModel = options.model === 'sft' ? aceSelection.sft : aceSelection.base
    if (!selectedModel || !aceSelection.vae || !aceSelection.textEncoderSmall || !aceSelection.textEncoderLarge) {
      setNotice({ tone: 'error', text: `The ACE-Step ${options.model.toUpperCase()} model, audio VAE, and both Qwen ACE text encoders are required.` })
      return
    }
    const aceGpuRouting = routingPlanFor({ diffusion: selectedModel, textEncoder: aceSelection.textEncoderLarge, audioVae: aceSelection.vae })
    if (aceGpuRouting?.vramWarnings.length && !settings.gpuRouting.allowOvercommit) {
      setNotice({ tone: 'error', text: `${aceGpuRouting.vramWarnings.join(' ')} Review GPU Routing or explicitly allow the VRAM warning.` })
      return
    }
    const missingNodes = ACE_STEP_REQUIRED_NODES.filter((node) => !info[node])
    if (missingNodes.length) {
      setNotice({ tone: 'error', text: `Update ComfyUI before using ACE-Step 1.5. Missing core nodes: ${missingNodes.join(', ')}.` })
      return
    }
    const localId = createId()
    const job: GenerationJob = {
      id: localId, provider: 'acestep', mediaType: 'audio', mode: 'text', prompt: options.tags,
      createdAt: Date.now(), status: 'queued', progress: 2, progressLabel: 'Preparing ACE-Step workflow',
      width: 0, height: 0, duration: options.duration,
      execution: { diffusionModel: options.model === 'sft' ? aceSelection.sft : aceSelection.base, attentionBackend: attentionBackendLabel(resolvedH3AttentionBackend), sampler: 'Euler + simple', gpuRouting: aceGpuRouting?.summary },
    }
    setJobs((current) => [job, ...current])
    setAceSubmitting(true)
    setNotice({ tone: 'neutral', text: `Preparing the official ACE-Step XL ${options.model.toUpperCase()} ComfyUI graph…` })
    try {
      const graph = buildAceStepWorkflow({ ...options, attentionBackend: resolvedH3AttentionBackend, gpuRouting: aceGpuRouting?.workflow }, aceSelection)
      if (aceGpuRouting) console.info(`[GPU Routing] ACE-Step | ${aceGpuRouting.logLine} | Strategy: ${aceGpuRouting.workflow.strategy}`)
      const response = await window.minimax.submitPrompt(settings.comfyUrl, graph, live.clientId)
      if (cancellationRequests.current.has(localId)) {
        await window.minimax.cancelPrompt(settings.comfyUrl, response.prompt_id)
        setJobs((current) => current.map((item) => item.id === localId ? { ...item, promptId: response.prompt_id, status: 'cancelled' } : item))
      } else {
        setJobs((current) => current.map((item) => item.id === localId ? { ...item, promptId: response.prompt_id, status: 'running', progress: 4, progressLabel: 'Waiting for ComfyUI to start' } : item))
        setNotice({ tone: 'success', text: `ACE-Step XL ${options.model.toUpperCase()} music generation added to ComfyUI.` })
      }
    } catch (error) {
      const cancelled = cancellationRequests.current.has(localId)
      setJobs((current) => current.map((item) => item.id === localId ? { ...item, status: cancelled ? 'cancelled' : 'failed', error: cancelled ? undefined : error instanceof Error ? error.message : String(error) } : item))
      setNotice(cancelled ? { tone: 'success', text: 'Music generation cancelled.' } : { tone: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      cancellationRequests.current.delete(localId)
      setAceSubmitting(false)
    }
  }

  const generateMusic3 = async (options: Music3GenerationOptions) => {
    if (!settings) return
    if (!status.connected) { setNotice({ tone: 'error', text: 'Start ComfyUI and verify the server connection in Settings.' }); return }
    if (!music3Selection.diffusion || !music3Selection.textEncoder || !music3Selection.vae) { setNotice({ tone: 'error', text: 'Music 3 needs its diffusion model, text encoder, and audio VAE. Install them and rescan models.' }); return }
    const missing = MUSIC3_REQUIRED_NODES.filter((node) => !info[node])
    if (missing.length) { setNotice({ tone: 'error', text: `Update ComfyUI before using Music 3. Missing core nodes: ${missing.join(', ')}.` }); return }
    const localId = createId()
    const job: GenerationJob = { id: localId, provider: 'music3', mediaType: 'audio', mode: 'text', prompt: options.caption, createdAt: Date.now(), status: 'queued', progress: 2, progressLabel: 'Preparing MiniMax Music 3 workflow', width: 0, height: 0, duration: options.duration, execution: { diffusionModel: music3Selection.diffusion, sampler: 'Euler + simple' } }
    setJobs((current) => [job, ...current]); setMusic3Submitting(true); setNotice({ tone: 'neutral', text: 'Preparing the official MiniMax Music 3 ComfyUI graph…' })
    try {
      const response = await window.minimax.submitPrompt(settings.comfyUrl, buildMusic3Workflow(options, music3Selection), live.clientId)
      if (cancellationRequests.current.has(localId)) {
        await window.minimax.cancelPrompt(settings.comfyUrl, response.prompt_id)
        setJobs((current) => current.map((item) => item.id === localId ? { ...item, promptId: response.prompt_id, status: 'cancelled' } : item))
      } else {
        setJobs((current) => current.map((item) => item.id === localId ? { ...item, promptId: response.prompt_id, status: 'running', progress: 4, progressLabel: 'Waiting for ComfyUI to start' } : item))
        setNotice({ tone: 'success', text: 'MiniMax Music 3 song generation added to ComfyUI.' })
      }
    } catch (error) {
      const cancelled = cancellationRequests.current.has(localId)
      setJobs((current) => current.map((item) => item.id === localId ? { ...item, status: cancelled ? 'cancelled' : 'failed', error: cancelled ? undefined : error instanceof Error ? error.message : String(error) } : item))
      setNotice(cancelled ? { tone: 'success', text: 'Music generation cancelled.' } : { tone: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally { cancellationRequests.current.delete(localId); setMusic3Submitting(false) }
  }

  const generate = async (target: 'video' | 'image' = 'video', renderAnyway = false, control?: { forceH3Pro?: boolean; parentJobId?: string; continuation?: ContinuationGenerationControl }) => {
    const stop = (message: string): undefined => {
      setNotice({ tone: 'error', text: message })
      if (control?.continuation) throw new Error(message)
      return undefined
    }
    if (!settings) return stop('Open Settings and configure the output folder first.')
    if (target === 'image' && mode !== 'reference') {
      return stop('Generate Image is available for the Ref2VA Reference workspace.')
    }
    if (target === 'video' && upscaleMode === 'ltx' && (!upscaleModel || !upscaleVae)) {
      return stop('LTX 2.5 spatial upscaler and video VAE must be available in ComfyUI.')
    }
    if (target === 'video' && upscaleMode === 'ltx' && missingLtxUpscaleNodes.length) {
      return stop(`Update ComfyUI before using LTX 2× upscale. Missing nodes: ${missingLtxUpscaleNodes.join(', ')}.`)
    }
    if (target === 'video' && upscaleMode === 'h3' && !h3LearnedUpscaleReady) {
      const missing = [...missingH3LearnedUpscaleNodes, ...(!h3LearnedUpscaleModel ? ['an H3 3D learned-upscale checkpoint'] : [])]
      return stop(`H3 Latent Upscale Pro is not ready. Install the missing requirement${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`)
    }
    if (target === 'video' && upscaleMode === 'rtx' && !rtxModel) {
      return stop('Choose an AI upscale model installed in ComfyUI first.')
    }
    if (target === 'video' && upscaleMode === 'rtx' && !window.confirm('RTX/CUDA upscale processes every frame independently and can amplify MiniMax noise or temporal shimmer. Continue with this experimental post-process?')) return stop('RTX upscale was cancelled.')
    if (!status.connected) {
      return stop('Start ComfyUI and verify the server connection in Settings.')
    }
    if (turbo === 'fast' && mode !== 'text') {
      return stop('FastVideo FastH3 is text-to-audio-video only. Choose Text mode, or use the base H3 model for image and reference workflows.')
    }
    if (!modelReady) {
      return stop('One or more required MiniMax H3 model components are missing. Open Settings, rescan models, and review the MiniMax H3 requirements.')
    }
    if (h3GpuRouting?.vramWarnings.length && !settings.gpuRouting.allowOvercommit) {
      return stop(`${h3GpuRouting.vramWarnings.join(' ')} Review GPU Routing in Settings, choose Sequential Offload or CPU Fallback, or explicitly allow the VRAM warning.`)
    }
    if (target === 'video' && liveEnabled && livePreviewMode === 'h3-override' && !h3PreviewOverrideNode) {
      return stop('MiniMax H3 animated preview is selected, but its Preview Override node was not detected. Install or enable the custom node, restart ComfyUI, then click the Local engine status to refresh.')
    }
    if (target === 'video' && liveEnabled && livePreviewMode === 'h3-override' && !selection.previewVae) {
      return stop('MiniMax H3 animated preview requires taeh3_decoder.safetensors in ComfyUI/models/vae_approx. Refresh the Local engine after adding it.')
    }
    if (mode === 'image' && !firstFrame) {
      return stop('Choose a first frame for this mode.')
    }
    if (mode === 'frames' && !lastFrame) {
      return stop('Choose a last frame for first-and-last-frame generation.')
    }
    if (mode === 'reference' && referenceImages.length + referenceVideos.length + referenceAudios.length === 0 && !selectedReferenceCharacterIds.length && !selectedReferenceLocationIds.length) {
      return stop('Add at least one reference image, video, or audio file.')
    }
    if (mode === 'reference' && (referenceImages.length > 9 || referenceVideos.length > 3 || referenceAudios.length > 3)) {
      return stop('Reference limits are 9 pictures, 3 videos, and 3 audio files. Remove extras before rendering.')
    }
    const workspaceBindings = workspaceBindingsFor(selectedReferenceCharacterIds, selectedReferenceLocationIds)
    const renderBindings = resolveRenderReferenceBindings(referenceImages, workspaceBindings, clothingPolicy)
    const renderReferenceImages = renderBindings.map((binding) => binding.file)
    const boundScene = bindSceneReferences(sceneState, renderBindings, referenceVideos, referenceAudios, firstFrame, lastFrame)
    const sceneCompilation = compileScene(boundScene)
    const promptAudit = { errors: sceneCompilation.conflicts.filter(item => item.severity === 'error').map(item => item.message) }
    if (mode === 'reference' && boundScene.references.some(ref => ref.anchor) && !info.MiniMaxH3AddGuide) return stop('Frame anchors require ComfyUI’s native MiniMaxH3AddGuide node. Update ComfyUI, turn Frame 0 guide off, or use Keyframes mode.')
    if (promptAudit.errors.length && !renderAnyway) {
      return stop(`Prompt needs attention: ${promptAudit.errors[0]}`)
    }
    const requiredReferenceFiles = [
      ...(mode === 'reference' ? [...renderReferenceImages, ...referenceVideos, ...referenceAudios] : []),
      ...((mode === 'image' || mode === 'frames') && firstFrame ? [firstFrame] : []),
      ...(mode === 'frames' && lastFrame ? [lastFrame] : []),
    ]
    if (requiredReferenceFiles.length) {
      try {
        const validation = await window.minimax.validateMediaFiles(requiredReferenceFiles)
        const invalid = validation.filter((file) => !file.valid)
        if (invalid.length) {
          const labels = invalid.slice(0, 3).map((file) => file.path.split(/[\\/]/).at(-1) || 'reference').join(', ')
          return stop(`Cannot start this render: ${labels}${invalid.length > 3 ? ` and ${invalid.length - 3} more` : ''} ${invalid.length === 1 ? 'is' : 'are'} unavailable or unsupported. Re-select the affected reference file${invalid.length === 1 ? '' : 's'}.`)
        }
      } catch (error) {
        return stop(`Could not verify the selected reference files: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    const setTargetSubmitting = target === 'image' ? setStillSubmitting : setSubmitting
    setTargetSubmitting(true)
    setNotice({ tone: 'neutral', text: target === 'image' ? 'Preparing one Ref2VA reference still…' : 'Uploading inputs and preparing the ComfyUI graph…' })
    const effectivePrompt = sceneCompilation.prompt
    const [width, height] = resolution.split('x').map(Number)
    const previewFrames = h3PreviewFrameCount(duration)
    const continuationPreviewEnabled = target === 'video' && (liveEnabled || Boolean(control?.continuation))
    const useGenerationAnimatedPreview = continuationPreviewEnabled && livePreviewMode !== 'standard' && h3AnimatedPreviewReady
    const selectedSampling = experimentalSampling
      ? { sampler, scheduler }
      : turbo === '8'
        ? turbo8Sampling(turbo8Profile)
        : { sampler: 'res_multistep', scheduler: 'simple' }
    const localId = createId()
    const latentFile = target === 'video' && info.MiniMaxH3SaveLatent ? `h3_context/${localId}_00001.safetensors` : undefined
    const h3ProActive = target === 'video' && upscaleMode === 'h3' && (!h3ProReview || control?.forceH3Pro === true)
    const h3ProReviewCheckpoint = target === 'video' && upscaleMode === 'h3' && h3ProReview && !control?.forceH3Pro
    const job: GenerationJob = {
      id: localId,
      outputName: control?.continuation?.outputName,
      continuation: control?.continuation ? { scriptId: control.continuation.scriptId, beatId: control.continuation.beatId, beatSignature: control.continuation.beatSignature, sourceJobId: control.continuation.sourceJobId, requestedDuration: control.continuation.requestedDuration, deliveredDuration: control.continuation.deliveredDuration } : undefined,
      latentFile,
      continuityState: boundScene,
      renderSettings: {
        resolution,
        turbo,
        turbo8Profile,
        steps,
        sampler,
        scheduler,
        experimentalSampling,
        textEncoderPreference,
        refImageSize,
        sigmaShiftMode,
        shiftVideo,
        shiftAudio,
        loraStrength,
        userLoras: userLoras.map(item => ({ ...item })),
        noDialogue,
        naturalMovement,
        clothingPolicy,
        seed,
      },
      provider: 'minimax',
      mode,
      prompt: effectivePrompt,
      createdAt: Date.now(),
      status: 'queued',
      progress: 2,
      progressLabel: target === 'image' ? 'Preparing Ref2VA reference still' : 'Preparing and uploading inputs',
      mediaType: target,
      sourceMode: target === 'image' ? 'ref2va-still' : undefined,
      seed,
      referenceAssets: [...renderReferenceImages.map((file) => file.path), ...referenceVideos.map((file) => file.path), ...referenceAudios.map((file) => file.path)],
      referenceFiles: [...renderReferenceImages, ...referenceVideos, ...referenceAudios],
      modelName: turbo === 'fast' ? selection.fastH3 : mode === 'reference' ? selection.ref2va : selection.fl2va,
      sampler: selectedSampling.sampler,
      scheduler: selectedSampling.scheduler,
      refImageSize,
      width: h3ProActive ? h3LatentUpscaleSize(width) : width * (target === 'video' && (upscaleMode === 'ltx' || upscaleMode === 'rtx') ? 2 : 1),
      height: h3ProActive ? h3LatentUpscaleSize(height) : height * (target === 'video' && (upscaleMode === 'ltx' || upscaleMode === 'rtx') ? 2 : 1),
      renderWidth: width,
      renderHeight: height,
      duration: control?.continuation?.deliveredDuration ?? duration,
      turbo,
      steps: target === 'video' ? h3SamplingSteps(turbo, steps) : steps,
      refinementSteps: target === 'video' ? upscaleMode === 'refine' ? h3RefineSteps : h3ProActive ? h3ProRefineSteps : undefined : undefined,
      refinementStepCostMultiplier: h3ProActive ? 4 : 1,
      noDialogue,
      naturalMovement,
      loraStrength,
      userLoras: userLoras.filter((lora) => lora.name),
      execution: {
        diffusionModel: turbo === 'fast' ? selection.fastH3 : mode === 'reference' ? selection.ref2va : selection.fl2va,
        diffusionPrecision: modelPrecisionLabel(turbo === 'fast' ? selection.fastH3 : mode === 'reference' ? selection.ref2va : selection.fl2va),
        textEncoder: selection.textEncoder,
        attentionBackend: settings.attentionBackend === 'sol' && solAttentionNode ? `NVIDIA Sol-Attn${settings.solCacheEnabled && solCacheNode ? ' + H3 cache' : ''} · tau ${settings.solAttnTau}` : settings.h3ParallelAttentionEnabled && h3ParallelAttentionNode && /kitchen|int8/i.test(resolvedH3AttentionBackend ?? '') ? 'H3 multi-GPU parallel · Kitchen INT8' : attentionBackendLabel(resolvedH3AttentionBackend),
        sampler: selectedSampling.sampler,
        scheduler: selectedSampling.scheduler,
        preview: continuationPreviewEnabled ? useGenerationAnimatedPreview ? `H3 animated · ${previewFrames} frames · ${H3_PREVIEW_FPS} fps` : 'Standard first frame' : 'Off',
        upscale: target === 'video' ? upscaleMode === 'refine' ? `H3 refine · same resolution · ${h3RefineSteps} steps · ${h3RefineDenoise.toFixed(2)} denoise` : upscaleMode === 'h3' ? h3ProReviewCheckpoint ? 'H3 Latent Upscale Pro · review checkpoint' : `H3 Latent Upscale Pro · 2× · ${h3ProRefineSteps}-step refine` : upscaleMode === 'ltx' ? 'LTX latent · 2×' : upscaleMode === 'rtx' ? `RTX frames · 2× · ${rtxModel}` : 'Off' : undefined,
        referenceCount: mode === 'reference' ? renderReferenceImages.length + referenceVideos.length + referenceAudios.length : undefined,
        adapters: [turbo === 'fast' ? 'FastVideo FastH3 · official 8-step checkpoint' : turbo !== 'off' ? `Turbo ${turbo}` : '', ...(turbo === 'fast' ? [] : userLoras.filter((lora) => lora.name).map((lora) => `${lora.name} · ${lora.strength}`))].filter(Boolean),
        gpuRouting: h3GpuRouting?.summary,
      },
      characterProjectId: characterHandoff ?? undefined,
      h3ProReviewPending: h3ProReviewCheckpoint || undefined,
      h3ProSourceSignature: h3ProReviewCheckpoint ? h3ProSourceSignature : undefined,
      h3ProParentJobId: control?.parentJobId,
    }
    setJobs((current) => [job, ...current])
    selectActiveJob(localId)
    let queued = false
    try {
      const upload = async (file: MediaFile, fitToOutput = false) => file.kind === 'image' && (fitToOutput || Boolean(file.crop))
        ? window.minimax.uploadImageData(settings.comfyUrl, await prepareImage(file, width, height))
        : window.minimax.uploadInput(settings.comfyUrl, file.path)
      const updatePreparation = (progressLabel: string) => setJobs(current => current.map(item => item.id === localId ? { ...item, progressLabel } : item))
      if (control?.continuation?.assembly) updatePreparation('Uploading continuation source video')
      const sourceVideo = control?.continuation?.assembly
        ? await window.minimax.uploadInput(settings.comfyUrl, control.continuation.assembly.sourcePath)
        : undefined
      if (control?.continuation) updatePreparation('Uploading beat references')
      const [first, last, images, videos, audios] = await Promise.all([
        firstFrame && (mode === 'image' || mode === 'frames') ? upload(firstFrame, true) : undefined,
        lastFrame && mode === 'frames' ? upload(lastFrame, true) : undefined,
        Promise.all(mode === 'reference' ? renderReferenceImages.map((file) => upload(file, true)) : []),
        Promise.all(mode === 'reference' ? referenceVideos.map((file) => upload(file)) : []),
        Promise.all(mode === 'reference' ? referenceAudios.map((file) => upload(file)) : []),
      ])
      if (cancellationRequests.current.has(localId)) throw new Error('Generation cancelled before submission.')
      if (control?.continuation) updatePreparation('Building continuation workflow')
      const generationOptions = {
        latentCapture: latentFile ? { filenamePrefix: `h3_context/${localId}` } : undefined,
        motionContext: control?.continuation?.motion ? { latentPath: control.continuation.motion.latentPath, contextFrames: control.continuation.motion.contextFrames, blendFrames: control.continuation.motion.blendFrames, carryAudio: control.continuation.motion.carryAudio, suppressAudio: control.continuation.motion.suppressAudio } : undefined,
        continuationAssembly: control?.continuation?.assembly && sourceVideo ? { sourceVideo, trimFrames: control.continuation.assembly.trimFrames, blendFrames: control.continuation.assembly.blendFrames, useMotionTrim: control.continuation.assembly.useMotionTrim } : undefined,
        sceneState: boundScene,
        ignoreSceneConflicts: renderAnyway,
        mode,
        prompt: effectivePrompt,
        width,
        height,
        duration,
        seed,
        steps,
        turbo,
        experimentalSampling,
        loraStrength,
        userLoras: turbo === 'fast' ? [] : userLoras.filter((lora) => lora.name),
        sampler: selectedSampling.sampler,
        scheduler: selectedSampling.scheduler,
        upscale: target === 'video' ? upscaleMode === 'refine' ? { type: 'refine' as const, steps: h3RefineSteps, denoise: h3RefineDenoise } : h3ProActive ? { type: 'h3' as const, model: h3LearnedUpscaleModel, scale: 2, refineSteps: h3ProRefineSteps, refineDenoise: 0.35 } : upscaleMode === 'ltx' ? { type: 'ltx' as const, model: upscaleModel, vae: upscaleVae } : upscaleMode === 'rtx' ? { type: 'rtx' as const, model: rtxModel } : undefined : undefined,
        refImageSize,
        sigmaShift: sigmaShiftMode === 'custom' ? { video: shiftVideo, audio: shiftAudio } : undefined,
        previewOverride: useGenerationAnimatedPreview && h3PreviewOverrideNode ? { frames: previewFrames, fps: H3_PREVIEW_FPS, nodeType: h3PreviewOverrideNode, vaeName: selection.previewVae, jpegQuality: 85 } : undefined,
        attentionBackend: settings.attentionBackend === 'sol' ? undefined : resolvedH3AttentionBackend,
        solAttention: target === 'video' && settings.attentionBackend === 'sol' && solAttentionNode ? { nodeType: solAttentionNode, tau: settings.solAttnTau } : undefined,
        solCache: target === 'video' && settings.attentionBackend === 'sol' && settings.solCacheEnabled && solCacheNode ? { nodeType: solCacheNode, threshold: 0.1, maxSteps: 5 } : undefined,
        h3ParallelAttention: target === 'video' && mode === 'reference' && settings.h3ParallelAttentionEnabled && h3ParallelAttentionNode && /kitchen|int8/i.test(resolvedH3AttentionBackend ?? '') ? { nodeType: h3ParallelAttentionNode, devices: 'auto' as const } : undefined,
        gpuRouting: h3GpuRouting?.workflow,
        filenamePrefix: target === 'image' ? `image/MiniMax_Ref2VA_Still_${Date.now()}` : control?.continuation?.outputName ? control.continuation.outputName : `video/MiniMax_H3_${Date.now()}`,
        firstFrame: firstFrame?.path,
        lastFrame: lastFrame?.path,
        referenceImages: renderReferenceImages.map((item) => item.path),
        referenceVideos: referenceVideos.map((item) => item.path),
        referenceAudios: referenceAudios.map((item) => item.path),
      }
      const graph = target === 'image'
        ? buildMiniMaxReferenceStillWorkflow(generationOptions, selection, { images, videos, audios })
        : buildMiniMaxWorkflow(generationOptions, selection, { first, last, images, videos, audios, source: sourceVideo })
      if (h3GpuRouting) console.info(`[GPU Routing] ${h3GpuRouting.logLine} | Strategy: ${h3GpuRouting.workflow.strategy}`)
      if (control?.continuation) updatePreparation('Submitting continuation to ComfyUI')
      const response = await window.minimax.submitPrompt(settings.comfyUrl, graph, live.clientId)
      if (cancellationRequests.current.has(localId)) {
        await window.minimax.cancelPrompt(settings.comfyUrl, response.prompt_id)
        setJobs((current) => current.map((item) => item.id === localId ? { ...item, promptId: response.prompt_id, status: 'cancelled', error: undefined } : item))
        setNotice({ tone: 'success', text: target === 'image' ? 'Reference still cancelled.' : 'Generation cancelled.' })
      } else {
        queued = true
        setJobs((current) => current.map((item) => item.id === localId ? { ...item, promptId: response.prompt_id, status: 'running', progress: 4, progressLabel: target === 'image' ? 'Generating one Ref2VA reference still' : 'Waiting for ComfyUI to start' } : control?.parentJobId && item.id === control.parentJobId ? { ...item, h3ProReviewPending: false } : item))
        if (mode === 'reference') setRef2vaSeed(seed)
        setNotice({ tone: 'success', text: target === 'image' ? 'Reference still added to the local ComfyUI queue.' : 'Generation added to the local ComfyUI queue.' })
        if (target === 'video') setCharacterHandoff(null)
      }
      // A locked seed is authoritative for every H3 route, including I2V.
      // Previously non-reference submissions always randomized after queueing,
      // which broke Ref2VA → I2V reproducibility.
      if (!seedLocked && !h3ProReviewCheckpoint) setSeed(randomH3Seed(seed))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const cancelled = cancellationRequests.current.has(localId)
      setJobs((current) => current.map((item) => item.id === localId ? cancelled ? { ...item, status: 'cancelled', error: undefined } : { ...item, status: 'failed', error: message } : item))
      setNotice(cancelled ? { tone: 'success', text: 'Generation cancelled.' } : { tone: 'error', text: message })
      if (control?.continuation && !cancelled) throw new Error(message)
    } finally {
      cancellationRequests.current.delete(localId)
      setCancellingIds((current) => { const next = new Set(current); next.delete(localId); return next })
      setTargetSubmitting(false)
    }
    return queued ? localId : undefined
  }

  // Keep the auto-render bridge on the latest generate implementation without
  // making its effect depend on a function recreated by every render.
  generateRef.current = generate

  const continuationAssemblyReady = ['MiniMaxH3LoopTrim', 'MiniMaxH3VideoMerge'].every(node => Boolean(info[node]))
  const continuationNodesReady = continuationAssemblyReady && ['MiniMaxH3SaveLatent', 'MiniMaxH3LoadLatent', 'MiniMaxH3VideoExtender', 'MiniMaxH3MotionContext'].every(node => Boolean(info[node]))
  const missingContinuationNodes = ['MiniMaxH3LoopTrim', 'MiniMaxH3VideoMerge', 'MiniMaxH3SaveLatent', 'MiniMaxH3LoadLatent', 'MiniMaxH3VideoExtender', 'MiniMaxH3MotionContext'].filter(node => !info[node])
  const generateContinuationBeat = async (script: ContinueScript, beat: ContinueBeat, source: GenerationJob | MediaFile, method: ContinueMethod, onProgress: (stage: string) => void) => {
    if (!settings) throw new Error('Open Settings and configure the output folder first.')
    onProgress('Locating the source video')
    const sourceJob = 'status' in source ? source : undefined
    const outputFile = sourceJob?.outputUrl ? outputFileFromUrl(sourceJob.outputUrl) : undefined
    const resolvedOutput = outputFile ? await window.minimax.resolveOutput(activeOutputDirectory, outputFile) : null
    const sourceCandidates = sourceJob ? continuationSourceCandidates(sourceJob, resolvedOutput) : [(source as MediaFile).path]
    let sourcePath = sourceCandidates[0]
    if (!sourcePath) throw new Error('The source clip is unavailable. Select it again or verify that its output still exists.')
    if (!continuationAssemblyReady) throw new Error('Combined continuation output requires the MiniMax H3 Extender Trim and Merge nodes. Install or enable them, restart ComfyUI, then test the connection again.')
    // Normalize source cadence before a 24 fps merge; a chosen frame also ends the retained source.
    onProgress('Preparing the source for the 24 fps combined video')
    sourcePath = await window.minimax.prepareContinuationSource(sourceCandidates, method === 'frame' ? beat.frameTime : null, activeOutputDirectory, settings.ffmpegPath)
    onProgress('Reading source timing and checking the seam')
    const externalMetadata = await window.minimax.getVideoMetadata(sourcePath, settings.ffmpegPath)
    if (script.continuity.blendFrames > externalMetadata.frameCount) throw new Error('The source is shorter than the seam blend. Reduce seam blend frames or choose a later source frame.')
    if (sourceJob && resolvedOutput && sourceJob.localOutputPath !== resolvedOutput) {
      setJobs(current => current.map(job => job.id === sourceJob.id ? { ...job, localOutputPath: resolvedOutput } : job))
    }
    if (method === 'motion' && (!continuationNodesReady || !sourceJob?.latentFile)) throw new Error('This source has no compatible saved H3 AV latent. Select Last Frame or Choose Frame.')
    const previousState = sourceJob ? continuationSourceState(sourceJob) : script.mode === 'reference' ? sceneState : createSceneState('', beat.duration, 'text')
    const inheritedNoDialogue = sourceJob?.renderSettings?.noDialogue ?? sourceJob?.noDialogue ?? previousState.noDialogue
    const effectiveNoDialogue = script.continuity.dialogueMode === 'none' || (script.continuity.dialogueMode !== 'allow' && inheritedNoDialogue)
    // A continuation job's stored prompt is compiled output and may already
    // contain prior continuity instructions. Reusing it recursively causes the
    // prompt to grow on every beat. The authored beat is the canonical action.
    const previousAction = sourceJob
      ? continuationPreviousAction(script, sourceJob) || (sourceJob.continuation ? '' : sourceJob.prompt.trim())
      : previousState.scene.trim()
    const continuityLines = beat.continuityBreak ? [] : [
      previousState.environment.value && `Location: ${previousState.environment.value}`,
      previousState.lighting.value && `Lighting: ${previousState.lighting.value}`,
      !beat.cameraOverride.trim() && previousState.camera.angle?.value && `Camera angle: ${previousState.camera.angle.value}`,
      !beat.cameraOverride.trim() && previousState.camera.movement?.value && `Camera movement: ${previousState.camera.movement.value}`,
      previousAction && `Previous action: ${previousAction}`,
    ].filter(Boolean)
    const nextMode: GenerationMode = script.mode === 'reference' ? 'reference' : method === 'motion' ? 'text' : 'image'
    const authored = [continuityLines.length ? `Preserve the established scene and motion. ${continuityLines.join('. ')}.` : '', `What happens next: ${beat.prompt.trim()}`, beat.cameraOverride.trim() ? `Camera change: ${beat.cameraOverride.trim()}` : ''].filter(Boolean).join('\n')
    const timing = continuationTiming(beat.duration, method === 'motion' ? script.continuity.contextFrames : 0, script.continuity.blendFrames)
    if (timing.renderFrames > 362) throw new Error(`This beat needs ${timing.renderFrames} raw H3 frames after continuity overlap, above H3’s 362-frame limit. Shorten the beat or reduce latent context frames.`)
    const renderDuration = timing.renderDuration
    const nextState = createSceneState(authored, renderDuration, nextMode)
    nextState.environment = beat.continuityBreak ? value('') : previousState.environment
    nextState.lighting = beat.continuityBreak ? value('') : previousState.lighting
    nextState.camera = beat.cameraOverride.trim() ? { ...(beat.continuityBreak ? nextState.camera : previousState.camera), movement: value(beat.cameraOverride.trim()) } : beat.continuityBreak ? nextState.camera : previousState.camera
    nextState.characters = beat.continuityBreak ? [] : previousState.characters
    nextState.noDialogue = effectiveNoDialogue
    if (effectiveNoDialogue) nextState.dialogue = []
    nextState.naturalMovement = previousState.naturalMovement
    nextState.continuity = { scene: !beat.continuityBreak, camera: !beat.continuityBreak, exactFrame: method !== 'motion', notes: value('') }
    let frame: MediaFile | null = null
    if (method !== 'motion') {
      onProgress('Extracting the frame for visual continuity')
      let extracted: Awaited<ReturnType<typeof window.minimax.extractVideoFrame>> | null = null
      let extractionError = ''
      for (const candidate of [sourcePath]) {
        try {
          extracted = await window.minimax.extractVideoFrame(candidate, 'last', activeOutputDirectory, settings.ffmpegPath)
          break
        } catch (error) {
          extractionError = error instanceof Error ? error.message : String(error)
        }
      }
      if (!extracted) throw new Error(`The source video could not be opened${extractionError ? `: ${extractionError}` : '.'}`)
      frame = { ...extracted, kind: 'image', name: `Continuation frame · ${extracted.name}`, preview: await window.minimax.mediaUrl(extracted.path), referenceRole: 'composition', referenceRetention: 'preserve', openingFrameTreatment: 'match' }
    }
    const inheritedStateFiles = previousState.references.map(ref => ref.file)
    const inherited = (inheritedStateFiles.length ? inheritedStateFiles : sourceJob?.referenceFiles ?? [...referenceImages, ...referenceVideos, ...referenceAudios]).filter(file => !file.openingFrameTreatment)
    const replacements = Object.entries(beat.replacements).filter((entry): entry is [string, MediaFile] => Boolean(entry[1]))
    const isReplaced = (file: MediaFile) => continuationReferenceReplaced(beat, file, previousState.references)
    const allReferences = (beat.continuityBreak ? [] : inherited).filter(file => !isReplaced(file)).concat(replacements.map(([, file]) => file))
    const inheritedPaths = new Set(allReferences.map(file => file.path))
    // Keep the compiler-side owner and Preserve assignments that belonged to
    // the source render. Rebuilding from bare MediaFile values loses ownerId,
    // which can turn a correctly assigned character image into an unassigned
    // standalone identity reference on the next beat.
    const replacementReferences: SceneReference[] = replacements.map(([role, file]) => {
      const referenceRole = role === 'character' ? 'subject' : file.referenceRole ?? role as NonNullable<MediaFile['referenceRole']>
      const resolvedFile = { ...file, referenceRole, referenceRetention: 'preserve' as const }
      const priorAssignment = previousState.references.find(ref => ref.file.referenceRole === referenceRole && ref.ownerId)
      const explicitOwnerId = role === 'character' || role === 'wardrobe' ? beat.replacementOwnerIds?.[role] : undefined
      const ownerId = referenceRole === 'subject' || referenceRole === 'wardrobe'
        ? explicitOwnerId ?? priorAssignment?.ownerId ?? (previousState.characters.length === 1 ? previousState.characters[0].id : undefined)
        : undefined
      return {
        id: `${resolvedFile.kind}:${resolvedFile.path}`,
        file: resolvedFile,
        ownerId,
        name: `Continuation ${role} replacement · ${resolvedFile.name}`,
        preserve: defaultPreservedAttributes({ file: resolvedFile, ownerId }),
        locks: [],
        observed: {},
        source: 'PRESERVE',
      }
    })
    nextState.references = [
      ...(beat.continuityBreak ? [] : previousState.references.filter(ref => !ref.anchor && inheritedPaths.has(ref.file.path) && !isReplaced(ref.file))),
      ...replacementReferences,
    ]
    const imageReferences = allReferences.filter(file => file.kind === 'image').slice(0, frame && nextMode === 'reference' ? 8 : 9)
    if (frame && nextMode === 'reference') imageReferences.unshift(frame)
    // Store only the state needed by the following beat. The expanded render
    // prompt is intentionally excluded so a chain cannot embed itself.
    const compactContinuityState: ScenePromptState = {
      ...nextState,
      scene: beat.prompt.trim(),
      continuity: { ...nextState.continuity, notes: value('') },
    }
    const createWorkspaceSnapshot = {
      mode, duration, ref2vaSeed, noDialogue, naturalMovement, activeJobId, characterHandoff,
      sceneState, firstFrame, lastFrame, referenceImages, referenceVideos, referenceAudios,
      selectedReferenceCharacterIds, selectedReferenceLocationIds, resolution, seed, seedLocked,
      turbo, turbo8Profile, steps, sampler, scheduler, experimentalSampling, textEncoderPreference,
      refImageSize, sigmaShiftMode, shiftVideo, shiftAudio, loraStrength, userLoras, clothingPolicy,
      upscaleMode,
    }
    flushSync(() => {
    setContinuationPreparing(true)
    setSceneState(nextState)
    // Continue is its own workspace, so Create may still hold the mode used
    // before the script opened. Apply this beat's mode before generateRef
    // reads the current render state.
    setMode(nextMode)
    setFirstFrame(nextMode === 'image' ? frame : null)
    setLastFrame(null)
    setReferenceImages(nextMode === 'reference' ? imageReferences : [])
    setReferenceVideos(nextMode === 'reference' ? allReferences.filter(file => file.kind === 'video').slice(0, 3) : [])
    setReferenceAudios(nextMode === 'reference' ? allReferences.filter(file => file.kind === 'audio').slice(0, 3) : [])
    setSelectedReferenceCharacterIds([])
    setSelectedReferenceLocationIds([])
    const inheritedSettings = sourceJob?.renderSettings
    setDuration(renderDuration)
    setResolution(inheritedSettings?.resolution ?? `${sourceJob?.renderWidth ?? sourceJob?.width ?? externalMetadata?.width ?? Number(resolution.split('x')[0])}x${sourceJob?.renderHeight ?? sourceJob?.height ?? externalMetadata?.height ?? Number(resolution.split('x')[1])}`)
    const inheritedSeed = inheritedSettings?.seed ?? sourceJob?.seed
    if (inheritedSeed !== undefined) { setSeed(inheritedSeed); setSeedLocked(true) }
    const inheritedTurbo = inheritedSettings?.turbo ?? sourceJob?.turbo ?? turbo
    setTurbo(inheritedTurbo === 'fast' && nextMode !== 'text' ? 'off' : inheritedTurbo)
    if (inheritedSettings) {
      setTurbo8Profile(inheritedSettings.turbo8Profile)
      setSteps(inheritedSettings.steps)
      setSampler(inheritedSettings.sampler)
      setScheduler(inheritedSettings.scheduler)
      setExperimentalSampling(inheritedSettings.experimentalSampling)
      setTextEncoderPreference(inheritedSettings.textEncoderPreference)
      setRefImageSize(inheritedSettings.refImageSize)
      setSigmaShiftMode(inheritedSettings.sigmaShiftMode)
      setShiftVideo(inheritedSettings.shiftVideo)
      setShiftAudio(inheritedSettings.shiftAudio)
      setLoraStrength(inheritedSettings.loraStrength)
      setUserLoras(inheritedSettings.userLoras.map(item => ({ ...item })))
      setNaturalMovement(inheritedSettings.naturalMovement)
      setClothingPolicy(inheritedSettings.clothingPolicy)
    } else {
      if (sourceJob?.steps) setSteps(sourceJob.steps)
      if (sourceJob?.sampler) { setSampler(sourceJob.sampler); setExperimentalSampling(true) }
      if (sourceJob?.scheduler) setScheduler(sourceJob.scheduler)
      if (sourceJob?.refImageSize) setRefImageSize(sourceJob.refImageSize)
      if (sourceJob?.loraStrength !== undefined) setLoraStrength(sourceJob.loraStrength)
      if (sourceJob?.userLoras) setUserLoras(sourceJob.userLoras.map(item => ({ ...item })))
      if (sourceJob?.naturalMovement !== undefined) setNaturalMovement(sourceJob.naturalMovement)
    }
    setNoDialogue(effectiveNoDialogue)
    // Continuation assembly operates on the base decoded frames. Applying a
    // post-process before the merge would produce mismatched frame sizes or a
    // disconnected upscaled segment instead of the completed sequence.
    setUpscaleMode('off')
    })
    try {
      onProgress('Uploading references and submitting the beat to ComfyUI')
      const outputName = continuationOutputName(script, beat)
      const queuedId = await generateRef.current?.('video', false, { continuation: {
        scriptId: script.id,
        beatId: beat.id,
        beatSignature: continuationBeatSignature(beat, script.videoName, `${script.mode}:${method}`, script.continuity),
        outputName,
        sourceJobId: sourceJob?.id ?? ('status' in source ? undefined : source.path),
        requestedDuration: beat.duration,
        deliveredDuration: timing.deliveredDuration,
        assembly: { sourcePath, trimFrames: timing.trimFrames, blendFrames: script.continuity.blendFrames, useMotionTrim: method === 'motion' },
        motion: method === 'motion' && sourceJob?.latentFile ? { latentPath: sourceJob.latentPath ?? sourceJob.latentFile, contextFrames: script.continuity.contextFrames, blendFrames: script.continuity.blendFrames, carryAudio: script.continuity.carryAudio, suppressAudio: effectiveNoDialogue } : undefined,
      } })
      if (!queuedId) throw new Error('ComfyUI did not return a queued beat. Check the local engine connection and retry.')
      setJobs(current => current.map(job => job.id === queuedId ? { ...job, continuityState: compactContinuityState } : job))
    } finally {
      setMode(createWorkspaceSnapshot.mode)
      setDuration(createWorkspaceSnapshot.duration)
      setRef2vaSeed(createWorkspaceSnapshot.ref2vaSeed)
      setNoDialogue(createWorkspaceSnapshot.noDialogue)
      setNaturalMovement(createWorkspaceSnapshot.naturalMovement)
      setActiveJobId(createWorkspaceSnapshot.activeJobId)
      setCharacterHandoff(createWorkspaceSnapshot.characterHandoff)
      setSceneState(createWorkspaceSnapshot.sceneState)
      setFirstFrame(createWorkspaceSnapshot.firstFrame)
      setLastFrame(createWorkspaceSnapshot.lastFrame)
      setReferenceImages(createWorkspaceSnapshot.referenceImages)
      setReferenceVideos(createWorkspaceSnapshot.referenceVideos)
      setReferenceAudios(createWorkspaceSnapshot.referenceAudios)
      setSelectedReferenceCharacterIds(createWorkspaceSnapshot.selectedReferenceCharacterIds)
      setSelectedReferenceLocationIds(createWorkspaceSnapshot.selectedReferenceLocationIds)
      setResolution(createWorkspaceSnapshot.resolution)
      setSeed(createWorkspaceSnapshot.seed)
      setSeedLocked(createWorkspaceSnapshot.seedLocked)
      setTurbo(createWorkspaceSnapshot.turbo)
      setTurbo8Profile(createWorkspaceSnapshot.turbo8Profile)
      setSteps(createWorkspaceSnapshot.steps)
      setSampler(createWorkspaceSnapshot.sampler)
      setScheduler(createWorkspaceSnapshot.scheduler)
      setExperimentalSampling(createWorkspaceSnapshot.experimentalSampling)
      setTextEncoderPreference(createWorkspaceSnapshot.textEncoderPreference)
      setRefImageSize(createWorkspaceSnapshot.refImageSize)
      setSigmaShiftMode(createWorkspaceSnapshot.sigmaShiftMode)
      setShiftVideo(createWorkspaceSnapshot.shiftVideo)
      setShiftAudio(createWorkspaceSnapshot.shiftAudio)
      setLoraStrength(createWorkspaceSnapshot.loraStrength)
      setUserLoras(createWorkspaceSnapshot.userLoras)
      setClothingPolicy(createWorkspaceSnapshot.clothingPolicy)
      setUpscaleMode(createWorkspaceSnapshot.upscaleMode)
      setContinuationPreparing(false)
    }
  }

  const continueH3Pro = async (job: GenerationJob) => {
    if (!job.h3ProReviewPending) return
    if (job.h3ProSourceSignature !== h3ProSourceSignature) {
      setNotice({ tone: 'error', text: 'The scene or render settings changed after this checkpoint. Restore them before continuing so the Pro refinement remains deterministic.' })
      return
    }
    await generate('video', renderAnyway, { forceH3Pro: true, parentJobId: job.id })
  }

  const sendStillToI2v = async (job: GenerationJob, provider: 'minimax' | 'ltx25') => {
    if (!job.localOutputPath) {
      setNotice({ tone: 'error', text: 'The completed still is not available as a local I2V input file.' })
      return
    }
    try {
      const file: MediaFile = {
        path: job.localOutputPath,
        name: `Generated still · ${new Date(job.createdAt).toLocaleString()}`,
        kind: 'image',
        preview: await window.minimax.mediaUrl(job.localOutputPath),
      }
      if (provider === 'ltx25') {
        await sendGeneratedStillToLtx(file)
        return
      }
      setFirstFrame(file)
      setLastFrame(null)
      setReferenceImages([])
      setReferenceVideos([])
      setReferenceAudios([])
      setSelectedReferenceCharacterIds([])
      setSelectedReferenceLocationIds([])
      setMode('image')
      setResolution(`${job.width}x${job.height}`)
      if (job.seed !== undefined) { setSeed(job.seed); setRef2vaSeed(job.seed); setSeedLocked(true) }
      setActiveJobId(null)
      setNotice({ tone: 'success', text: job.seed !== undefined ? `Generated still loaded as the MiniMax I2V starting frame. Seed ${job.seed} locked for the next render.` : 'Generated still loaded as the MiniMax I2V starting frame.' })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    }
  }

  // The Movie Planner owns production sequencing. Once it has resolved a shot,

  const runH3Benchmark = async () => {
    if (!settings || benchmarkRunning) return
    if (!status.connected) return setNotice({ tone: 'error', text: 'Connect ComfyUI before running the attention benchmark.' })
    if (pendingJobs.length) return setNotice({ tone: 'error', text: 'Finish or cancel active renders before benchmarking so the timing comparison is fair.' })
    const selection = inferSelections(models, '8', textEncoderPreference, settings.h3DiffusionPrecision)
    if (![selection.fl2va, selection.textEncoder, selection.videoVae, selection.audioVae, selection.fl2vLora].every(Boolean)) {
      return setNotice({ tone: 'error', text: 'The FL2VA base stack and official 8-step Turbo LoRA are required for the benchmark.' })
    }
    if (h3GpuRouting?.vramWarnings.length && !settings.gpuRouting.allowOvercommit) {
      return setNotice({ tone: 'error', text: `${h3GpuRouting.vramWarnings.join(' ')} Enable “Allow render despite VRAM estimate” or choose a safer GPU routing strategy before benchmarking.` })
    }
    const available = h3BenchmarkBackends.map((item) => ({
      ...item,
      attention: item.backend === 'sol' ? undefined : resolveAttentionBackend(item.backend, h3AttentionBackends),
      ready: item.backend === 'sol' ? Boolean(solAttentionNode) : Boolean(resolveAttentionBackend(item.backend, h3AttentionBackends)),
    }))
    let finalResults: H3BenchmarkResult[] = available.map((item) => ({
      backend: item.backend,
      label: item.backend === 'sol' && settings.solCacheEnabled && solCacheNode ? `${item.label} + cache` : item.label,
      status: item.ready ? 'idle' : 'unavailable',
      error: item.ready ? undefined : item.backend === 'sol' ? 'SolAttnH3 was not detected.' : `${item.label} was not reported by ComfyUI.`,
    }))
    setBenchmarkResults(finalResults)
    if (!available.some((item) => item.ready)) return setNotice({ tone: 'error', text: 'None of the requested attention backends are available in ComfyUI.' })
    setBenchmarkRunning(true)
    const [width, height] = benchmarkConfig.resolution.split('x').map(Number)
    setNotice({ tone: 'neutral', text: `Running the fixed ${benchmarkConfig.duration}-second ${benchmarkConfig.resolution} text-to-video benchmark sequentially. Please leave ComfyUI idle.` })
    const benchmarkPrompt = 'A red paper kite glides slowly above a quiet coastal cliff at sunrise, stable cinematic camera, natural motion, realistic light, no dialogue, no text.'
    const seed = 190914
    for (const item of available) {
      if (!item.ready) continue
      finalResults = benchmarkResultPatch(finalResults, item.backend, { status: 'running', error: undefined })
      setBenchmarkResults(finalResults)
      const submittedAt = Date.now()
      try {
        const graph = buildMiniMaxWorkflow({
          mode: 'text', prompt: benchmarkPrompt, width, height, duration: benchmarkConfig.duration, seed, steps: 8, turbo: '8', sampler: 'res_multistep', scheduler: 'simple', refImageSize: 'match', loraStrength: 1,
          attentionBackend: item.attention,
          solAttention: item.backend === 'sol' && solAttentionNode ? { nodeType: solAttentionNode, tau: settings.solAttnTau } : undefined,
          solCache: item.backend === 'sol' && settings.solCacheEnabled && solCacheNode ? { nodeType: solCacheNode, threshold: 0.1, maxSteps: 5 } : undefined,
          gpuRouting: h3GpuRouting?.workflow,
          filenamePrefix: `video/MiniMax_Attention_Benchmark_${item.backend}_${Date.now()}`,
          referenceImages: [], referenceVideos: [], referenceAudios: [],
        }, selection, { images: [], videos: [], audios: [] })
        const response = await window.minimax.submitPrompt(settings.comfyUrl, graph, live.clientId)
        const timing = await waitForBenchmarkCompletion(settings.comfyUrl, response.prompt_id, submittedAt)
        finalResults = benchmarkResultPatch(finalResults, item.backend, { status: 'completed', ...timing, completedAt: Date.now() })
      } catch (error) {
        finalResults = benchmarkResultPatch(finalResults, item.backend, { status: 'failed', error: error instanceof Error ? error.message : String(error), elapsedMs: Date.now() - submittedAt })
      }
      setBenchmarkResults(finalResults)
    }
    setBenchmarkRunning(false)
    const completed = finalResults.filter((item) => item.status === 'completed' && item.elapsedMs !== undefined).sort((a, b) => (a.elapsedMs ?? Infinity) - (b.elapsedMs ?? Infinity))
    setNotice(completed.length
      ? { tone: 'success', text: `Attention benchmark complete. ${completed[0].label} was fastest at ${formatBenchmarkDuration(completed[0].elapsedMs)} total.` }
      : { tone: 'error', text: 'The attention benchmark did not produce a completed render. Review the result details and ComfyUI log.' })
  }

  const removeWorkspaceCharacter = (characterId: string) => {
    const character = sceneState.characters.find((item) => item.id === characterId) ?? characterProjects.find((item) => item.id === characterId)
    const name = character?.name || 'this character'
    if (!window.confirm(`Remove “${name}” from this scene? Linked scene references and dialogue assignments will also be removed. The Character Library entry and original media stay available.`)) return
    setSelectedReferenceCharacterIds((current) => current.filter((id) => id !== characterId))
    setSceneState((current) => ({
      ...current,
      characters: current.characters.filter((item) => item.id !== characterId),
      references: current.references.filter((reference) => reference.ownerId !== characterId),
      shots: current.shots.map((shot) => ({ ...shot, characterIds: shot.characterIds.filter((id) => id !== characterId) })),
      dialogue: current.dialogue
        .map((line) => ({ ...line, speakerIds: line.speakerIds.filter((id) => id !== characterId) }))
        .filter((line) => line.speakerIds.length > 0),
    }))
    setNotice({ tone: 'neutral', text: `${name} was removed from this scene. The library entry and original media were kept.` })
  }

  const runH3Diagnostics = async () => {
    if (!settings || diagnosticRunning) return
    if (!status.connected) return setNotice({ tone: 'error', text: 'Connect ComfyUI before running the H3 diagnostic.' })
    const qualityModels = inferSelections(models, 'off', textEncoderPreference, settings.h3DiffusionPrecision)
    const turboModels = inferSelections(models, '8', textEncoderPreference, settings.h3DiffusionPrecision)
    if (![qualityModels.fl2va, qualityModels.textEncoder, qualityModels.videoVae, qualityModels.audioVae, turboModels.fl2vLora].every(Boolean)) {
      return setNotice({ tone: 'error', text: 'The FL2VA base stack and official 8-step Turbo LoRA are required for the diagnostic.' })
    }
    const tests = [
      { name: 'Native quality', turbo: 'off' as const, selection: qualityModels, filenamePrefix: 'video/MiniMax_DIAGNOSTIC_NATIVE' },
      { name: 'Official Turbo 8', turbo: '8' as const, selection: turboModels, filenamePrefix: 'video/MiniMax_DIAGNOSTIC_TURBO8' },
    ]
    setDiagnosticRunning(true)
    setNotice({ tone: 'neutral', text: 'Queuing the fixed-seed Native and Turbo 8 diagnostic pair…' })
    let queuedCount = 0
    for (const [index, test] of tests.entries()) {
      const id = createId()
      const job: GenerationJob = { id, provider: 'minimax', mode: 'text', prompt: `[H3 diagnostic · ${test.name}] ${diagnosticPrompt}`, createdAt: Date.now() + index, status: 'queued', progress: 2, progressLabel: 'Preparing diagnostic workflow', width: 1344, height: 768, duration: 5 }
      setJobs((current) => [job, ...current])
      try {
        const graph = buildMiniMaxWorkflow({ mode: 'text', prompt: diagnosticPrompt, width: 1344, height: 768, duration: 5, seed: 12345, steps: 20, turbo: test.turbo, sampler: 'res_multistep', scheduler: 'simple', refImageSize: 'match', filenamePrefix: test.filenamePrefix, referenceImages: [], referenceVideos: [], referenceAudios: [] }, test.selection, { images: [], videos: [], audios: [] })
        const response = await window.minimax.submitPrompt(settings.comfyUrl, graph, live.clientId)
        queuedCount += 1
        setJobs((current) => current.map((item) => item.id === id ? { ...item, promptId: response.prompt_id, status: 'running', progress: 4, progressLabel: index === 0 ? 'Native test queued' : 'Turbo 8 test queued behind Native' } : item))
        if (index === tests.length - 1) setActiveJobId(id)
      } catch (error) {
        setJobs((current) => current.map((item) => item.id === id ? { ...item, status: 'failed', error: error instanceof Error ? error.message : String(error) } : item))
      }
    }
    setDiagnosticRunning(false)
    setNotice(queuedCount === 2
      ? { tone: 'success', text: 'H3 diagnostic pair queued with identical prompt, seed, resolution, duration, and official sampling.' }
      : { tone: 'error', text: queuedCount ? 'Only one diagnostic render could be queued. Check the failed Queue entry.' : 'The diagnostic renders could not be queued. Check ComfyUI and try again.' })
    setView('queue')
  }

  const refreshWorkspaceSearchEntries = useCallback(() => {
    if (!mainAreaRef.current) return
    setWorkspaceSearchEntries(collectWorkspaceSearchEntries(mainAreaRef.current))
  }, [])
  useEffect(() => {
    if (!workspaceSearchOpen) return
    const frame = window.requestAnimationFrame(refreshWorkspaceSearchEntries)
    window.requestAnimationFrame(() => workspaceSearchInputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [refreshWorkspaceSearchEntries, view, workspaceSearchOpen])
  useEffect(() => {
    if (!workspaceSearchOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWorkspaceSearchOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [workspaceSearchOpen])
  useEffect(() => () => {
    if (workspaceSearchHighlightTimer.current !== null) window.clearTimeout(workspaceSearchHighlightTimer.current)
  }, [])
  const workspaceSearchResults = useMemo(() => {
    const query = compactSearchText(workspaceSearchQuery).toLowerCase()
    const terms = query.split(' ').filter(Boolean)
    const matches = workspaceSearchEntries.filter((entry) => terms.every((term) => entry.searchableText.includes(term)))
    if (!query) return matches.slice(0, 12)
    return matches
      .map((entry, index) => {
        const label = entry.label.toLowerCase()
        const score = label === query ? 0 : label.startsWith(query) ? 1 : label.includes(query) ? 2 : 3
        return { entry, index, score }
      })
      .sort((a, b) => a.score - b.score || a.index - b.index)
      .map(({ entry }) => entry)
      .slice(0, 20)
  }, [workspaceSearchEntries, workspaceSearchQuery])
  useEffect(() => setWorkspaceSearchIndex(0), [workspaceSearchQuery, workspaceSearchResults.length])
  useEffect(() => {
    if (!workspaceSearchOpen) return
    const frame = window.requestAnimationFrame(() => document.querySelector<HTMLElement>('.workspace-search-result.selected')?.scrollIntoView({ block: 'nearest' }))
    return () => window.cancelAnimationFrame(frame)
  }, [workspaceSearchIndex, workspaceSearchOpen])
  const focusWorkspaceSearchEntry = (entry: WorkspaceSearchEntry) => {
    setWorkspaceSearchOpen(false)
    const root = mainAreaRef.current
    if (!root) return
    let ancestor: HTMLElement | null = entry.target
    while (ancestor && ancestor !== root) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = true
      ancestor = ancestor.parentElement
    }
    const hiddenPanel = entry.target.closest<HTMLElement>('[aria-hidden="true"]')
    if (hiddenPanel) {
      const toggle = Array.from(root.querySelectorAll<HTMLElement>('[aria-controls]')).find((candidate) => candidate.getAttribute('aria-controls') === hiddenPanel.id)
      toggle?.click()
    }
    const focusTarget = () => {
      if (workspaceSearchHighlightTimer.current !== null) window.clearTimeout(workspaceSearchHighlightTimer.current)
      const previousTarget = root.querySelector<HTMLElement>('.workspace-search-highlight')
      previousTarget?.classList.remove('workspace-search-highlight')
      if (previousTarget) delete previousTarget.dataset.workspaceSearchLabel
      entry.target.classList.add('workspace-search-highlight')
      entry.target.dataset.workspaceSearchLabel = entry.label
      entry.target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      if (!(entry.focusElement as HTMLInputElement).disabled) entry.focusElement.focus({ preventScroll: true })
      workspaceSearchHighlightTimer.current = window.setTimeout(() => {
        entry.target.classList.remove('workspace-search-highlight')
        delete entry.target.dataset.workspaceSearchLabel
        workspaceSearchHighlightTimer.current = null
      }, 3600)
    }
    window.requestAnimationFrame(focusTarget)
  }
  const handleWorkspaceSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && workspaceSearchResults.length) {
      event.preventDefault()
      setWorkspaceSearchIndex((current) => (current + 1) % workspaceSearchResults.length)
    } else if (event.key === 'ArrowUp' && workspaceSearchResults.length) {
      event.preventDefault()
      setWorkspaceSearchIndex((current) => (current - 1 + workspaceSearchResults.length) % workspaceSearchResults.length)
    } else if (event.key === 'Enter' && workspaceSearchResults[workspaceSearchIndex]) {
      event.preventDefault()
      focusWorkspaceSearchEntry(workspaceSearchResults[workspaceSearchIndex])
    }
  }
  const openWorkspaceSearch = () => {
    setWorkspaceSearchQuery('')
    setWorkspaceSearchIndex(0)
    setWorkspaceSearchOpen(true)
  }
  useEffect(() => {
    const openFromKeyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !event.repeat) {
        if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
        event.preventDefault()
        setNavigatorOpen(true)
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        if (!workspaceSearchOpen && document.querySelector('[role="dialog"][aria-modal="true"]')) return
        event.preventDefault()
        if (workspaceSearchOpen) {
          workspaceSearchInputRef.current?.focus()
          workspaceSearchInputRef.current?.select()
        } else {
          setWorkspaceSearchQuery('')
          setWorkspaceSearchIndex(0)
          setWorkspaceSearchOpen(true)
        }
      }
    }
    window.addEventListener('keydown', openFromKeyboard)
    return () => window.removeEventListener('keydown', openFromKeyboard)
  }, [workspaceSearchOpen])
  if (!settings) {
    return bootError
      ? <main className="boot" role="alert"><AlertCircle /><h1>Could not open your settings</h1><p>{bootError}</p><p>Check that the local settings folder is available, then retry.</p><button type="button" className="primary-button" onClick={() => setBootAttempt(attempt => attempt + 1)}>Retry opening studio</button></main>
      : <div className="boot" role="status" aria-live="polite"><LoaderCircle className="spin" /><span>Opening Oyama AI Video Studio…</span></div>
  }

  const runLegacyMigration = async () => {
    if (legacyMigrationRunning) return
    const replaceBrowserStorage = legacyMigration?.needsBrowserStorageRepair === true
    if (replaceBrowserStorage && !window.confirm('Restore the previous MiniMax Studio projects, characters, and workspace state? This replaces Oyama’s current browser-backed workspace data. Settings and output files are not removed. Oyama must then be restarted.')) return
    setLegacyMigrationRunning(true)
    try {
      const result = await window.minimax.migrateLegacyData(replaceBrowserStorage)
      setLegacyMigration(result)
      setNotice(result.migrated
        ? { tone: 'success', text: 'Previous Studio data was imported safely. Restart Oyama to load newly imported browser-backed projects and workspace state.' }
        : { tone: 'neutral', text: 'No previous MiniMax Studio profile was found to import.' })
    } catch (error) {
      setNotice({ tone: 'error', text: `Could not import the previous Studio data: ${error instanceof Error ? error.message : String(error)}` })
    } finally {
      setLegacyMigrationRunning(false)
    }
  }

  const dismissLegacyMigrationBanner = () => {
    localStorage.setItem(legacyMigrationDismissalKey, 'true')
    setLegacyMigrationDismissed(true)
  }
  const llmConnection = resolveLlmConnection(settings)
  const changeCopilotModel = (model: string) => {
    const field = llmConnection.provider === 'lmstudio' ? 'lmStudioModel' : 'ollamaModel'
    const next = { ...settings, [field]: model }
    setSettings(next)
    void window.minimax.saveSettings(next).catch((error) => setNotice({ tone: 'error', text: `The model changed for this session, but could not be saved: ${error instanceof Error ? error.message : String(error)}` }))
  }
  const sendScratchpadPrompt = (target: ScratchpadTarget, authored: string, compiled: string) => {
    if (target === 'h3') { setPrompt(authored); setActiveJobId(null); setView('create') }
    else if (target === 'image') { window.dispatchEvent(new CustomEvent('minimax:load-image-prompt', { detail: compiled })); setView('zimage') }
    else if (target === 'ltx25') { setView('ltx25'); window.setTimeout(() => window.dispatchEvent(new CustomEvent('oyama:load-ltx-prompt', { detail: compiled })), 0) }
    else { setMusicEngine('acestep'); setView('music'); window.setTimeout(() => window.dispatchEvent(new CustomEvent('oyama:load-music-prompt', { detail: compiled })), 0) }
    setNotice({ tone: 'success', text: `Scratchpad prompt sent to ${target === 'h3' ? 'MiniMax H3' : target === 'ltx25' ? 'LTX 2.5' : target === 'image' ? 'Create Image' : 'ACE-Step'}.` })
  }
  return (
    <div className={`app-shell ${sidebarOpen ? '' : 'sidebar-collapsed'} ${view === 'create' ? 'video-shell-active' : `studio-shell-active studio-view-${view}`}`}>
      <header className="titlebar" aria-label="Application title bar">
        {view !== 'create' && <StudioTopBar onOpenNavigator={() => setNavigatorOpen(true)} view={view} musicEngine={musicEngine} projectName={workspaceProjects.find(project => project.id === activeWorkspaceProjectId && project.scope === workspaceProjectScope(view, musicEngine))?.name ?? 'Current workspace'} connected={status.connected} onNavigate={(nextView, engine) => { if (engine) setMusicEngine(engine); setView(nextView) }} onOpenProjects={() => setProjectManagerOpen(true)} onOpenSettings={() => setView('settings')} onOpenCompare={() => setCompareOpen(true)} compareOpen={compareOpen} />}
        <button className="titlebar-mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open workspace menu"><Menu size={18} /></button>
        <div className="titlebar-brand"><span className="brand-mark"><Film size={18} /></span><span><strong>Oyama AI Video Studio</strong><small>Create&nbsp;&nbsp;•&nbsp;&nbsp;Visualize&nbsp;&nbsp;•&nbsp;&nbsp;Tell Stories</small></span></div>
        <button className="titlebar-search" type="button" onClick={openWorkspaceSearch} title={`Search settings in ${workspaceTips[view].title}`} aria-haspopup="dialog" aria-expanded={workspaceSearchOpen} aria-keyshortcuts="Control+F Meta+F"><Search size={15} /><span>Find a setting in {workspaceTips[view].title}…</span><kbd>Ctrl F</kbd></button>
        {view === 'create' && <div className="titlebar-mode-widget" role="tablist" aria-label="Video input mode">{modeInfo.map((item) => <button key={item.id} type="button" role="tab" aria-selected={mode === item.id} className={mode === item.id ? 'selected' : ''} title={`${item.label} · ${item.note}`} onClick={() => setMode(item.id)}><item.icon size={15} /><span>{item.label}</span></button>)}</div>}
        <div className="titlebar-drag" />
        {view === 'create' && <div className="titlebar-generation-actions" aria-label="Video generation actions">
          <button className="titlebar-action titlebar-generate-video" type="button" onClick={() => void generateRef.current?.('video', renderAnyway)} disabled={submitting} aria-describedby="h3-render-readiness"><Play size={14} fill="currentColor" />{submitting ? 'Submitting…' : 'Generate video'}</button>
          {activeRenderJob && ['queued', 'running'].includes(activeRenderJob.status) && <button className="titlebar-action titlebar-cancel-generation" type="button" onClick={() => void cancelJob(activeRenderJob)} disabled={cancellingIds.has(activeRenderJob.id)} title={activeRenderJob.mediaType === 'image' ? 'Cancel the active image generation' : 'Cancel the active video generation'}><CircleStop size={14} />{cancellingIds.has(activeRenderJob.id) ? 'Stopping…' : activeRenderJob.mediaType === 'image' ? 'Cancel image' : 'Cancel generation'}</button>}
          <label className="titlebar-render-anyway" title="Submit despite scene conflicts. Engine, models, and media must still be available."><input type="checkbox" checked={renderAnyway} onChange={(event) => setRenderAnyway(event.target.checked)} />Render anyway</label>
          {mode === 'reference' && <button className="titlebar-action titlebar-generate-image" type="button" onClick={() => void generateRef.current?.('image')} disabled={stillSubmitting}><ImagePlus size={14} />{stillSubmitting ? 'Generating…' : 'Generate image'}</button>}
        </div>}
        {(view === 'create' || view === 'ltx25' || view === 'zimage' || view === 'anime') && <button className="titlebar-action titlebar-reset" onClick={resetCurrentWorkspace} title="Reset prompts, options, media, selections, and the current preview in this workspace"><RotateCcw size={14} />Reset workspace</button>}
        {workspaceProjectScope(view, musicEngine) && <button className="titlebar-action titlebar-projects" onClick={() => setProjectManagerOpen(true)} title="Save, open, and manage full workspace projects"><FolderOpen size={14} /><span>Project: Current workspace</span><ChevronDown size={13} /></button>}
        <button className="titlebar-action titlebar-help" onClick={() => setHelpOpen(true)} title="Show tips for this workspace" aria-label="Show workspace tips"><HelpCircle size={15} />Tips</button>
        <button className="titlebar-action" onClick={() => { setLanOpen(true); void window.minimax.getLanStatus().then(setLanStatus) }} title="Share Oyama AI Video Studio over your local network"><QrCode size={14} />LAN</button>
      </header>

      {failedKeys.length > 0 && <section className="storage-failure" role="alert"><strong>Some changes have not been saved</strong><p>Local storage is full or unavailable. Keep this window open to preserve your current work, free storage space, then retry.</p><button type="button" className="secondary-button" onClick={retryLocalSave}>Retry saving</button></section>}
      <WorkspaceNavigator open={navigatorOpen} onOpenChange={setNavigatorOpen} view={view} engine={musicEngine} onNavigate={(next, engine) => { if (engine) setMusicEngine(engine); setView(next) }} onProjects={() => setProjectManagerOpen(true)} onTips={() => setHelpOpen(true)} onFind={openWorkspaceSearch} onReset={['create', 'ltx25', 'zimage'].includes(view) ? resetCurrentWorkspace : undefined} />
      {workspaceSearchOpen && <div className="workspace-search-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setWorkspaceSearchOpen(false) }}>
        <section className="workspace-search-dialog" role="dialog" aria-modal="true" aria-labelledby="workspace-search-title">
          <div className="workspace-search-input-wrap"><Search size={17} /><input ref={workspaceSearchInputRef} type="search" value={workspaceSearchQuery} onChange={(event) => setWorkspaceSearchQuery(event.target.value)} onKeyDown={handleWorkspaceSearchKeyDown} placeholder={`Search ${workspaceTips[view].title} settings`} autoComplete="off" spellCheck={false} aria-labelledby="workspace-search-title" /><kbd>Esc</kbd></div>
          <div className="workspace-search-heading"><span><strong id="workspace-search-title">Find workspace settings</strong><small>{workspaceSearchQuery ? `${workspaceSearchResults.length} matching setting${workspaceSearchResults.length === 1 ? '' : 's'} · select one to jump there` : `Search controls in ${workspaceTips[view].title}, then jump directly to one.`}</small></span><button type="button" className="icon-button" onClick={() => setWorkspaceSearchOpen(false)} aria-label="Close settings search"><X size={17} /></button></div>
          <div className="workspace-search-results" role="listbox" aria-label="Workspace setting results">
            {workspaceSearchResults.length === 0
              ? <div className="workspace-search-empty"><Search size={22} /><strong>No settings found</strong><span>Try a label such as resolution, duration, sampler, output, or preview.</span></div>
              : workspaceSearchResults.map((entry, index) => <button type="button" role="option" aria-selected={index === workspaceSearchIndex} className={`workspace-search-result ${index === workspaceSearchIndex ? 'selected' : ''}`} key={entry.id} onMouseEnter={() => setWorkspaceSearchIndex(index)} onClick={() => focusWorkspaceSearchEntry(entry)}><span><strong>{highlightWorkspaceSearchText(entry.label, workspaceSearchQuery)}</strong>{entry.context && <small>{highlightWorkspaceSearchText(entry.context, workspaceSearchQuery)}</small>}</span><kbd>↵</kbd></button>)}
          </div>
          <p className="workspace-search-help"><kbd>↑</kbd><kbd>↓</kbd> to move <span>·</span> <kbd>Enter</kbd> to jump <span>·</span> <kbd>Esc</kbd> to close</p>
        </section>
      </div>}

      {helpOpen && <WorkspaceTips view={view} onClose={() => setHelpOpen(false)} />}
      {compareOpen && <VideoCompare onClose={closeVideoCompare} />}
      {projectManagerOpen && <WorkspaceProjectManager activeScope={workspaceProjectScope(view, musicEngine)} projects={workspaceProjects} onClose={() => setProjectManagerOpen(false)} onSave={saveWorkspaceProject} onLoad={loadWorkspaceProject} onRename={renameWorkspaceProject} onDelete={deleteWorkspaceProject} feedback={notice} />}

      {sidebarOpen && <button className="mobile-sidebar-backdrop" aria-label="Close workspace menu" onClick={() => setSidebarOpen(false)} />}
      <aside className="sidebar" onClick={(event) => { if (window.innerWidth <= 680 && (event.target as HTMLElement).closest('button')) setSidebarOpen(false) }}>
        <div className="sidebar-top">
          <button className="icon-button sidebar-toggle" onClick={() => setSidebarOpen((value) => !value)} aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}><PanelLeftClose size={18} /></button>
        </div>
        <nav aria-label="Primary navigation">
          <div className="nav-group"><span className="nav-section-label">Create</span>
            <NavButton active={view === 'scratchpad'} icon={FileText} label="Scratchpad" onClick={() => setView('scratchpad')} />
            <NavButton active={view === 'create'} icon={WandSparkles} label="Video" onClick={() => { setCharacterHandoff(null); setView('create') }} />
            <NavButton active={view === 'continue'} icon={SkipForward} label="Continue" onClick={() => setView('continue')} />
            <NavButton active={view === 'zimage'} icon={ImageIcon} label="Image" onClick={() => setView('zimage')} />
            <NavButton active={view === 'anime'} icon={Palette} label="Anime" onClick={() => setView('anime')} />
            <NavButton active={view === 'referenceprep'} icon={Scan} label="Reference Prep" onClick={() => setView('referenceprep')} />
            <NavButton active={view === 'ltx25'} icon={Aperture} label="LTX 2.5" onClick={() => setView('ltx25')} />
            <NavButton active={view === 'music' && musicEngine === 'acestep'} icon={Music2} label="ACE-Step" onClick={() => { setMusicEngine('acestep'); setView('music') }} />
            <NavButton active={view === 'music' && musicEngine === 'music3'} icon={Music2} label="Music 3" onClick={() => { setMusicEngine('music3'); setView('music') }} />
          </div>
          <div className="nav-group"><span className="nav-section-label">Assets</span>
            <NavButton active={view === 'characters'} icon={Users} label="Characters" itemType="character" onClick={() => setView('characters')} />
            <NavButton active={view === 'hair'} icon={Scissors} label="Hair" onClick={() => setView('hair')} />
            <NavButton active={view === 'wardrobes'} icon={Shirt} label="Wardrobe" itemType="wardrobe" onClick={() => setView('wardrobes')} />
            <NavButton active={view === 'accessories'} icon={Watch} label="Accessories" onClick={() => setView('accessories')} />
            <NavButton active={view === 'locations'} icon={MapPin} label="Locations" itemType="location" onClick={() => setView('locations')} />
          </div>
          <div className="nav-group"><span className="nav-section-label">Project</span>
            <NavButton active={view === 'library'} icon={Library} label="Library" onClick={() => setView('library')} />
            <NavButton active={view === 'queue'} icon={ListVideo} label="Queue" count={pendingJobs.length} onClick={() => setView('queue')} />
            <NavButton active={view === 'movie'} icon={Clapperboard} label="Oyama AI Movie" onClick={() => setView('movie')} />
            <NavButton active={view === 'clipmaster'} icon={Film} label="Clip Master" onClick={() => setView('clipmaster')} />
          </div>
        </nav>
        <div className="sidebar-spacer" />
        <div className={`model-health ${modelReady ? 'healthy' : ''}`}>
          <HardDrive size={17} />
          <div><strong>{modelReady ? 'Models ready' : 'Models incomplete'}</strong><span>{models.length} local files indexed</span></div>
        </div>
        <NavButton active={view === 'settings'} icon={Settings} label="Settings" onClick={() => setView('settings')} />
      </aside>

      <main className="main-area" ref={mainAreaRef} aria-label={workspaceLabel(view, musicEngine)}>
        {!legacyMigrationDismissed && legacyMigration && (legacyMigration.available || legacyMigration.migrated) && <section className="legacy-migration-banner" aria-label="Previous Studio data migration"><div><strong>{legacyMigration.needsBrowserStorageRepair ? 'Restore your previous Studio projects and characters' : legacyMigration.migrated ? 'Previous Studio data is ready in Oyama' : 'Bring your previous Studio data into Oyama'}</strong><span>{legacyMigration.needsBrowserStorageRepair ? 'Settings were imported, but local characters, projects, and workspace state need one repair import. Open Settings to restore them.' : legacyMigration.migrated ? 'Your prior local profile was copied safely. You can rerun the import from Settings if you need to recover files added later.' : 'Import settings, saved intents, local projects, LAN pairing, and downloaded tools without replacing Oyama files.'}</span></div><div className="legacy-migration-banner-actions"><button type="button" className="secondary-button" onClick={() => setView('settings')}>Open Settings</button><button type="button" className="icon-button" onClick={dismissLegacyMigrationBanner} aria-label="Dismiss previous Studio migration notice" title="Dismiss"><X size={16} /></button></div></section>}
        {notice && <Notice tone={notice.tone} text={notice.text} onClose={() => setNotice(null)} />}
        <fieldset className="video-workspace-host" disabled={continuationPreparing} hidden={view !== 'create'} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>{continuationPreparing && <p role="status">Preparing continuation. Video controls will return when the beat is queued.</p>}
          <VideoWorkspaceShell onOpenNavigator={() => setNavigatorOpen(true)} key={`create-${createResetKey}`} sceneState={sceneState} setSceneState={setSceneState} onAnalyzeReference={path => analyzeSceneReference(settings, path)}
            projectName={workspaceProjects.find(project => project.id === activeWorkspaceProjectId && project.scope === workspaceProjectScope(view, musicEngine))?.name ?? 'Current workspace'} onOpenProjects={() => setProjectManagerOpen(true)} onNavigate={(nextView, engine) => { if (engine) setMusicEngine(engine); setView(nextView) }} onReset={resetCurrentWorkspace} historyJobs={jobs.filter(job => job.provider === 'minimax').slice(0, 12)} onSelectJob={selectActiveJob} onGenerate={() => void generateRef.current?.('video', renderAnyway)} onGenerateStill={() => void generateRef.current?.('image')} onCancel={() => { if (activeRenderJob) void cancelJob(activeRenderJob) }} activeRenderJob={activeRenderJob} cancelling={Boolean(activeRenderJob && cancellingIds.has(activeRenderJob.id))} onOpenSettings={() => setView('settings')} onOpenCompare={() => setCompareOpen(true)} compareOpen={compareOpen}
            info={info}
            gpuRoutingSummary={h3GpuRouting?.summary ?? 'GPU Routing: Auto'}
            gpuRoutingWarning={h3GpuRouting?.vramWarnings[0] ?? h3GpuRouting?.warnings[0]}
            renderIntents={settings.renderSettingsPresets}
            onApplyIntent={(intent) => {
              const values = intent.values
              setResolution(values.resolution); setDuration(values.duration); setTurbo(values.turbo); setTurbo8Profile(values.turbo8Profile); setTextEncoderPreference(values.textEncoderPreference); setSteps(values.steps); setSampler(values.sampler); setScheduler(values.scheduler); setExperimentalSampling(values.experimentalSampling); setRefImageSize(values.refImageSize); setLiveEnabled(values.livePreview); setSigmaShiftMode(values.sigmaShiftMode); setShiftVideo(values.shiftVideo); setShiftAudio(values.shiftAudio); setLoraStrength(values.loraStrength); setUpscaleMode(values.upscaleMode); setH3RefineSteps(values.h3RefineSteps ?? workspaceDefaults.h3RefineSteps); setH3RefineDenoise(values.h3RefineDenoise ?? workspaceDefaults.h3RefineDenoise)
              setUserLoras(values.userLoras.map((item) => ({ ...item }))); setRtxModel(values.rtxModel); setLivePreviewMode(values.livePreviewMode); setNoDialogue(values.noDialogue); setNaturalMovement(values.naturalMovement); setClothingPolicy(values.clothingPolicy); setSeed(values.seed); if (mode === 'reference') setRef2vaSeed(values.seed); setSeedLocked(values.seedLocked)
              setNotice({ tone: 'success', text: `Intent “${intent.name}” applied to this Ref2VA workspace.` })
            }}
            onSaveIntent={(name, values) => {
              const now = Date.now()
              const existing = settings.renderSettingsPresets.find((intent) => intent.name.toLowerCase() === name.toLowerCase())
              const intent: RenderSettingsPreset = { id: existing?.id ?? createId(), name, values, createdAt: existing?.createdAt ?? now, updatedAt: now }
              const next = { ...settings, renderSettingsPresets: [...settings.renderSettingsPresets.filter((item) => item.id !== intent.id), intent] }
              setSettings(next)
              void window.minimax.saveSettings(next).catch(() => setNotice({ tone: 'error', text: 'Intent was created for this session, but could not be saved.' }))
              setNotice({ tone: 'success', text: `Intent “${name}” saved and ready to use.` })
            }}
            onDeleteIntent={(intent) => {
              const next = { ...settings, renderSettingsPresets: settings.renderSettingsPresets.filter((item) => item.id !== intent.id) }
              setSettings(next)
              void window.minimax.saveSettings(next).catch(() => setNotice({ tone: 'error', text: 'Intent was removed for this session, but settings could not be saved.' }))
            }}
            sampler={sampler} setSampler={setSampler} scheduler={scheduler} setScheduler={setScheduler}
            experimentalSampling={experimentalSampling} setExperimentalSampling={setExperimentalSampling}
            refImageSize={refImageSize} setRefImageSize={setRefImageSize}
            noDialogue={noDialogue} setNoDialogue={setNoDialogue}
            naturalMovement={naturalMovement} setNaturalMovement={setNaturalMovement}
            clothingPolicy={clothingPolicy} setClothingPolicy={setClothingPolicy}
            sigmaShiftMode={sigmaShiftMode} setSigmaShiftMode={setSigmaShiftMode}
            shiftVideo={shiftVideo} setShiftVideo={setShiftVideo} shiftAudio={shiftAudio} setShiftAudio={setShiftAudio}
            loraStrength={loraStrength} setLoraStrength={setLoraStrength}
            liveEnabled={liveEnabled} setLiveEnabled={setLiveEnabled} livePreviewMode={livePreviewMode} setLivePreviewMode={setLivePreviewMode} liveConnected={live.connected} livePreview={live.preview} blurNsfwPreview={settings.blurNsfwLivePreviews}
            upscaleMode={upscaleMode} setUpscaleMode={setUpscaleMode} h3ProReview={h3ProReview} setH3ProReview={setH3ProReview} h3ProRefineSteps={h3ProRefineSteps} setH3ProRefineSteps={setH3ProRefineSteps} h3RefineSteps={h3RefineSteps} setH3RefineSteps={setH3RefineSteps} h3RefineDenoise={h3RefineDenoise} setH3RefineDenoise={setH3RefineDenoise} h3LearnedUpscaleAvailable={h3LearnedUpscaleReady} h3LearnedUpscaleMissingNodes={missingH3LearnedUpscaleNodes} h3LearnedUpscaleModelDetected={Boolean(h3LearnedUpscaleModel)} h3LearnedUpscaleDirectory={h3LearnedUpscaleDirectory} ltxAvailable={ltxUpscaleReady} ltxMissingNodes={missingLtxUpscaleNodes}
            rtxModels={rtxModels} rtxModel={rtxModel} setRtxModel={setRtxModel}
            updateReference={(index, file) => setReferenceImages((items) => items.map((item, i) => i === index ? file : item))}
            mode={mode}
            setMode={setMode}
            prompt={prompt}
            setPrompt={setPrompt}
            duration={duration}
            setDuration={setDuration}
            resolution={resolution}
            setResolution={setResolution}
            turbo={turbo}
            setTurbo={setTurbo}
            turbo8Profile={turbo8Profile}
            setTurbo8Profile={setTurbo8Profile}
            userLoras={userLoras}
            setUserLoras={setUserLoras}
            userLoraChoices={userLoraChoices}
            textEncoderPreference={textEncoderPreference}
            setTextEncoderPreference={setTextEncoderPreference}
            steps={steps}
            setSteps={setSteps}
            seed={seed}
            setSeed={(value) => { setSeed(value); if (mode === 'reference') setRef2vaSeed(value) }}
            seedLocked={seedLocked}
            setSeedLocked={setSeedLocked}
            advanced={advanced}
            setAdvanced={setAdvanced}
            firstFrame={firstFrame}
            lastFrame={lastFrame}
            setFirstFrame={setFirstFrame}
            setLastFrame={setLastFrame}
            chooseMedia={chooseMedia}
            referenceImages={referenceImages}
            characters={characterProjects}
            wardrobes={wardrobeProjects}
            locations={locationProjects}
            accessories={accessoryProjects}
            selectedCharacterIds={selectedReferenceCharacterIds}
            selectedLocationIds={selectedReferenceLocationIds}
            removeCharacter={removeWorkspaceCharacter}
            characterDetailReferencesEnabled={settings.characterDetailReferencesEnabled}
            loadCharacter={(characterId) => void loadReferenceCharacter(characterId)}
            loadWardrobe={(wardrobeId) => void loadReferenceWardrobe(wardrobeId)}
            loadLocation={(locationId) => void loadReferenceLocation(locationId)}
            loadAccessory={(accessoryId) => void loadReferenceAccessory(accessoryId)}
            refreshSourceMedia={refreshSourceMedia}
            referenceVideos={referenceVideos}
            referenceAudios={referenceAudios}
            removeReference={(kind, index) => {
              if (kind === 'image') {
                const file = referenceImages[index]
                if (!file) return
                const previous = workspaceBindingsFor(selectedReferenceCharacterIds, selectedReferenceLocationIds)
                const binding = previous.find(item => item.file.path === file.path)
                if (binding?.characterId || binding?.locationId) {
                  const characterIds = binding.characterId ? selectedReferenceCharacterIds.filter(id => id !== binding.characterId) : selectedReferenceCharacterIds
                  const locationIds = binding.locationId ? selectedReferenceLocationIds.filter(id => id !== binding.locationId) : selectedReferenceLocationIds
                  setSelectedReferenceCharacterIds(characterIds)
                  setSelectedReferenceLocationIds(locationIds)
                  void applyWorkspaceBindings(previous, workspaceBindingsFor(characterIds, locationIds))
                } else {
                  setReferenceImages(items => items.filter((_, itemIndex) => itemIndex !== index))
                  setPrompt(current => syncReferencePrompt(current, previous, []))
                  setPromptSuggestion('')
                  setPromptSuggestionId('')
                }
              }
              if (kind === 'video') setReferenceVideos((items) => items.filter((_, itemIndex) => itemIndex !== index))
              if (kind === 'audio') setReferenceAudios((items) => items.filter((_, itemIndex) => itemIndex !== index))
              setPromptSuggestion('')
              setPromptSuggestionId('')
            }}
            chooseReference={chooseMany}
            editVideoReference={(index) => void editVideoReference(index)}
            h3Validated={h3Report.validated}
            modelReady={modelReady}
            selection={selection}
             submitting={submitting}
             stillSubmitting={stillSubmitting}
             renderAnyway={renderAnyway}
            connected={status.connected}
             onSendStillToI2v={(job, provider) => void sendStillToI2v(job, provider)}
            latestJob={activeJobId ? jobs.find((job) => job.id === activeJobId) : undefined}
            onOpenContinuation={() => setContinuationOpenRequest(current => nextContinuationOpenRequest(current))} onContinue={startVideoContinuation}
            onContinueReference={startRef2vaContinuation}
            onContinueH3Pro={continueH3Pro}
            ollamaAvailable={ollamaModels.length > 0}
            ollamaModel={llmConnection.model}
            llmProviderLabel={llmConnection.label}
            promptSuggestion=""
            promptingTool={promptingTool}
            dialogueGenerating={dialogueGenerating}
            onPromptTool={(tool) => void runPromptTool(tool)}
            onGenerateDialogue={generateCharacterDialogue}
            onUseSuggestion={() => { setPrompt(promptSuggestion); setPromptSuggestion(''); setPromptSuggestionId('') }}
            onDismissSuggestion={() => { setPromptSuggestion(''); setPromptSuggestionId('') }}
          />
        </fieldset>
        {view === 'scratchpad' && <ScratchpadWorkspace provider={llmConnection.provider} url={llmConnection.url} model={llmConnection.model} models={ollamaModels} available={ollamaModels.length > 0} checking={localLlmChecking} connectionError={localLlmStatus?.error} onRefresh={() => void refreshOllama(settings, true)} onModelChange={changeCopilotModel} onSend={sendScratchpadPrompt} onNotice={(tone, text) => setNotice({ tone, text })} />}
        {view === 'ltx25' && <Ltx25Workspace key={`ltx-${ltxResetKey}`}
          settings={settings}
          models={ltxSelection}
          pipelineReady={LTX_NATIVE_REQUIRED_NODES.every((node) => Boolean(info[node]))}
          missingNodes={LTX_NATIVE_REQUIRED_NODES.filter((node) => !info[node])}
          connected={status.connected}
          liveConnected={live.connected}
          livePreview={live.preview}
          blurNsfwPreview={settings.blurNsfwLivePreviews}
          samplingPreviewNodeType={ltxSamplingPreviewOverrideNode}
          msrEnabled={settings.experimentalLtxMsrEnabled}
          msrReady={Boolean(info.ComfyUILTX25MSRICLoRALoader && info.ComfyUILTX25MSRMultiReferenceGuide)}
          msrLoras={choices(info, 'ComfyUILTX25MSRICLoRALoader', 'lora_name').filter((name) => /licon.*msr|msr.*licon/i.test(name))}
          latestJob={jobs.find((job) => job.provider === 'ltx25' && job.promptId === live.preview?.promptId) ?? jobs.find((job) => job.provider === 'ltx25' && job.createdAt > ltxResetAt)}
          submitting={ltxSubmitting}
          cancelling={Boolean(jobs.find((job) => job.provider === 'ltx25' && ['queued', 'running'].includes(job.status)) && cancellingIds.has(jobs.find((job) => job.provider === 'ltx25' && ['queued', 'running'].includes(job.status))!.id))}
          ollamaAvailable={ollamaModels.length > 0}
          onChooseImage={chooseLtxImage}
          onGenerate={(options, file) => void generateLtx(options, file)}
          onCancel={(job) => void cancelJob(job)}
        />}
        {view === 'music' && musicEngine === 'acestep' && <AceStepWorkspace key={`acestep-${aceResetKey}`}
          settings={settings}
          models={aceSelection}
          connected={status.connected}
          pipelineReady={ACE_STEP_REQUIRED_NODES.every((node) => Boolean(info[node]))}
          missingNodes={ACE_STEP_REQUIRED_NODES.filter((node) => !info[node])}
          latestJob={jobs.find((job) => job.provider === 'acestep')}
          submitting={aceSubmitting}
          cancelling={Boolean(jobs.find((job) => job.provider === 'acestep' && ['queued', 'running'].includes(job.status)) && cancellingIds.has(jobs.find((job) => job.provider === 'acestep' && ['queued', 'running'].includes(job.status))!.id))}
          ollamaAvailable={ollamaModels.length > 0}
          onGenerate={(options) => void generateAceStep(options)}
          onCancel={(job) => void cancelJob(job)}
          onSelectMusic3={() => setMusicEngine('music3')}
        />}
        {view === 'music' && musicEngine === 'music3' && <Music3Workspace key={`music3-${music3ResetKey}`}
          settings={settings}
          models={music3Selection}
          connected={status.connected}
          pipelineReady={MUSIC3_REQUIRED_NODES.every((node) => Boolean(info[node]))}
          missingNodes={MUSIC3_REQUIRED_NODES.filter((node) => !info[node])}
          latestJob={jobs.find((job) => job.provider === 'music3')}
          submitting={music3Submitting}
          ollamaAvailable={ollamaModels.length > 0}
          cancelling={Boolean(jobs.find((job) => job.provider === 'music3' && ['queued', 'running'].includes(job.status)) && cancellingIds.has(jobs.find((job) => job.provider === 'music3' && ['queued', 'running'].includes(job.status))!.id))}
          onGenerate={(options) => void generateMusic3(options)}
          onCancel={(job) => void cancelJob(job)}
          onSelectAceStep={() => setMusicEngine('acestep')}
        />}
        <div hidden={view !== 'zimage'}><ZImageWorkspace key={`first-frame-${zImageResetKey}`} url={settings.comfyUrl} info={info} connected={status.connected} ollamaAvailable={ollamaModels.length > 0} llmProvider={llmConnection.provider} ollamaUrl={llmConnection.url} ollamaModel={llmConnection.model} outputDirectory={activeOutputDirectory} attentionBackend={resolvedH3AttentionBackend} gpuRouting={h3GpuRouting?.workflow} onUse={(file, frameResolution) => {
          setFirstFrame(file); setResolution(snapToMinimaxResolution(frameResolution)); setMode('image'); setActiveJobId(null); setView('create'); setNotice({ tone: 'success', text: 'Z-Image frame loaded into the MiniMax I2V workspace.' })
        }} onUseLtx={(file) => void sendGeneratedStillToLtx(file)} /></div>
        <div hidden={view !== 'anime'}><AnimeWorkspace key={`anime-${animeResetKey}`} url={settings.comfyUrl} info={info} connected={status.connected} ollamaAvailable={ollamaModels.length > 0} llmProvider={llmConnection.provider} ollamaUrl={llmConnection.url} ollamaModel={llmConnection.model} outputDirectory={activeOutputDirectory} onUse={(file, frameResolution) => {
          setFirstFrame(file); setResolution(snapToMinimaxResolution(frameResolution)); setMode('image'); setActiveJobId(null); setView('create'); setNotice({ tone: 'success', text: 'Anime frame loaded into the MiniMax I2V workspace.' })
        }} onUseLtx={(file) => void sendGeneratedStillToLtx(file)} /></div>
        {view === 'referenceprep' && <ReferencePrepStudio settings={settings} info={info} connected={status.connected} onUseCutout={(file) => {
          setReferenceImages((current) => current.some((item) => item.path === file.path) ? current : [...current, file].slice(0, 9))
          setMode('reference'); setActiveJobId(null); setView('create')
          setNotice({ tone: 'success', text: 'BiRefNet cutout added as a preserved subject reference. The original source remains available in Reference Prep.' })
        }} onNotice={(tone, text) => setNotice({ tone, text })} onOpenStudio={setView} />}
        {view === 'characters' && <CharacterStudio settings={settings} info={info} connected={status.connected} ollamaAvailable={ollamaModels.length > 0} automationJobs={jobs.filter((job) => job.characterProjectId)} onNotice={(tone, text) => setNotice({ tone, text })} onCreateTurntable={generateCharacterIdentitySurvey} onUseInScene={(characterId) => { void loadReferenceCharacter(characterId); setMode('reference'); setView('create') }} onOpenLibrary={setView} />}
        {view === 'hair' && <HairStudio settings={settings} info={info} connected={status.connected} ollamaAvailable={ollamaModels.length > 0} onNotice={(tone, text) => setNotice({ tone, text })} />}
        {view === 'wardrobes' && <WardrobeStudio settings={settings} info={info} connected={status.connected} onNotice={(tone, text) => setNotice({ tone, text })} />}
        {view === 'accessories' && <AccessoryStudio settings={settings} info={info} connected={status.connected} onNotice={(tone, text) => setNotice({ tone, text })} />}
        {view === 'locations' && <LocationStudio settings={settings} info={info} connected={status.connected} ollamaAvailable={ollamaModels.length > 0} automationJobs={jobs.filter((job) => job.locationProjectId)} onNotice={(tone, text) => setNotice({ tone, text })} onCreateWalkthrough={(project: LocationProject, options?: { duration: number; cameraLanguage: string }) => {
          if (!project.baseImage) return Promise.resolve('Approve a location image before rendering the walkthrough.')
          const firstFrame = project.baseImage
          const walkthroughDirection = project.environmentMode === 'nature'
            ? `Comprehensive cinematic natural-landscape survey of ${project.name}. Begin with a wide establishing view, then move slowly through the terrain in one continuous stabilized path. Deliberately reveal landforms, vegetation zones, water features, rock formations, horizon lines, and their spatial relationships. Preserve the exact terrain, ecology, vegetation placement, lighting, weather, and geography from the first frame. Untouched nature only: no buildings, cabins, houses, ruins, roads, streets, bridges, fences, signs, vehicles, power lines, utility poles, constructed paths, or other human-made objects.`
            : `Comprehensive cinematic location walkthrough reference video of ${project.name}. Begin with a wide establishing view, then move slowly along the perimeter in one continuous stabilized path. Deliberately pan through every important zone and spatial connection, revealing entrances, landmarks, surfaces, fixtures, terrain, and object placement. Preserve exactly the same architecture, dimensions, materials, lighting, weather, and geography from the first frame.`
          const locationProfile = [project.description, project.locationContext !== 'mixed' && `Authoritative ${project.locationContext} setting.`, project.atmosphere && `Atmosphere and lighting: ${project.atmosphere}.`, project.timeOfDay && `Time and weather: ${project.timeOfDay}.`, project.continuityAnchors && `Fixed continuity anchors: ${project.continuityAnchors}.`, project.accuracyDetails && `Must-match location details: ${project.accuracyDetails}.`, project.visualStyle && `Visual treatment: ${project.visualStyle}.`].filter(Boolean).join(' ')
          const cameraLanguage = options?.cameraLanguage ?? 'Use only wide and extra-wide shots with an 18–24mm lens. Begin with a complete establishing view, then move slowly and smoothly to reveal the environment’s spatial relationships. Never use close-ups.'
          const clarityDirection = 'Maintain crisp, sharp frames with a fast shutter and slow stabilized camera movement. No motion blur, temporal smearing, ghosting, rolling-shutter distortion, speed ramps, whip pans, or rapid camera movement.'
          return generateLtx({ mode: 'image', prompt: `${walkthroughDirection} Location description: ${locationProfile} Camera language: ${cameraLanguage} Image clarity: ${clarityDirection} No cuts, no teleporting, no layout changes, no duplicated objects, no people as focal subjects, no dialogue, no text, no logos.`, width: 1344, height: 768, duration: Math.max(5, Math.min(20, options?.duration ?? 10)), preset: 'quality', seed: Math.floor(Math.random() * 1_000_000_000), filenamePrefix: 'MiniMax_location_walkthrough' }, firstFrame, { locationProjectId: project.id })
        }} />}
        {view === 'queue' && <JobsView title="Queue" note="Running and recent local generations" jobs={jobs} empty="No generations have been queued." cancellingIds={cancellingIds} onCancel={cancelJob} onDelete={deleteGeneration} />}
        <div hidden={view !== 'continue'}><ContinueWorkspace openRequest={continuationOpenRequest} jobs={jobs} connected={status.connected} liveConnected={live.connected} motionReady={continuationNodesReady} assemblyReady={continuationAssemblyReady} missingNodes={missingContinuationNodes} livePreview={live.preview} cancellingIds={cancellingIds} onChooseVideo={async () => { const picked = await window.minimax.chooseMedia('video'); return picked ? { ...picked, kind: 'video', preview: await window.minimax.mediaUrl(picked.path) } : null }} onChooseImage={async () => { const picked = await window.minimax.chooseMedia('image'); return picked ? { ...picked, kind: 'image', preview: await window.minimax.mediaUrl(picked.path) } : null }} onGenerate={generateContinuationBeat} onCancel={cancelJob} onResetSource={() => setContinuationOpenRequest(current => ({ ...current, sourceId: null }))} /></div>
        {(view === 'movie' || (view === 'clipmaster' && clipMasterFromMovie)) && <div className="movie-integrated" hidden={view !== 'movie'}><div className="movie-workspace-heading"><div><h1>Oyama AI Movie</h1><p>Assemble renders, refine clips, and send frames to H3 or LTX.</p></div><button className="secondary-button" onClick={() => void window.minimax.openMovieEditor()}><ExternalLink size={15} />Open separate window</button></div><MovieEditor settings={settings} jobs={jobs} onCreate={(kind) => setView(kind === 'music' ? 'music' : 'ltx25')} onNotice={(tone, text) => setNotice({ tone, text })} onOpenClipMaster={clip => { setClipMasterClip(clip); setClipMasterFromMovie(true); setView('clipmaster') }} onUseFrame={receiveMovieFrame} /></div>}
        {view === 'library'  && <LibraryView onDelete={deleteGeneration} jobs={jobs.filter((job) => job.status === 'completed')} settings={settings} onEdit={() => setView('movie')} onCreate={() => setView('create')} onUseLtx={loadStartFrameInLtx} onUseLastFrameReference={addVideoLastFrameAsReference} onNotice={(tone, text) => setNotice({ tone, text })} />}
        {view === 'clipmaster' && <ClipMasterBeta onUseFrame={receiveMovieFrame} clip={clipMasterClip ?? undefined} jobs={jobs} settings={settings} onClose={() => { setClipMasterClip(null); setView(clipMasterFromMovie ? 'movie' : 'library') }} onNotice={(tone, text) => setNotice({ tone, text })} onExportClip={clipMasterFromMovie ? clip => window.dispatchEvent(new CustomEvent('oyama-movie-add-media', { detail: clip })) : undefined} />}
        {view === 'settings' && <SettingsView settings={settings} setSettings={setSettings} info={info} models={models} jobs={jobs} gpu={gpu} h3Report={h3Report} scanning={scanning} status={status} checking={checking} diagnosticRunning={diagnosticRunning} benchmarkRunning={benchmarkRunning} benchmarkConfig={benchmarkConfig} setBenchmarkConfig={setBenchmarkConfig} benchmarkResults={benchmarkResults} ollamaModels={ollamaModels} localLlmStatus={localLlmStatus} localLlmChecking={localLlmChecking} legacyMigration={legacyMigration} legacyMigrationRunning={legacyMigrationRunning} onRefreshOllama={() => void refreshOllama(settings, true)} onScan={() => void scanModels(settings)} onCheck={() => void checkConnection(settings.comfyUrl)} onSave={() => void saveAppSettings()} onApplyDefaults={applyGenerationDefaults} onRunDiagnostics={() => void runH3Diagnostics()} onRunBenchmark={() => void runH3Benchmark()} onRunLegacyMigration={() => void runLegacyMigration()} onFactoryReset={() => void factoryResetWorkspace()} />}
      </main>
      <footer className="status-bar" aria-label="Application status">
        <span className="status-bar-context"><Film size={14} /><strong>{workspaceLabel(view, musicEngine)}</strong></span>
        <span className="status-bar-divider" aria-hidden="true" />
        {view === 'create' && <span className="status-bar-attention" aria-label="MiniMax H3 attention controls">
          <span>Attention</span>
          <select value={settings.attentionBackend === 'sol' ? 'automatic' : settings.attentionBackend} onChange={(event) => setSettings({ ...settings, attentionBackend: event.target.value as AppSettings['attentionBackend'] })} aria-label="H3 attention backend">
            <option value="automatic">Auto</option><option value="kitchen">Kitchen</option><option value="sage">Sage</option><option value="native">Native</option>
          </select>
          <button type="button" className={`sol-toggle ${settings.attentionBackend === 'sol' ? 'on' : ''}`} disabled={!solAttentionNode} onClick={() => setSettings({ ...settings, attentionBackend: settings.attentionBackend === 'sol' ? 'automatic' : 'sol', h3ParallelAttentionEnabled: false })} title={solAttentionNode ? 'Sol on uses Sol-Attn for MiniMax H3. SageAttention remains the launch-level dense fallback.' : 'SolAttnH3 was not detected by ComfyUI.'}>
            <Gauge size={12} />Sol {settings.attentionBackend === 'sol' ? 'On' : 'Off'}
          </button>
        </span>}
        {activeRenderRuntime !== undefined && <span className={`status-bar-runtime ${activeRenderJob?.status === 'running' || activeRenderJob?.status === 'queued' ? 'active' : ''}`} role="status" title={activeRenderJob?.status === 'running' && activeEngineRuntime !== undefined ? 'ComfyUI engine time. Queue wait is shown separately when known.' : 'Time since this render was submitted locally.'}><Clock3 size={13} />{activeRenderJob?.status === 'queued' ? 'Queue' : activeRenderJob?.status === 'running' ? 'Engine' : 'Render'} · {formatRuntime(activeEngineRuntime ?? activeRenderRuntime)}{activeRenderJob?.status === 'running' && activeQueueWait !== undefined && activeQueueWait > 0 && <small>Queued {formatRuntime(activeQueueWait)}</small>}</span>}
        {activeSamplerProgress && <span className="status-bar-sampler" title={`ComfyUI render progress: ${activeSamplerProgress.currentStep} of ${activeSamplerProgress.totalSteps} sampler steps (${activeSamplerProgress.progress}%). ${activeSamplerProgress.rate ? `Measured pace ${formatStepDuration(activeSamplerProgress.rate)}.` : 'Measuring sampler pace.'} ${activeSamplerProgress.stepOverdueBy !== undefined ? `The next step is taking ${formatStepCountdown(activeSamplerProgress.stepOverdueBy)} longer than the measured pace; decoding, preview work, or system load may be delaying it.` : activeSamplerProgress.currentStep < activeSamplerProgress.totalSteps && activeSamplerProgress.nextStepIn !== undefined ? `Next sampler step expected in ${formatStepCountdown(activeSamplerProgress.nextStepIn)}.` : ''} ${activeSamplerProgress.remainingMs !== undefined ? `Estimated ${formatRuntime(activeSamplerProgress.remainingMs)} remaining.` : 'Remaining-time estimate will appear after another sampler step is measured.'}`}><Gauge size={13} /><strong>{activeSamplerProgress.progress}%</strong><span className="sampler-step">Step {activeSamplerProgress.currentStep}/{activeSamplerProgress.totalSteps}</span>{activeSamplerProgress.rate && <span className="sampler-rate">{formatStepDuration(activeSamplerProgress.rate)}</span>}{activeSamplerProgress.currentStep < activeSamplerProgress.totalSteps && activeSamplerProgress.nextStepIn !== undefined && <span className={`sampler-countdown ${activeSamplerProgress.stepOverdueBy !== undefined ? 'delayed' : ''}`}><Clock3 size={12} />{activeSamplerProgress.stepOverdueBy !== undefined ? `Waiting +${formatStepCountdown(activeSamplerProgress.stepOverdueBy)}` : `Next ${formatStepCountdown(activeSamplerProgress.nextStepIn)}`}</span>}{activeSamplerProgress.remainingMs !== undefined && <span className="sampler-estimate">ETA ~{formatRuntime(activeSamplerProgress.remainingMs)}</span>}</span>}
        {view === 'create' && <span className="status-bar-render-estimate" title={plannedRenderEstimate ? `Estimated from ${plannedRenderEstimate.sampleCount} completed H3 render${plannedRenderEstimate.sampleCount === 1 ? '' : 's'} on this GPU. Queue wait is excluded.` : 'This estimate learns from completed H3 video renders on the detected GPU.'}><Clock3 size={13} />{plannedRenderEstimate ? `Est. render ~${formatRuntime(plannedRenderEstimate.milliseconds)}` : 'Est. render · learning'}</span>}
        <button type="button" className={`working-seed ${view === 'create' && mode === 'reference' || seed === ref2vaSeed ? 'matching' : 'mismatch'}`} onClick={() => { setSeed(ref2vaSeed); setSeedLocked(true); setNotice({ tone: 'success', text: `Working seed synchronized to Ref2VA seed ${ref2vaSeed}.` }) }} title={view === 'create' && mode === 'reference' ? `Ref2VA working seed ${ref2vaSeed} is authoritative.` : seed === ref2vaSeed ? `Working seed ${seed} matches the Ref2VA seed.` : `Current workspace seed ${seed} differs from Ref2VA seed ${ref2vaSeed}. Click to synchronize.`} aria-label={view === 'create' && mode === 'reference' ? `Ref2VA working seed ${ref2vaSeed}` : seed === ref2vaSeed ? `Working seed ${seed}, matches Ref2VA` : `Working seed ${seed}, click to use Ref2VA seed ${ref2vaSeed}`}><Dices size={13} /><span>Working seed</span><strong>{view === 'create' && mode === 'reference' ? ref2vaSeed : seed}</strong>{view !== 'create' || mode !== 'reference' ? seed !== ref2vaSeed && <small>· Ref2VA {ref2vaSeed}</small> : <small>· source</small>}</button>
        <span className="status-bar-spacer" />
        {h3ProReview && pendingH3ProJob && <button type="button" className="status-bar-continue-upscale" disabled={submitting} onClick={() => { selectActiveJob(pendingH3ProJob.id); setView('create'); void continueH3Pro(pendingH3ProJob) }} title="The first H3 pass is ready. Review it, then continue the learned 2× latent upscale and refinement.">{submitting ? <LoaderCircle className="spin" size={13} /> : <Sparkles size={13} />}<span>Continue upscale</span></button>}
        <GpuMeter value={gpu} />
        <button className={`connection-chip ${status.connected ? 'online' : ''}`} onClick={() => void checkConnection(settings.comfyUrl)} title="Check ComfyUI connection">
          {checking ? <LoaderCircle size={14} className="spin" /> : <span className="status-dot" />}
          {status.connected ? `Local engine · ${status.latencyMs} ms` : 'Engine offline'}
        </button>
      </footer>
      {lanOpen && <LanCompanionDialog status={lanStatus} qr={lanQr} onRotate={async () => setLanStatus(await window.minimax.rotateLanToken())} onClose={() => setLanOpen(false)} />}
      {videoClipDraft && <VideoReferenceClipper source={videoClipDraft.source} onClose={() => setVideoClipDraft(null)} onCreate={createVideoReferenceClip} />}

    </div>
  )
}

function LanCompanionDialog({ status, qr, onRotate, onClose }: { status: LanStatus; qr: { mobile: string; desktop: string }; onRotate(): Promise<void>; onClose(): void }) {
  const [rotating, setRotating] = useState(false)
  const desktopUrl = status.desktopUrl ?? status.url?.replace('?mobile=1', '?desktop=1') ?? ''
  return <div className="lan-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="lan-dialog" role="dialog" aria-modal="true" aria-labelledby="lan-dialog-title">
      <header><div><QrCode size={20} /><span><strong id="lan-dialog-title">Share over your LAN</strong><small>Touch-first mobile creation or the complete Studio interface</small></span></div><button className="icon-button" onClick={onClose} aria-label="Close LAN sharing"><X size={18} /></button></header>
      {status.running && status.url ? <div className="lan-dialog-body">
        <div className="lan-instructions"><span className="lan-ready"><Check size={15} />LAN server ready</span><h2>Open on another device</h2><p>Scan the experience you want on a phone, tablet, or computer connected to the same trusted Wi-Fi or LAN.</p></div>
        <div className="lan-share-grid">
          <article className="lan-share-card"><div className="lan-qr">{qr.mobile ? <img src={qr.mobile} alt="QR code for the touch-first mobile MiniMax workspace" /> : <LoaderCircle className="spin" aria-label="Preparing mobile QR code" />}</div><div><strong>Touch-first mobile creation</strong><small>Fast controls for creating and monitoring shots from a phone.</small><label>Mobile address<input readOnly value={status.url} onFocus={(event) => event.currentTarget.select()} /></label></div></article>
          <article className="lan-share-card"><div className="lan-qr">{qr.desktop ? <img src={qr.desktop} alt="QR code for the complete Oyama AI Video Studio interface" /> : <LoaderCircle className="spin" aria-label="Preparing Studio QR code" />}</div><div><strong>Complete Studio interface</strong><small>Full workspace for desktop or tablet editing and production.</small><label>Studio address<input readOnly value={desktopUrl} onFocus={(event) => event.currentTarget.select()} /></label></div></article>
        </div>
        <small className="lan-security-note">The full Studio view shares the interface and browser-local project state. Hardware generation and local-file access remain protected by authenticated LAN services. Windows Firewall may ask to allow private-network access the first time.</small>
      </div> : <div className="lan-dialog-error"><AlertCircle size={22} /><span><strong>Mobile server unavailable</strong><p>{status.error ?? 'Restart Oyama AI Video Studio, then try again.'}</p></span></div>}
      <footer><button className="secondary-button" disabled={rotating || !status.running} title="Invalidate previously scanned mobile links" onClick={async () => { if (!window.confirm('Rotate the mobile access link? Previously scanned links will stop working.')) return; setRotating(true); try { await onRotate() } finally { setRotating(false) } }}><RotateCcw size={14} />{rotating ? 'Rotating…' : 'Rotate access link'}</button><button className="primary-button" onClick={onClose}>Done</button></footer>
    </section>
  </div>
}

function GpuMeter({ value }: { value: GpuTelemetry | null }) {
  const usage = value?.usagePercent
  const vram = value?.vramPercent
  const available = Boolean(value?.available && usage !== undefined && vram !== undefined)
  const title = available ? `${value?.name ?? 'GPU'} · ${usage}% utilization · ${vram}% VRAM (${value?.vramUsedMb ?? 0} / ${value?.vramTotalMb ?? 0} MB)` : 'GPU telemetry unavailable'
  return <div className={`gpu-meter ${available ? 'available' : ''}`} title={title} aria-label={title}><Gauge size={14} /><span><small>GPU</small><strong>{available ? `${usage}%` : '—'}</strong></span><i aria-hidden="true"><b style={{ width: `${available ? usage : 0}%` }} /></i><span><small>VRAM</small><strong>{available ? `${vram}%` : '—'}</strong></span></div>
}

function WorkspaceProjectManager({ activeScope, projects, onClose, onSave, onLoad, onRename, onDelete, feedback }: { feedback: { tone: 'error' | 'success' | 'neutral'; text: string } | null; activeScope: WorkspaceProjectScope | null; projects: WorkspaceProject[]; onClose(): void; onSave(name: string, scope: WorkspaceProjectScope): boolean; onLoad(project: WorkspaceProject): void; onRename(project: WorkspaceProject): void; onDelete(project: WorkspaceProject): void }) {
  const [name, setName] = useState('')
  const [filter, setFilter] = useState<'all' | WorkspaceProjectScope>('all')
  const visibleProjects = projects.filter((project) => filter === 'all' || project.scope === filter)
  const details = (project: WorkspaceProject) => {
    const prompt = ['prompt', 'metadata', 'vocals', 'arrangement', 'lyrics'].map(key => typeof project.snapshot[key] === 'string' ? project.snapshot[key] : '').join(' ').trim()
    const references = ['referenceImages', 'referenceVideos', 'referenceAudios', 'msrReferences'].reduce((total, key) => total + (Array.isArray(project.snapshot[key]) ? project.snapshot[key].length : 0), 0) + (project.snapshot.firstFrame ? 1 : 0)
    return `${prompt ? `${prompt.length.toLocaleString()} character prompt` : 'No prompt'} · ${references} media reference${references === 1 ? '' : 's'}`
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent className="workspace-project-modal" aria-describedby={undefined} onCloseAutoFocus={event => { event.preventDefault(); Array.from(document.querySelectorAll<HTMLButtonElement>('[data-workspace-trigger]')).find(button => button.getClientRects().length > 0)?.focus() }}>
      <header><div><FolderOpen size={20} /><span><DialogTitle>Workspace projects</DialogTitle><small>Full local snapshots of prompts, controls, and selected reference files.</small></span></div></header>
      <div className="workspace-project-body">
        {feedback && <p className={`project-feedback ${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.text}</p>}
        {activeScope ? <form className="workspace-project-save" onSubmit={(event) => { event.preventDefault(); if (onSave(name, activeScope)) setName('') }}><span><strong>Save current {workspaceProjectLabel(activeScope)} workspace</strong><small>Includes the full prompt, render selections, and reference assignments. Files remain in their original local locations.</small></span><label><span>Project name</span><input autoFocus value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="e.g. Kitchen dialogue v1" /></label><button className="primary-button" type="submit" disabled={!name.trim()}><Save size={15} />Save project</button></form> : <p className="settings-note">Open Create, LTX 2.5, Create Image, Anime, or Music to save that workspace as a project. You can still open any saved project below.</p>}
        <div className="workspace-project-toolbar"><span><strong>Saved projects</strong><small>{projects.length} local project{projects.length === 1 ? '' : 's'}</small></span><label><span>Show</span><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">All workspaces</option><option value="create">MiniMax H3 / Ref2VA</option><option value="ltx25">LTX 2.5</option><option value="zimage">Create Image</option><option value="anime">Anime &amp; Checkpoint</option><option value="music">Music · ACE-Step</option><option value="music3">Music · Music 3</option></select></label></div>
        {visibleProjects.length ? <div className="workspace-project-list">{visibleProjects.map((project) => <article key={project.id}><div><span className="workspace-project-scope">{workspaceProjectLabel(project.scope)}</span><strong>{project.name}</strong><small>{details(project)}</small><small>Updated {new Date(project.updatedAt).toLocaleString()}</small></div><div><button type="button" className="secondary-button" onClick={() => onLoad(project)}>Open</button><button type="button" className="icon-button" aria-label={`Rename ${project.name}`} onClick={() => onRename(project)}><Pencil size={15} /></button><button type="button" className="icon-button danger-icon" aria-label={`Delete ${project.name}`} onClick={() => { if (window.confirm(`Delete project “${project.name}”? This does not delete any source files.`)) onDelete(project) }}><Trash2 size={15} /></button></div></article>)}</div> : <div className="workspace-project-empty"><FolderOpen size={26} /><strong>No projects here yet</strong><span>Save the active workspace to capture its prompt, settings, and references.</span></div>}
      </div>
      <footer><small>Projects are stored locally in Oyama AI Video Studio. Opening a project never changes its source images, videos, audio, or library assets.</small><button className="secondary-button" onClick={onClose}>Done</button></footer>
    </DialogContent>
  </Dialog>
}

function NavButton({ active, icon: Icon, label, count, itemType, onClick }: { active: boolean; icon: typeof Film; label: string; count?: number; itemType?: 'character' | 'wardrobe' | 'location'; onClick(): void }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} data-item-type={itemType} title={label} aria-current={active ? 'page' : undefined} aria-label={label} onClick={onClick}><Icon size={19} /><span>{label}</span>{count ? <em>{count}</em> : null}</button>
}

function Notice({ tone, text, onClose }: { tone: 'error' | 'success' | 'neutral'; text: string; onClose(): void }) {
  return <div className={`notice ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{tone === 'error' ? <AlertCircle size={17} /> : tone === 'success' ? <Check size={17} /> : <Activity size={17} />}<span>{text}</span><button onClick={onClose} aria-label="Dismiss"><X size={16} /></button></div>
}

type CreateViewProps = {
  gpuRoutingSummary: string; gpuRoutingWarning?: string
  onAnalyzeReference(path: string): ReturnType<typeof analyzeSceneReference>
  sceneState: ScenePromptState
  setSceneState(state: ScenePromptState): void
  info: ObjectInfo
  renderIntents: RenderSettingsPreset[]
  onApplyIntent(intent: RenderSettingsPreset): void
  onSaveIntent(name: string, values: RenderSettingsPreset['values']): void
  onDeleteIntent(intent: RenderSettingsPreset): void
  sampler: string; setSampler(value: string): void; scheduler: string; setScheduler(value: string): void
  experimentalSampling: boolean; setExperimentalSampling(value: boolean): void
  refImageSize: 'match' | 'max'; setRefImageSize(value: 'match' | 'max'): void
  sigmaShiftMode: 'model' | 'custom'; setSigmaShiftMode(value: 'model' | 'custom'): void
  shiftVideo: number; setShiftVideo(value: number): void; shiftAudio: number; setShiftAudio(value: number): void
  loraStrength: number; setLoraStrength(value: number): void
  userLoras: Array<{ name: string; strength: number }>; setUserLoras(value: Array<{ name: string; strength: number }>): void; userLoraChoices: string[]
  liveEnabled: boolean; setLiveEnabled(value: boolean): void; livePreviewMode: 'auto' | 'standard' | 'h3-override'; setLivePreviewMode(value: 'auto' | 'standard' | 'h3-override'): void; liveConnected: boolean; livePreview: LivePreview | null; blurNsfwPreview: boolean
  upscaleMode: UpscaleMode; setUpscaleMode(value: UpscaleMode): void; h3ProReview: boolean; setH3ProReview(value: boolean): void; h3ProRefineSteps: number; setH3ProRefineSteps(value: number): void; h3RefineSteps: number; setH3RefineSteps(value: number): void; h3RefineDenoise: number; setH3RefineDenoise(value: number): void; h3LearnedUpscaleAvailable: boolean; h3LearnedUpscaleMissingNodes: readonly string[]; h3LearnedUpscaleModelDetected: boolean; h3LearnedUpscaleDirectory: string; ltxAvailable: boolean; ltxMissingNodes: readonly string[]
  noDialogue: boolean; setNoDialogue(value: boolean): void
  naturalMovement: boolean; setNaturalMovement(value: boolean): void
  clothingPolicy: 'wardrobe' | 'underwear' | 'unrestricted'; setClothingPolicy(value: 'wardrobe' | 'underwear' | 'unrestricted'): void
  rtxModels: string[]; rtxModel: string; setRtxModel(value: string): void
  updateReference(index: number, file: MediaFile): void
  mode: GenerationMode; setMode(value: GenerationMode): void
  prompt: string; setPrompt(value: string): void
  duration: number; setDuration(value: number): void
  resolution: string; setResolution(value: string): void
  turbo: 'off' | '4' | '8' | 'fast'; setTurbo(value: 'off' | '4' | '8' | 'fast'): void
  turbo8Profile: Turbo8Profile; setTurbo8Profile(value: Turbo8Profile): void
  textEncoderPreference: 'fast' | 'quality'; setTextEncoderPreference(value: 'fast' | 'quality'): void
  steps: number; setSteps(value: number): void
  seed: number; setSeed(value: number): void; seedLocked: boolean; setSeedLocked(value: boolean): void
  advanced: boolean; setAdvanced(value: boolean): void
  firstFrame: MediaFile | null; lastFrame: MediaFile | null
  setFirstFrame(value: MediaFile | null): void; setLastFrame(value: MediaFile | null): void
  chooseMedia(kind: MediaKind, setter: (file: MediaFile) => void): Promise<void>
  referenceImages: MediaFile[]; referenceVideos: MediaFile[]; referenceAudios: MediaFile[]
  characters: CharacterProject[]; wardrobes: WardrobeProject[]; locations: LocationProject[]; accessories: AccessoryProject[]; selectedCharacterIds: string[]; selectedLocationIds: string[]; removeCharacter(characterId: string): void; characterDetailReferencesEnabled: boolean; loadCharacter(characterId: string): void; loadWardrobe(wardrobeId: string): void; loadLocation(locationId: string): void; loadAccessory(accessoryId: string): void
  refreshSourceMedia(): Promise<void>
  removeReference(kind: MediaKind, index: number): void
  chooseReference(kind: MediaKind): Promise<void>
  editVideoReference(index: number): void
  h3Validated: boolean
  modelReady: boolean; selection: ModelSelection; submitting: boolean; stillSubmitting: boolean; connected: boolean
  ollamaAvailable: boolean; ollamaModel: string; llmProviderLabel: string; promptSuggestion: string
  promptingTool: 'enhance' | 'timeline' | 'audio' | null
  dialogueGenerating: boolean
  onPromptTool(tool: 'enhance' | 'timeline' | 'audio'): void
  onGenerateDialogue(draft: CharacterDialogueDraft): Promise<string>
  onUseSuggestion(): void; onDismissSuggestion(): void
  renderAnyway: boolean
  onOpenContinuation(): void; onSendStillToI2v(job: GenerationJob, provider: 'minimax' | 'ltx25'): void; onContinue(job: GenerationJob): Promise<void>; onContinueReference(job: GenerationJob): Promise<void>; onContinueH3Pro(job: GenerationJob): Promise<void>; latestJob?: GenerationJob
}

type VideoShellProps = CreateViewProps & {
  onOpenNavigator(): void; projectName: string; onOpenProjects(): void; onOpenSettings(): void
  onOpenCompare(): void; compareOpen: boolean
  onNavigate(view: View, engine?: 'acestep' | 'music3'): void; onReset(): void; historyJobs: GenerationJob[]; onSelectJob(id: string): void
  onGenerate(): void; onGenerateStill(): void; onCancel(): void
  activeRenderJob?: GenerationJob; cancelling: boolean
}

const videoModeLabels: Array<[GenerationMode, string]> = [['reference', 'References'], ['text', 'Text'], ['image', 'Image'], ['frames', 'First + last']]

function StudioTopBar({ onOpenNavigator, view, musicEngine, projectName, connected, onNavigate, onOpenProjects, onOpenSettings, onOpenCompare, compareOpen }: {
  onOpenNavigator(): void; view: View; musicEngine: 'acestep' | 'music3'; projectName: string; connected: boolean
  onNavigate(next: View, engine?: 'acestep' | 'music3'): void; onOpenProjects(): void; onOpenSettings(): void; onOpenCompare(): void; compareOpen: boolean
}) {
  const tabs: Array<{ label: string; view: View; engine?: 'acestep' | 'music3' }> = [
    { label: 'Scratchpad', view: 'scratchpad' }, { label: 'Video', view: 'create' }, { label: 'Continue', view: 'continue' }, { label: 'Image', view: 'zimage' },
    { label: 'Music', view: 'music', engine: musicEngine }, { label: 'Library', view: 'library' }, { label: 'Movie', view: 'movie' },
  ]
  return <div className="studio-topbar">
    <button type="button" className="workspace-switcher" data-workspace-trigger onClick={onOpenNavigator} aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K" title="Browse all workspaces (Ctrl+K)"><Menu size={18} /><span><strong>Workspaces</strong><small>{workspaceLabel(view, musicEngine)}</small></span><ChevronDown size={13} /></button>
    <nav aria-label="Primary workspaces">{tabs.map(tab => <button type="button" key={tab.label} className={view === tab.view ? 'active' : ''} aria-current={view === tab.view ? 'page' : undefined} onClick={() => onNavigate(tab.view, tab.engine)}>{tab.label}</button>)}</nav>
    <button type="button" className="video-project-name" onClick={onOpenProjects} title="Open projects">Project: {projectName}<ChevronDown size={13} /></button>
    <span className="video-mode-spacer" />
    <button className="compare-titlebar-button" type="button" onClick={onOpenCompare} aria-haspopup="dialog" aria-expanded={compareOpen} title="Open Video Compare"><Columns3 size={15} /><span>Compare</span></button>
    <button type="button" className={`video-pipeline-state ${connected ? 'ready' : ''}`} onClick={onOpenSettings} title="Open connection settings"><i />{connected ? 'Engine connected' : 'Offline · Set up'}</button>
    <button type="button" className="video-mode-settings" title="Application settings" aria-label="Application settings" onClick={onOpenSettings}><Settings size={18} /></button>
    <span className="video-window-gutter" aria-hidden="true" />

  </div>
}

function ModeBar({ mode, setMode, projectName, onOpenProjects, connected, modelReady, onOpenSettings, onOpenCompare, compareOpen, onOpenNavigator }: Pick<VideoShellProps, 'mode' | 'setMode' | 'projectName' | 'onOpenProjects' | 'connected' | 'modelReady' | 'onOpenSettings' | 'onOpenCompare' | 'compareOpen' | 'onOpenNavigator'>) {
  return <header className="video-mode-bar">
    <button type="button" className="workspace-switcher" data-workspace-trigger onClick={onOpenNavigator} aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K" title="Browse all workspaces (Ctrl+K)"><Menu size={18} /><span><strong>Workspaces</strong><small>Video · MiniMax H3</small></span><ChevronDown size={13} /></button>
    <nav aria-label="Video input mode">{videoModeLabels.map(([id, label]) => <button key={id} type="button" aria-pressed={mode === id} title={modeInfo.find(item => item.id === id)?.note} className={mode === id ? 'active' : ''} onClick={() => setMode(id)}>{label}</button>)}</nav>
    <button type="button" className="video-project-name" onClick={onOpenProjects}>Project: {projectName}<ChevronDown size={13} /></button>
    <span className="video-mode-spacer" />
    <button className="compare-titlebar-button" type="button" onClick={onOpenCompare} aria-haspopup="dialog" aria-expanded={compareOpen} title="Open Video Compare"><Columns3 size={15} /><span>Compare</span></button>
    <button type="button" className={`video-pipeline-state ${connected && modelReady ? 'ready' : ''}`} onClick={onOpenSettings} title="Open connection and model settings"><i />{!connected ? 'Offline · Set up' : !modelReady ? 'Set up models' : 'Engine ready'}</button>
    <button type="button" className="video-mode-settings" title="Application settings" aria-label="Application settings" onClick={onOpenSettings}><Settings size={18} /></button>
    <span className="video-window-gutter" aria-hidden="true" />

  </header>
}

function AssetRail({ props, onSelect }: { props: VideoShellProps; onSelect(file: MediaFile): void }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'images' | 'video' | 'characters' | 'locations'>('all')
  const [collapsed, setCollapsed] = useState(false)
  const query = search.trim().toLocaleLowerCase()
  const matches = (name: string) => name.toLocaleLowerCase().includes(query)
  const files = [...props.referenceImages, ...props.referenceVideos, ...props.referenceAudios]
  const showFiles = filter === 'all' || filter === 'images' || filter === 'video'
  const filteredFiles = files.filter(file => matches(file.name) && (filter === 'all' || filter === 'images' && file.kind === 'image' || filter === 'video' && file.kind === 'video'))
  const characters = props.characters.filter(item => matches(item.name))
  const locations = props.locations.filter(item => matches(item.name))
  const wardrobes = props.wardrobes.filter(item => matches(item.name))
  const accessories = props.accessories.filter(item => matches(item.name))
  const resultCount = (showFiles ? filteredFiles.length : 0) + (filter === 'all' || filter === 'characters' ? characters.length : 0) + (filter === 'all' || filter === 'locations' ? locations.length : 0) + (filter === 'all' ? wardrobes.length + accessories.length : 0)
  const emptyTitle = query ? 'No matching assets' : filter === 'characters' ? 'No characters yet' : filter === 'locations' ? 'No locations yet' : filter === 'images' ? 'No scene images yet' : filter === 'video' ? 'No scene videos yet' : 'No assets here yet'
  const emptyDescription = query ? 'Search covers attached scene media and this project’s characters, locations, wardrobe, and accessories.' : filter === 'images' || filter === 'video' ? 'Attach media to a shot to see it here, or browse your project library.' : 'Browse the project library or create an asset to get started.'
  return <aside className={`video-asset-rail ${collapsed ? 'collapsed' : ''}`} aria-label="Assets">
    <div className="video-rail-heading"><strong>Assets</strong><button type="button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand assets' : 'Collapse assets'} title={collapsed ? 'Expand assets' : 'Collapse assets'}><PanelLeftClose size={16} /></button></div>
    {!collapsed && <><label className="video-asset-search"><Search size={16} /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search scene & project…" aria-label="Search scene and project assets" aria-describedby="video-asset-search-scope" /></label><small className="video-asset-search-scope" id="video-asset-search-scope">Scene media + project assets</small>
      <div className="video-asset-filters" role="group" aria-label="Asset type">{(['all', 'images', 'video', 'characters', 'locations'] as const).map(item => <button key={item} type="button" className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === 'all' ? 'All' : item === 'video' ? 'Video' : item[0].toUpperCase() + item.slice(1)}</button>)}</div>
      <div className="video-asset-list">
        {showFiles && filteredFiles.length > 0 && <section><h3>Recent</h3>{filteredFiles.map((file, index) => <button type="button" className="video-asset-row" key={`${file.path}-${index}`} onClick={() => onSelect(file)}>{file.preview && file.kind === 'image' ? <img src={file.preview} alt="" /> : <span className="video-asset-placeholder"><Film size={18} /></span>}<span><strong>{file.name}</strong><small>{file.kind}</small></span><ChevronDown size={13} /></button>)}</section>}
        {(filter === 'all' || filter === 'characters') && characters.length > 0 && <section><h3>Characters</h3>{characters.map(item => <button type="button" key={item.id} className={`video-asset-row ${props.selectedCharacterIds.includes(item.id) ? 'selected' : ''}`} onClick={() => props.loadCharacter(item.id)}>{characterReferences(item)[0]?.preview ? <img src={characterReferences(item)[0].preview} alt="" /> : <span className="video-asset-placeholder"><Users size={18} /></span>}<span><strong>{item.name}</strong><small>{characterReferences(item).length} assets {props.selectedCharacterIds.includes(item.id) ? '· in scene' : ''}</small></span><Plus size={13} /></button>)}</section>}
        {(filter === 'all' || filter === 'locations') && locations.length > 0 && <section><h3>Locations</h3>{locations.map(item => <button type="button" key={item.id} className={`video-asset-row ${props.selectedLocationIds.includes(item.id) ? 'selected' : ''}`} onClick={() => props.loadLocation(item.id)}>{locationReferences(item)[0]?.preview ? <img src={locationReferences(item)[0].preview} alt="" /> : <span className="video-asset-placeholder"><MapPin size={18} /></span>}<span><strong>{item.name}</strong><small>{locationReferences(item).length} assets {props.selectedLocationIds.includes(item.id) ? '· in scene' : ''}</small></span><Plus size={13} /></button>)}</section>}
        {filter === 'all' && wardrobes.length + accessories.length > 0 && <section><h3>Wardrobe & accessories</h3>{wardrobes.map(item => <button type="button" className="video-asset-row" key={item.id} onClick={() => props.loadWardrobe(item.id)}><span className="video-asset-placeholder"><Shirt size={18} /></span><span><strong>{item.name}</strong><small>Wardrobe</small></span><Plus size={13} /></button>)}{accessories.map(item => <button type="button" className="video-asset-row" key={item.id} onClick={() => props.loadAccessory(item.id)}><span className="video-asset-placeholder"><Aperture size={18} /></span><span><strong>{item.name}</strong><small>Accessory</small></span><Plus size={13} /></button>)}</section>}
        {resultCount === 0 && <div className="video-asset-empty" role="status"><Search size={19} /><strong>{emptyTitle}</strong><p>{emptyDescription}</p>{query ? <button type="button" onClick={() => setSearch('')}>Clear search</button> : <button type="button" onClick={() => props.onNavigate(filter === 'characters' ? 'characters' : filter === 'locations' ? 'locations' : 'library')}>{filter === 'characters' ? 'Create character' : filter === 'locations' ? 'Create location' : 'Open library'}</button>}</div>}
      </div>
      {props.mode !== 'text' && <div className="video-asset-add"><button type="button" onClick={() => props.mode === 'reference' ? void props.chooseReference('image') : void props.chooseMedia('image', props.mode === 'frames' && props.firstFrame ? props.setLastFrame : props.setFirstFrame)}><Plus size={14} />{props.mode === 'reference' ? 'Add Image' : 'Add Frame'}</button>{props.mode === 'reference' && <><button type="button" onClick={() => void props.chooseReference('video')}>Video</button><button type="button" onClick={() => void props.chooseReference('audio')}>Audio</button></>}</div>}
    </>}
  </aside>
}

function PromptPanel({ prompt, setPrompt, onPromptTool, promptingTool, promptSuggestion, onUseSuggestion, onDismissSuggestion }: Pick<VideoShellProps, 'prompt' | 'setPrompt' | 'onPromptTool' | 'promptingTool' | 'promptSuggestion' | 'onUseSuggestion' | 'onDismissSuggestion'>) {
  const [legendOpen, setLegendOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  return <section className="video-prompt-panel"><header><strong>Prompt</strong><div><button type="button" className="video-prompt-expand" onClick={() => setExpanded(true)} title="Open large prompt editor"><PanelTopOpen size={14} />Expand</button><button type="button" className="video-syntax-help-button" onClick={() => setLegendOpen(true)} title="Prompt syntax legend" aria-label="Open prompt syntax legend"><HelpCircle size={14} /></button><button type="button" onClick={() => onPromptTool('timeline')} disabled={Boolean(promptingTool)}><Clock3 size={14} />Timeline</button><button type="button" onClick={() => onPromptTool('enhance')} disabled={Boolean(promptingTool)}>{promptingTool === 'enhance' ? <LoaderCircle size={14} className="spin" /> : <WandSparkles size={14} />}Improve</button></div></header><H3PromptEditor value={prompt} onChange={setPrompt} placeholder="Describe the scene, or type ## to add structured direction…" /><footer><span>Type <code>##</code> or right-click to insert tags</span><span>{prompt.length} characters</span></footer>{promptSuggestion && <div className="video-prompt-suggestion"><p>{promptSuggestion}</p><button type="button" onClick={onDismissSuggestion}>Dismiss</button><button type="button" onClick={onUseSuggestion}>Use suggestion</button></div>}{expanded && <VideoPromptModal value={prompt} promptingTool={promptingTool} onChange={setPrompt} onPromptTool={onPromptTool} onClose={() => setExpanded(false)} />}{legendOpen && <div className="video-syntax-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setLegendOpen(false) }}><section className="video-syntax-dialog" role="dialog" aria-modal="true" aria-labelledby="video-syntax-title"><header><span><strong id="video-syntax-title">H3 prompt syntax</strong><small>Easy authoring tags are compiled into MiniMax H3’s official fields.</small></span><button type="button" onClick={() => setLegendOpen(false)} aria-label="Close syntax legend"><X size={17} /></button></header><div className="video-syntax-list">{promptMarkupLegend.map(item => <div key={item.tag}><code>{item.tag}</code><span>{item.description}</span><button type="button" onClick={() => { const separator = prompt.trim() ? '\n\n' : ''; setPrompt(`${prompt}${separator}${item.tag}\n`); setLegendOpen(false) }}>Insert</button></div>)}</div><div className="video-syntax-example"><strong>Example</strong><pre>{`##scene\nA model crosses a sunlit gallery as the camera slowly pushes in.\n\n##soundscape\nSoft footsteps and distant city ambience.\n\n##music\nMinimal non-diegetic strings, restrained and elegant.`}</pre></div><footer><span>The compiler emits official H3 fields such as <code>integrated_multimodal_description</code>, <code>overall_soundscape</code>, and <code>non_diegetic_music</code>; authoring tags never reach the model.</span><button type="button" onClick={() => setLegendOpen(false)}>Done</button></footer></section></div>}</section>
}

function ModeInputStrip({ props, boundScene, selection, onSelect }: { props: VideoShellProps; boundScene: ScenePromptState; selection: SceneInspectorSelection; onSelect(selection: SceneInspectorSelection): void }) {
  if (props.mode === 'text') return null
  if (props.mode === 'reference') return <section className="video-input-strip video-reference-strip"><header><strong>References</strong><span>{boundScene.references.length} selected</span></header><div className="video-reference-items">{boundScene.references.map((ref, index) => <button type="button" key={ref.id} className={`video-reference-item ${selection.kind === 'reference' && selection.id === ref.id ? 'selected' : ''}`} onClick={() => onSelect({ kind: 'reference', id: ref.id })}>{ref.file.preview && ref.file.kind === 'image' ? <img src={ref.file.preview} alt="" /> : <span className="video-reference-icon"><Film size={22} /></span>}<span><strong>{`Picture ${index + 1}`}</strong><small>{ref.file.referenceRole || ref.videoRole || ref.audio?.layer || 'Reference'} · {ref.ownerId ? boundScene.characters.find(item => item.id === ref.ownerId)?.name || 'Character' : 'Scene'}</small></span></button>)}<button type="button" className="video-reference-add" onClick={() => void props.chooseReference('image')}><Plus size={18} /><span>Add reference</span></button></div></section>
  const slots: Array<{ label: string; file: MediaFile | null; setter(file: MediaFile | null): void }> = [{ label: props.mode === 'image' ? 'Start Image' : 'First Frame', file: props.firstFrame, setter: props.setFirstFrame }, ...(props.mode === 'frames' ? [{ label: 'Last Frame', file: props.lastFrame, setter: props.setLastFrame }] : [])]
  return <section className={`video-input-strip video-frame-strip ${props.mode === 'frames' ? 'paired' : ''}`}>{slots.map((slot, index) => <div className="video-frame-slot" key={slot.label}><button type="button" className="video-frame-preview" onClick={() => slot.file ? onSelect({ kind: 'reference', id: `${slot.file.kind}:${slot.file.path}:${index === 0 ? 'opening' : 'ending'}` }) : void props.chooseMedia('image', slot.setter)}>{slot.file?.preview ? <img src={slot.file.preview} alt="" /> : <ImagePlus size={25} />}</button><span><strong>{slot.label}</strong><small>{slot.file?.name || 'Add an image'}</small></span><button type="button" onClick={() => void props.chooseMedia('image', slot.setter)}>{slot.file ? 'Replace' : 'Choose'}</button>{slot.file && <button type="button" className="video-slot-remove" title={`Remove ${slot.label}`} aria-label={`Remove ${slot.label}`} onClick={() => { slot.setter(null); onSelect({ kind: 'scene' }) }}><X size={15} /></button>}</div>).reduce<React.ReactNode[]>((items, element, index) => index ? [...items, <span className="video-frame-arrow" key="arrow">→</span>, element] : [element], [])}</section>
}

function PreviewStage({ job, historyJobs, onSelectJob, livePreview, liveEnabled, blurSensitive, blocker, onViewQueue, onDetach, onContinue, onContinueReference, onSendStillToI2v }: { job?: GenerationJob; historyJobs: GenerationJob[]; onSelectJob(id: string): void; livePreview: LivePreview | null; liveEnabled: boolean; blurSensitive: boolean; blocker: string; onViewQueue(): void; onDetach(): void; onContinue: VideoShellProps['onContinue']; onContinueReference: VideoShellProps['onContinueReference']; onSendStillToI2v: VideoShellProps['onSendStillToI2v'] }) {
  const [tab, setTab] = useState<'preview' | 'history'>('preview')
  const live = job && ['queued', 'running'].includes(job.status) && liveEnabled && livePreview?.promptId === job.promptId ? livePreview : null
  const previewAspect = job?.width && job?.height ? `${job.width} / ${job.height}` : '16 / 9'
  return <section className="video-preview-stage"><header><div role="tablist" aria-label="Preview view"><button type="button" role="tab" aria-selected={tab === 'preview'} className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>Preview</button><button type="button" role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>History</button></div><button type="button" title="Detach preview" aria-label="Detach preview" onClick={onDetach}><PanelTopOpen size={16} /></button></header>
    <div className="video-preview-canvas">{tab === 'history' ? <div className="video-preview-history">{historyJobs.length ? historyJobs.map(item => <button type="button" key={item.id} onClick={() => { onSelectJob(item.id); setTab('preview') }}><span className="video-history-thumb">{item.outputUrl && item.mediaType === 'image' ? <img src={item.outputUrl} alt="" /> : item.outputUrl && item.mediaType !== 'audio' ? <MovieMediaThumbnail source={item.outputUrl} posterUrl={item.thumbnailUrl} /> : <Film size={19} />}</span><span><strong>{shortPrompt(item.prompt) || 'Untitled render'}</strong><small>{item.status} · {item.width} × {item.height} · {item.duration}s</small></span></button>) : <div className="video-preview-empty"><History size={30} /><strong>No renders yet</strong></div>}</div> : job?.outputUrl ? job.mediaType === 'image' ? <img src={job.outputUrl} alt="Generated output" /> : <VideoPlayer src={job.outputUrl} /> : live ? <figure className={blurSensitive && job && hasSensitivePreviewWording(job.prompt) ? 'sensitive-preview' : ''} style={{ aspectRatio: previewAspect }}>{live.mime === 'video/mp4' ? <video src={live.url} autoPlay loop muted playsInline /> : <img src={live.url} alt="Live generation preview" />}<figcaption className="video-live-preview-badge"><i />Live sampler preview<small>Low resolution · final quality appears when rendering completes</small></figcaption></figure> : job && ['queued', 'running'].includes(job.status) ? <div className="video-preview-empty" role="status"><LoaderCircle size={28} className="spin" /><strong>{job.progressLabel || 'Rendering locally'}</strong><span>{Math.round(job.progress)}% · {job.width} × {job.height}</span><div className="progress"><i style={{ width: `${job.progress}%` }} /></div></div> : job?.status === 'failed' ? <div className="video-preview-empty video-preview-failed" role="alert"><AlertCircle size={30} /><strong>Render did not complete</strong><span>{job.error || 'ComfyUI stopped before an output was returned.'}</span><small>{blocker ? `Before retrying: ${blocker}` : 'Review the activity, adjust settings if needed, then Generate again.'}</small><button type="button" onClick={onViewQueue}><Activity size={15} />View render activity</button></div> : <div className="video-preview-empty" role="status"><Film size={32} /><strong>Preview</strong><span>Your generated video will appear here.</span></div>}</div>
    {job?.outputUrl && <footer><span>{job.width} × {job.height} · {job.duration}s</span>{job.mediaType === 'image' ? <button type="button" onClick={() => onSendStillToI2v(job, 'minimax')}>Send to I2V</button> : job.provider === 'minimax' ? <div><button type="button" onClick={() => void onContinue(job)}>Continue in new window</button><button type="button" onClick={() => void onContinueReference(job)}>Continue in Reference</button></div> : null}<VideoExportButtons job={job} /></footer>}</section>
}

function GenerateBar({ props, blocker }: { props: VideoShellProps; blocker: string }) {
  const quality = props.experimentalSampling ? 'Custom' : props.turbo === 'off' ? 'Quality' : props.turbo === 'fast' ? 'Fast' : `Turbo ${props.turbo}`
  const active = props.activeRenderJob && ['queued', 'running'].includes(props.activeRenderJob.status) ? props.activeRenderJob : undefined
  const activeId = active?.id
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!activeId) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [activeId])
  const elapsed = active ? Math.max(0, now - (active.startedAt ?? active.createdAt)) : 0
  const sampler = samplerProgressSummary(active, now)
  const remainingMs = sampler?.remainingMs
  const nextStepIn = sampler?.nextStepIn
  const completionTime = remainingMs !== undefined ? new Date(now + remainingMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : undefined
  const announcedStage = active?.status === 'queued' ? 'Waiting in render queue' : active?.progressLabel?.includes('Refinement') ? 'Refinement pass' : active?.progressLabel?.includes('step') ? 'Sampling pass' : active?.progressLabel || 'Rendering locally'
  return <footer className={`video-generate-bar ${active ? 'is-rendering' : ''}`}><div className="video-generate-context"><span className="video-generate-thumb">{props.firstFrame?.preview && props.mode !== 'reference' ? <img src={props.firstFrame.preview} alt="" /> : <Film size={21} />}</span><span><strong>{videoModeLabels.find(([id]) => id === props.mode)?.[1]}</strong><small>{props.mode === 'reference' ? 'Reference to Video' : props.mode === 'text' ? 'Text to Video' : props.mode === 'image' ? 'Image to Video' : 'First / Last Frame'}</small></span></div>{active ? <div className="video-render-estimate"><span className="video-render-estimate-heading"><i /><span className="sr-only" role="status" aria-live="polite">{announcedStage}</span><strong>{active.status === 'queued' ? `Waiting in render queue${active.queuePosition ? ` · position ${active.queuePosition}` : ''}` : active.progressLabel || 'Rendering locally'}</strong><b>{Math.round(active.progress)}%</b></span><span className="video-render-progress"><i style={{ width: `${Math.max(2, active.progress)}%` }} /></span><span className="video-render-metrics"><small>Elapsed {formatRuntime(elapsed)}</small>{sampler ? <small>Step {sampler.currentStep}/{sampler.totalSteps}</small> : null}{sampler?.rate ? <small>{formatStepDuration(sampler.rate)}</small> : null}{nextStepIn !== undefined && sampler?.remainingSteps ? <small>Next step {formatStepCountdown(nextStepIn)}</small> : null}<small>{remainingMs !== undefined ? `ETA ~${formatRuntime(remainingMs)} · ${completionTime}` : active.status === 'queued' ? 'ETA starts with sampling' : 'Measuring sampler pace…'}</small></span></div> : <div className="video-generate-summary" title={blocker || 'Current output settings'}><span>{props.resolution.replace('x', ' × ')}</span><span>{props.duration}s</span><span>{quality}</span>{blocker && <em>{blocker}</em>}</div>}<span className="video-generate-spacer" />{active && <button type="button" className="video-cancel-button" disabled={props.cancelling} onClick={props.onCancel}><CircleStop size={16} />{props.cancelling ? 'Stopping…' : 'Cancel'}</button>}<button type="button" className="video-generate-button" disabled={props.submitting || Boolean(blocker) || Boolean(active)} title={blocker || (active ? 'Wait for or cancel the active render.' : 'Generate video')} onClick={props.onGenerate}><Play size={18} fill="currentColor" />{props.submitting ? 'Submitting…' : active ? 'Rendering…' : 'Generate'}</button></footer>
}

function Inspector({ props, boundScene, selection, selectedFile, selectedReference, onClearSelection, onUpdateScene, onUpdateFile, onPreset, onSceneEditor }: {
  props: VideoShellProps; boundScene: ScenePromptState; selection: SceneInspectorSelection; selectedFile?: MediaFile | null; selectedReference?: ScenePromptState['references'][number]
  onClearSelection(): void; onUpdateScene(state: ScenePromptState): void; onUpdateFile(file: MediaFile): void
  onPreset(preset: 'off' | '8' | '4' | 'fast' | 'custom'): void; onSceneEditor(): void
}) {
  const [dialogueOpen, setDialogueOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [stepsDraft, setStepsDraft] = useState(String(props.steps))
  useEffect(() => { setStepsDraft(String(props.steps)) }, [props.steps])
  const qualityValue = props.experimentalSampling ? 'custom' : props.turbo
  const fixedSteps = props.turbo === '4' || props.turbo === 'fast'
  const minSteps = props.turbo === 'off' ? 16 : 4
  const maxSteps = props.turbo === 'off' ? 30 : 12
  const setSteps = (value: number) => {
    if (fixedSteps || !Number.isFinite(value)) return
    if (qualityValue !== 'custom') onPreset('custom')
    props.setSteps(Math.max(minSteps, Math.min(maxSteps, Math.round(value))))
  }
  const commitStepsDraft = () => {
    if (stepsDraft.trim()) setSteps(Number(stepsDraft))
    setStepsDraft(String(Math.max(minSteps, Math.min(maxSteps, Math.round(Number(stepsDraft) || props.steps)))))
  }
  const h3PreviewReady = Boolean(findH3PreviewOverrideNode(props.info) && props.selection.previewVae)
  const previewStatus = !props.liveEnabled ? 'Live preview off' : props.livePreviewMode === 'standard' ? 'Standard still-frame preview' : h3PreviewReady ? 'H3 motion preview ready' : props.livePreviewMode === 'h3-override' ? 'H3 motion components required' : 'Auto uses still frames until H3 is ready'
  return <aside className="video-inspector" aria-label="Video inspector"><header><strong>{selectedFile ? 'Asset Properties' : 'Generation Settings'}</strong>{selectedFile ? <button type="button" title="Back to generation settings" aria-label="Back to generation settings" onClick={onClearSelection}><X size={16} /></button> : null}</header>
    <div className="video-inspector-scroll">{selectedFile ? <div className="video-selected-asset">
      <div className="video-selected-preview">{selectedFile.preview && selectedFile.kind === 'image' ? <img src={selectedFile.preview} alt="" /> : <Film size={30} />}</div><strong>{selectedFile.name}</strong><small>{selectedFile.kind === 'image' ? 'Image' : selectedFile.kind === 'video' ? 'Video' : 'Audio'} source</small>
      {selectedReference && props.mode === 'reference' && <><label>Reference role<select value={selectedFile.referenceRole ?? 'composition'} onChange={event => onUpdateFile({ ...selectedFile, referenceRole: event.target.value as NonNullable<MediaFile['referenceRole']> })}>{[['subject', 'Subject / identity'], ['wardrobe', 'Wardrobe'], ['prop', 'Prop / product'], ['location', 'Location / set'], ['composition', 'Composition / pose'], ['lighting-style', 'Lighting / style']].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><SceneSelectionInspector state={boundScene} selection={selection} onChange={onUpdateScene} /></>}
      {selectedFile.kind === 'image' && <ImageCrop label={selectedFile.name} file={selectedFile} resolution={props.resolution} onChange={onUpdateFile} />}
      {selectedReference && props.mode === 'reference' && selectedFile.kind === 'video' && <button type="button" className="video-inline-action" onClick={() => { const i = props.referenceVideos.findIndex(item => item.path === selectedFile.path); if (i >= 0) props.editVideoReference(i) }}><Scissors size={15} />Trim reference clip</button>}
      {selectedReference && props.mode === 'reference' && <button type="button" className="video-inline-action video-remove-action" onClick={() => { const index = (selectedFile.kind === 'image' ? props.referenceImages : selectedFile.kind === 'video' ? props.referenceVideos : props.referenceAudios).findIndex(item => item.path === selectedFile.path); if (index >= 0) props.removeReference(selectedFile.kind, index); onClearSelection() }}><Trash2 size={15} />Remove from scene</button>}
    </div> : <>
      <div className={`video-preview-health ${h3PreviewReady && props.liveEnabled && props.livePreviewMode !== 'standard' ? 'ready' : ''}`} role="status"><span className="video-preview-health-dot" /><span>{previewStatus}</span></div>
      <details className="video-inspector-section video-output-section" open><summary><span>Output<small>Size, length, and repeatability</small></span><ChevronDown size={15} /></summary><div className="video-inspector-fields video-output-fields"><label className="video-resolution-label">Resolution<select value={props.resolution} onChange={event => props.setResolution(event.target.value)}>{!MINIMAX_VIDEO_RESOLUTIONS.includes(props.resolution) && <option value={props.resolution}>{videoResolutionLabel(props.resolution)}</option>}{(['square', 'landscape', 'portrait', 'ultrawide'] as const).map(orientation => <optgroup key={orientation} label={orientation[0].toUpperCase() + orientation.slice(1)}>{MINIMAX_VIDEO_RESOLUTION_GROUPS[orientation].map(size => <option value={size} key={size}>{videoResolutionLabel(size)}</option>)}</optgroup>)}</select></label><label>Duration<select value={props.duration} onChange={event => props.setDuration(Number(event.target.value))}>{Array.from({ length: 27 }, (_, i) => i * .5 + 2).map(value => <option key={value} value={value}>{value} seconds</option>)}</select></label><label className="video-seed-label">Seed<div className="video-seed-field"><input type="number" value={props.seed} min={0} max={999999999999} disabled={props.submitting || props.stillSubmitting} onChange={event => props.setSeed(Math.max(0, Math.floor(Number(event.target.value) || 0)))} aria-label="Seed" /><button type="button" onClick={() => { props.setSeedLocked(true); props.setSeed(randomH3Seed(props.seed)) }} title="Randomize seed" aria-label="Randomize seed"><Dices size={15} /></button></div></label><label className="video-checkbox video-seed-lock"><input type="checkbox" checked={props.seedLocked} onChange={event => props.setSeedLocked(event.target.checked)} />Keep this seed for repeatable results</label></div></details>
      <details className="video-inspector-section video-quality-section" open><summary><span>Quality & sampling<small>{props.steps} steps · {fixedSteps ? 'Fixed recipe' : qualityValue === 'custom' ? 'Custom' : 'Preset managed'}</small></span><ChevronDown size={15} /></summary><div className="video-inspector-fields"><label>Quality preset<select value={qualityValue} onChange={event => onPreset(event.target.value as 'off' | '8' | '4' | 'fast' | 'custom')}><option value="off">Quality · native</option><option value="8">Turbo 8 · balanced</option><option value="4">Turbo 4 · experimental</option>{props.mode === 'text' && <option value="fast">Fast · T2V only</option>}<option value="custom">Custom…</option></select></label><div className="video-step-control"><span><strong>Sampling steps</strong><small>{fixedSteps ? `${props.turbo === '4' ? 'Turbo 4' : 'Fast'} uses a fixed ${props.turbo === '4' ? 4 : 8}-step recipe. Select Custom to adjust steps.` : qualityValue === 'custom' ? 'Custom value controls render time and refinement.' : 'Changing this switches to Custom sampling.'}</small></span><div><button type="button" aria-label="Decrease sampling steps" disabled={fixedSteps || props.steps <= minSteps} onClick={() => setSteps(props.steps - 1)}>−</button><input type="number" aria-label="Sampling steps" min={minSteps} max={maxSteps} disabled={fixedSteps} value={fixedSteps ? props.turbo === '4' ? 4 : 8 : stepsDraft} onChange={event => setStepsDraft(event.target.value)} onBlur={commitStepsDraft} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} /><button type="button" aria-label="Increase sampling steps" disabled={fixedSteps || props.steps >= maxSteps} onClick={() => setSteps(props.steps + 1)}>+</button></div><input className="video-step-slider" type="range" aria-label="Sampling steps slider" min={minSteps} max={maxSteps} disabled={fixedSteps} value={fixedSteps ? props.turbo === '4' ? 4 : 8 : props.steps} onChange={event => setSteps(Number(event.target.value))} /></div><div className={`video-quality-note ${qualityValue === 'custom' ? 'custom' : ''}`}><strong>{fixedSteps ? 'Fixed-step recipe' : qualityValue === 'custom' ? 'Custom sampling active' : qualityValue === 'off' ? 'Maximum detail' : 'Accelerated recipe'}</strong><span>{fixedSteps ? 'Choose Custom for adjustable Turbo 8 sampling, or Native for full-quality sampling.' : qualityValue === 'custom' ? `${minSteps}–${maxSteps} steps supported for the selected base recipe.` : qualityValue === 'off' ? 'Native quality favors detail and consistency over speed.' : 'Official Turbo settings favor faster iteration.'}</span></div></div></details>
      <details className="video-inspector-section video-advanced-section" open={advancedOpen} onToggle={event => { setAdvancedOpen(event.currentTarget.open); props.setAdvanced(event.currentTarget.open) }}><summary>Advanced<ChevronDown size={15} /></summary><div className="video-inspector-fields">
        <button type="button" className="video-inline-action" onClick={onSceneEditor}><SlidersHorizontal size={15} />Edit scene structure and continuity</button>
        {props.mode === 'reference' && <><button type="button" className="video-inline-action" onClick={() => setDialogueOpen(true)}><MessageSquareText size={15} />Character dialogue</button><button type="button" className="video-inline-action" disabled={props.stillSubmitting} onClick={props.onGenerateStill}><ImagePlus size={15} />Generate reference still</button><label>Reference fidelity<select value={props.refImageSize} onChange={event => props.setRefImageSize(event.target.value as 'match' | 'max')}><option value="match">Balanced</option><option value="max">Maximum identity</option></select></label><label>Clothing behavior<select value={props.clothingPolicy} onChange={event => props.setClothingPolicy(event.target.value as typeof props.clothingPolicy)}><option value="wardrobe">Assigned wardrobe</option><option value="underwear">Underwear</option><option value="unrestricted">Unrestricted</option></select></label></>}
        <label className="video-checkbox"><input type="checkbox" checked={props.noDialogue} onChange={event => props.setNoDialogue(event.target.checked)} />No dialogue</label><label className="video-checkbox"><input type="checkbox" checked={props.naturalMovement} onChange={event => props.setNaturalMovement(event.target.checked)} />Natural movement</label>
        <label className="video-checkbox"><input type="checkbox" checked={props.liveEnabled} onChange={event => props.setLiveEnabled(event.target.checked)} />Live preview</label>{props.liveEnabled && <label>Preview source<select value={props.livePreviewMode} onChange={event => props.setLivePreviewMode(event.target.value as typeof props.livePreviewMode)}><option value="auto">Automatic · H3 motion when ready</option><option value="standard">Standard first frame</option><option value="h3-override">Require H3 animated preview</option></select></label>}
        <label>Refinement and upscale<select value={props.upscaleMode} onChange={event => props.setUpscaleMode(event.target.value as UpscaleMode)}><option value="off">Off</option><option value="refine">Refine · same resolution</option><option value="h3" disabled={!props.h3LearnedUpscaleAvailable}>Refine + Upscale · H3 2×</option><option value="ltx" disabled={!props.ltxAvailable}>LTX 2.5 · 2×</option><option value="rtx" disabled={!props.rtxModels.length}>RTX frames · 2×</option></select></label>{props.upscaleMode === 'rtx' && <label>RTX model<select value={props.rtxModel} onChange={event => props.setRtxModel(event.target.value)}>{props.rtxModels.map(name => <option key={name}>{name}</option>)}</select></label>}{props.upscaleMode === 'refine' && <><label>Refinement steps<input type="number" min={1} max={30} value={props.h3RefineSteps} onChange={event => props.setH3RefineSteps(Math.max(1, Math.min(30, Math.round(Number(event.target.value)) || 1)))} /></label><label>Refinement strength<input type="number" min={0.01} max={1} step={0.05} value={props.h3RefineDenoise} onChange={event => props.setH3RefineDenoise(Math.max(0.01, Math.min(1, Number(event.target.value) || 0.01)))} /></label></>}{props.upscaleMode === 'h3' && <><label>Refinement steps<input type="number" min={1} max={30} value={props.h3ProRefineSteps} onChange={event => props.setH3ProRefineSteps(Number(event.target.value))} /></label><label className="video-checkbox"><input type="checkbox" checked={props.h3ProReview} onChange={event => props.setH3ProReview(event.target.checked)} />Review first pass</label></>}
        <div className="video-advanced-divider">Custom sampling</div><label className="video-checkbox"><input type="checkbox" checked={qualityValue === 'custom'} onChange={event => onPreset(event.target.checked ? 'custom' : props.turbo)} />Enable Custom values</label>
        {qualityValue === 'custom' && <><label>Base recipe<select value={props.turbo} onChange={event => props.setTurbo(event.target.value as typeof props.turbo)}><option value="off">Native</option><option value="8">Turbo 8</option><option value="4">Turbo 4</option>{props.mode === 'text' && <option value="fast">Fast T2V</option>}</select></label>{props.turbo === '8' && <label>Turbo profile<select value={props.turbo8Profile} onChange={event => props.setTurbo8Profile(event.target.value as Turbo8Profile)}><option value="stable">Stable</option><option value="balanced">Balanced</option><option value="motion">Motion</option><option value="euler-beta">Euler + Beta</option></select></label>}<label>Sampler<select value={props.sampler} onChange={event => { props.setSampler(event.target.value); props.setExperimentalSampling(true) }}>{[...new Set([props.sampler, 'res_multistep', 'euler', ...choices(props.info, 'KSamplerSelect', 'sampler_name')])].map(value => <option key={value}>{value}</option>)}</select></label><label>Scheduler<select value={props.scheduler} onChange={event => { props.setScheduler(event.target.value); props.setExperimentalSampling(true) }}>{[...new Set([props.scheduler, 'simple', 'beta', ...choices(props.info, 'BasicScheduler', 'scheduler')])].map(value => <option key={value}>{value}</option>)}</select></label><label>Text encoder<select value={props.textEncoderPreference} onChange={event => props.setTextEncoderPreference(event.target.value as typeof props.textEncoderPreference)}><option value="fast">Fast</option><option value="quality">Quality</option></select></label><label>Official Turbo LoRA strength<input type="number" min={0} max={2} step={.05} value={props.loraStrength} onChange={event => props.setLoraStrength(Number(event.target.value))} /></label><label>Sigma shifts<select value={props.sigmaShiftMode} onChange={event => props.setSigmaShiftMode(event.target.value as typeof props.sigmaShiftMode)}><option value="model">Model defaults</option><option value="custom">Custom</option></select></label>{props.sigmaShiftMode === 'custom' && <><label>Video shift<input type="number" min={.01} max={100} step={.01} value={props.shiftVideo} onChange={event => props.setShiftVideo(Number(event.target.value))} /></label><label>Audio shift<input type="number" min={.01} max={100} step={.01} value={props.shiftAudio} onChange={event => props.setShiftAudio(Number(event.target.value))} /></label></>}{props.userLoras.map((slot, index) => <div className="video-lora-row" key={index}><label>LoRA {index + 1}<select value={slot.name} onChange={event => props.setUserLoras(props.userLoras.map((item, i) => i === index ? { ...item, name: event.target.value } : item))}><option value="">None</option>{props.userLoraChoices.map(name => <option key={name}>{name}</option>)}</select></label><input aria-label={`LoRA ${index + 1} strength`} type="number" min={0} max={2} step={.05} disabled={!slot.name} value={slot.strength} onChange={event => props.setUserLoras(props.userLoras.map((item, i) => i === index ? { ...item, strength: Number(event.target.value) } : item))} /></div>)}</>}
      </div></details>
      {props.latestJob?.status === 'completed' && <details className="video-inspector-section"><summary>Render details<ChevronDown size={15} /></summary><div className="video-inspector-fields"><JobExecutionChips job={props.latestJob} expanded /><ComfyActivityConsole job={props.latestJob} /></div></details>}
    </>}</div>
    {dialogueOpen && <CharacterDialogueModal characters={props.selectedCharacterIds.map(id => props.characters.find(item => item.id === id)).filter(Boolean) as CharacterProject[]} duration={props.duration} generating={props.dialogueGenerating} ollamaAvailable={props.ollamaAvailable} providerLabel={props.llmProviderLabel} onClose={() => setDialogueOpen(false)} onGenerate={props.onGenerateDialogue} onInsert={text => { props.setNoDialogue(false); props.setPrompt([props.prompt, text].filter(Boolean).join('\n')); setDialogueOpen(false) }} />}
  </aside>
}

function VideoWorkspaceShell(props: VideoShellProps) {
  const [selection, setSelection] = useState<SceneInspectorSelection>({ kind: 'scene' })
  const [sceneEditorOpen, setSceneEditorOpen] = useState(false)
  const [previewPopoutRoot, setPreviewPopoutRoot] = useState<HTMLElement | null>(null)
  const popoutRef = useRef<Window | null>(null)
  const [railAsset, setRailAsset] = useState<MediaFile | null>(null)
  const selectedCharacters = props.selectedCharacterIds.map(id => props.characters.find(item => item.id === id)).filter(Boolean) as CharacterProject[]
  const selectedLocations = props.selectedLocationIds.map(id => props.locations.find(item => item.id === id)).filter(Boolean) as LocationProject[]
  const bindings = allocateWorkspaceReferences(selectedCharacters.map(item => ({ id: item.id, name: item.name, identity: characterReferences(item), detailReferences: props.characterDetailReferencesEnabled ? item.detailReferences : [], hairStyleIds: item.hairStyleIds, wardrobeIds: item.wardrobeIds, accessoryIds: item.accessoryIds })), props.wardrobes, selectedLocations.map(item => ({ id: item.id, name: item.name, images: locationReferences(item), environmentMode: item.environmentMode, locationContext: item.locationContext, accuracyDetails: item.accuracyDetails })))
  const renderBindings = resolveRenderReferenceBindings(props.referenceImages, bindings, props.clothingPolicy)
  const boundScene = bindSceneReferences(props.sceneState, renderBindings, props.referenceVideos, props.referenceAudios, props.firstFrame, props.lastFrame)
  const compilation = compileScene(boundScene)
  const selectedReference = selection.kind === 'reference' ? boundScene.references.find(item => item.id === selection.id) : undefined
  const selectedFile = selectedReference?.file || railAsset
  const blocker = props.mode === 'image' && !props.firstFrame ? 'Add a start image' : props.mode === 'frames' && (!props.firstFrame || !props.lastFrame) ? 'Add both frames' : props.mode === 'reference' && !boundScene.references.length ? 'Add a reference' : compilation.conflicts.find(item => item.severity === 'error')?.message || (!props.connected ? 'Engine offline' : !props.modelReady ? 'Models missing' : '')
  const updateScene = (next: ScenePromptState) => { props.setSceneState(next); if (props.mode === 'image' || props.mode === 'frames') { props.setFirstFrame(next.references.find(ref => ref.anchor === 'opening')?.file || props.firstFrame); props.setLastFrame(next.references.find(ref => ref.anchor === 'ending')?.file || props.lastFrame) } }
  const updateFile = (next: MediaFile) => { if (selectedReference) { const i = props.referenceImages.findIndex(item => item.path === selectedReference.file.path); if (i >= 0) props.updateReference(i, next); props.setSceneState({ ...boundScene, references: boundScene.references.map(ref => ref.id === selectedReference.id ? { ...ref, file: next } : ref) }); if (props.firstFrame?.path === next.path) props.setFirstFrame(next); if (props.lastFrame?.path === next.path) props.setLastFrame(next) } else setRailAsset(next) }
  const choosePreset = (preset: 'off' | '8' | '4' | 'fast' | 'custom') => {
    if (preset === 'custom') {
      if (props.turbo === '4' || props.turbo === 'fast') {
        props.setTurbo('8'); props.setSteps(8); props.setTurbo8Profile('balanced')
        props.setSampler('res_multistep'); props.setScheduler('simple')
      } else if (!props.experimentalSampling) {
        const sampling = props.turbo === '8' ? turbo8Sampling(props.turbo8Profile) : { sampler: 'res_multistep', scheduler: 'simple' }
        props.setSampler(sampling.sampler); props.setScheduler(sampling.scheduler)
      }
      props.setExperimentalSampling(true)
      return
    }
    props.setExperimentalSampling(false); props.setTurbo(preset)
    props.setSteps(preset === 'off' ? 30 : preset === '4' ? 4 : 8)
    props.setTurbo8Profile('balanced'); props.setSampler('res_multistep'); props.setScheduler('simple')
    props.setSigmaShiftMode('model'); props.setLoraStrength(1)
  }
  const detach = () => { if (popoutRef.current && !popoutRef.current.closed) { popoutRef.current.focus(); return } const popup = window.open('', 'oyama-video-preview', 'popup=yes,width=1080,height=720,resizable=yes'); if (!popup) return; popup.document.title = 'Oyama · Preview'; document.querySelectorAll('link[rel="stylesheet"], style').forEach(node => popup.document.head.appendChild(node.cloneNode(true))); const root = popup.document.createElement('main'); popup.document.body.appendChild(root); popoutRef.current = popup; setPreviewPopoutRoot(root); popup.addEventListener('beforeunload', () => { popoutRef.current = null; setPreviewPopoutRoot(null) }, { once: true }) }
  useEffect(() => () => popoutRef.current?.close(), [])
  return <div className="video-workspace-shell">
    <ModeBar mode={props.mode} setMode={value => { setSelection({ kind: 'scene' }); setRailAsset(null); if (value !== 'text' && props.turbo === 'fast') choosePreset('off'); props.setMode(value) }} projectName={props.projectName} onOpenProjects={props.onOpenProjects} connected={props.connected} modelReady={props.modelReady} onOpenSettings={props.onOpenSettings} onOpenCompare={props.onOpenCompare} compareOpen={props.compareOpen} onOpenNavigator={props.onOpenNavigator} />
    <div className="video-workspace-main"><AssetRail props={props} onSelect={file => { setRailAsset(file); const ref = boundScene.references.find(item => item.file.path === file.path); setSelection(ref ? { kind: 'reference', id: ref.id } : { kind: 'scene' }) }} />
      <main className="video-creative-area"><details className="video-continuation-opt-in"><summary>Optional · Continue a video</summary><p>Plan additional beats with motion context, frame continuity, and combined exports.</p><button className="secondary-button" onClick={props.onOpenContinuation}>Open continuation window</button>{props.latestJob?.status === 'completed' && props.latestJob.mediaType !== 'image' && <button className="secondary-button" onClick={() => void props.onContinue(props.latestJob!)}>Continue in new window</button>}</details><PromptPanel prompt={props.prompt} setPrompt={props.setPrompt} onPromptTool={props.onPromptTool} promptingTool={props.promptingTool} promptSuggestion={props.promptSuggestion} onUseSuggestion={props.onUseSuggestion} onDismissSuggestion={props.onDismissSuggestion} /><ModeInputStrip props={props} boundScene={boundScene} selection={selection} onSelect={value => { setRailAsset(null); setSelection(value) }} /><PreviewStage job={props.latestJob} historyJobs={props.historyJobs} onSelectJob={props.onSelectJob} livePreview={props.livePreview} liveEnabled={props.liveEnabled} blurSensitive={props.blurNsfwPreview} blocker={blocker} onViewQueue={() => props.onNavigate('queue')} onDetach={detach} onContinue={props.onContinue} onContinueReference={props.onContinueReference} onSendStillToI2v={props.onSendStillToI2v} /></main>
      <Inspector props={props} boundScene={boundScene} selection={selection} selectedFile={selectedFile} selectedReference={selectedReference} onClearSelection={() => { setRailAsset(null); setSelection({ kind: 'scene' }) }} onUpdateScene={updateScene} onUpdateFile={updateFile} onPreset={choosePreset} onSceneEditor={() => setSceneEditorOpen(true)} />
    </div><GenerateBar props={props} blocker={blocker} />
    {previewPopoutRoot && createPortal(<DetachedPreviewMonitor job={props.latestJob} livePreview={props.livePreview} liveEnabled={props.liveEnabled} blurSensitive={props.blurNsfwPreview} />, previewPopoutRoot)}
    {sceneEditorOpen && <div className="video-scene-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSceneEditorOpen(false) }}><div className="video-scene-dialog" role="dialog" aria-modal="true" aria-label="Scene details"><header><strong>Scene details</strong><button type="button" onClick={() => setSceneEditorOpen(false)} aria-label="Close scene details"><X size={18} /></button></header><SceneComposer state={boundScene} onChange={updateScene} selection={selection} onInspect={setSelection} options={[]} onAddReference={() => void props.chooseReference('image')} onManageReferences={() => void props.chooseReference('image')} onRemoveCharacter={props.removeCharacter} onUpdateReferenceFile={(path, file) => { const i = props.referenceImages.findIndex(item => item.path === path); if (i >= 0) props.updateReference(i, file) }} /><footer><button type="button" onClick={() => setSceneEditorOpen(false)}>Done</button></footer></div></div>}
  </div>
}

/** Previous production surface retained as a compatibility reference during the Video workspace rollout. */
export function LegacyCreateView(props: CreateViewProps) {
  const {
    info, gpuRoutingSummary, gpuRoutingWarning, renderIntents, onApplyIntent, onSaveIntent, onDeleteIntent, sampler, setSampler, scheduler, setScheduler, experimentalSampling, setExperimentalSampling, refImageSize, setRefImageSize,
    sigmaShiftMode, setSigmaShiftMode, shiftVideo, setShiftVideo, shiftAudio, setShiftAudio, loraStrength, setLoraStrength, userLoras, setUserLoras, userLoraChoices, liveEnabled, setLiveEnabled, livePreviewMode, setLivePreviewMode, liveConnected, livePreview, blurNsfwPreview,
    upscaleMode, setUpscaleMode, h3ProReview, setH3ProReview, h3ProRefineSteps, setH3ProRefineSteps, h3RefineSteps, setH3RefineSteps, h3RefineDenoise, setH3RefineDenoise, h3LearnedUpscaleAvailable, h3LearnedUpscaleMissingNodes, h3LearnedUpscaleModelDetected, h3LearnedUpscaleDirectory, ltxAvailable, ltxMissingNodes, noDialogue, setNoDialogue, naturalMovement, setNaturalMovement, clothingPolicy, setClothingPolicy, rtxModels, rtxModel, setRtxModel, updateReference,
    mode, setMode, prompt, setPrompt, duration, setDuration, resolution, setResolution, turbo, setTurbo, turbo8Profile, setTurbo8Profile, textEncoderPreference, setTextEncoderPreference, steps, setSteps,
    seed, setSeed, seedLocked, setSeedLocked, advanced, setAdvanced, firstFrame, lastFrame, setFirstFrame, setLastFrame, chooseMedia,
    referenceImages, referenceVideos, referenceAudios, characters, wardrobes, locations, accessories, selectedCharacterIds, selectedLocationIds, removeCharacter, characterDetailReferencesEnabled, loadCharacter, loadWardrobe, loadLocation, loadAccessory, refreshSourceMedia, removeReference, chooseReference, editVideoReference, h3Validated, modelReady, selection,
    submitting, stillSubmitting, renderAnyway, connected, ollamaAvailable, ollamaModel, llmProviderLabel, promptSuggestion, promptingTool, dialogueGenerating,
    onPromptTool, onGenerateDialogue, onUseSuggestion, onDismissSuggestion, onSendStillToI2v, onContinue, onContinueReference, onContinueH3Pro, latestJob,
  } = props
  const { sceneState, setSceneState } = props
  const sourceMediaTriggerRef = useRef<HTMLButtonElement>(null)
  const sceneToolsRef = useRef<HTMLDetailsElement>(null)
  const sourceMediaCloseRef = useRef<HTMLButtonElement>(null)
  const dialogueTriggerRef = useRef<HTMLButtonElement>(null)
  const [sourceMediaOpen, setSourceMediaOpen] = useState(false)
  const [dialogueOpen, setDialogueOpen] = useState(false)
  const [intentBuilderOpen, setIntentBuilderOpen] = useState(false)
  const [activeIntentId, setActiveIntentId] = useState('')
  const [inspectorTab, setInspectorTab] = useState<'preview' | 'state'>('state')
  const [renderRailWidth, setRenderRailWidth] = useState(initialRenderRailWidth)
  const [inspectorSelection, setInspectorSelection] = useState<SceneInspectorSelection>({ kind: 'scene' })
  const [previewPopoutRoot, setPreviewPopoutRoot] = useState<HTMLElement | null>(null)
  const previewPopoutRef = useRef<Window | null>(null)
  const h3PreviewOverrideAvailable = Boolean(findH3PreviewOverrideNode(info))
  const h3AnimatedPreviewReady = h3PreviewOverrideAvailable && Boolean(selection.previewVae)
  useEffect(() => localStorage.setItem('minimax.renderRailWidth', String(renderRailWidth)), [renderRailWidth])
  const startRenderRailResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = renderRailWidth
    document.body.classList.add('resizing-workspace-rail')
    const onMove = (moveEvent: PointerEvent) => setRenderRailWidth(clampRenderRailWidth(startWidth - (moveEvent.clientX - startX)))
    const onEnd = () => {
      document.body.classList.remove('resizing-workspace-rail')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd, { once: true })
    window.addEventListener('pointercancel', onEnd, { once: true })
  }
  const selectedCharacters = selectedCharacterIds.map((id) => characters.find((character) => character.id === id)).filter(Boolean) as CharacterProject[]
  const selectedLocations = selectedLocationIds.map((id) => locations.find((location) => location.id === id)).filter(Boolean) as LocationProject[]
  const selectedBindings = allocateWorkspaceReferences(selectedCharacters.map((character) => ({ id: character.id, name: character.name, identity: characterReferences(character), detailReferences: characterDetailReferencesEnabled ? character.detailReferences : [], hairStyleIds: character.hairStyleIds, wardrobeIds: character.wardrobeIds, accessoryIds: character.accessoryIds })), wardrobes, selectedLocations.map((location) => ({ id: location.id, name: location.name, images: locationReferences(location), environmentMode: location.environmentMode, locationContext: location.locationContext, accuracyDetails: location.accuracyDetails })))
  const renderBindings = resolveRenderReferenceBindings(referenceImages, selectedBindings, clothingPolicy)
  const builderReferenceImages = renderBindings.map((binding) => binding.file)
  const boundScene = bindSceneReferences(sceneState, renderBindings, referenceVideos, referenceAudios, firstFrame, lastFrame)
  const sceneCompilation = compileScene(boundScene)
  const frameZeroGuide = boundScene.references.find(ref => ref.file.kind === 'image' && ref.anchor === 'opening')
  const frameZeroCandidates = boundScene.references.filter(ref => ref.file.kind === 'image')
  const sourceMediaCount = referenceImages.length + referenceVideos.length + referenceAudios.length
  const shotBlocker = mode === 'image' && !firstFrame ? 'Add the first frame in Sources.'
    : mode === 'frames' && !lastFrame ? 'Add the last frame in Sources.'
    : mode === 'reference' && (referenceImages.length > 9 || referenceVideos.length > 3 || referenceAudios.length > 3) ? 'Keep Sources within 9 pictures, 3 videos, and 3 audio files.'
    : ''
  const sceneBlocker = sceneCompilation.conflicts.find(item => item.severity === 'error')?.message || ''
  const renderBlocker = shotBlocker || (!renderAnyway ? sceneBlocker : '') || (mode === 'reference' && boundScene.references.some(ref => ref.anchor) && !info.MiniMaxH3AddGuide ? 'Frame anchors require MiniMaxH3AddGuide. Update ComfyUI, turn Frame 0 guide off, or use Keyframes mode.' : '') || (!connected ? 'Connect ComfyUI using Local engine or Settings.'
    : !modelReady ? 'Check the required H3 models in Settings.'
    : liveEnabled && livePreviewMode === 'h3-override' && (!h3PreviewOverrideAvailable || !selection.previewVae) ? 'Choose Automatic preview, or install the H3 preview node and decoder.'
    : upscaleMode === 'h3' && !h3LearnedUpscaleAvailable ? 'Choose upscale Off or install the H3 upscaler.'
    : upscaleMode === 'ltx' && !ltxAvailable ? 'Choose upscale Off or install the LTX upscaler requirements.'
    : upscaleMode === 'rtx' && !rtxModel ? 'Choose an RTX upscale model or turn upscale Off.' : '')
  const effectiveSteps = h3SamplingSteps(turbo, steps)
  const activeLiveJob = latestJob && latestJob.mediaType !== 'image' && ['running', 'queued'].includes(latestJob.status) ? latestJob : null
  const livePreviewForActiveJob = activeLiveJob && liveEnabled && livePreview?.promptId === activeLiveJob.promptId ? livePreview : null
  const closeSourceMedia = useCallback(() => {
    setSourceMediaOpen(false)
    window.requestAnimationFrame(() => sourceMediaTriggerRef.current?.focus())
  }, [])
  const keepSourceMediaFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), summary, select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
    const first = controls[0]
    const last = controls.at(-1)
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
  useEffect(() => {
    if (!sourceMediaOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSourceMedia()
    }
    window.addEventListener('keydown', closeOnEscape)
    window.requestAnimationFrame(() => sourceMediaCloseRef.current?.focus())
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [closeSourceMedia, sourceMediaOpen])
  useEffect(() => {
    if (mode !== 'reference' && sourceMediaOpen) setSourceMediaOpen(false)
  }, [mode, sourceMediaOpen])
  const insertPromptText = (text: string) => setPrompt([prompt, text].filter(Boolean).join("\n"))
  const closeDialogue = useCallback(() => {
    setDialogueOpen(false)
    window.requestAnimationFrame(() => dialogueTriggerRef.current?.focus())
  }, [])
  useEffect(() => () => { previewPopoutRef.current?.close() }, [])
  const detachPreview = () => {
    if (previewPopoutRef.current && !previewPopoutRef.current.closed) { previewPopoutRef.current.focus(); return }
    const popup = window.open('', 'oyama-ai-video-studio-preview', 'popup=yes,width=1080,height=720,resizable=yes')
    if (!popup) return
    popup.document.title = 'Oyama AI Video Studio · Preview monitor'
    popup.document.documentElement.className = 'preview-popout-document'
    popup.document.head.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => node.remove())
    document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style').forEach((node) => {
      const clone = node.cloneNode(true) as HTMLLinkElement | HTMLStyleElement
      if (clone.tagName === 'LINK' && node.tagName === 'LINK') (clone as HTMLLinkElement).href = (node as HTMLLinkElement).href
      popup.document.head.appendChild(clone)
    })
    popup.document.body.className = 'preview-popout-body'
    popup.document.body.replaceChildren()
    const root = popup.document.createElement('main')
    root.id = 'preview-popout-root'
    popup.document.body.appendChild(root)
    previewPopoutRef.current = popup
    setPreviewPopoutRoot(root)
    popup.addEventListener('beforeunload', () => { previewPopoutRef.current = null; setPreviewPopoutRoot(null) }, { once: true })
    popup.focus()
  }
  const smartCharacterOptions = characters.filter((character) => characterReferences(character, characterDetailReferencesEnabled).length > 0).map((character) => {
    const projected = selectedCharacterIds.includes(character.id) ? selectedCharacters : [...selectedCharacters, character]
    const projectedBindings = allocateWorkspaceReferences(projected.map((item) => ({ id: item.id, name: item.name, identity: characterReferences(item), detailReferences: characterDetailReferencesEnabled ? item.detailReferences : [], hairStyleIds: item.hairStyleIds, wardrobeIds: item.wardrobeIds, accessoryIds: item.accessoryIds })), wardrobes, selectedLocations.map((location) => ({ id: location.id, name: location.name, images: locationReferences(location), environmentMode: location.environmentMode, locationContext: location.locationContext, accuracyDetails: location.accuracyDetails })))
    const wardrobeCount = projectedBindings.filter((binding) => binding.characterId === character.id && binding.purpose === 'wardrobe').length
    return { id: `character.${character.id}`, category: 'character' as const, label: character.name, description: wardrobeCount ? `${character.description || 'Character Studio identity'} · wardrobe isolated` : character.description || 'Character Studio identity', insertion: `Character: ${character.name}.`, thumbnail: characterReferences(character, characterDetailReferencesEnabled)[0]?.preview, meta: `${projectedBindings.filter((binding) => binding.characterId === character.id).length} allocated refs`, onSelect: (nextPrompt: string) => { setPrompt(nextPrompt); loadCharacter(character.id) } }
  })
  const smartWardrobeOptions = wardrobes.filter((wardrobe) => wardrobeReferences(wardrobe).length > 0).map((wardrobe) => { const files = wardrobeReferences(wardrobe).slice(0, 9); const tags = files.map((_, index) => `<Picture ${index + 1}>`).join(', ').replace(/, ([^,]+)$/, ' and $1'); return { id: `wardrobe.${wardrobe.id}`, category: 'wardrobe' as const, label: wardrobe.name, description: wardrobe.description || 'Approved Wardrobe Studio outfit', insertion: `Wardrobe: apply the approved ${wardrobe.name} outfit from ${tags}; preserve its garments, materials, colors, fit, and accessories.`, thumbnail: files[0]?.preview, meta: `${files.length} approved`, onSelect: (nextPrompt: string) => { setPrompt(nextPrompt); loadWardrobe(wardrobe.id) } } })
  const smartLocationOptions = locations.filter((location) => locationReferences(location).length > 0).map((location) => { const files = locationReferences(location); const projected = selectedLocationIds.includes(location.id) ? selectedLocations : [...selectedLocations, location]; const projectedBindings = allocateWorkspaceReferences(selectedCharacters.map((character) => ({ id: character.id, name: character.name, identity: characterReferences(character), detailReferences: characterDetailReferencesEnabled ? character.detailReferences : [], hairStyleIds: character.hairStyleIds, wardrobeIds: character.wardrobeIds, accessoryIds: character.accessoryIds })), wardrobes, projected.map((item) => ({ id: item.id, name: item.name, images: locationReferences(item), environmentMode: item.environmentMode, locationContext: item.locationContext, accuracyDetails: item.accuracyDetails }))); return { id: `location.${location.id}`, category: 'location' as const, label: location.name, description: location.description || 'Approved Location Studio environment', insertion: `Location: ${location.name}.`, thumbnail: files[0]?.preview, meta: `${projectedBindings.filter((binding) => binding.locationId === location.id).length} allocated view${projectedBindings.filter((binding) => binding.locationId === location.id).length === 1 ? '' : 's'}`, onSelect: (nextPrompt: string) => { setPrompt(nextPrompt); loadLocation(location.id) } } })
  const applyCreatePreset = (preset: 'quality' | 'turbo' | 'preview') => {
    const [width, height] = resolution.split('x').map(Number)
    const portrait = height > width
    const square = height === width
    const base = preset === 'preview' ? square ? '640x640' : portrait ? '480x864' : '864x480' : square ? '768x768' : portrait ? '768x1344' : '1344x768'
    setResolution(base)
    setTurbo(preset === 'quality' ? 'off' : '8')
    setTurbo8Profile('balanced')
    setSteps(preset === 'quality' ? 30 : 8); setSampler('res_multistep'); setScheduler('simple'); setExperimentalSampling(false)
    setSigmaShiftMode('model'); setShiftVideo(12); setShiftAudio(3); setLoraStrength(1); setUpscaleMode('off')
  }
  const currentIntentValues: RenderSettingsPreset['values'] = { resolution, duration, turbo, steps, sampler, scheduler, experimentalSampling, refImageSize, livePreview: liveEnabled, sigmaShiftMode, shiftVideo, shiftAudio, loraStrength, upscaleMode, h3RefineSteps, h3RefineDenoise, textEncoderPreference, turbo8Profile, userLoras: userLoras.map((item) => ({ ...item })), rtxModel, livePreviewMode, noDialogue, naturalMovement, clothingPolicy, seed, seedLocked }
  const selectIntent = (id: string) => {
    setActiveIntentId(id)
    const intent = renderIntents.find((item) => item.id === id)
    if (intent) onApplyIntent(intent)
  }
  const setUserLoraSlot = (index: number, patch: Partial<{ name: string; strength: number }>) => setUserLoras(userLoras.map((slot, slotIndex) => slotIndex === index ? { ...slot, ...patch } : slot))
  return (
    <div className="create-page minimax-workspace">
      <div className="page-heading">
        <div><p className="eyebrow">CREATE · MINIMAX H3</p><h1>Video Creation</h1><p>Generate cinematic video with references, reusable assets, and focused production controls.</p></div>
        <div className="heading-actions"><div className="heading-model-card"><span><small>MODEL</small><strong>MiniMax H3</strong><em>{modeInfo.find((item) => item.id === mode)?.note ?? 'Video generation'}</em></span><Film size={22} /></div><div className="heading-state"><span className={modelReady && h3Validated ? 'ok' : 'warn'}>{modelReady && h3Validated ? <Check size={15} /> : <AlertCircle size={15} />}{!modelReady ? 'Check model paths' : h3Validated ? 'Validated H3 stack' : 'Custom H3 stack'}</span></div></div>
      </div>



      <div className="workspace-grid" style={{ '--render-rail-width': `${renderRailWidth}px` } as CSSProperties}>
        <section className="composer-panel">
          <div className="workspace-command-deck">
            <details ref={sceneToolsRef} className="scene-tools-menu create-options-menu">
              <summary><Menu size={15} /><span><strong>Scene tools</strong><small>{ollamaAvailable ? `${ollamaModel} · local` : `${llmProviderLabel} offline`}</small></span><ChevronDown size={14} /></summary>
              <div className="scene-tools-menu-panel create-options-menu-panel">
                <div className="create-options-actions" aria-label="Scene tools">
                <button type="button" aria-label="Refine scene" onClick={() => { if (sceneToolsRef.current) sceneToolsRef.current.open = false; onPromptTool('enhance') }} disabled={!ollamaAvailable || Boolean(promptingTool)}>{promptingTool === 'enhance' ? <LoaderCircle size={14} className="spin" /> : <WandSparkles size={14} />}<span><strong>Refine scene</strong><small>Polish the written direction</small></span></button>
                <button type="button" aria-label="Build shot timeline" onClick={() => { if (sceneToolsRef.current) sceneToolsRef.current.open = false; onPromptTool('timeline') }} disabled={!ollamaAvailable || Boolean(promptingTool)}>{promptingTool === 'timeline' ? <LoaderCircle size={14} className="spin" /> : <Clock3 size={14} />}<span><strong>Shot timeline</strong><small>Build a timed shot sequence</small></span></button>
                <button type="button" aria-label="Run audio pass" onClick={() => { if (sceneToolsRef.current) sceneToolsRef.current.open = false; onPromptTool('audio') }} disabled={!ollamaAvailable || Boolean(promptingTool)}>{promptingTool === 'audio' ? <LoaderCircle size={14} className="spin" /> : <Volume2 size={14} />}<span><strong>Audio pass</strong><small>Improve ambience and sound cues</small></span></button>
                {mode === 'reference' && <button ref={dialogueTriggerRef} type="button" aria-label="Open character dialogue" onClick={() => { if (sceneToolsRef.current) sceneToolsRef.current.open = false; setDialogueOpen(true) }}><MessageSquareText size={14} /><span><strong>Character dialogue</strong><small>Write performable dialogue</small></span></button>}
                </div>
              </div>
            </details>
          </div>

          <section id="workspace-direction" className={`create-section create-direction-section ${mode === 'reference' ? 'reference-prompt-builder' : ''}`}>
            <div className="create-section-heading"><span><WandSparkles size={15} /></span><div><strong>{'Scene Composer'}</strong><small>{'Direct the scene. The compiler handles H3.'}</small></div><em className={prompt.trim() ? 'complete' : ''}>{prompt.trim() ? 'Ready' : 'Required'}</em></div>
          <div className="field-group prompt-field">
<SceneComposer selection={inspectorSelection} onInspect={setInspectorSelection} onRemoveCharacter={(characterId) => { setInspectorSelection({ kind: 'scene' }); removeCharacter(characterId) }} onUpdateReferenceFile={(path, next) => { const index = referenceImages.findIndex((file) => file.path === path); if (index >= 0) updateReference(index, next) }} onAnalyzeReference={ollamaAvailable ? props.onAnalyzeReference : undefined} state={boundScene} onChange={next => { setSceneState(next); if (mode !== 'reference' && mode !== 'text') { setFirstFrame(next.references.find(ref => ref.anchor === 'opening')?.file || null); setLastFrame(next.references.find(ref => ref.anchor === 'ending')?.file || null) } }} options={[...smartCharacterOptions, ...smartWardrobeOptions, ...smartLocationOptions]} onAddReference={() => { if (mode === 'image' || mode === 'frames') { document.getElementById('workspace-sources')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return } setMode('reference'); void refreshSourceMedia().then(() => setSourceMediaOpen(true)) }} onManageReferences={() => { if (mode === 'image' || mode === 'frames') { document.getElementById('workspace-sources')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return } setMode('reference'); void refreshSourceMedia().then(() => setSourceMediaOpen(true)) }} />
            {promptSuggestion && (
              <div className="assistant-result" role="status">
                <div className="assistant-result-heading"><span><Sparkles size={14} />Local suggestion</span><small>Review before replacing your prompt</small></div>
                <textarea aria-label={`${llmProviderLabel} prompt suggestion`} value={promptSuggestion} readOnly />
                <div className="assistant-actions"><button type="button" className="secondary-button" onClick={onDismissSuggestion}>Dismiss</button><button type="button" className="primary-button" onClick={onUseSuggestion}><Check size={14} />Use suggestion</button></div>
              </div>
            )}
          </div>
          </section>

          {(mode === 'image' || mode === 'frames') && <section id="workspace-sources" className="create-section create-input-section">
            <div className="create-section-heading"><span><ImageIcon size={15} /></span><div><strong>Source media</strong><small>{mode === 'frames' ? 'Set the opening and closing composition.' : 'Choose the frame this shot begins from.'}</small></div><em className={firstFrame && (mode !== 'frames' || lastFrame) ? 'complete' : ''}>{mode === 'frames' ? `${Number(Boolean(firstFrame)) + Number(Boolean(lastFrame))} of 2` : firstFrame ? 'Ready' : 'Required'}</em></div>
          {(mode === 'image' || mode === 'frames') && (
            <div className={`frame-grid ${mode === 'image' ? 'single' : ''}`}>
              <div><MediaDrop label="First frame" note="PNG, JPG or WebP" file={firstFrame} onChoose={() => void chooseMedia('image', (file) => setFirstFrame(file))} onRemove={() => setFirstFrame(null)} />{firstFrame && <ImageCrop label="First frame" file={firstFrame} resolution={resolution} onChange={setFirstFrame} />}</div>
              {mode === 'frames' && <div><MediaDrop label="Last frame" note="Automatically fitted to output size" file={lastFrame} onChoose={() => void chooseMedia('image', (file) => setLastFrame(file))} onRemove={() => setLastFrame(null)} />{lastFrame && <ImageCrop label="Last frame" file={lastFrame} resolution={resolution} onChange={setLastFrame} />}</div>}
            </div>
          )}
          </section>}


          {intentBuilderOpen && mode === 'reference' && <Ref2vaIntentBuilder intents={renderIntents} values={currentIntentValues} onApply={(intent) => { setActiveIntentId(intent.id); onApplyIntent(intent); setIntentBuilderOpen(false) }} onSave={onSaveIntent} onDelete={onDeleteIntent} onClose={() => setIntentBuilderOpen(false)} />}

          {sourceMediaOpen && mode === 'reference' && (
            <div className="modal-backdrop source-media-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSourceMedia() }}>
              <section className="source-media-modal" role="dialog" aria-modal="true" aria-labelledby="source-media-modal-title" aria-describedby="source-media-modal-description" onKeyDown={keepSourceMediaFocus}>
                <header>
                  <div><span><ImageIcon size={18} /></span><div><small>REFERENCE WORKSPACE</small><strong id="source-media-modal-title">Source media</strong><p id="source-media-modal-description">Build the cast, locations, look, motion, and sound for this render.</p></div></div>
                  <div className="source-media-header-actions"><em>{sourceMediaCount} loaded</em><button ref={sourceMediaCloseRef} type="button" aria-label="Close source media" onClick={closeSourceMedia}><X size={18} /></button></div>
                </header>
                <div className="source-media-modal-body">
                  <section className="source-media-modal-section"><div className="source-media-section-title"><span>01</span><div><strong>Libraries</strong><small>Select reusable people, environments, props, and accessories. Their approved pictures share the 9-picture budget.</small></div></div><div className="reference-groups source-media-library-groups"><CharacterReferencePicker characters={characters} wardrobes={wardrobes} values={selectedCharacterIds} onChange={loadCharacter} /><LocationReferencePicker locations={locations} values={selectedLocationIds} onChange={loadLocation} /><AccessoryReferencePicker accessories={accessories} selectedPaths={referenceImages.map((file) => file.path)} onChange={loadAccessory} /></div>{selectedBindings.length > 0 && <details className="source-media-auto-prompt"><summary><Sparkles size={14} /><span><strong>Automatic reference direction</strong><small>{selectedBindings.length} numbered picture assignment{selectedBindings.length === 1 ? '' : 's'} sent automatically at render time</small></span><ChevronDown size={14} /></summary><ol>{sceneCompilation.subjects.map((subject) => <li key={subject.label}>{subject.name}: {subject.attributes.join("; ")}</li>)}</ol></details>}</section>
                  <section className="source-media-modal-section"><div className="source-media-section-title"><span>02</span><div><strong>Clothing behavior</strong><small>Decide whether assigned wardrobe or identity-photo clothing is authoritative.</small></div></div><div className="reference-groups source-media-policy-groups"><fieldset className="reference-fidelity clothing-policy"><legend><Shirt size={15} /><span><strong>Clothing intent</strong><small>Controls whether identity-photo clothing or assigned wardrobe is authoritative.</small></span></legend><div><label className={clothingPolicy === 'wardrobe' ? 'selected' : ''}><input type="radio" name="clothing-policy" checked={clothingPolicy === 'wardrobe'} onChange={() => setClothingPolicy('wardrobe')} /><span><strong>Assigned wardrobe</strong><small>Wardrobe Studio images exclusively control clothing. Identity-photo clothes are discarded.</small></span></label><label className={clothingPolicy === 'underwear' ? 'selected' : ''}><input type="radio" name="clothing-policy" checked={clothingPolicy === 'underwear'} onChange={() => setClothingPolicy('underwear')} /><span><strong>Underwear</strong><small>Use each adult character's own identity reference without assigned outerwear.</small></span></label><label className={clothingPolicy === 'unrestricted' ? 'selected' : ''}><input type="radio" name="clothing-policy" checked={clothingPolicy === 'unrestricted'} onChange={() => setClothingPolicy('unrestricted')} /><span><strong>Unrestricted</strong><small>Follow explicit adult fictional clothing or nudity direction in the scene prompt.</small></span></label></div></fieldset></div></section>
                  <section className="source-media-modal-section"><div className="source-media-section-title"><span>03</span><div><strong>Files and preparation</strong><small>Add standalone pictures, assign their role and retention, and choose Fit or Fill before rendering.</small></div></div><div className="reference-groups source-media-file-groups"><ReferenceRow icon={ImageIcon} label="Pictures" limit="Up to 9 total" kind="image" files={referenceImages} onAdd={() => void chooseReference('image')} onRemove={(index) => removeReference('image', index)} />{referenceImages.length > 0 && <div className="reference-crops">{referenceImages.map((file, i) => <article className="reference-crop-item" key={file.path}><header><span><strong>{file.name}</strong><small>{file.referenceRole ?? 'reference'} · output framing</small></span><div className="reference-fit-toggle" role="group" aria-label={`${file.name} crop style`}><button type="button" className={(file.crop?.fit ?? 'contain') === 'contain' ? 'selected' : ''} onClick={() => updateReference(i, { ...file, crop: { fit: 'contain', x: file.crop?.x ?? .5, y: file.crop?.y ?? .5, zoom: file.crop?.zoom ?? 1 } })}>Fit</button><button type="button" className={file.crop?.fit === 'crop' ? 'selected' : ''} onClick={() => updateReference(i, { ...file, crop: { fit: 'crop', x: file.crop?.x ?? .5, y: file.crop?.y ?? .5, zoom: file.crop?.zoom ?? 1 } })}>Fill</button></div></header><details><summary>Fine crop and reference role</summary><ImageCrop handoff label={file.name} file={file} resolution={resolution} onChange={(next) => updateReference(i, next)} /></details></article>)}</div>}<ReferenceRow icon={Film} label="Videos" limit="Up to 3 · trim longer sources to 2–15 seconds" kind="video" files={referenceVideos} onAdd={() => void chooseReference('video')} onEdit={editVideoReference} onRemove={(index) => removeReference('video', index)} /><ReferenceRow icon={Volume2} label="Audio" limit="Up to 3" kind="audio" files={referenceAudios} onAdd={() => void chooseReference('audio')} onRemove={(index) => removeReference('audio', index)} /></div></section>
                  <section className="source-media-modal-section"><div className="source-media-section-title"><span>04</span><div><strong>Final handoff inspection</strong><small>Verify the exact prepared canvas, numbered slot, role, retention, and source quality before queueing.</small></div></div><ReferenceHandoffInspector files={builderReferenceImages} labels={renderBindings.map((binding) => binding.label)} resolution={resolution} /></section>
                </div>
                <footer><span>{sourceMediaCount ? `${sourceMediaCount} file${sourceMediaCount === 1 ? '' : 's'} ready for this render` : 'No standalone files added yet'}</span><button type="button" className="primary-button" onClick={closeSourceMedia}><Check size={15} />Done</button></footer>
              </section>
            </div>
          )}

          {dialogueOpen && mode === 'reference' && <CharacterDialogueModal
            characters={selectedCharacters}
            duration={duration}
            generating={dialogueGenerating}
            ollamaAvailable={ollamaAvailable}
            providerLabel={llmProviderLabel}
            onClose={closeDialogue}
            onGenerate={onGenerateDialogue}
            onInsert={(text) => { setNoDialogue(false); insertPromptText(text); closeDialogue() }}
          />}
        </section>
        <button type="button" className="workspace-rail-resizer" role="separator" aria-label="Resize output and continuity sidebar" aria-orientation="vertical" aria-valuemin={MIN_RENDER_RAIL_WIDTH} aria-valuemax={MAX_RENDER_RAIL_WIDTH} aria-valuenow={renderRailWidth} title="Drag to resize · double-click to reset" onPointerDown={startRenderRailResize} onDoubleClick={() => setRenderRailWidth(DEFAULT_RENDER_RAIL_WIDTH)} onKeyDown={(event) => { if (event.key === 'ArrowLeft') setRenderRailWidth((value) => clampRenderRailWidth(value + 16)); if (event.key === 'ArrowRight') setRenderRailWidth((value) => clampRenderRailWidth(value - 16)); if (event.key === 'Home') setRenderRailWidth(MIN_RENDER_RAIL_WIDTH); if (event.key === 'End') setRenderRailWidth(MAX_RENDER_RAIL_WIDTH) }}><span /></button>
        <div className="workspace-right-rail">
          <PreviewPanel id="workspace-preview" title="Render monitor"><div className="panel-heading preview-monitor-heading"><div><small>{latestJob?.status === 'completed' ? 'FINAL OUTPUT' : latestJob && ['queued', 'running'].includes(latestJob.status) ? 'LIVE ENGINE FEED' : 'PRODUCTION MONITOR'}</small><strong>{latestJob?.status === 'completed' ? 'Result ready' : latestJob && ['queued', 'running'].includes(latestJob.status) ? 'Rendering now' : 'Standing by'}</strong>{latestJob && <span>{latestJob.width} × {latestJob.height}{latestJob.mediaType === 'image' ? ' · still' : ` · ${latestJob.duration}s`}</span>}</div><div className="preview-toolbar">{latestJob ? <StatusBadge status={latestJob.status} /> : <em className="monitor-standby">READY</em>}<button className="icon-button" aria-label="Detach preview" title="Detach preview" onClick={detachPreview}><PanelTopOpen size={15}/></button></div></div>          {livePreviewForActiveJob && activeLiveJob && <figure className={`live-preview workspace-live-preview ${livePreviewForActiveJob.animated ? 'animated' : ''} ${blurNsfwPreview && hasSensitivePreviewWording(activeLiveJob.prompt) ? 'sensitive-preview' : ''}`} tabIndex={blurNsfwPreview && hasSensitivePreviewWording(activeLiveJob.prompt) ? 0 : undefined}>{livePreviewForActiveJob.mime === 'video/mp4' ? <video key={livePreviewForActiveJob.url} src={livePreviewForActiveJob.url} aria-label="Animated MiniMax H3 generation preview" autoPlay loop muted playsInline preload="auto" /> : <img key={livePreviewForActiveJob.url} src={livePreviewForActiveJob.url} alt={livePreviewForActiveJob.animated ? 'Animated MiniMax H3 generation preview' : 'Live generation preview'} />}{blurNsfwPreview && hasSensitivePreviewWording(activeLiveJob.prompt) && <span className="sensitive-preview-notice">Sensitive preview · hover or focus to reveal</span>}<figcaption><span>Live preview</span>{livePreviewForActiveJob.animated ? `Animated H3 · ${h3PreviewFrameCount(activeLiveJob.duration)} frames${livePreviewForActiveJob.fps ? ` · ${livePreviewForActiveJob.fps} fps` : ''}${livePreviewForActiveJob.step && livePreviewForActiveJob.totalSteps ? ` · sampler ${livePreviewForActiveJob.step}/${livePreviewForActiveJob.totalSteps}` : ''}` : 'Intermediate decoded frame'}</figcaption></figure>}
          <div className={`preview-stage ${livePreviewForActiveJob ? 'has-live-preview' : ''}`}>
            {latestJob?.outputUrl ? latestJob.mediaType === 'image' ? <img className="reference-still-output" src={latestJob.outputUrl} alt="Generated Ref2VA reference still" /> : <VideoPlayer src={latestJob.outputUrl} /> : latestJob && ['queued', 'running'].includes(latestJob.status) ? livePreviewForActiveJob ? <div className="live-render-status" role="status"><div><span className="render-status-kicker"><i />{latestJob.status === 'queued' ? 'Queued locally' : 'Local engine active'}</span><strong>{latestJob.currentStep !== undefined && latestJob.totalSteps ? `Sampling step ${latestJob.currentStep} of ${latestJob.totalSteps}` : latestJob.status === 'queued' ? 'Waiting in the render queue' : 'Preparing the next preview update'}</strong><small>{latestJob.progressLabel && !/waiting for comfyui to start/i.test(latestJob.progressLabel) ? latestJob.progressLabel : `${latestJob.width} × ${latestJob.height} · ${latestJob.duration}s`}</small></div><span className="live-render-progress"><strong>{Math.round(latestJob.progress)}%</strong><small>live progress</small></span><div className="progress" aria-label={`${Math.round(latestJob.progress)}% render progress`}><i style={{ width: `${latestJob.progress}%` }} /></div><div className="render-stage-rail" aria-label={`Render status: ${latestJob.status === 'queued' ? 'queued' : 'sampling'}`}><span className="complete">Prepared</span><span className={latestJob.status === 'queued' ? 'active' : 'complete'}>Queued</span><span className={latestJob.status === 'running' ? 'active' : ''}>Sampling</span><span>Output</span></div></div> : <div className="render-state constructing" data-render-state={latestJob.status}><RenderConstruction state={latestJob.status} label={latestJob.progressLabel} progress={latestJob.progress || undefined} /><div className="render-status-kicker"><i />{latestJob.status === 'queued' ? 'Queued locally' : 'Local engine active'}</div><strong>{latestJob.progressLabel ?? (latestJob.status === 'queued' ? 'Waiting in queue' : latestJob.mediaType === 'image' ? 'Generating one reference still' : 'Rendering locally')}</strong><span>{latestJob.currentStep !== undefined && latestJob.totalSteps ? `Live sampler step ${latestJob.currentStep} of ${latestJob.totalSteps}` : `${latestJob.width} × ${latestJob.height}${latestJob.mediaType === 'image' ? ' · one still' : ` · ${latestJob.duration}s`}`}</span><div className="progress"><i style={{ width: `${latestJob.progress}%` }} /></div><div className="render-stage-rail" aria-label={`Render status: ${latestJob.status === 'queued' ? 'queued' : 'sampling'}`}><span className="complete">Prepared</span><span className={latestJob.status === 'queued' ? 'active' : 'complete'}>Queued</span><span className={latestJob.status === 'running' ? 'active' : ''}>Rendering</span><span>Output</span></div><small>{Math.round(latestJob.progress)}% · live ComfyUI status</small></div> : <PreviewEmptyState job={latestJob} />}
          </div>
</PreviewPanel>

        <aside id="workspace-inspector" className="preview-panel studio-inspector">
          <header className="inspector-control-header">
            <div className="inspector-control-title"><small>WORKSPACE INSPECTOR</small><strong>{inspectorTab === 'preview' ? 'Generated output' : 'Scene continuity'}</strong></div>
            <nav className="inspector-tabs" aria-label="Workspace inspector" role="tablist">
              {(['preview', 'state'] as const).map(tab => <button key={tab} type="button" role="tab" data-inspector-tab={tab} className={inspectorTab === tab ? 'selected' : ''} aria-selected={inspectorTab === tab} onClick={() => setInspectorTab(tab)}>{tab === 'preview' ? 'Output' : 'Continuity'}</button>)}
            </nav>
          </header>
          {inspectorTab === 'preview' && <div className="inspector-tab-panel preview-inspector-panel">
          {!latestJob && <div className="inspector-empty-state"><Film size={20} /><strong>No output yet</strong><small>Completed renders, generation details, and continuation tools will appear here.</small></div>}
          {h3ProReview && latestJob?.h3ProReviewPending && latestJob.status === 'completed' && latestJob.outputUrl && <section className="h3-pro-review-card"><span><Sparkles size={17} /><span><strong>H3 Pro checkpoint ready</strong><small>Review this first-pass video. Continuing reruns the same locked seed and then performs the learned 2× latent upscale plus {h3ProRefineSteps} refinement steps.</small></span></span><button type="button" className="primary-button" disabled={submitting} onClick={() => void onContinueH3Pro(latestJob)}>{submitting ? <LoaderCircle className="spin" size={14} /> : <Play size={14} />}Continue upscale</button></section>}
          {latestJob?.mediaType !== 'image' && latestJob?.provider === 'minimax' && latestJob.status === 'completed' && latestJob.outputUrl && <VideoContinuationControls job={latestJob} onContinue={onContinue} onContinueReference={onContinueReference} />}
          {latestJob?.mediaType === 'image' && latestJob.status === 'completed' && latestJob.outputUrl && <div className="still-result-actions"><a className="secondary-button" href={latestJob.outputUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />Open image</a><div className="still-i2v-actions"><span><ImagePlus size={15} />Send to I2V</span><button className="primary-button" onClick={() => onSendStillToI2v(latestJob, 'ltx25')}><Aperture size={15} />LTX 2.5</button><button className="secondary-button" onClick={() => onSendStillToI2v(latestJob, 'minimax')}><Film size={15} />MiniMax I2V</button></div></div>}
          {latestJob && <JobExecutionChips job={latestJob} expanded />}
          {latestJob && <ComfyActivityConsole job={latestJob} />}
          </div>}
          {inspectorTab === 'state' && <div className="inspector-tab-panel state-inspector-panel"><SceneSelectionInspector state={boundScene} selection={inspectorSelection} onChange={setSceneState} /><SceneContextPanels state={boundScene} onChange={setSceneState} /></div>}
        </aside>
        </div>

        <section id="workspace-render-setup" className="workspace-render-setup render-inspector-panel" aria-labelledby="workspace-render-setup-title">
          <header className="render-workspace-heading"><div><small>04 · PRODUCTION</small><strong id="workspace-render-setup-title">Render setup workspace</strong><p>Review hardware, output, conditioning, sampling, adapters, preview, and finishing before generation.</p></div><span><b>{resolution.replace('x', ' × ')}</b><small>{duration}s · {turbo === 'off' ? 'Native quality' : turbo === 'fast' ? 'FastVideo FastH3 · 8 steps' : `Turbo ${turbo}`}</small></span></header>
          <div className="render-workspace-body">
          <div className="render-policy-card">
            <div><small>SCENE BEHAVIOR</small><strong>Performance safeguards</strong><p>These instructions are compiled into the render prompt without changing your written scene direction.</p></div>
            <div className="prompt-policy-toggles" aria-label="Prompt safeguards">
              <label className="no-dialogue-toggle" title={`Blocks spoken words, narration, singing, lip-sync, captions, and text overlays${mode === 'reference' ? ' in this Reference render' : ''}.`}><input type="checkbox" checked={noDialogue} onChange={(event) => setNoDialogue(event.target.checked)} /><span><strong>No dialogue</strong><small>{noDialogue ? 'Ambient sound only' : 'Dialogue and lip-sync allowed'}</small></span></label>
              <label className="no-dialogue-toggle natural-movement-toggle" title="Adds restrained breathing, blinking, eye movement, and posture adjustment without changing the requested action, pose, camera, identity, wardrobe, or scene."><input type="checkbox" checked={naturalMovement} onChange={(event) => setNaturalMovement(event.target.checked)} /><span><strong>Natural movement</strong><small>{naturalMovement ? 'Subtle subject motion' : 'No added motion direction'}</small></span></label>
            </div>
          </div>
          {mode === 'reference' && <section className="ref2va-intent-bar" aria-labelledby="ref2va-intent-label">
            <div><span className="ref2va-intent-icon"><Sparkles size={16} /></span><span className="ref2va-intent-copy"><strong id="ref2va-intent-label">Intent</strong><small>Apply a named Ref2VA render setup to this workspace.</small></span></div>
            <div className="ref2va-intent-actions"><label><span className="sr-only">Ref2VA intent</span><select value={activeIntentId} onChange={(event) => selectIntent(event.target.value)}><option value="">Choose an intent…</option>{renderIntents.map((intent) => <option key={intent.id} value={intent.id}>{intent.name}</option>)}</select></label><button type="button" className="secondary-button" onClick={() => setIntentBuilderOpen(true)}><SlidersHorizontal size={15} />Build intents</button></div>
          </section>}
          <details open className="pipeline-summary render-engine-card"><summary><span><small>LOCAL PIPELINE</small><strong>Engine components</strong></span><ChevronDown size={12} /></summary><div className="render-engine-grid">
            <PipelineItem ready={Boolean(turbo === 'fast' ? selection.fastH3 : mode === 'reference' ? selection.ref2va : selection.fl2va)} label="Diffusion" value={turbo === 'fast' ? selection.fastH3 : mode === 'reference' ? selection.ref2va : selection.fl2va} />
            <PipelineItem ready={Boolean(selection.textEncoder)} label="Encoder" value={selection.textEncoder} />
            <PipelineItem ready={Boolean(selection.videoVae && selection.audioVae)} label="Video + audio VAE" value={selection.videoVae && selection.audioVae ? 'Both detected' : 'Missing component'} />
            <PipelineItem ready={turbo === 'off' || turbo === 'fast' ? Boolean(turbo === 'fast' ? selection.fastH3 : true) : Boolean(mode === 'reference' ? selection.ref2vLora : selection.fl2vLora)} label="Acceleration" value={turbo === 'fast' ? selection.fastH3 : turbo === 'off' ? 'Native sampling' : (mode === 'reference' ? selection.ref2vLora : selection.fl2vLora)} />
          </div>
          </details>
          <section id="workspace-output" className={`create-section create-output-section preview-output-settings ${advanced ? 'show-advanced' : 'basic-render'}`}>
            <div className="create-section-heading"><span><Gauge size={15} /></span><div><strong>Output and quality</strong><small>Configure the next render.</small></div><em className="complete">{resolution.replace('x', ' × ')} · {duration}s</em></div>
            <div className={`create-gpu-routing-summary ${gpuRoutingWarning ? 'warning' : ''}`}><Gauge size={14} /><span><strong>{gpuRoutingSummary}</strong><small>{gpuRoutingWarning ?? `H3 frame grid resolves this duration to ${frameCount(duration)} frames before generation. Whole-component placement is requested for the next render.`}</small></span></div>
            {mode !== 'reference' && <div className="create-presets" aria-label="Recommended H3 presets"><button type="button" onClick={() => applyCreatePreset('quality')}><strong>Native Quality</strong><small>1344 × 768 · 30 steps</small></button><button type="button" onClick={() => applyCreatePreset('turbo')}><strong>Turbo 8</strong><small>Native canvas · official LoRA</small></button><button type="button" onClick={() => applyCreatePreset('preview')}><strong>Preview</strong><small>864 × 480 · Turbo 8</small></button></div>}
             <div className="render-settings-masonry">
             <RenderSize value={resolution} onChange={setResolution} />
             {mode === 'reference' && <details className="output-reference-fidelity"><summary><Gauge size={16} /><span><small>REFERENCE FIDELITY</small><strong>{refImageSize === 'max' ? 'Maximum identity' : 'Balanced'}</strong><em>{refImageSize === 'max' ? 'Keep more original source detail' : 'Fit references to the output canvas'}</em></span><ChevronDown size={15} /></summary><fieldset><legend>Choose how much source-image detail H3 preserves</legend><label className={refImageSize === 'match' ? 'selected' : ''}><input type="radio" name="output-reference-fidelity" checked={refImageSize === 'match'} onChange={() => setRefImageSize('match')} /><span><strong>Balanced</strong><small>Fit references to the output canvas. Faster and uses less memory.</small></span></label><label className={refImageSize === 'max' ? 'selected' : ''}><input type="radio" name="output-reference-fidelity" checked={refImageSize === 'max'} onChange={() => setRefImageSize('max')} /><span><strong>Maximum identity</strong><small>Keep more original image detail. Slower and uses more memory.</small></span></label></fieldset></details>}
             {mode === 'reference' && <section className={`frame-zero-guide-setting ${frameZeroGuide ? 'active' : ''}`} aria-labelledby="frame-zero-guide-title">
               <div className="frame-zero-guide-heading"><span><Aperture size={17} /></span><div><small>CONTINUATION CONTROL</small><strong id="frame-zero-guide-title">Frame 0 guide</strong><p>Choose one picture to VAE-anchor at native <code>frame_idx 0</code>.</p></div><em>{frameZeroGuide ? '0.00s anchored' : 'Off'}</em></div>
               <label><span>Literal opening source</span><select aria-label="Frame 0 guide source" value={frameZeroGuide?.id || ''} disabled={!frameZeroCandidates.length} onChange={(event) => setSceneState(setFrameZeroGuide(boundScene, event.target.value || undefined))}><option value="">Off · references do not lock the opening</option>{frameZeroCandidates.map((ref) => { const label = sceneCompilation.references.find(item => item.id === ref.id)?.label.replace(/[<>]/g, '') || 'Picture'; return <option key={ref.id} value={ref.id}>{label} · {ref.name}</option> })}</select></label>
               <div className="frame-zero-guide-meaning"><span><strong>Frame 0 anchor</strong><small>Native Add Guide conditioning fixes this picture as the opening visual state at 0.00s.</small></span><span><strong>Reference only</strong><small>Guides identity, wardrobe, scene, motion, or style without fixing the first generated frame.</small></span></div>
               {!frameZeroCandidates.length && <p className="field-help">Add at least one picture in Sources to enable a Frame 0 guide.</p>}
               {frameZeroGuide && !info.MiniMaxH3AddGuide && <p className="field-help upscale-warning">This ComfyUI installation does not report MiniMaxH3AddGuide. Update ComfyUI or turn Frame 0 guide off.</p>}
             </section>}
            <section className="ref2va-setting-group render-plan-card" aria-labelledby="render-plan-title"><div className="ref2va-setting-heading"><span>01</span><div><strong id="render-plan-title">Render plan</strong><small>Set timing and the primary H3 sampling recipe.</small></div></div><div className="render-controls"><div className="field-group"><label htmlFor="duration">Duration</label><div className="range-line"><input id="duration" type="range" min="2" max="15" step="0.5" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /><output>{duration}s</output></div></div><SelectField label="Sampling quality" value={turbo} onChange={(value) => setTurbo(value as 'off' | '4' | '8' | 'fast')} options={mode === 'reference' ? [["off", `Native quality · ${steps} steps`], ["8", 'Turbo 8 · Ref2VA v1.0 · 768p'], ["4", 'Turbo 4 · Ref2VA v0.1']] : mode === 'text' ? [["off", `Native quality · ${steps} steps`], ["8", 'Official Turbo 8'], ["fast", 'FastVideo FastH3 · official 8-step T2VA'], ["4", 'Turbo 4 · experimental']] : [["off", `Native quality · ${steps} steps`], ["8", 'Official Turbo 8'], ["4", 'Turbo 4 · experimental']]} /></div>
            <div className="ref2va-seed-control">
              <div className="field-group"><label htmlFor="h3-ref2va-seed">MiniMax H3 seed</label><input id="h3-ref2va-seed" className="number-input" type="number" min={0} max={999999999999} step={1} value={seed} disabled={seedLocked || submitting || stillSubmitting} onChange={(event) => setSeed(Math.max(0, Math.min(999999999999, Math.floor(Number(event.target.value) || 0))))} /></div>
              <div className="ref2va-seed-actions">
                <button type="button" className="seed-step-button" aria-label="Decrease Ref2VA seed by one" title="Use the previous seed value" disabled={seed <= 0 || submitting || stillSubmitting} onClick={() => setSeed(seed - 1)}>−1</button>
                <button type="button" className="seed-step-button" aria-label="Increase Ref2VA seed by one" title="Use the next seed value" disabled={seed >= 999999999999 || submitting || stillSubmitting} onClick={() => setSeed(seed + 1)}>+1</button>
                <button type="button" className="secondary-button" aria-pressed={seedLocked} aria-label={seedLocked ? 'Unlock MiniMax H3 seed' : 'Lock MiniMax H3 seed'} title={seedLocked ? 'Unlock to type or randomize this seed. The −1 and +1 buttons remain available.' : 'Keep this seed for Ref2VA and I2V renders'} disabled={submitting || stillSubmitting} onClick={() => setSeedLocked(!seedLocked)}><LockKeyhole size={15} />{seedLocked ? 'Locked' : 'Unlocked'}</button>
                <button type="button" className="secondary-button" aria-label="Randomize MiniMax H3 seed" title={seedLocked ? 'Unlock the seed before randomizing' : 'Choose a different random seed'} disabled={seedLocked || submitting || stillSubmitting} onClick={() => setSeed(randomH3Seed(seed))}><Dices size={15} />Randomize</button>
              </div>
              <p className="field-help">{seedLocked ? 'Locked: this seed stays fixed across Ref2VA and I2V submissions. Use −1 or +1 for a deliberate one-step variation; unlock to type or randomize.' : 'Unlocked: this seed changes after each successful H3 submission. Lock it to carry the Ref2VA seed into I2V.'}</p>
            </div>
            <p className="field-help">Choose Native for full-quality sampling, or Turbo for a shorter render. FastVideo FastH3 is an official distilled text-to-audio-video checkpoint: it is fixed to 8 steps and does not support image, first/last-frame, or reference conditioning.</p>
            {turbo === '8' && <><SelectField label="Turbo 8 profile" value={turbo8Profile} onChange={(value) => setTurbo8Profile(value as Turbo8Profile)} options={[["stable", 'Stable · Euler + Simple · faces/dialogue'], ["balanced", 'Balanced · res_multistep + Simple'], ["motion", 'Motion · res_multistep + Beta'], ["euler-beta", 'Euler + Beta · controlled test']]}/><NumberField label="Turbo 8 steps" value={effectiveSteps} min={4} max={12} onChange={setSteps} /><p className="field-help">8 is the trained default. Use 9–12 steps for controlled coherence or detail testing; 12 is the supported maximum for this Turbo recipe.</p></>}
            </section>
            <section className="ref2va-setting-group ref2va-adapter-group" aria-labelledby="user-lora-title"><div className="ref2va-setting-heading"><span>02</span><div><strong>Adapters</strong><small>Add compatible ComfyUI LoRAs after the selected H3 recipe.</small></div></div><section className="user-lora-slots"><div><span><strong id="user-lora-title">Additional ComfyUI LoRAs</strong><small>Apply up to three adapters from your configured LoRAs folder.</small></span><em>{userLoras.filter((slot) => slot.name).length}/3 selected</em></div>{userLoras.map((slot, index) => <div className="user-lora-slot" key={index}><label>LoRA {index + 1}<select value={slot.name} disabled={!userLoraChoices.length} onChange={(event) => setUserLoraSlot(index, { name: event.target.value })}><option value="">No additional LoRA</option>{userLoraChoices.filter((name) => name === slot.name || !userLoras.some((other, otherIndex) => otherIndex !== index && other.name === name)).map((name) => <option key={name} value={name}>{name}</option>)}</select></label><NumberField label="Strength" value={slot.strength} min={0} max={2} step={0.05} disabled={!slot.name} onChange={(strength) => setUserLoraSlot(index, { strength })} /></div>)}<p className="field-help">Official H3 Turbo LoRAs stay automatic and do not consume these slots. Additional adapters are loaded after Turbo; use short fixed-seed tests because unsupported model adapters can reduce stability.</p>{!userLoraChoices.length && <p className="field-help">No extra LoRAs were found. Add compatible files to the configured ComfyUI LoRAs folder, then rescan in Settings.</p>}</section></section>
            <section className="ref2va-setting-group render-finish-card" aria-labelledby="preview-finish-title">
              <div className="ref2va-setting-heading"><span>03</span><div><strong id="preview-finish-title">Preview and finish</strong><small>Choose what to watch while sampling and what happens after rendering.</small></div></div>
              <div className="render-extras">
                <div className="ref2va-subsection-title">During the render</div>
                <label><input type="checkbox" checked={liveEnabled} onChange={(event) => setLiveEnabled(event.target.checked)} />Live preview <small>{liveEnabled ? liveConnected ? 'Connected · waiting for preview frames' : 'Connecting to ComfyUI…' : 'Off'}</small></label>
                <label className="live-preview-mode"><span>Preview source</span><select value={livePreviewMode} disabled={!liveEnabled} onChange={(event) => setLivePreviewMode(event.target.value as 'auto' | 'standard' | 'h3-override')}><option value="auto">Automatic · H3 animation when ready</option><option value="standard">Standard first frame</option><option value="h3-override">Require H3 animation · 12 fps</option></select></label>
                <p className={`field-help preview-availability ${livePreviewMode === 'h3-override' && !h3AnimatedPreviewReady ? 'upscale-warning' : ''}`} role="status">{!liveEnabled ? 'Live previews are off; rendering and saved output are unaffected.' : livePreviewMode === 'standard' ? 'Standard mode shows decoded still frames while sampling.' : h3AnimatedPreviewReady ? `H3 motion preview ready · ${h3PreviewFrameCount(duration)} frames at ${H3_PREVIEW_FPS} fps during sampling.` : `H3 motion preview unavailable${!h3PreviewOverrideAvailable ? ' · Preview Override node missing' : ' · compatible Tiny VAE decoder missing'}. Automatic mode will show standard frames without blocking the render.`}</p>
                <div className="ref2va-subsection-title after-render">After the render</div>
                <div className="upscale-options" role="group" aria-labelledby="upscale-label"><span id="upscale-label">H3 refinement and upscale</span><label><input type="radio" name="upscale" checked={upscaleMode === 'off'} onChange={() => setUpscaleMode('off')} />Off</label><label><input type="radio" name="upscale" checked={upscaleMode === 'refine'} onChange={() => setUpscaleMode('refine')} />Refine · same resolution</label><label><input type="radio" name="upscale" checked={upscaleMode === 'h3'} disabled={!h3LearnedUpscaleAvailable} onChange={() => setUpscaleMode('h3')} />Refine + Upscale · H3 2×</label><label><input type="radio" name="upscale" checked={upscaleMode === 'ltx'} disabled={!ltxAvailable} onChange={() => setUpscaleMode('ltx')} />LTX 2.5 latent · 2×</label><label><input type="radio" name="upscale" checked={upscaleMode === 'rtx'} disabled={rtxModels.length === 0} onChange={() => setUpscaleMode('rtx')} />RTX / CUDA frames · 2× · experimental</label></div>
                {upscaleMode === 'rtx' && <SelectField label="AI upscale model" value={rtxModel} onChange={setRtxModel} options={rtxModels.map((name) => [name, name])} />}
                {upscaleMode === 'refine' && <><div className="h3-pro-refine-control"><NumberField label="Refinement steps" value={h3RefineSteps} min={1} max={30} step={1} onChange={(value) => setH3RefineSteps(Math.max(1, Math.min(30, Math.round(value) || 1)))} /><small>Start with 2–4 steps. More steps take longer at the same resolution.</small></div><div className="h3-pro-refine-control"><NumberField label="Refinement strength / denoise" value={h3RefineDenoise} min={0.01} max={1} step={0.05} onChange={(value) => setH3RefineDenoise(Math.max(0.01, Math.min(1, Number(value) || 0.01)))} /><small>Start at 0.30. Lower values preserve composition and motion; higher values redraw more detail.</small></div><p className="field-help" role="status" aria-live="polite">H3 runs a second partial-denoise pass on the original {resolution.replace('x', ' × ')} latent. The first pass audio stays in the final video.</p></>}
                {upscaleMode === 'h3' && <><div className="h3-pro-refine-control"><NumberField label="H3 refinement steps" value={h3ProRefineSteps} min={1} max={30} step={1} onChange={(value) => setH3ProRefineSteps(Math.max(1, Math.min(30, Math.round(value) || 1)))} /><small>More steps can reconstruct additional detail but increase target-resolution render time. Start with 4–8.</small></div><label className="h3-pro-review-toggle"><input type="checkbox" checked={h3ProReview} onChange={(event) => setH3ProReview(event.target.checked)} /><span><strong>Review first pass before upscale</strong><small>{h3ProReview ? 'Render the native-size video first, review it, then choose Continue upscale.' : 'Run generation, learned 2× upscale, and H3 refinement automatically in one job.'}</small></span></label><p className="field-help">The learned 3D upscaler enlarges the video latent 2×, then H3 performs {h3ProRefineSteps} partial-denoise refinement step{h3ProRefineSteps === 1 ? '' : 's'} while the original audio latent stays locked. Final size: {resolution.split('x').map((value) => h3LatentUpscaleSize(Number(value))).join(' × ')}.</p></>}
                {!h3LearnedUpscaleAvailable && <p className="field-help upscale-warning">To enable H3 Latent Upscale Pro, install the <a href="https://github.com/xmarre/Comfyui_Minimax_h3_latent_Upscaler-Plus" target="_blank" rel="noreferrer">H3 Latent Upscaler Plus nodes</a>, then put <a href="https://huggingface.co/LBH-123-AI/Minimax_h3_latent_Upscaler" target="_blank" rel="noreferrer">minimax_h3_latent_upscaler_3d_fp16.safetensors</a> in {h3LearnedUpscaleDirectory ? <code>{h3LearnedUpscaleDirectory}</code> : <code>ComfyUI/models/latent_upscale_models</code>}. Restart ComfyUI and refresh Local engine.{h3LearnedUpscaleMissingNodes.length ? ` Missing nodes: ${h3LearnedUpscaleMissingNodes.join(', ')}.` : !h3LearnedUpscaleModelDetected ? ' The running engine does not list the required 3D checkpoint.' : ''}</p>}
                <p className={`field-help ${upscaleMode === 'rtx' ? 'upscale-warning' : ''}`}>{upscaleMode === 'ltx' ? `MiniMax frames are encoded with the LTX‑2.5 video VAE, spatially upsampled exactly 2×, decoded, and joined to the untouched MiniMax audio.` : upscaleMode === 'rtx' ? `Experimental frame-by-frame upscale using ${rtxModel || 'the selected model'} can amplify flicker.` : upscaleMode === 'h3' ? h3ProReview ? 'The checkpoint is a finished native-resolution video. Continue uses the same seed and settings for the Pro rerun.' : 'Direct mode runs the complete Pro pipeline without stopping for approval.' : upscaleMode === 'refine' ? 'The video latent is sampled again at the same resolution, with no upscaler model required.' : !ltxAvailable && ltxMissingNodes.length ? `LTX 2× is unavailable until ComfyUI provides: ${ltxMissingNodes.join(', ')}.` : 'The original MiniMax video is saved without post-processing.'}</p>
              </div>
            </section>
            </div>
            <button className="advanced-toggle render-advanced-toggle" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced} aria-controls="render-advanced-panel"><SlidersHorizontal size={16} /><span><strong>Advanced H3</strong><small>Encoder, sampler, sigma shifts, LoRAs, preview pipeline, and upscale.</small></span><ChevronDown size={15} className={advanced ? 'rotated' : ''} /></button>
            <section id="render-advanced-panel" className="ref2va-setting-group compact-advanced-grid" aria-hidden={!advanced}><div className="ref2va-setting-heading"><span>04</span><div><strong>Model and sampling</strong><small>Override the validated H3 defaults only when needed.</small></div></div><div className="advanced-grid"><SelectField label="Text encoder" value={textEncoderPreference} onChange={(value) => setTextEncoderPreference(value as 'fast' | 'quality')} options={[["fast", 'Fast · NVFP4-AWQ'], ["quality", 'Quality · INT8 ConvRot']]} /><NumberField label="Full-quality steps" value={steps} min={16} max={30} onChange={setSteps} disabled={turbo !== 'off'} /><div className="turbo-lora-weight"><NumberField label="Official Turbo LoRA weight" value={loraStrength} min={0} max={2} step={0.05} onChange={setLoraStrength} disabled={turbo === 'off'} /></div><label className="sampling-opt-in"><input type="checkbox" checked={experimentalSampling} onChange={(event) => setExperimentalSampling(event.target.checked)} />Custom sampler and scheduler</label><SelectField label="Sampler" value={experimentalSampling ? sampler : turbo === '8' ? turbo8Sampling(turbo8Profile).sampler : 'res_multistep'} onChange={setSampler} disabled={!experimentalSampling} options={[...new Set([sampler, 'euler', 'res_multistep', ...choices(info, 'KSamplerSelect', 'sampler_name')])].map((value) => [value, value])} /><SelectField label="Scheduler" value={experimentalSampling ? scheduler : turbo === '8' ? turbo8Sampling(turbo8Profile).scheduler : 'simple'} onChange={setScheduler} disabled={!experimentalSampling} options={[...new Set([scheduler, 'simple', 'beta', ...choices(info, 'BasicScheduler', 'scheduler')])].map((value) => [value, value])} /><SelectField label="Sigma shifts" value={sigmaShiftMode} onChange={(value) => setSigmaShiftMode(value as 'model' | 'custom')} options={[["model", 'Model defaults · 12 / 3'], ["custom", 'Custom shifts']]} /><NumberField label="Video shift" value={shiftVideo} min={0.01} max={100} step={0.01} onChange={setShiftVideo} disabled={sigmaShiftMode !== 'custom'} /><NumberField label="Audio shift" value={shiftAudio} min={0.01} max={100} step={0.01} onChange={setShiftAudio} disabled={sigmaShiftMode !== 'custom'} /></div></section>
            <p className="field-help render-duration">{frameCount(duration)} frames · {(frameCount(duration) / 24).toFixed(2)}s at 24 fps.</p>
          </section></div>
          <div id="h3-render-readiness" className={`h3-render-readiness ${renderBlocker ? 'blocked' : 'ready'}`} role="status"><strong>{renderBlocker ? 'Before you generate' : 'Ready to render'}</strong><span>{renderBlocker || 'Review the output settings, then generate your video. Progress and results appear in Preview.'}</span></div>
        </section>
        {previewPopoutRoot && createPortal(<DetachedPreviewMonitor job={latestJob} livePreview={livePreview} liveEnabled={liveEnabled} blurSensitive={blurNsfwPreview} />, previewPopoutRoot)}
      </div>
    </div>
  )
}

function PreviewEmptyState({ job }: { job?: GenerationJob }) {
  const failed = job?.status === 'failed'
  const cancelled = job?.status === 'cancelled'
  return <div className="empty-preview" role={failed ? 'alert' : 'status'}><div className="preview-icon">{failed ? <AlertCircle size={28} /> : <Film size={28} />}</div><strong>{failed ? 'Render did not complete' : cancelled ? 'Render cancelled' : 'Your preview will appear here'}</strong><span>{failed ? job.error || 'Check the activity log, correct the issue, then generate again.' : cancelled ? 'Your shot settings are still available. Generate again when you are ready.' : 'Set your sources and shot direction, review the render settings, then generate. Live updates and the finished result appear here.'}</span></div>
}

function DetachedPreviewMonitor({ job, livePreview, liveEnabled, blurSensitive }: { job?: GenerationJob; livePreview: LivePreview | null; liveEnabled: boolean; blurSensitive: boolean }) {
  const isRenderingVideo = Boolean(job && job.mediaType !== 'image' && ['running', 'queued'].includes(job.status))
  const isLive = Boolean(isRenderingVideo && liveEnabled && livePreview && livePreview.promptId === job?.promptId)
  const sensitive = Boolean(job && blurSensitive && hasSensitivePreviewWording(job.prompt))
  return <section className="detached-preview-monitor" aria-label="Detached preview monitor">
    <header><span><small>OYAMA AI VIDEO STUDIO</small><strong>Preview monitor</strong></span>{isRenderingVideo && job && <StatusBadge status={job.status} />}</header>
    <main>
      {isLive && livePreview && <figure className={`live-preview detached-live-preview ${livePreview.animated ? 'animated' : ''} ${sensitive ? 'sensitive-preview' : ''}`} tabIndex={sensitive ? 0 : undefined}>
        {livePreview.mime === 'video/mp4' ? <video key={livePreview.url} src={livePreview.url} aria-label="Animated MiniMax H3 generation preview" autoPlay loop muted playsInline /> : <img key={livePreview.url} src={livePreview.url} alt={livePreview.animated ? 'Animated MiniMax H3 generation preview' : 'Live generation preview'} />}
        {sensitive && <span className="sensitive-preview-notice">Sensitive preview · hover or focus to reveal</span>}
        <figcaption>{livePreview.animated ? `Live animated preview${livePreview.fps ? ` · ${livePreview.fps} fps` : ''}` : 'Live generation preview'}</figcaption>
      </figure>}
      {!isLive && (job?.outputUrl ? job.mediaType === 'image' ? <img src={job.outputUrl} alt="Completed reference still" /> : <VideoPlayer src={job.outputUrl} /> : isRenderingVideo && job ? <div className="detached-preview-state"><RenderConstruction state={job.status} /><strong>{job.progressLabel ?? (job.status === 'queued' ? 'Waiting in queue' : 'Rendering locally')}</strong><span>{Math.round(job.progress)}% · {job.width} × {job.height}</span><div className="progress"><i style={{ width: `${job.progress}%` }} /></div></div> : <PreviewEmptyState job={job} />)}
    </main>
    <footer>{job ? <span>{job.width} × {job.height}{job.mediaType === 'image' ? ' · Still image' : ` · ${job.duration}s`}</span> : <span>Move this window to any display for a dedicated monitor.</span>}<span>{isLive ? 'Updates live' : job?.outputUrl ? 'Render output' : isRenderingVideo ? 'Preparing preview' : job?.status === 'failed' ? 'Render failed' : job?.status === 'cancelled' ? 'Cancelled' : 'Awaiting render'}</span></footer>
  </section>
}

function Ref2vaIntentBuilder({ intents, values, onApply, onSave, onDelete, onClose }: { intents: RenderSettingsPreset[]; values: RenderSettingsPreset['values']; onApply(intent: RenderSettingsPreset): void; onSave(name: string, values: RenderSettingsPreset['values']): void; onDelete(intent: RenderSettingsPreset): void; onClose(): void }) {
  const [name, setName] = useState('')
  const [snapshot, setSnapshot] = useState<RenderSettingsPreset['values'] | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { window.requestAnimationFrame(() => closeRef.current?.focus()) }, [])
  const snapshotValues = snapshot ?? values
  const summary = `${snapshotValues.resolution.replace('x', ' × ')} · ${snapshotValues.duration}s · ${snapshotValues.turbo === 'off' ? `${snapshotValues.steps} steps` : `Turbo ${snapshotValues.turbo} · ${snapshotValues.steps} steps`}`
  return <div className="modal-backdrop intent-builder-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="intent-builder-modal" role="dialog" aria-modal="true" aria-labelledby="intent-builder-title" onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}>
      <header><span><Sparkles size={18} /><span><strong id="intent-builder-title">Ref2VA intent builder</strong><small>Save the current render setup as a reusable intent. Prompts and reference media stay untouched.</small></span></span><button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label="Close intent builder"><X size={18} /></button></header>
      <div className="intent-builder-body">
        {!snapshot ? <section className="intent-snapshot-card"><div><span><strong>Current Ref2VA setup</strong><small>{summary}</small></span><span>{values.turbo8Profile} profile</span></div><button className="primary-button" type="button" onClick={() => setSnapshot({ ...values })}><Save size={15} />Snapshot intent</button></section> : <form onSubmit={(event) => { event.preventDefault(); const trimmed = name.trim(); if (!trimmed) return; onSave(trimmed.slice(0, 60), snapshot); setName(''); onClose() }}>
          <div className="intent-current-values"><span><strong>Snapshot captured</strong><small>{summary}</small></span><span>{snapshotValues.turbo8Profile} profile</span></div>
          <label><span>Name this intent</span><input autoFocus value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="e.g. Dialogue close-up or Face detail" /></label>
          <div className="intent-snapshot-actions"><button className="secondary-button" type="button" onClick={() => setSnapshot(null)}>Retake</button><button className="primary-button" type="submit" disabled={!name.trim()}><Save size={15} />Save intent</button></div>
        </form>}
        <section className="intent-library" aria-labelledby="intent-library-title"><div><strong id="intent-library-title">Saved intents</strong><small>{intents.length ? 'Choose one to replace this workspace’s render settings.' : 'Save your first intent above, then select it directly from Ref2VA.'}</small></div>{intents.length > 0 && <div>{intents.map((intent) => <article key={intent.id}><span><strong>{intent.name}</strong><small>{intent.values.resolution.replace('x', ' × ')} · {intent.values.duration}s · {intent.values.turbo === 'off' ? `${intent.values.steps} steps` : `Turbo ${intent.values.turbo} · ${intent.values.steps} steps`}</small></span><span><button type="button" className="secondary-button" onClick={() => onApply(intent)}>Apply</button><button type="button" className="icon-button" onClick={() => { if (window.confirm(`Delete intent “${intent.name}”?`)) onDelete(intent) }} aria-label={`Delete intent ${intent.name}`}><Trash2 size={15} /></button></span></article>)}</div>}</section>
      </div>
      <footer><span>Intents apply resolution, duration, quality, sampling, fidelity, preview, and finish settings only.</span><button type="button" className="secondary-button" onClick={onClose}>Done</button></footer>
    </section>
  </div>
}

function VideoPlayer({ src, onDuration }: { src: string; onDuration?(duration: number): void }) {
  const [failure, setFailure] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [playbackState, setPlaybackState] = useState<'loading' | 'ready' | 'playing' | 'buffering' | 'ended'>('loading')
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    setFailure('')
    setPlaybackState('loading')
    videoRef.current?.load()
  }, [src, attempt])

  const markPlayable = () => {
    setPlaybackState((state) => state === 'playing' ? state : 'ready')
  }

  if (failure) {
    return <div className="playback-error" role="alert"><AlertCircle size={25} /><strong>Video could not be decoded</strong><span>{failure}</span><button className="secondary-button" onClick={() => { setFailure(''); setAttempt((value) => value + 1) }}><RefreshCw size={15} />Retry playback</button></div>
  }

  return <div className="stable-video-player" data-playback-state={playbackState}>
    <video ref={videoRef} src={src} controls playsInline preload="metadata" onLoadStart={() => setPlaybackState('loading')} onLoadedMetadata={(event) => onDuration?.(event.currentTarget.duration)} onLoadedData={markPlayable} onCanPlay={markPlayable} onPlaying={() => setPlaybackState('playing')} onPause={() => setPlaybackState((state) => state === 'ended' || state === 'loading' ? state : 'ready')} onEnded={() => setPlaybackState('ended')} onWaiting={() => setPlaybackState('buffering')} onStalled={() => setPlaybackState('buffering')} onError={(event) => { const mediaError = event.currentTarget.error; const messages: Record<number, string> = { 1: 'Playback was interrupted.', 2: 'The local media file could not be read.', 3: 'The video codec could not be decoded.', 4: 'This video format is not supported.' }; setFailure(messages[mediaError?.code ?? 0] || mediaError?.message || 'Electron could not play this video.') }} />
    {playbackState === 'loading' && <div className="video-readiness" role="status"><LoaderCircle size={18} className="spin" /><span><strong>Preparing local playback</strong><small>Loading the first playable frame…</small></span></div>}
    {playbackState === 'buffering' && <div className="video-buffering-status" role="status"><span />Stabilizing playback</div>}
    {playbackState === 'ended' && <button className="video-replay-button" type="button" onClick={() => { const video = videoRef.current; if (!video) return; video.currentTime = 0; void video.play() }}><RefreshCw size={15} />Replay video</button>}
  </div>
}

function VideoContinuationControls({ job, onContinue, onContinueReference }: { job: GenerationJob; onContinue(job: GenerationJob): Promise<void>; onContinueReference(job: GenerationJob): Promise<void> }) {
  const [busy, setBusy] = useState<'i2v' | 'ref2va' | null>(null)
  const run = async (target: 'i2v' | 'ref2va') => { setBusy(target); try { await (target === 'i2v' ? onContinue(job) : onContinueReference(job)) } finally { setBusy(null) } }
  return <section className="video-continuation" aria-labelledby="video-continuation-title"><header><strong id="video-continuation-title">Continue this video</strong><small>Plan the next beats with saved motion context when available, or continue from a rendered frame.</small></header><div className="video-continuation-options"><button className="primary-button" disabled={!!busy} onClick={() => void run('i2v')}><SkipForward size={14} />Open Continuation Script<span>Use this completed clip as the source</span></button><button className="secondary-button" disabled={!!busy} onClick={() => void run('ref2va')}>{busy === 'ref2va' ? <LoaderCircle className="spin" size={14} /> : <ImagePlus size={14} />}Quick Ref2VA frame<span>Use the final frame in Create</span></button></div></section>
}

const DEFAULT_RENDER_RAIL_WIDTH = 400
const MIN_RENDER_RAIL_WIDTH = 320
const MAX_RENDER_RAIL_WIDTH = 620
const clampRenderRailWidth = (value: number) => Math.min(MAX_RENDER_RAIL_WIDTH, Math.max(MIN_RENDER_RAIL_WIDTH, Math.round(value)))

function initialRenderRailWidth() {
  const stored = Number(localStorage.getItem('minimax.renderRailWidth'))
  return Number.isFinite(stored) && stored > 0 ? clampRenderRailWidth(stored) : DEFAULT_RENDER_RAIL_WIDTH
}

function MediaDrop({ label, note, file, onChoose, onRemove }: { label: string; note: string; file: MediaFile | null; onChoose(): void; onRemove(): void }) {
  return <div className={`media-drop ${file ? 'has-file' : ''}`}>{file?.preview ? <img src={file.preview} alt="" /> : null}<div className="media-drop-content"><span className="upload-icon"><Upload size={19} /></span><strong>{file?.name ?? label}</strong><small>{file ? 'Ready to use' : note}</small><button onClick={onChoose}>{file ? 'Replace' : 'Choose image'}</button></div>{file && <button className="remove-media" onClick={onRemove} aria-label={`Remove ${label}`}><X size={15} /></button>}</div>
}

function ReferenceRow({ icon: Icon, label, limit, kind, files, onAdd, onEdit, onRemove }: { icon: typeof Film; label: string; limit: string; kind: MediaKind; files: MediaFile[]; onAdd(): void; onEdit?(index: number): void; onRemove(index: number): void }) {
  return <div className="reference-row"><div className="reference-title"><span><Icon size={17} /></span><div><strong>{label}</strong><small>{limit}</small></div></div><div className="reference-files">{files.map((file, index) => <div className="file-pill" key={`${file.path}-${index}`}>{file.preview && kind === 'image' ? <><img src={file.preview} alt="" /><span className="reference-hover-preview" role="tooltip"><img src={file.preview} alt={`Large preview of ${file.name}`} /><b>{file.name}</b></span></> : <Icon size={15} />}<span><strong>{kind === 'image' ? `Picture ${index + 1}` : kind === 'video' ? `Video ${index + 1}` : `Audio ${index + 1}`}</strong><small>{file.clip ? `${(file.clip.end - file.clip.start).toFixed(1)}s · ${file.name}` : file.name}</small></span>{onEdit && <button onClick={() => onEdit(index)} aria-label={`Edit clip ${file.name}`} title="Change reference clip"><Scissors size={13} /></button>}<button onClick={() => onRemove(index)} aria-label={`Remove ${file.name}`}><X size={14} /></button></div>)}<button className="add-reference" onClick={onAdd} disabled={files.length >= (kind === 'image' ? 9 : 3)}><Plus size={16} />Add {kind}</button></div></div>
}

function CharacterReferencePicker({ characters, wardrobes, values, onChange }: { characters: CharacterProject[]; wardrobes: WardrobeProject[]; values: string[]; onChange(value: string): void }) {
  return <fieldset className="character-reference-picker multi-character-picker"><legend>Characters in this render</legend><div><span><Users size={17} /></span><span><strong>Character library</strong><small>Select several people. Their identity, assigned hair, wardrobe, and accessories are imported together within the 9-picture limit.</small></span></div><div className="character-reference-choices">{characters.map((character) => { const references = characterReferences(character); const selected = values.includes(character.id); const wardrobe = wardrobes.find((item) => item.id === character.wardrobeIds[0]); const wardrobeCount = wardrobe ? wardrobeReferences(wardrobe).length : 0; const hair = loadHairStyleProjects().find((item) => item.id === character.hairStyleIds[0]); return <label className={selected ? 'selected' : ''} key={character.id}><input type="checkbox" checked={selected} disabled={!references.length} onChange={() => onChange(character.id)} />{references[0]?.preview ? <img className="reference-choice-thumbnail" src={references[0].preview} alt="" /> : <span className="reference-choice-placeholder"><Users size={18} /></span>}<span><strong>{character.name}</strong><small>{references.length ? `${references.length} identity image${references.length === 1 ? '' : 's'}` : 'No approved identity images'}</small><em>{hair?.referenceImage ? `Hair · ${hair.name}` : character.hairStyleIds.length ? 'Hair needs an approved image' : 'No assigned hair'} · {wardrobeCount ? `Wardrobe · ${wardrobe?.name}` : character.wardrobeIds.length ? 'Wardrobe needs an approved image' : 'No assigned wardrobe'}</em></span>{wardrobeCount > 0 && wardrobeReferences(wardrobe!)[0]?.preview && <img className="reference-choice-asset" src={wardrobeReferences(wardrobe!)[0].preview} alt={`${wardrobe!.name} assigned wardrobe`} />}</label> })}</div>{values.length > 0 && <button type="button" className="secondary-button" onClick={() => onChange('')}>Clear cast</button>}</fieldset>
}

function LocationReferencePicker({ locations, values, onChange }: { locations: LocationProject[]; values: string[]; onChange(value: string): void }) {
  if (!locations.length) return null
  return <fieldset className="character-reference-picker multi-character-picker location-reference-picker"><legend>Locations in this render</legend><div><span><MapPin size={17} /></span><span><strong>Location library</strong><small>Add environments alongside the cast. All selected assets share the 9-picture limit.</small></span></div><div className="character-reference-choices">{locations.map((location) => { const references = locationReferences(location); const selected = values.includes(location.id); return <label className={selected ? 'selected' : ''} key={location.id}><input type="checkbox" checked={selected} disabled={!references.length} onChange={() => onChange(location.id)} />{references[0]?.preview ? <img className="reference-choice-thumbnail location" src={references[0].preview} alt="" /> : <span className="reference-choice-placeholder"><MapPin size={18} /></span>}<span><strong>{location.name}</strong><small>{references.length ? `${location.environmentMode === 'nature' ? 'Nature only · ' : ''}${references.length} approved view${references.length === 1 ? '' : 's'}` : 'No approved location views'}</small></span></label> })}</div>{values.length > 0 && <button type="button" className="secondary-button" onClick={() => onChange('')}>Clear locations</button>}</fieldset>
}

function SelectField({ label, value, options, onChange, disabled }: { label: string; value: string; options: string[][]; onChange(value: string): void; disabled?: boolean }) {
  const id = useId()
  return <div className="field-group"><label htmlFor={id}>{label}</label><div className="select-wrap"><select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, text]) => <option value={optionValue} key={optionValue}>{text}</option>)}</select><ChevronDown size={15} /></div></div>
}
function NumberField({ label, value, min, max, step, onChange, disabled }: { label: string; value: number; min: number; max: number; step?: number; onChange(value: number): void; disabled?: boolean }) {
  const id = useId()
  return <div className="field-group"><label htmlFor={id}>{label}</label><input id={id} className="number-input" type="number" value={value} min={min} max={max} step={step} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} /></div>
}
function PipelineItem({ ready, label, value }: { ready: boolean; label: string; value: string }) {
  return <div className="pipeline-item"><span className={ready ? 'ready' : ''}>{ready ? <Check size={13} /> : <AlertCircle size={13} />}</span><div><strong>{label}</strong><small title={value}>{value || 'Not detected'}</small></div></div>
}
const workspaceTips: Record<View, { title: string; description: string; tips: Array<[string, string]> }> = {
  continue: { title: 'Continue · MiniMax H3', description: 'Extend a completed clip one beat at a time.', tips: [['Source', 'Choose a completed H3 render or import a video.'], ['Motion Context', 'When a compatible H3 AV latent was saved, its trailing motion and audio can guide the next beat.'], ['Script', 'Write only what changes next; the preceding completed beat becomes the next source.']] },
  scratchpad: { title: 'Scratchpad', description: 'Write, refine, compile, and route prompts with local tools.', tips: [['Tags', 'Type ## to autocomplete structured H3 sections, or right-click in the editor to insert or jump to a tag.'], ['Local autocomplete', 'Pause while writing to request a short continuation from your selected Ollama or LM Studio model, then press Tab to accept it.'], ['Compiler', 'Choose a destination to inspect the exact prompt shape before sending it into a production workspace.'], ['Privacy', 'Drafts persist in local browser storage and local-model tools use your configured local provider.']] },
  movie: { title: 'Oyama AI Movie', description: 'Assemble generated and imported media in a local movie project.', tips: [['Media', 'Search or filter the media pool, then click a clip to append it or choose insertion at the playhead.'], ['Editing', 'Select clips to trim, split, duplicate or open Clip Master. Locked tracks protect their clips from edits.'], ['Continue a shot', 'Choose a source frame and destination in Continue this shot to send it to H3 reference, H3 I2V, H3 first/last frames, or LTX.'], ['Export', 'Export primary sequence joins primary video trims in order. It does not composite overlays, gaps, transforms or separate audio tracks.']] },
  create: { title: 'Create · MiniMax H3', description: 'Build a shot with text, references, or first/last frames.', tips: [['References', 'Use one picture for a clear identity or several numbered pictures for cast, wardrobe, and locations. Keep each person’s references together and describe how they align to the shot.'], ['Motion', 'Describe the physical action and camera movement in plain language. Use Natural movement for subtle, believable motion; use No dialogue when you want ambient sound only.'], ['Generate image', 'Ref2VA stills are useful as clean opening frames. The eye guidance is applied automatically when people are visible, and the finished still can be sent directly to LTX 2.5.'], ['Quality', 'Native Quality is the safest comparison baseline. Turbo is faster; experimental sampling and frame upscaling can introduce instability.']] },
  ltx25: { title: 'LTX 2.5', description: 'Animate text or a first frame with native LTX video and audio.', tips: [['Image mode', 'The first frame is the visual authority. Start the prompt with the intended motion, then keep camera movement restrained and continuous.'], ['Identity', 'When a still is handed off from image generation, an identity-preserving starter prompt is inserted automatically. Review and edit it before rendering.'], ['Quality presets', 'Quality uses the official two-stage 8 + 3 workflow. Turbo uses the distilled single-stage schedule for faster previews.'], ['Audio', 'LTX creates synchronized audio. Keep No dialogue enabled for natural ambience without speech, narration, singing, captions, or lip-sync.']] },
  music: { title: 'Music · ACE-Step', description: 'Create a local soundtrack or sound bed for your project.', tips: [['Tags', 'Describe genre, tempo, instrumentation, mood, and structure. Short, concrete tags usually produce more controllable results.'], ['Duration', 'Match the music length to the intended edit, then trim or assemble clips in Clip editor.'], ['Iteration', 'Change one or two tags at a time so you can tell which direction improved the result.']] },
  zimage: { title: 'Create Image · Z-Image', description: 'Generate a high-resolution still for a reference or opening frame.', tips: [['Prompt', 'Describe subject, expression, composition, lens, lighting, environment, and texture. Keep the image prompt still-focused—do not describe motion or sound.'], ['Eyes', 'For people, say “eyes naturally open, relaxed eyelids, clear irises and pupils, believable attentive gaze.” Avoid “wide-eyed,” which can create an unnatural stare.'], ['Model choice', 'Turbo is fast for exploration. Original Z-Image offers more steps and stronger prompt control for final stills.'], ['Next step', 'Use MiniMax I2V for H3 animation or Send to LTX 2.5 for the identity-preserving LTX starter prompt.']] },
  anime: { title: 'Anime & Checkpoint', description: 'Generate stills with any single-file SD1.5/SDXL checkpoint installed in ComfyUI.', tips: [['Checkpoint', 'Install any anime or general checkpoint in ComfyUI’s models/checkpoints folder, then rescan or reopen this workspace to see it in the list.'], ['Tags', 'Most anime checkpoints respond well to booru-style comma-separated tags for character, pose, outfit, and background.'], ['CLIP skip', 'SD1.5 anime checkpoints often want CLIP skip 2; SDXL-family checkpoints usually want CLIP skip 1.'], ['Next step', 'Use MiniMax I2V for H3 animation or Send to LTX 2.5 for the identity-preserving LTX starter prompt.']] },
  referenceprep: { title: 'Reference Prep · BiRefNet', description: 'Create clean local cutouts and editable masks from source references.', tips: [['Use the source correctly', 'Keep the original image for composition, lighting, and style. Use the BiRefNet cutout for character, wardrobe, or prop identity.'], ['Review edges', 'Inspect hair, transparent materials, and fine object details before using the cutout in a generation. The grayscale mask is saved alongside it for cleanup.'], ['Setup', 'This workspace uses native ComfyUI background-removal nodes and birefnet.safetensors in models/background_removal.']] },
  characters: { title: 'Characters', description: 'Build approved identities that can be reused across shots.', tips: [['Master image', 'Choose a neutral, well-lit image with the entire face visible. This becomes the visual identity anchor.'], ['References', 'Add focused detail views only when they clarify hair, wardrobe, accessories, or distinguishing features.'], ['Turntable', 'Use the identity survey to check facial geometry, body proportions, clothing, and profile continuity before using the character in a movie.']] },
  hair: { title: 'Hair', description: 'Save repeatable hairstyles for character continuity.', tips: [['Describe the cut', 'Include length, shape, texture, parting, fringe, volume, and finish.'], ['Reference', 'Use a clear image with the hairline and silhouette visible; avoid busy backgrounds.'], ['Reuse', 'Approved styles can be attached to characters and carried into later reference renders.']] },
  wardrobes: { title: 'Wardrobe', description: 'Create clothing references without losing material and fit details.', tips: [['Describe materials', 'Name fabric, weave, sheen, weight, closures, colors, and layers.'], ['Keep it grounded', 'Specify how the garment fits and moves instead of relying on broad fashion adjectives.'], ['Continuity', 'Attach approved wardrobe references to a character when the same outfit must persist across shots.']] },
  accessories: { title: 'Accessories', description: 'Create reusable props and wearable details.', tips: [['Silhouette', 'Describe the object’s shape, scale, materials, finish, and distinctive markings.'], ['Placement', 'State exactly where it is worn or held so it stays consistent in later shots.'], ['Reference', 'Use a simple, well-lit view with the full object visible.']] },
  locations: { title: 'Locations', description: 'Create recognizable environments and reusable spatial references.', tips: [['Master image', 'Choose a wide, uncluttered view that shows the main geography and landmarks.'], ['Survey', 'The LTX walkthrough is designed to reveal connected zones and stable spatial relationships.'], ['Nature-only', 'Enable it when the location should contain terrain, vegetation, water, or formations without human-made structures.']] },
  queue: { title: 'Queue', description: 'Monitor work running on the local ComfyUI engine.', tips: [['Progress', 'The runtime and sampler indicators show whether a job is waiting, rendering, or nearing completion.'], ['Cancel', 'Stopping a queued or running job prevents further work; completed outputs remain available.'], ['Errors', 'Open the job details and check the ComfyUI connection or missing model/node message before retrying.']] },
  library: { title: 'Video library', description: 'Review finished images and videos without changing their originals.', tips: [['Preview', 'Use Preview to open any still or clip in a lightbox. Escape, Close, or click outside the panel to dismiss it.'], ['Frames', 'Frame bookmarks lets you extract reusable frames from a video and send one to LTX 2.5 as a starting frame.'], ['Movie editor', 'Open Movie Editor to place, trim, and assemble non-destructive copies; source renders remain untouched.']] },
  clipmaster: { title: 'Clip Master', description: 'Select a video for precise frame selection, frame extraction, and isolated trimmed exports.', tips: [['Select a clip', 'Choose any completed video render here, or select a local video. The existing Clip editor remains separate and unchanged.'], ['Exact frames', 'Use the frame controls to set inclusive start and end frame numbers. The scrubber and the player remain synchronized to that frame index.'], ['Extract frames', 'Save the start, end, current, or multiple chosen frames into ComfyUI/output/ClipMaster/<source-clip-name>/.'], ['Export', 'Trimmed videos use an incrementing versioned filename and are saved inside the configured ComfyUI output folder without replacing an earlier export.']] },
  settings: { title: 'Settings', description: 'Connect the studio to your local engine and configure defaults.', tips: [['Connection', 'Keep ComfyUI running at the configured local address, then use Test connection to refresh status.'], ['Models', 'Rescan after adding files. The app indexes model folders in place and does not move or copy them.'], ['Defaults', 'Generation defaults apply to the main Create workspace; LTX and Z-Image keep their own workspace settings.'], ['Local assistant', 'Ollama or LM Studio can refine prompts locally when configured; prompts are not sent to a cloud service.']] },
}

const setupGuide: Array<[string, string]> = [
  ['1. Core engine and folders', 'Install a current local ComfyUI build and keep it running at the address shown in Settings (default http://127.0.0.1:8188). In Settings → Model locations, point diffusion_models, text_encoders, vae, loras, vae_approx, and clip_vision at your ComfyUI model folders, then choose an output folder and click Test connection / Rescan.'],
  ['2. MiniMax H3 video', 'Required for Create: models/diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors and minimax_h3_ref2va_pruned_int8_convrot.safetensors; models/text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors; models/vae/minimax_h3_video_vae_fp16.safetensors and minimax_h3_audio_vae_fp32.safetensors. The app requires a current ComfyUI exposing the MiniMax H3 core nodes.'],
  ['3. H3 Turbo and animated preview', 'Turbo additionally needs models/loras/minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors and minimax_h3_ref2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors. The older Ref2V 4-step LoRA is optional. The quality text-encoder choice additionally needs qwen3vl_32b_minimax_h3_int8_convrot.safetensors. H3 animated preview is optional and needs a compatible MiniMax H3 Preview Override node plus that node’s own 24-latent-channel taeh3_decoder.safetensors in models/vae_approx. A decoder.22 3-versus-12 output-shape warning means a different same-named TAE was installed; replace it with the decoder distributed with the active H3 Preview Override node.'],
  ['4. Native LTX 2.5', 'Required for the LTX workspace: models/diffusion_models/ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors (NVFP4/distilled variants are also detected); models/text_encoders/gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot.safetensors; models/vae/ltx-2.5-video-vae-bf16.safetensors and ltx-2.5-audio-vae-bf16.safetensors; and models/latent_upscale_models/ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors.'],
  ['5. LTX node gate and sampling preview', 'Current ComfyUI must expose LTXVConditioning, LTXVEmptyLatentAudio, EmptyLTXVLatentVideo, LTXVDualCFGGuider, LTXVSeparateAVLatent, LTXVConcatAVLatent, LTXVLatentUpsampler, LTXVAudioVAEDecode, ManualSigmas, VAEDecodeTiled, CLIPTextEncode, KSamplerSelect, and SamplerCustomAdvanced. Sampling-time LTX previews are optional and require ComfyUI-KJNodes, which provides LTX2SamplingPreviewOverride. Restart ComfyUI and refresh the Local engine after installing it.'],
  ['6. LTX and MiniMax 2× upscale', 'LTX latent 2× post-processing also requires VAEEncodeTiled, LatentUpscaleModelLoader, LTXVLatentUpsampler, VAEDecodeTiled, ImageFromBatch, RepeatImageBatch, and ImageBatch. An RTX/CUDA frame-upscale choice requires any compatible UpscaleModelLoader model; it is optional and can introduce flicker.'],
  ['7. Z-Image stills', 'For Z-Image Turbo install models/diffusion_models/z_image_turbo_bf16.safetensors, models/text_encoders/qwen_3_4b.safetensors, and models/vae/ae.safetensors. Original Z-Image additionally needs models/diffusion_models/z_image_bf16.safetensors. Both variants use current ComfyUI core nodes including ModelSamplingAuraFlow, EmptySD3LatentImage, and KSampler.'],
  ['8. ACE-Step 1.5 music', 'Install models/diffusion_models/acestep_v1.5_xl_sft_bf16.safetensors and/or acestep_v1.5_xl_base_bf16.safetensors; models/vae/ace_1.5_vae.safetensors; and models/text_encoders/qwen_0.6b_ace15.safetensors plus qwen_4b_ace15.safetensors. Current ComfyUI must expose DualCLIPLoader, TextEncodeAceStepAudio1.5, EmptyAceStep1.5LatentAudio, ConditioningZeroOut, ModelSamplingAuraFlow, KSampler, VAEDecodeAudio, and SaveAudioAdvanced.'],
  ['9. Local prompt and vision assistance', 'Optional: run Ollama (default http://127.0.0.1:11434) or LM Studio locally and select a loaded model in Settings. Any local text model can refine prompts; generated-still-to-LTX grounding needs a vision-capable model such as LLaVA or another multimodal model accepted by your provider. The app falls back safely when vision inspection is unavailable.'],
  ['10. Editing, outputs, and recovery', 'Install FFmpeg and set its executable or folder in Settings for trim, frame extraction, bookmarks, and timeline export. Keep output and input media on local disks with write access. After adding models or custom nodes: restart ComfyUI, click Local engine / Test connection, then Rescan models. The workspace’s readiness message names any missing node family or model component.'],
]

function WorkspaceTips({ view, onClose }: { view: View; onClose(): void }) {
  const content = workspaceTips[view]
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])
  return <div className="tips-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="tips-modal" role="dialog" aria-modal="true" aria-labelledby="tips-modal-title"><header><div><span className="tips-modal-icon"><HelpCircle size={18} /></span><span><small>WORKSPACE TIPS</small><strong id="tips-modal-title">{content.title}</strong><p>{content.description}</p></span></div><button className="icon-button" onClick={onClose} aria-label="Close workspace tips"><X size={18} /></button></header><div className="tips-modal-body">{content.tips.map(([title, text], index) => <article key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{title}</strong><p>{text}</p></div></article>)}<section className="tips-setup-guide" aria-labelledby="tips-setup-guide-title"><header><span><HardDrive size={15} /></span><div><small>COMPLETE LOCAL SETUP</small><strong id="tips-setup-guide-title">Models, nodes, and optional tools</strong><p>Use this checklist for the features you want. Every item stays local to your workstation.</p></div></header>{setupGuide.map(([title, text], index) => <article key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{title}</strong><p>{text}</p></div></article>)}</section></div><footer><span><HelpCircle size={14} />Tips update with the workspace you are viewing.</span><button className="secondary-button" onClick={onClose}>Done</button></footer></section></div>
}

function StatusBadge({ status }: { status: GenerationJob['status'] }) {
  return <span className={`status-badge ${status}`}>{status === 'running' && <LoaderCircle size={12} className="spin" />}{status}</span>
}

function JobExecutionChips({ job, expanded = false }: { job: GenerationJob; expanded?: boolean }) {
  const execution = job.execution
  if (!execution) return null
  const chips = [
    execution.attentionBackend && { label: execution.attentionBackend, emphasis: /int8 attention|sage/i.test(execution.attentionBackend) },
    execution.diffusionPrecision && { label: execution.diffusionPrecision },
    execution.gpuRouting && { label: execution.gpuRouting, emphasis: /GPU 1|5060/i.test(execution.gpuRouting) },
    execution.sampler && { label: `${execution.sampler} + ${execution.scheduler ?? 'scheduler'}` },
    execution.preview && { label: `Preview: ${execution.preview}` },
    execution.upscale && execution.upscale !== 'Off' && { label: execution.upscale },
    execution.referenceCount !== undefined && { label: `${execution.referenceCount} reference${execution.referenceCount === 1 ? '' : 's'}` },
    ...(execution.adapters?.map((adapter) => ({ label: adapter })) ?? []),
    ...(expanded ? [
      execution.diffusionModel && { label: `Model: ${modelLabel(execution.diffusionModel)}`, detail: execution.diffusionModel },
      execution.textEncoder && { label: `Encoder: ${modelPrecisionLabel(execution.textEncoder) ?? modelLabel(execution.textEncoder)}`, detail: execution.textEncoder },
    ] : []),
  ].filter((chip): chip is { label: string; emphasis?: boolean; detail?: string } => Boolean(chip))
  return chips.length ? <div className={`job-execution-chips ${expanded ? 'expanded' : ''}`} aria-label="Render configuration">{chips.map((chip) => <span key={`${chip.label}-${chip.detail ?? ''}`} className={chip.emphasis ? 'accelerated' : ''} title={chip.detail ?? chip.label}>{chip.label}</span>)}</div> : null
}

function ComfyActivityConsole({ job }: { job: GenerationJob }) {
  const activity = job.comfyActivity ?? []
  const running = job.status === 'queued' || job.status === 'running'
  const fallback = running
    ? [{ at: job.createdAt, level: 'info' as const, message: job.promptId ? `ComfyUI accepted prompt ${job.promptId}; waiting for execution updates.` : 'Preparing locally. This workflow has not been submitted to ComfyUI yet.' }]
    : []
  const entries = activity.length ? activity : fallback
  if (!entries.length) return null
  const latest = entries.at(-1)!
  return <details className={`comfy-activity-console ${job.status === 'failed' ? 'has-error' : ''}`} open={job.status === 'failed'}>
    <summary>
      <span><Activity size={14} />ComfyUI activity</span>
      <small title={latest.message}>{latest.message}</small>
      <span className={`activity-state ${latest.level}`}>{running ? 'live' : job.status}</span>
    </summary>
    <div className="comfy-activity-log" role="log" aria-label="ComfyUI activity log" aria-live="polite">
      {entries.map((entry, index) => <div className={`comfy-activity-entry ${entry.level}`} key={`${entry.at}-${index}`}><time dateTime={new Date(entry.at).toISOString()}>{new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</time><span>{entry.message}</span></div>)}
    </div>
  </details>
}

function LibraryView({ jobs, settings, onEdit, onCreate, onUseLtx, onUseLastFrameReference, onNotice, onDelete }: { onDelete(job: GenerationJob, mode: 'history' | 'trash' | 'permanent'): Promise<void>; jobs: GenerationJob[]; settings: AppSettings; onEdit(): void; onCreate(): void; onUseLtx(file: MediaFile): void; onUseLastFrameReference(job: GenerationJob, opening: { mode: 'match' | 'reframe' | 'arc'; cameraAngle?: string }): Promise<void>; onNotice(tone: 'error' | 'success' | 'neutral', text: string): void }) {
  const [query, setQuery] = useState('')
  const [provider, setProvider] = useState<'all' | 'minimax' | 'ltx25'>('all')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [bookmarkVideo, setBookmarkVideo] = useState<BookmarkVideo | null>(null)
  const [lightbox, setLightbox] = useState<GenerationJob | null>(null)
  const [rife, setRife] = useState<{ installed: boolean; executable?: string; error?: string } | null>(null)
  const [rifeBusyId, setRifeBusyId] = useState<string | null>(null)
  const [referenceBusyId, setReferenceBusyId] = useState<string | null>(null)
  const [openingMode, setOpeningMode] = useState<'match' | 'reframe' | 'arc'>('match')
  const [openingCameraAngle, setOpeningCameraAngle] = useState('side camera angle')
  const available = jobs.filter((job) => job.mediaType !== 'audio' && Boolean(job.outputUrl))
  const filtered = available.filter((job) => (provider === 'all' || (job.provider ?? 'minimax') === provider) && (!query.trim() || job.prompt.toLowerCase().includes(query.trim().toLowerCase()))).sort((a, b) => sort === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt)
  const videos: BookmarkVideo[] = available.filter(job => job.mediaType !== 'image').map((job) => ({ id: `job-${job.id}`, name: shortPrompt(job.prompt), source: job.outputUrl!, duration: job.duration, provider: job.provider === 'ltx25' ? 'ltx25' : 'minimax' }))
  useEffect(() => {
    if (!lightbox) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setLightbox(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [lightbox])
  useEffect(() => { void window.minimax.getRifeStatus().then(setRife).catch(() => setRife({ installed: false })) }, [])
  const runRife = async (job: GenerationJob, mode: 'fps-2x' | 'slow-motion') => {
    setRifeBusyId(job.id)
    try {
      let status = rife
      if (!status?.installed) { status = await window.minimax.installRife(); setRife(status) }
      if (!status?.installed) throw new Error(status?.error || 'RIFE setup did not finish.')
      const result = await window.minimax.interpolateVideo(job.outputUrl!, settings.outputDirectory, settings.ffmpegPath, mode)
      await window.minimax.showOutput(result.path)
      onNotice('success', mode === 'slow-motion' ? 'Cinematic slow-motion render created with RIFE and opened in its output folder.' : '48 fps RIFE optical-flow render created and opened in its output folder.')
    } catch (error) { onNotice('error', error instanceof Error ? error.message : String(error)) } finally { setRifeBusyId(null) }
  }
  const addLastFrameReference = async (job: GenerationJob) => {
    setReferenceBusyId(job.id)
    try { await onUseLastFrameReference(job, openingMode === 'match' ? { mode: 'match' } : { mode: openingMode, cameraAngle: openingCameraAngle }) }
    catch (error) { onNotice('error', `Could not create the final-frame reference: ${error instanceof Error ? error.message : String(error)}`) }
    finally { setReferenceBusyId(null) }
  }
  return <div className="standard-page library-page"><div className="page-heading"><div><p className="eyebrow">LOCAL LIBRARY</p><h1>Video library</h1><p>Review renders, collect reusable frames, or assemble clips without changing the originals.</p></div><button className="primary-button" onClick={onEdit}><Scissors size={16} />Open movie editor</button></div>
    <div className="library-toolbar"><label><span>Search renders</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search prompts…" /></label><label><span>Provider</span><select value={provider} onChange={(event) => setProvider(event.target.value as typeof provider)}><option value="all">All providers</option><option value="minimax">MiniMax H3</option><option value="ltx25">LTX 2.5</option></select></label><label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label><div><strong>{filtered.length}</strong><span>of {available.length} assets</span></div></div>
    {available.length === 0 ? <div className="empty-page library-first-run"><History size={28} /><strong>Your finished renders will live here</strong><span>Generate a shot to start the library. Finished videos are saved automatically on this device.</span><div className="library-first-run-actions"><button className="primary-button" onClick={onCreate}><Film size={15} />Open Video workspace</button><button className="secondary-button" onClick={onEdit}><Scissors size={15} />Open movie editor</button></div></div> : filtered.length === 0 ? <div className="empty-page compact"><Film size={25} /><strong>No results match these filters.</strong><button className="secondary-button" onClick={() => { setQuery(''); setProvider('all') }}>Clear filters</button></div> : <div className="library-grid">{filtered.map((job) => {
      const image = job.mediaType === 'image'
      const video = videos.find(item => item.id === `job-${job.id}`)
      const rifeBusy = rifeBusyId === job.id
      const title = libraryPromptTitle(job.prompt)
      return <article className="library-card" key={job.id}>
        <button type="button" className="library-card-media" onClick={() => setLightbox(job)} aria-label={`Preview ${title}`}>
          {image ? <img src={job.outputUrl} alt="" /> : <MovieMediaThumbnail source={job.outputUrl!} posterUrl={job.thumbnailUrl} />}
          <span className="library-media-play"><Play size={16} fill="currentColor" /></span>
          {!image && <span className="library-media-duration">{job.duration}s</span>}
        </button>
        <div className="library-card-body">
          <div className="library-card-meta"><span className={`library-provider ${job.provider === 'ltx25' ? 'ltx' : ''}`}>{image ? 'Ref2VA still' : job.provider === 'ltx25' ? 'LTX 2.5' : 'MiniMax H3'}</span><time dateTime={new Date(job.createdAt).toISOString()}>{new Date(job.createdAt).toLocaleDateString()}</time></div>
          <strong title={job.prompt}>{title}</strong>
          <small>{job.width} × {job.height} · {image ? 'one image' : `${job.duration}s · ${job.mode}`}</small>
          <div className="library-card-actions">
            <DeleteGenerationButton job={job} disabled={Boolean(rifeBusyId)} onDelete={onDelete} />
            <button className="secondary-button" onClick={() => setLightbox(job)}><Watch size={15} />Preview</button>
            {!image && video && <button className="primary-button" onClick={() => setBookmarkVideo(video)}><Bookmark size={15} />Frame bookmarks</button>}
            <a className="secondary-button" href={job.outputUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />Open file</a>
          </div>
          {!image && <details className="library-rife"><summary><Gauge size={14} />RIFE motion tools</summary><span>{rife?.installed ? 'Optical-flow derivative · original remains unchanged.' : 'Installs the official local RIFE tool on first use.'}</span><div><button className="secondary-button" disabled={Boolean(rifeBusyId)} onClick={() => void runRife(job, 'fps-2x')}>{rifeBusy ? <LoaderCircle className="spin" size={14} /> : <Gauge size={14} />}48 fps</button><button className="secondary-button" disabled={Boolean(rifeBusyId)} onClick={() => void runRife(job, 'slow-motion')}>{rifeBusy ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}Cinematic slow motion</button></div></details>}
        </div>
      </article>
    })}</div>}
    {lightbox && <div className="media-lightbox-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setLightbox(null) }}><section className="media-lightbox" role="dialog" aria-modal="true" aria-labelledby="library-preview-title"><header><span><small>LIBRARY PREVIEW</small><strong id="library-preview-title">{shortPrompt(lightbox.prompt)}</strong></span><button className="icon-button" onClick={() => setLightbox(null)} aria-label="Close preview"><X size={18} /></button></header><div className="media-lightbox-stage">{lightbox.mediaType === 'image' ? <img src={lightbox.outputUrl} alt="Generated reference still" /> : <VideoPlayer src={lightbox.outputUrl!} />}</div><footer><span>{lightbox.width} × {lightbox.height} · {lightbox.mediaType === 'image' ? 'Still image' : `${lightbox.duration}s video`}</span><div className="media-lightbox-actions">{lightbox.mediaType !== 'image' && <div className="opening-frame-builder"><div><strong>Next-shot frame conditioning</strong><small>Extract the absolute final frame, then choose native Frame 0 conditioning or reference-only guidance.</small></div><fieldset disabled={referenceBusyId === lightbox.id}><legend>Conditioning treatment</legend><label><input type="radio" name="opening-treatment" checked={openingMode === 'match'} onChange={() => setOpeningMode('match')} /><span><strong>Frame 0 anchor</strong><small>Native Add Guide conditioning at frame_idx 0; fixes the opening visual state.</small></span></label><label><input type="radio" name="opening-treatment" checked={openingMode === 'reframe'} onChange={() => setOpeningMode('reframe')} /><span><strong>Reference only · reframe</strong><small>Guides scene identity while H3 generates a new opening angle; frame 0 is not locked.</small></span></label><label><input type="radio" name="opening-treatment" checked={openingMode === 'arc'} onChange={() => setOpeningMode('arc')} /><span><strong>Frame 0 anchor, then arc</strong><small>Native frame_idx 0 guide first, followed by the requested camera movement.</small></span></label></fieldset>{openingMode !== 'match' && <label className="opening-camera-angle"><span>{openingMode === 'arc' ? 'Target camera angle' : 'Opening camera angle'}</span><select value={openingCameraAngle} onChange={(event) => setOpeningCameraAngle(event.target.value)}><option value="side camera angle">Side camera angle</option><option value="three-quarter camera angle">Three-quarter camera angle</option><option value="front-facing camera angle">Front-facing camera angle</option><option value="low camera angle">Low camera angle</option><option value="high camera angle">High camera angle</option><option value="over-the-shoulder camera angle">Over-the-shoulder camera angle</option></select></label>}<button className="primary-button" disabled={referenceBusyId === lightbox.id} onClick={() => void addLastFrameReference(lightbox)} title="Extract the final frame and use it as a native Frame 0 anchor or a reference-only reframe source">{referenceBusyId === lightbox.id ? <LoaderCircle className="spin" size={15} /> : <ImagePlus size={15} />}{referenceBusyId === lightbox.id ? 'Extracting final frame…' : openingMode === 'match' ? 'Use native Frame 0 anchor' : openingMode === 'reframe' ? 'Use reference-only reframe' : 'Use Frame 0 anchor + arc'}<small>Experimental</small></button></div>}<button className="secondary-button" onClick={() => setLightbox(null)}>Close</button></div></footer></section></div>}
    {bookmarkVideo && <FrameBookmarkStudio key={bookmarkVideo.id} initialVideo={bookmarkVideo} videos={videos} settings={settings} onClose={() => setBookmarkVideo(null)} onUseLtx={onUseLtx} onNotice={onNotice} />}
  </div>
}

function JobsView({ title, note, jobs, empty, cancellingIds, onCancel, onDelete }: { title: string; note: string; jobs: GenerationJob[]; empty: string; cancellingIds: Set<string>; onCancel(job: GenerationJob): Promise<void>; onDelete(job: GenerationJob, mode: 'history' | 'trash' | 'permanent'): Promise<void> }) {
  return <div className="standard-page">
    <div className="page-heading"><div><p className="eyebrow">LOCAL WORKSPACE</p><h1>{title}</h1><p>{note}</p></div></div>
    {jobs.length === 0 ? <div className="empty-page"><History size={28} /><strong>{empty}</strong><span>New work is saved automatically on this device.</span></div> : <div className="job-list">{jobs.map((job) => {
      const audio = job.mediaType === 'audio'
      const image = job.mediaType === 'image'
      const active = job.status === 'running' || job.status === 'queued'
      return <article className={`job-row ${active ? 'constructing' : ''}`} key={job.id}>
        <div className={`job-thumbnail ${audio ? 'audio' : ''}`}>{job.outputUrl ? audio ? <Music2 /> : image ? <img src={job.outputUrl} alt="Generated reference still" /> : <span aria-label="Video output"><MovieMediaThumbnail source={job.outputUrl} posterUrl={job.thumbnailUrl} /></span> : job.status === 'running' ? <LoaderCircle className="spin" /> : audio ? <Music2 /> : image ? <ImageIcon /> : <Film />}</div>
        <div className="job-copy"><div><StatusBadge status={job.status} /><span>{new Date(job.createdAt).toLocaleString()}</span></div><strong>{shortPrompt(job.prompt)}</strong><small>{audio ? `${job.provider === 'music3' ? 'Music 3' : 'ACE-Step'} · ${job.duration}s · audio` : `${job.width} × ${job.height} · ${image ? 'Ref2VA still' : `${job.duration}s · ${job.mode}`}`}</small><JobExecutionChips job={job} />{job.outputUrl && audio && <audio className="job-audio" src={job.outputUrl} controls preload="metadata" />}{active && <><small className="job-progress-label">{job.progressLabel ?? (job.status === 'queued' ? 'Waiting in queue' : audio ? 'Generating music locally' : image ? 'Generating one reference still' : 'Rendering locally')}{job.queuePosition ? ` · position ${job.queuePosition}` : ''}{job.currentStep !== undefined && job.totalSteps ? ` · ${job.currentStep}/${job.totalSteps}` : ''}</small><div className="progress compact"><i style={{ width: `${job.progress}%` }} /></div></>}{job.error && <p className="job-error">{job.error}</p>}<ComfyActivityConsole job={job} /></div>
        <div className="job-actions">{job.outputUrl && <a className="secondary-button" href={job.outputUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />Open</a>}{active && <button className="danger-button" disabled={cancellingIds.has(job.id)} onClick={() => void onCancel(job)}>{cancellingIds.has(job.id) ? <LoaderCircle size={15} className="spin" /> : <CircleStop size={15} />}{cancellingIds.has(job.id) ? 'Stopping…' : 'Stop'}</button>}{!active && <DeleteGenerationButton job={job} onDelete={onDelete} />}</div>
      </article>
    })}</div>}
  </div>
}

function SettingsView({ settings, setSettings, info, models, jobs, gpu, h3Report, scanning, status, checking, diagnosticRunning, benchmarkRunning, benchmarkConfig, setBenchmarkConfig, benchmarkResults, ollamaModels, localLlmStatus, localLlmChecking, legacyMigration, legacyMigrationRunning, onRefreshOllama, onScan, onCheck, onSave, onApplyDefaults, onRunDiagnostics, onRunBenchmark, onRunLegacyMigration, onFactoryReset }: { settings: AppSettings; setSettings(value: AppSettings): void; info: ObjectInfo; models: ModelFile[]; jobs: GenerationJob[]; gpu: GpuTelemetry | null; h3Report: ReturnType<typeof h3StackReport>; scanning: boolean; status: ComfyStatus; checking: boolean; diagnosticRunning: boolean; benchmarkRunning: boolean; benchmarkConfig: H3BenchmarkConfig; setBenchmarkConfig(value: H3BenchmarkConfig): void; benchmarkResults: H3BenchmarkResult[]; ollamaModels: OllamaModel[]; localLlmStatus: LocalLlmStatus | null; localLlmChecking: boolean; legacyMigration: { available: boolean; migrated: boolean; migratedAt?: string; needsBrowserStorageRepair: boolean } | null; legacyMigrationRunning: boolean; onRefreshOllama(): void; onScan(): void; onCheck(): void; onSave(): void; onApplyDefaults(): void; onRunDiagnostics(): void; onRunBenchmark(): void; onRunLegacyMigration(): void; onFactoryReset(): void }) {
  const pathRows: Array<{ kind: ModelKind; label: string; note: string }> = [
    { kind: 'diffusion_models', label: 'Diffusion models', note: 'FL2VA and Ref2VA checkpoints' },
    { kind: 'text_encoders', label: 'Text encoders', note: 'Qwen3-VL MiniMax encoder' },
    { kind: 'vae', label: 'VAE models', note: 'Video and audio decoders' },
    { kind: 'loras', label: 'LoRAs', note: '4-step and 8-step turbo adapters' },
    { kind: 'vae_approx', label: 'Preview models', note: 'Tiny H3 preview decoder' },
    { kind: 'clip_vision', label: 'Vision encoders', note: 'Optional reference encoders' },
  ]
  const defaults = settings.generationDefaults
  const llm = resolveLlmConnection(settings)
  const activeModelField = settings.llmProvider === 'lmstudio' ? 'lmStudioModel' : 'ollamaModel'
  const activeUrlField = settings.llmProvider === 'lmstudio' ? 'lmStudioUrl' : 'ollamaUrl'
  const currentLlmStatus = localLlmStatus?.provider === llm.provider && localLlmStatus.url === llm.url ? localLlmStatus : null
  const llmHealthLabel = localLlmChecking ? 'Checking…' : currentLlmStatus?.connected
    ? ollamaModels.length ? `${ollamaModels.length} model${ollamaModels.length === 1 ? '' : 's'} ready` : 'Connected · no models'
    : currentLlmStatus?.error ? 'Unreachable' : 'Not checked'
  const updateDefaults = (patch: Partial<AppSettings['generationDefaults']>) => setSettings({ ...settings, generationDefaults: { ...defaults, ...patch } })
  const [presetName, setPresetName] = useState('')
  const [workflowKind, setWorkflowKind] = useState<'h3-i2v' | 'ref2va' | 'ltx' | 'zimage' | 'acestep'>('h3-i2v')
  const [workflowExportStatus, setWorkflowExportStatus] = useState('')
  const [solGuideOpen, setSolGuideOpen] = useState(false)
  const [solTestStatus, setSolTestStatus] = useState('')
  const [gpuDiagnosticStatus, setGpuDiagnosticStatus] = useState('')
  const [factoryResetOpen, setFactoryResetOpen] = useState(false)
  const [factoryResetPhrase, setFactoryResetPhrase] = useState('')
  const [devToolsError, setDevToolsError] = useState('')
  const [activeSettingsSection, setActiveSettingsSection] = useState('display')
  const settingsSections = [
    ['display', 'Display & access'],
    ['engine', 'ComfyUI engine'],
    ['performance', 'Performance'],
    ['benchmark', 'Attention benchmark'],
    ['routing', 'GPU Routing'],
    ['workflows', 'Workflow export'],
    ['h3', 'H3 engine stack'],
    ['defaults', 'Render defaults'],
    ['assistant', 'Local AI'],
    ['models', 'Model folders'],
    ['storage', 'Output & tools'],
    ['reset', 'Factory reset'],
  ] as const
  const openSettingsSection = (id: typeof settingsSections[number][0]) => {
    setActiveSettingsSection(id)
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const saveRenderPreset = () => {
    const name = presetName.trim()
    if (!name) return
    const now = Date.now()
    const existing = settings.renderSettingsPresets.find((preset) => preset.name.toLowerCase() === name.toLowerCase())
    const preset: RenderSettingsPreset = { id: existing?.id ?? createId(), name, values: { ...defaults, userLoras: [], rtxModel: '', livePreviewMode: 'auto', noDialogue: true, naturalMovement: true, clothingPolicy: 'wardrobe', seed: 0, seedLocked: true }, createdAt: existing?.createdAt ?? now, updatedAt: now }
    setSettings({ ...settings, renderSettingsPresets: [...settings.renderSettingsPresets.filter((item) => item.id !== preset.id), preset] })
    setPresetName('')
  }
  const applyRenderPreset = (preset: RenderSettingsPreset) => updateDefaults({ ...preset.values })
  const renameRenderPreset = (preset: RenderSettingsPreset) => {
    const name = window.prompt('Preset name', preset.name)?.trim()
    if (!name) return
    setSettings({ ...settings, renderSettingsPresets: settings.renderSettingsPresets.map((item) => item.id === preset.id ? { ...item, name: name.slice(0, 60), updatedAt: Date.now() } : item) })
  }
  const deleteRenderPreset = (preset: RenderSettingsPreset) => {
    if (!window.confirm(`Delete render preset “${preset.name}”?`)) return
    setSettings({ ...settings, renderSettingsPresets: settings.renderSettingsPresets.filter((item) => item.id !== preset.id) })
  }
  const applyPreset = (preset: 'quality' | 'official-turbo' | 'preview') => {
    const common = { resolution: '1344x768', duration: 5, steps: 30, loraStrength: 1, shiftVideo: 12, upscaleMode: 'off' as const }
    if (preset === 'quality') updateDefaults({ ...common, turbo: 'off', sampler: 'res_multistep', scheduler: 'simple', experimentalSampling: false, sigmaShiftMode: 'model', shiftAudio: 3 })
    else if (preset === 'official-turbo') updateDefaults({ ...common, turbo: '8', sampler: 'res_multistep', scheduler: 'simple', experimentalSampling: false, sigmaShiftMode: 'model', shiftAudio: 3 })
    else updateDefaults({ ...common, resolution: '864x480', turbo: '8', sampler: 'res_multistep', scheduler: 'simple', experimentalSampling: false, sigmaShiftMode: 'model', shiftAudio: 3 })
  }
  const samplerOptions = [...new Set([defaults.sampler, 'res_multistep', 'euler', 'gradient_estimation', 'ipndm', 'deis', 'heun', ...choices(info, 'KSamplerSelect', 'sampler_name')])]
  const schedulerOptions = [...new Set([defaults.scheduler, 'simple', 'beta', 'normal', ...choices(info, 'BasicScheduler', 'scheduler')])]
  const warnedSampler = ['euler_ancestral', 'lcm', 'dpmpp_3m_sde'].includes(defaults.sampler)
  const attentionBackends = choices(info, 'ModelAttentionBackend', 'attention')
  const h3ParallelAttentionNode = findH3ParallelAttentionNode(info)
  const solAttentionNode = findSolAttentionNode(info)
  const solCacheNode = findSolCompatibleCacheNode(info)
  const previewRoutingNode = findH3PreviewOverrideNode(info)
  const nvfp4Fl2vaInstalled = models.some((model) => model.kind === 'diffusion_models' && /^minimax_h3_fl2va_pruned_nvfp4\.safetensors$/i.test(model.name))
  const nvfp4Ref2vaInstalled = models.some((model) => model.kind === 'diffusion_models' && /^minimax_h3_ref2va_pruned_nvfp4\.safetensors$/i.test(model.name))
  const nvfp4DiffusionReady = nvfp4Fl2vaInstalled && nvfp4Ref2vaInstalled
  const kitchenAttention = resolveAttentionBackend('kitchen', attentionBackends)
  const sageAttention = resolveAttentionBackend('sage', attentionBackends)
  const nativeAttention = resolveAttentionBackend('native', attentionBackends)
  const selectedAttention = resolveAttentionBackend(settings.attentionBackend, attentionBackends)
  const h3AttentionBackend = settings.attentionBackend === 'sol' ? undefined : selectedAttention
  const routingGpuList = routingGpus(gpu, status.stats?.devices)
  const routingH3Models = inferSelections(models, defaults.turbo, defaults.textEncoderPreference, settings.h3DiffusionPrecision)
  const routingModelNames: Partial<Record<RoutingComponent, string>> = { diffusion: routingH3Models.fl2va, textEncoder: routingH3Models.textEncoder, videoVae: routingH3Models.videoVae, audioVae: routingH3Models.audioVae, previewVae: routingH3Models.previewVae }
  const routingSizes = Object.fromEntries(Object.entries(routingModelNames).map(([component, name]) => [component, estimatedComponentBytes(models.find((model) => model.name === name)?.bytes, component as RoutingComponent)]))
  const gpuRoutingPlan = resolveGpuRouting(settings.gpuRouting, routingGpuList, info, routingSizes, previewRoutingNode)
  const runtimeArgs = status.stats?.system?.argv ?? []
  const detectedOutputDirectory = status.detectedOutputDirectory?.replace(/[\\/]+$/, '')
  const configuredOutputDirectory = settings.outputDirectory.replace(/[\\/]+$/, '')
  const outputDirectoryMismatch = Boolean(detectedOutputDirectory && configuredOutputDirectory.localeCompare(detectedOutputDirectory, undefined, { sensitivity: 'accent' }) !== 0)
  const hasRuntimeArg = (arg: string) => runtimeArgs.some((value) => value === arg || value.startsWith(`${arg}=`))
  const routingCapabilities = [
    { label: 'Diffusion model', node: info.UNETLoaderMultiGPU ? 'UNETLoaderMultiGPU' : info.SelectModelDevice ? 'SelectModelDevice' : undefined, cpu: Boolean(info.UNETLoaderMultiGPU) },
    { label: 'Text encoder', node: info.CLIPLoaderMultiGPU ? 'CLIPLoaderMultiGPU' : info.SelectCLIPDevice ? 'SelectCLIPDevice' : undefined, cpu: Boolean(info.CLIPLoaderMultiGPU || info.SelectCLIPDevice) },
    { label: 'Video / audio VAE', node: info.VAELoaderMultiGPU ? 'VAELoaderMultiGPU' : info.SelectVAEDevice ? 'SelectVAEDevice' : undefined, cpu: Boolean(info.VAELoaderMultiGPU) },
    { label: 'Preview VAE', node: previewRoutingNode, cpu: false },
  ]
  const runtimeMemoryPolicy = !runtimeArgs.length ? 'Launch flags unavailable' : hasRuntimeArg('--gpu-only') ? 'GPU-only residency' : hasRuntimeArg('--highvram') ? 'High VRAM residency' : hasRuntimeArg('--lowvram') || hasRuntimeArg('--novram') ? 'Conservative VRAM mode' : 'ComfyUI-managed memory'
  const solRuntimeDiagnostics = parseSolRuntimeDiagnostics(jobs.flatMap((job) => job.comfyActivity?.map((activity) => activity.message) ?? []).join('\n'))
  const completedBenchmarks = benchmarkResults.filter((item) => item.status === 'completed' && item.elapsedMs !== undefined).sort((a, b) => (a.elapsedMs ?? Infinity) - (b.elapsedMs ?? Infinity))
  const benchmarkWinner = completedBenchmarks[0]
  const benchmarkMachine = gpu?.name ?? status.stats?.devices?.[0]?.name ?? 'this PC'
  const gpuDeviceOptions: Array<[string, string]> = [['auto', 'Auto'], ['cpu', 'CPU'], ...routingGpuList.map((device) => [`gpu:${device.index}`, `GPU ${device.index} — ${device.name}`] as [string, string])]
  const updateGpuRouting = (patch: Partial<AppSettings['gpuRouting']>) => setSettings({ ...settings, gpuRouting: { ...settings.gpuRouting, ...patch } })
  const testSolEngine = async () => {
    if (!solAttentionNode) { setSolTestStatus('SolAttnH3 is not detected. Install it, restart ComfyUI, and Test connection first.'); return }
    try {
      const h3 = inferSelections(models, '8', defaults.textEncoderPreference, settings.h3DiffusionPrecision)
      const workflow = buildMiniMaxWorkflow({ mode: 'text', prompt: 'A polished chrome sphere rotates slowly on a dark studio pedestal under one soft overhead light. Locked camera, clean reflections, ambient room tone, no dialogue, no text.', width: 864, height: 480, duration: 5, seed: 12345, steps: 8, turbo: '8', sampler: 'res_multistep', scheduler: 'simple', refImageSize: 'match', loraStrength: 1, gpuRouting: gpuRoutingPlan.workflow, solCache: settings.solCacheEnabled && solCacheNode ? { nodeType: solCacheNode, threshold: 0.1, maxSteps: 5 } : undefined, solAttention: { nodeType: solAttentionNode, tau: settings.solAttnTau }, filenamePrefix: `video/Sol_Engine_Test_${Date.now()}`, referenceImages: [], referenceVideos: [], referenceAudios: [] }, h3, { images: [], videos: [], audios: [] })
      const nodes = Object.values(workflow)
      if (!nodes.some((node) => node.class_type === solAttentionNode)) throw new Error('The generated workflow does not contain the Sol-Attn node.')
      if (nodes.some((node) => node.class_type === 'ModelAttentionBackend')) throw new Error('Safety check failed: a generic attention backend was also present in the H3 graph.')
      if (!nodes.some((node) => node.class_type === 'LoraLoaderModelOnly')) throw new Error('The official Turbo 8 LoRA is not available in the selected H3 model stack.')
      if (workflow['14']?.inputs.steps !== 8) throw new Error('The Sol test graph did not resolve to exactly eight sampling steps.')
      if (settings.solCacheEnabled && solCacheNode && !nodes.some((node) => node.class_type === solCacheNode)) throw new Error('The requested H3 cache node was not included in the Sol stack.')
      const response = await window.minimax.submitPrompt(settings.comfyUrl, workflow)
      setSolTestStatus(`Sol${settings.solCacheEnabled && solCacheNode ? ' + cache' : ''} Turbo 8 test accepted · prompt ${response.prompt_id}. Watch the queue and ComfyUI log for backend=triton, correctness gate PASS, sparse calls, and cache skips.`)
    } catch (error) {
      setSolTestStatus(`Sol test failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  const testGpuRouting = async () => {
    if (!status.connected) { setGpuDiagnosticStatus('Connect ComfyUI before running the placement diagnostic.'); return }
    if (!routingH3Models.fl2va || !routingH3Models.textEncoder || !routingH3Models.videoVae || !routingH3Models.audioVae) { setGpuDiagnosticStatus('The H3 diffusion, text encoder, and both full VAEs are required.'); return }
    if (gpuRoutingPlan.vramWarnings.length && !settings.gpuRouting.allowOvercommit) { setGpuDiagnosticStatus(`Blocked by VRAM validation: ${gpuRoutingPlan.vramWarnings.join(' ')}`); return }
    try {
      const workflow = buildMiniMaxWorkflow({ mode: 'text', prompt: 'GPU placement diagnostic. Static studio color chart, locked camera, ambient tone, no dialogue.', width: 608, height: 352, duration: 2, seed: 30905060, steps: 8, turbo: '8', sampler: 'res_multistep', scheduler: 'simple', refImageSize: 'match', loraStrength: 1, gpuRouting: gpuRoutingPlan.workflow, solAttention: settings.attentionBackend === 'sol' && solAttentionNode ? { nodeType: solAttentionNode, tau: settings.solAttnTau } : undefined, filenamePrefix: `video/GPU_Routing_Diagnostic_${Date.now()}`, referenceImages: [], referenceVideos: [], referenceAudios: [] }, inferSelections(models, '8', defaults.textEncoderPreference, settings.h3DiffusionPrecision), { images: [], videos: [], audios: [] })
      const response = await window.minimax.submitPrompt(settings.comfyUrl, workflow)
      console.info(`[GPU Routing Diagnostic] ${gpuRoutingPlan.logLine} | Strategy: ${gpuRoutingPlan.workflow.strategy}`)
      setGpuDiagnosticStatus(`Diagnostic queued · prompt ${response.prompt_id}. Requested: ${gpuRoutingPlan.logLine}. Queue acceptance verifies graph compatibility only; confirm the ComfyUI process log reports these placements before treating them as runtime-verified.`)
    } catch (error) {
      setGpuDiagnosticStatus(`Diagnostic failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  const exportWorkflow = async () => {
    const [width, height] = defaults.resolution.split('x').map(Number)
    const h3 = inferSelections(models, defaults.turbo, defaults.textEncoderPreference, settings.h3DiffusionPrecision)
    const ltx = inferLtx25Selections(models, choices(info, 'LatentUpscaleModelLoader', 'model_name'))
    const ace = inferAceStepSelections(models)
    const attentionBackend = selectedAttention
    const filenamePrefix = `MiniMax_Export_${Date.now()}`
    let workflow: Record<string, unknown>
    let filename: string
    if (workflowKind === 'ref2va') {
      filename = 'minimax-ref2va-api-workflow.json'
      workflow = buildMiniMaxWorkflow({ mode: 'reference', prompt: 'Describe the shot. Attach reference media in ComfyUI before queueing.', width, height, duration: defaults.duration, seed: 12345, steps: defaults.steps, turbo: defaults.turbo, sampler: defaults.sampler, scheduler: defaults.scheduler, experimentalSampling: defaults.experimentalSampling, refImageSize: defaults.refImageSize, loraStrength: defaults.loraStrength, attentionBackend: h3AttentionBackend, gpuRouting: gpuRoutingPlan.workflow, solCache: settings.attentionBackend === 'sol' && settings.solCacheEnabled && solCacheNode ? { nodeType: solCacheNode, threshold: 0.1, maxSteps: 5 } : undefined, solAttention: settings.attentionBackend === 'sol' && solAttentionNode ? { nodeType: solAttentionNode, tau: settings.solAttnTau } : undefined, filenamePrefix, referenceImages: [], referenceVideos: [], referenceAudios: [] }, h3, { images: [], videos: [], audios: [] })
    } else if (workflowKind === 'ltx') {
      filename = 'ltx-2.5-api-workflow.json'
      workflow = buildLtx25Workflow({ mode: 'text', prompt: 'Describe one continuous cinematic shot.', width, height, duration: defaults.duration, seed: 12345, preset: 'turbo', attentionBackend, gpuRouting: gpuRoutingPlan.workflow, filenamePrefix }, ltx)
    } else if (workflowKind === 'zimage') {
      filename = 'z-image-api-workflow.json'
      const zModel = models.find((model) => model.kind === 'diffusion_models' && /z[_-]?image.*turbo/i.test(model.name))?.name ?? 'z_image_turbo_bf16.safetensors'
      const zEncoder = models.find((model) => model.kind === 'text_encoders' && /qwen[_-]?3[_-]?4b/i.test(model.name))?.name ?? 'qwen_3_4b.safetensors'
      const zVae = models.find((model) => model.kind === 'vae' && /^ae\.safetensors$/i.test(model.name))?.name ?? 'ae.safetensors'
      workflow = buildZImage('Describe a single polished image.', width, height, 12345, zModel, zEncoder, zVae, 8, 1, 'turbo', '', attentionBackend, gpuRoutingPlan.workflow)
    } else if (workflowKind === 'acestep') {
      filename = 'ace-step-1.5-api-workflow.json'
      workflow = buildAceStepWorkflow({ model: ace.sft ? 'sft' : 'base', tags: 'cinematic instrumental soundtrack', lyrics: '', instrumental: true, duration: 60, bpm: 120, timeSignature: '4', language: 'en', keyScale: 'C major', seed: 12345, generateAudioCodes: true, attentionBackend, gpuRouting: gpuRoutingPlan.workflow, filenamePrefix }, ace)
    } else {
      filename = 'minimax-h3-i2v-api-workflow.json'
      workflow = buildMiniMaxWorkflow({ mode: 'text', prompt: 'Describe one continuous cinematic shot.', width, height, duration: defaults.duration, seed: 12345, steps: defaults.steps, turbo: defaults.turbo, sampler: defaults.sampler, scheduler: defaults.scheduler, experimentalSampling: defaults.experimentalSampling, refImageSize: defaults.refImageSize, loraStrength: defaults.loraStrength, attentionBackend: h3AttentionBackend, gpuRouting: gpuRoutingPlan.workflow, solCache: settings.attentionBackend === 'sol' && settings.solCacheEnabled && solCacheNode ? { nodeType: solCacheNode, threshold: 0.1, maxSteps: 5 } : undefined, solAttention: settings.attentionBackend === 'sol' && solAttentionNode ? { nodeType: solAttentionNode, tau: settings.solAttnTau } : undefined, filenamePrefix, referenceImages: [], referenceVideos: [], referenceAudios: [] }, h3, { images: [], videos: [], audios: [] })
    }
    try {
      const saved = await window.minimax.exportWorkflowJson(filename, workflow)
      setWorkflowExportStatus(saved ? `Saved ${filename}. It includes ${settings.attentionBackend === 'sol' && solAttentionNode && (workflowKind === 'ref2va' || workflowKind === 'h3-i2v') ? 'NVIDIA Sol-Attn' : attentionBackend ? attentionBackendLabel(attentionBackend) : 'ComfyUI default attention'}.` : 'Workflow export cancelled.')
    } catch (error) {
      setWorkflowExportStatus(error instanceof Error ? `Could not export workflow: ${error.message}` : 'Could not export workflow.')
    }
  }
  const routingRows: Array<{ key: RoutingComponent; setting: 'diffusion' | 'textEncoder' | 'videoVae' | 'audioVae' | 'previewVae'; label: string }> = [{ key: 'diffusion', setting: 'diffusion', label: 'Diffusion Model' }, { key: 'textEncoder', setting: 'textEncoder', label: 'Text Encoder' }, { key: 'videoVae', setting: 'videoVae', label: 'Video VAE' }, { key: 'audioVae', setting: 'audioVae', label: 'Audio VAE' }, { key: 'previewVae', setting: 'previewVae', label: 'Preview VAE' }]
  const preloadHelperReady = Boolean(info.OyamaH3PreloadStart && info.OyamaH3PreloadAwait)
  const preloadHasSeparateGpus = gpuRoutingPlan.placements.diffusion.resolved.startsWith('gpu:') && gpuRoutingPlan.placements.textEncoder.resolved.startsWith('gpu:') && gpuRoutingPlan.placements.diffusion.resolved !== gpuRoutingPlan.placements.textEncoder.resolved
  return <div className="standard-page settings-page"><div className="page-heading"><div><p className="eyebrow">APPLICATION</p><h1>Settings</h1><p>Organize your local engine, models, workspace scale, and output tools. Changes are saved automatically; this button also rescans models and refreshes connections.</p></div><button className="primary-button" onClick={onSave}><Save size={17} />Save & refresh</button></div>
    <div className="settings-layout"><aside className="settings-sidebar" aria-label="Settings sections"><span>SETTINGS</span>{settingsSections.map(([id, label]) => <button key={id} type="button" className={activeSettingsSection === id ? 'active' : ''} onClick={() => openSettingsSection(id)}>{label}</button>)}</aside><div className="settings-content">
    <section className="settings-section settings-display-section" id="settings-display"><div className="settings-heading"><div><SlidersHorizontal size={19} /><span><strong>Display & access</strong><small>Make the workspace comfortable at your screen resolution and text size.</small></span></div><output>{settings.uiScale}%</output></div><div className="ui-scale-control"><div><label htmlFor="ui-scale">Interface scale</label><small>Changes the entire application immediately. The choice is saved with your local settings.</small></div><div><input id="ui-scale" type="range" min="75" max="150" step="5" value={settings.uiScale} onChange={(event) => { const uiScale = Number(event.target.value); setSettings({ ...settings, uiScale }); void window.minimax.setUiScale(uiScale / 100) }} /><div><button type="button" className="secondary-button" onClick={() => { setSettings({ ...settings, uiScale: 100 }); void window.minimax.setUiScale(1) }}>Reset to 100%</button><strong>{settings.uiScale}%</strong></div></div></div><div className="connection-row"><div className="field-group grow"><strong>Developer tools</strong><small>Inspect renderer errors and performance while a video is rendering.</small></div><button type="button" className="secondary-button" onClick={() => { setDevToolsError(''); void window.minimax.openDevTools().catch((cause) => setDevToolsError(cause instanceof Error ? cause.message : String(cause))) }}><ExternalLink size={15} />Open DevTools</button></div>{devToolsError && <p className="settings-warning" role="alert"><AlertCircle size={15} />{devToolsError}</p>}</section>
    <section className="settings-section" id="settings-engine"><div className="settings-heading"><div><Activity size={19} /><span><strong>ComfyUI engine</strong><small>The desktop app communicates only with this local address.</small></span></div><span className={`health-pill ${status.connected ? 'online' : ''}`}>{status.connected ? 'Connected' : 'Offline'}</span></div><div className="connection-row"><div className="field-group grow"><label htmlFor="comfy-url">Server URL</label><input id="comfy-url" value={settings.comfyUrl} onChange={(event) => setSettings({ ...settings, comfyUrl: event.target.value })} /></div><button className="secondary-button test-button" onClick={onCheck} disabled={checking}>{checking ? <LoaderCircle size={16} className="spin" /> : <RefreshCw size={16} />}Test connection</button></div>{status.connected && status.stats?.devices?.[0] && <div className="device-strip"><Gauge size={17} /><span><strong>{status.stats.devices[0].name ?? 'Compute device'}</strong><small>{status.stats.devices[0].vram_total ? `${formatBytes(status.stats.devices[0].vram_total)} VRAM · ${formatBytes(status.stats.devices[0].vram_free ?? 0)} free` : 'ComfyUI device detected'}</small></span></div>}{outputDirectoryMismatch && <div className="settings-warning" role="alert"><AlertCircle size={15} /><span><strong>Output folder does not match the running ComfyUI</strong><small>ComfyUI is saving to <code>{detectedOutputDirectory}</code>. Oyama is looking in <code>{settings.outputDirectory}</code>, so completed renders can appear missing.</small></span><button type="button" className="secondary-button" onClick={() => setSettings({ ...settings, outputDirectory: detectedOutputDirectory!, clipMasterOutputDirectory: `${detectedOutputDirectory}\\video` })}>Use detected folder</button></div>}</section>
    <section className="settings-section gpu-routing-section" id="settings-routing"><div className="settings-heading"><div><Gauge size={19} /><span><strong>GPU Routing</strong><small>Place whole model components on independent devices; VAEs are never split.</small></span></div><span className={`health-pill ${gpuRoutingPlan.warnings.length ? '' : 'online'}`}>{gpuRoutingPlan.warnings.length ? 'Fallback active' : 'Ready'}</span></div>
      <div className="gpu-routing-presets"><SelectField label="Routing preset" value={settings.gpuRouting.preset} onChange={(preset) => updateGpuRouting({ preset: preset as AppSettings['gpuRouting']['preset'] })} options={[["automatic", 'Automatic'], ["single", 'Single GPU'], ["split", 'Diffusion GPU 0 / VAE GPU 1'], ["custom", 'Custom']]} /><SelectField label="Residency strategy" value={gpuRoutingPlan.workflow.strategy} onChange={(strategy) => updateGpuRouting({ strategy: strategy as AppSettings['gpuRouting']['strategy'], ...(strategy !== 'resident' ? { preloadDiffusionDuringTextEncoding: false } : {}) })} options={[["resident", 'Keep Resident'], ["sequential", 'Sequential Offload'], ["cpu-fallback", 'CPU Fallback']]} /></div>
      <div className="gpu-loading-modes" aria-label="H3 model loading options">
        <label className={`settings-check ${settings.gpuRouting.strategy === 'resident' ? 'selected' : ''}`}><input type="checkbox" checked={settings.gpuRouting.strategy === 'resident'} onChange={(event) => updateGpuRouting({ strategy: event.target.checked ? 'resident' : 'sequential', ...(!event.target.checked ? { preloadDiffusionDuringTextEncoding: false } : {}) })} /><span><strong>Keep H3 DiT resident</strong><small>Loads normally on the first render, then keeps the transformer on its routed GPU while memory permits. This is the stable fast-repeat option.</small></span></label>
        <label className={`settings-check ${settings.gpuRouting.preloadDiffusionDuringTextEncoding && gpuRoutingPlan.workflow.preloadDiffusion ? 'selected' : ''}`}><input type="checkbox" checked={settings.gpuRouting.preloadDiffusionDuringTextEncoding} disabled={!preloadHelperReady || routingGpuList.length < 2} onChange={(event) => updateGpuRouting({ preloadDiffusionDuringTextEncoding: event.target.checked, ...(event.target.checked ? { strategy: 'resident' } : {}) })} /><span><strong>Preload H3 DiT during text encoding · experimental</strong><small>{!preloadHelperReady ? 'Oyama preload helper not detected. Install it in ComfyUI/custom_nodes, restart ComfyUI, then refresh the engine.' : !preloadHasSeparateGpus ? 'Ready helper detected. Route Diffusion and Text Encoder to different GPUs to activate it.' : gpuRoutingPlan.workflow.preloadDiffusion ? 'Active and guarded: preload starts first, text encoding runs on the other GPU, and sampling waits at a hard barrier.' : 'Requested, but safety validation is using normal resident loading for this configuration.'}</small></span></label>
      </div>
      <div className="gpu-inventory">{routingGpuList.length ? routingGpuList.map((device) => <article key={device.index}><span className="status-dot" /><div><strong>GPU {device.index} — {device.name}</strong><small>{formatGiB(device.totalBytes)} total · {formatGiB(device.usedBytes)} used · {formatGiB(device.freeBytes)} free</small></div><em>{device.totalBytes ? Math.round(device.usedBytes / device.totalBytes * 100) : 0}%</em></article>) : <p className="settings-warning"><AlertCircle size={15} />No CUDA GPUs were reported. Refresh the engine; routing remains Auto.</p>}</div>
      {routingGpuList.length > (status.stats?.devices?.filter((device) => /cuda/i.test(`${device.type ?? ''} ${device.name ?? ''}`)).length ?? 0) && <p className="settings-note">Additional CUDA GPUs are available through NVIDIA telemetry. ComfyUI’s <code>/system_stats</code> endpoint currently reports only its primary device; use a device-aware loader and the placement diagnostic before relying on a secondary target.</p>}
      <details className="runtime-capability-panel" open><summary><span><strong>Runtime capability gate</strong><small>Only routes components through device nodes this ComfyUI server has advertised.</small></span><em>{routingCapabilities.filter((item) => item.node).length}/4 detected</em></summary><div className="runtime-capability-list">{routingCapabilities.map((item) => <div key={item.label} className={item.node ? 'ready' : 'missing'}><span className="routing-status" /><div><strong>{item.label}</strong><small>{item.node ? `${item.node} detected · ${item.cpu ? 'GPU and CPU placement available' : item.label.includes('VAE') ? 'GPU targets only in ComfyUI core' : 'GPU placement available'}` : 'No compatible device-aware node advertised; remains on ComfyUI default.'}</small></div><em>{item.node ?? 'Unavailable'}</em></div>)}</div><div className="runtime-launch-report"><span><strong>ComfyUI memory policy</strong><small>{runtimeMemoryPolicy}{status.stats?.system?.pytorch_version ? ` · PyTorch ${status.stats.system.pytorch_version}` : ''}</small></span><span><strong>Dynamic VRAM</strong><small>{!runtimeArgs.length ? 'Not reported by this server' : hasRuntimeArg('--disable-dynamic-vram') ? 'Disabled by launch flag' : 'Not disabled by launch flag'}</small></span><span><strong>Async offload</strong><small>{!runtimeArgs.length ? 'Not reported by this server' : hasRuntimeArg('--disable-async-offload') ? 'Disabled by launch flag' : 'No disabling flag reported'}</small></span></div><p className="field-help">A detected selector means the graph can request placement, not that a render succeeded there. Run the placement diagnostic after changing a GPU, driver, ComfyUI build, or custom node. Core <code>SelectVAEDevice</code> supports another GPU but intentionally does not support CPU; CPU VAE requires <code>VAELoaderMultiGPU</code>.</p></details>
      <div className="gpu-routing-grid">{routingRows.map((row) => { const placement = gpuRoutingPlan.placements[row.key]; const selected = settings.gpuRouting[row.setting] ?? 'auto'; return <div className="gpu-routing-row" key={row.key}><span className={`routing-status ${placement.status}`} title={placement.note ?? placement.status} /><SelectField label={row.label} value={settings.gpuRouting.preset === 'custom' ? selected : placement.resolved} disabled={settings.gpuRouting.preset !== 'custom'} onChange={(device) => updateGpuRouting({ preset: 'custom', [row.setting]: device })} options={gpuDeviceOptions} /><small>{placement.resolved === 'auto' ? 'Resolved: ComfyUI default' : `Resolved: ${placement.resolved === 'cpu' ? 'CPU' : `cuda:${placement.resolved.slice(4)}`} · ${placement.route?.nodeType ?? 'fallback'}`}</small></div> })}</div>
      <div className="gpu-routing-summary"><strong>{gpuRoutingPlan.summary}</strong><small>{gpuRoutingPlan.workflow.strategy === 'sequential' ? 'Text encoding runs before decode; compatible MultiGPU loaders offload to CPU between component stages.' : gpuRoutingPlan.workflow.strategy === 'cpu-fallback' ? 'Unsupported or memory-constrained automatic placements fall back safely instead of claiming a GPU assignment.' : 'Components remain resident until ComfyUI releases them.'}</small></div>
      {gpuRoutingPlan.warnings.map((warning) => <p className="settings-warning" key={warning}><AlertCircle size={15} />{warning}</p>)}
      {gpuRoutingPlan.vramWarnings.map((warning) => <p className="settings-warning" key={warning}><AlertCircle size={15} />{warning}</p>)}
      <label className="settings-check"><input type="checkbox" checked={settings.gpuRouting.allowOvercommit} onChange={(event) => updateGpuRouting({ allowOvercommit: event.target.checked })} /><span><strong>Allow render despite VRAM estimate</strong><small>Required to continue when routed component estimates exceed currently free VRAM. ComfyUI may still offload or reject the job.</small></span></label>
      <div className="diagnostic-action"><span><strong>Placement diagnostic</strong><small>Queues a two-second H3 render through every selected loader and full Video/Audio VAE decode.</small></span><button className="secondary-button" disabled={!status.connected || !h3Report.ready} onClick={() => void testGpuRouting()}><Activity size={15} />Test GPU Routing</button></div>{gpuDiagnosticStatus && <p className="settings-note" role="status">{gpuDiagnosticStatus}</p>}
      <p className="settings-note">Uses current ComfyUI core Select Device nodes when available, or <a href="https://github.com/pollockjj/ComfyUI-MultiGPU" target="_blank" rel="noreferrer">ComfyUI-MultiGPU</a> device-aware loaders. CPU VAE routing requires the latter because ComfyUI’s native VAE selector intentionally rejects CPU.</p>
    </section>
    <section className="settings-section performance-settings" id="settings-performance"><div className="settings-heading"><div><Gauge size={19} /><span><strong>Render performance</strong><small>Global attention acceleration. The selected backend is applied to every compatible new H3, Ref2VA, LTX, and ACE-Step graph.</small></span></div><span className={`health-pill ${selectedAttention ? 'online' : ''}`}>{selectedAttention ? 'Ready' : 'Setup needed'}</span></div><fieldset className="attention-backend-picker"><legend>Attention backend</legend><label className={settings.attentionBackend === 'automatic' ? 'selected' : ''}><input type="radio" name="attention-backend" checked={settings.attentionBackend === 'automatic'} onChange={() => setSettings({ ...settings, attentionBackend: 'automatic' })} /><span><strong>Automatic</strong><small>{kitchenAttention ? `Uses ${kitchenAttention} when detected, then SageAttention, then native.` : sageAttention ? `Uses ${sageAttention} when detected, then native.` : 'Uses the native backend until an accelerated backend is detected.'}</small></span></label><label className={settings.attentionBackend === 'kitchen' ? 'selected' : ''}><input type="radio" name="attention-backend" checked={settings.attentionBackend === 'kitchen'} onChange={() => setSettings({ ...settings, attentionBackend: 'kitchen' })} /><span><strong>Kitchen INT8</strong><small>{kitchenAttention ? `Detected: ${kitchenAttention}` : 'Not detected — the graph will safely use native attention.'}</small></span></label><label className={settings.attentionBackend === 'sage' ? 'selected' : ''}><input type="radio" name="attention-backend" checked={settings.attentionBackend === 'sage'} onChange={() => setSettings({ ...settings, attentionBackend: 'sage' })} /><span><strong>SageAttention</strong><small>{sageAttention ? `Detected: ${sageAttention}` : 'Requires SageAttention to be enabled by the running ComfyUI environment.'}</small></span></label><label className={settings.attentionBackend === 'native' ? 'selected' : ''}><input type="radio" name="attention-backend" checked={settings.attentionBackend === 'native'} onChange={() => setSettings({ ...settings, attentionBackend: 'native' })} /><span><strong>Native</strong><small>{nativeAttention ? `Detected: ${nativeAttention}` : 'Use ComfyUI’s standard attention implementation.'}</small></span></label></fieldset><label className="settings-check"><input type="checkbox" checked={settings.h3ParallelAttentionEnabled} disabled={!h3ParallelAttentionNode || !kitchenAttention} onChange={(event) => setSettings({ ...settings, h3ParallelAttentionEnabled: event.target.checked, attentionBackend: event.target.checked ? 'kitchen' : settings.attentionBackend })} /><span><strong>Accelerate one H3 Ref2VA render across GPUs</strong><small>{h3ParallelAttentionNode && kitchenAttention ? `Ready to use ${h3ParallelAttentionNode} with Kitchen INT8. The node verifies peer access and uses up to four visible GPUs automatically.` : 'Requires the H3 Parallel custom node and a detected Kitchen INT8 attention backend. Until both are detected, the normal single-GPU graph is used.'}</small></span></label><div className="settings-note"><strong>H3 Parallel setup</strong><br />1. In ComfyUI Manager choose <em>Install via Git URL</em> and enter <code>https://github.com/AesSedai/ComfyUI-MiniMaxH3-Parallel.git</code>.<br />2. Install or update <code>comfy-kitchen</code> (0.2.31+), then launch the one ComfyUI process with <code>--use-ck-attention</code> and expose 2–4 NVIDIA GPUs, for example <code>CUDA_VISIBLE_DEVICES=0,1 python main.py --use-ck-attention</code>.<br />3. Restart ComfyUI and Test connection. Enable this option only after the Parallel node and Kitchen INT8 show as ready. It applies only to new H3 Ref2VA video renders; it does not combine with SageAttention or Torch Compile.</div>{!attentionBackends.length && <p className="settings-warning"><AlertCircle size={15} />This ComfyUI server does not report <code>ModelAttentionBackend</code> yet. Update/restart ComfyUI Desktop, then test the connection again. No acceleration graph is sent until it is detected.</p>}</section>
    <section className="settings-section attention-benchmark-section" id="settings-benchmark"><div className="settings-heading"><div><Clock3 size={19} /><span><strong>Attention benchmark</strong><small>Runs one standardized text-to-video Turbo 8 clip through Kitchen INT8, SageAttention, and Sol-Attn.</small></span></div><span className={`health-pill ${benchmarkWinner ? 'online' : ''}`}>{benchmarkWinner ? 'Measured' : 'Not run'}</span></div><div className="benchmark-controls"><label><span>Clip duration</span><div><input type="number" min="1" max="60" step="1" disabled={benchmarkRunning} value={benchmarkConfig.duration} onChange={(event) => setBenchmarkConfig({ ...benchmarkConfig, duration: Math.max(1, Math.min(60, Math.round(Number(event.target.value) || 1))) })} /><small>seconds</small></div></label><label><span>Resolution</span><select disabled={benchmarkRunning} value={benchmarkConfig.resolution} onChange={(event) => setBenchmarkConfig({ ...benchmarkConfig, resolution: event.target.value })}>{MINIMAX_VIDEO_RESOLUTIONS.map((resolution) => <option key={resolution} value={resolution}>{resolution.replace('x', ' × ')}</option>)}</select></label></div><div className="diagnostic-action"><span><strong>PC-specific recommendation</strong><small>{benchmarkConfig.resolution.replace('x', ' × ')} · {benchmarkConfig.duration} seconds · 8 steps · fixed seed · identical prompt and model stack. Timing includes queue submission through completed video output.</small></span><button type="button" className="primary-button" disabled={benchmarkRunning || !status.connected || !h3Report.ready} onClick={onRunBenchmark}>{benchmarkRunning ? <LoaderCircle className="spin" size={15} /> : <Clock3 size={15} />}{benchmarkRunning ? 'Benchmark running…' : 'Run benchmark'}</button></div>{benchmarkResults.length > 0 && <div className="benchmark-results" aria-live="polite">{benchmarkResults.map((result) => <div className="benchmark-result-row" key={result.backend}><div><strong>{result.label}</strong><small>{result.status === 'completed' ? `Total ${formatBenchmarkDuration(result.elapsedMs)} · active render ${formatBenchmarkDuration(result.renderMs)}` : result.status === 'running' ? 'Rendering now…' : result.status === 'unavailable' ? 'Unavailable' : result.status === 'failed' ? 'Failed' : 'Waiting'}</small></div><span className={`health-pill ${result.status === 'completed' ? 'online' : ''}`}>{result.status === 'completed' ? formatBenchmarkDuration(result.elapsedMs) : result.status === 'running' ? <LoaderCircle className="spin" size={13} /> : result.status}</span>{result.error && result.status !== 'unavailable' && <small className="field-help">{result.error}</small>}</div>)}</div>}{benchmarkWinner && <div className="settings-note benchmark-recommendation"><strong>Recommendation for {benchmarkMachine}:</strong> use <strong>{benchmarkWinner.label}</strong> for H3 text-to-video. It completed the {benchmarkConfig.duration}-second {benchmarkConfig.resolution.replace('x', ' × ')} clip in {formatBenchmarkDuration(benchmarkWinner.elapsedMs)} total ({formatBenchmarkDuration(benchmarkWinner.renderMs)} active render). Re-run after changing models, GPU routing, ComfyUI launch flags, or driver versions.</div>}</section>
    <section className="settings-section workflow-export-section" id="settings-workflows"><div className="settings-heading"><div><Save size={19} /><span><strong>ComfyUI workflow export</strong><small>Save an API-format workflow for queueing directly in ComfyUI. It uses your indexed model filenames and selected attention backend.</small></span></div></div><div className="workflow-export-controls"><label>Workflow template<select value={workflowKind} onChange={(event) => setWorkflowKind(event.target.value as typeof workflowKind)}><option value="h3-i2v">MiniMax H3 image / text to video</option><option value="ref2va">MiniMax H3 Ref2VA</option><option value="ltx">LTX 2.5 video</option><option value="zimage">Z-Image still</option><option value="acestep">ACE-Step 1.5 audio</option></select></label><button type="button" className="secondary-button" onClick={() => void exportWorkflow()}><Save size={15} />Export workflow JSON</button></div><p className="field-help">Exports ComfyUI’s API prompt JSON, not a screenshot or app preset. Reference-media templates include a clear placeholder prompt; attach your own input/reference nodes in ComfyUI before queueing. {selectedAttention ? `${attentionBackendLabel(selectedAttention)} will be included as a ModelAttentionBackend node.` : 'No acceleration node is added until ComfyUI reports a compatible backend.'}</p>{workflowExportStatus && <p className="settings-note workflow-export-status" role="status">{workflowExportStatus}</p>}</section>
    <section className="settings-section sol-engine-settings" aria-labelledby="sol-engine-title">
      <div className="settings-heading"><div><Gauge size={19} /><span><strong id="sol-engine-title">NVIDIA Sol Engine</strong><small>H3-only sparse video attention through ComfyUI.</small></span></div><span className={`health-pill ${solAttentionNode ? 'online' : ''}`}>{solAttentionNode ? 'Detected' : 'Install node'}</span></div>
      <label className={`settings-check ${settings.attentionBackend === 'sol' ? 'selected' : ''}`}><input type="radio" name="attention-backend" checked={settings.attentionBackend === 'sol'} disabled={!solAttentionNode} onChange={() => setSettings({ ...settings, attentionBackend: 'sol', h3ParallelAttentionEnabled: false })} /><span><strong>Use Sol-Attn for MiniMax H3 video</strong><small>{solAttentionNode ? `Ready through ${solAttentionNode}. H3 and Ref2VA use Sol exclusively; LTX, Z-Image, and ACE-Step use ${kitchenAttention ?? 'ComfyUI default attention'}.` : 'Install ComfyUI-SolAttn-H3, restart ComfyUI, then Test connection.'}</small></span></label>
      <fieldset className="attention-backend-picker h3-precision-picker"><legend>H3 diffusion weight format</legend><label className={settings.h3DiffusionPrecision === 'int8' ? 'selected' : ''}><input type="radio" name="h3-diffusion-precision" checked={settings.h3DiffusionPrecision === 'int8'} onChange={() => setSettings({ ...settings, h3DiffusionPrecision: 'int8' })} /><span><strong>INT8 ConvRot</strong><small>Recommended for this RTX 3090 · native CUDA 13 path · best current speed/quality balance.</small></span></label><label className={settings.h3DiffusionPrecision === 'nvfp4' ? 'selected' : ''}><input type="radio" name="h3-diffusion-precision" checked={settings.h3DiffusionPrecision === 'nvfp4'} onChange={() => setSettings({ ...settings, h3DiffusionPrecision: 'nvfp4' })} /><span><strong>NVFP4 · experimental</strong><small>{nvfp4DiffusionReady ? 'FL2VA and Ref2VA detected. New H3, Sol, and Turbo 8 workflows will use them.' : `Install ${!nvfp4Fl2vaInstalled && !nvfp4Ref2vaInstalled ? 'both diffusion files' : !nvfp4Fl2vaInstalled ? 'FL2VA' : 'Ref2VA'}. Until then, the app falls back to the installed INT8 pair.`}</small></span></label></fieldset>
      <div className="settings-note nvfp4-download-panel"><strong>NVFP4 downloads</strong><p>The diffusion conversions are community files. Native NVFP4 diffusion execution targets Blackwell GPUs; an RTX 3090 emulates it and may be slower or show more artifacts than INT8 ConvRot.</p><div><a className="secondary-button" href="https://huggingface.co/lilcheaty/MiniMax-H3-NVFP4/resolve/main/minimax_h3_fl2va_pruned_nvfp4.safetensors?download=true" target="_blank" rel="noreferrer"><Download size={14} />FL2VA NVFP4 · 12.5 GB</a><a className="secondary-button" href="https://huggingface.co/lilcheaty/MiniMax-H3-NVFP4/resolve/main/minimax_h3_ref2va_pruned_nvfp4.safetensors?download=true" target="_blank" rel="noreferrer"><Download size={14} />Ref2VA NVFP4 · 12.5 GB</a><a className="secondary-button" href="https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors?download=true" target="_blank" rel="noreferrer"><Download size={14} />Official text encoder · 15.7 GB</a></div><small>Put FL2VA and Ref2VA in <code>ComfyUI/models/diffusion_models</code>; put the Qwen text encoder in <code>ComfyUI/models/text_encoders</code>. Restart or rescan models afterward.</small></div>
      <div className="field-group"><label htmlFor="sol-attn-tau">Routing threshold (tau)</label><input id="sol-attn-tau" type="number" min="-1000" max="10" step="0.05" value={settings.solAttnTau} disabled={!solAttentionNode} onChange={(event) => setSettings({ ...settings, solAttnTau: Math.max(-1000, Math.min(10, Number(event.target.value) || 1)) })} /><p className="field-help">1.0 is NVIDIA’s validated H3 policy. Higher values compute fewer key/value blocks and may change output quality.</p></div>
      <label className="settings-check"><input type="checkbox" checked={settings.solCacheEnabled} disabled={!solCacheNode} onChange={(event) => setSettings({ ...settings, solCacheEnabled: event.target.checked })} /><span><strong>Add NVIDIA-style cross-step cache</strong><small>{solCacheNode ? `Detected: ${solCacheNode}. Uses threshold 0.10 and at most five retained steps before Sol-Attn.` : 'Install the compatible ComfyUI-MiniMaxH3-Cache node. Other cache families are not auto-substituted because their hooks can conflict with Sol.'}</small></span></label>
      <div className={`sol-runtime-panel ${solRuntimeDiagnostics.state}`}><div><strong>Sol runtime diagnostics</strong><span>{solRuntimeLabel(solRuntimeDiagnostics)}</span></div><small>Policy: tau 1.0 · diag · 20% dense warmup · first 2 dense layers · prefix sink · correctness gate · KV splits 1. SageAttention is the launch-level dense fallback; no Sage patch node is added to Sol graphs.</small><div className="sol-runtime-metrics"><span>Backend {solRuntimeDiagnostics.backend ?? 'awaiting runtime log'}</span><span>Sparse {solRuntimeDiagnostics.sparseCalls ?? '—'}</span><span>Dense {solRuntimeDiagnostics.denseCalls ?? '—'}</span><span>Density {solRuntimeDiagnostics.density ?? '—'}</span><span>Seq {solRuntimeDiagnostics.sequenceLength?.toLocaleString() ?? '—'}</span><span>Gate {solRuntimeDiagnostics.correctnessGate ?? '—'}</span></div></div>
      <div className="settings-note"><strong>ComfyUI setup required</strong><br />ComfyUI Desktop uses a managed Python environment. Install both the custom node and NVIDIA kernel there, then restart and test the connection.</div>
      <div className="sol-engine-actions"><button type="button" className="secondary-button sol-guide-button" onClick={() => setSolGuideOpen(true)}>How to install Sol-Attn</button><button type="button" className="primary-button" disabled={!status.connected || !solAttentionNode || !h3Report.ready} onClick={() => void testSolEngine()}>{!status.connected ? 'Connect ComfyUI to test' : 'Test Sol Engine'}</button></div>
      {solTestStatus && <p className={`settings-note ${solTestStatus.startsWith('Sol test failed') ? 'error' : ''}`} role="status">{solTestStatus}</p>}
    </section>
    <section className="settings-section h3-stack-section" id="settings-h3">
      <div className="settings-heading"><div><Gauge size={19} /><span><strong>H3 engine stack</strong><small>Compares the selected files with the validated official ComfyUI stack.</small></span></div><span className={`health-pill ${h3Report.validated ? 'online' : ''}`}>{h3Report.validated ? 'Validated' : h3Report.ready ? 'Custom' : 'Incomplete'}</span></div>
      <div className="h3-stack-list">{h3Report.rows.map((row) => <div key={row.label} className={row.validated ? 'validated' : row.optional && !row.selected ? 'optional' : 'custom'}><span>{row.validated ? <Check size={14} /> : row.optional && !row.selected ? <Minus size={14} /> : <AlertCircle size={14} />}</span><div><strong>{row.label}</strong><small title={row.selected || row.expected}>{row.selected || `${row.optional ? 'Optional' : 'Missing'} · expected ${row.expected}`}</small></div><em>{row.validated ? 'Recommended' : row.selected ? 'Non-standard' : row.optional ? 'Optional' : 'Missing'}</em></div>)}</div>
      {!h3Report.validated && <p className="settings-warning"><AlertCircle size={15} />Some components differ from the validated H3 stack. Generation remains available, but output quality may differ.</p>}
      <div className="diagnostic-action"><span><strong>Fixed quality comparison</strong><small>Queues Native Quality and Turbo 8 at 1344 × 768, 5 seconds, seed 12345, with no upscale.</small></span><button className="secondary-button" disabled={!status.connected || diagnosticRunning || !h3Report.ready} onClick={onRunDiagnostics}>{diagnosticRunning ? <LoaderCircle className="spin" size={15} /> : <Activity size={15} />}{diagnosticRunning ? 'Queuing tests…' : 'Run H3 Quality Test'}</button></div>
    </section>
    <section className="settings-section generation-defaults-section" id="settings-defaults">
      <div className="settings-heading"><div><SlidersHorizontal size={19} /><span><strong>Generation defaults</strong><small>Choose the starting values for the main Create workspace.</small></span></div><button className="secondary-button" onClick={onApplyDefaults}>Apply to Create</button></div>
      <div className="preset-row" aria-label="Generation presets">
        <button type="button" onClick={() => applyPreset('quality')}><strong>Native Quality</strong><small>1344 × 768 · 30 steps · no upscale</small></button>
        <button type="button" onClick={() => applyPreset('official-turbo')}><strong>Turbo 8</strong><small>Native canvas · official LoRA 1.0</small></button>
        <button type="button" onClick={() => applyPreset('preview')}><strong>Preview</strong><small>864 × 480 · official Turbo 8</small></button>
      </div>
      <div className="render-preset-manager" aria-labelledby="render-preset-manager-title"><div><span><Save size={15} /><span><strong id="render-preset-manager-title">Saved Ref2VA intents</strong><small>Intents save resolution, duration, Turbo profile, steps, fidelity, sampling, shifts, and upscale settings. Prompts and source media are never included.</small></span></span><span>{settings.renderSettingsPresets.length} saved</span></div><form onSubmit={(event) => { event.preventDefault(); saveRenderPreset() }}><label><span>Save current defaults as an intent</span><input value={presetName} maxLength={60} onChange={(event) => setPresetName(event.target.value)} placeholder="e.g. Dialogue close-up" /></label><button className="secondary-button" type="submit" disabled={!presetName.trim()}><Plus size={14} />Save intent</button></form>{settings.renderSettingsPresets.length > 0 && <div className="render-preset-list">{settings.renderSettingsPresets.map((preset) => <article key={preset.id}><span><strong>{preset.name}</strong><small>{preset.values.resolution.replace('x', ' × ')} · {preset.values.duration}s · {preset.values.turbo === 'off' ? `${preset.values.steps} steps` : `Turbo ${preset.values.turbo} · ${preset.values.turbo === '8' ? `${preset.values.steps} steps · ${preset.values.turbo8Profile}` : '4 steps'}`}</small></span><div><button type="button" className="secondary-button" onClick={() => applyRenderPreset(preset)}>Load</button><button type="button" className="icon-button" onClick={() => renameRenderPreset(preset)} aria-label={`Rename ${preset.name}`}><Pencil size={14} /></button><button type="button" className="icon-button" onClick={() => deleteRenderPreset(preset)} aria-label={`Delete ${preset.name}`}><Trash2 size={14} /></button></div></article>)}</div>}</div>
      <div className="generation-defaults-grid">
        <SelectField label="Default resolution" value={defaults.resolution} onChange={(resolution) => updateDefaults({ resolution })} options={['608x352', '864x480', '1056x608', '1344x768', '768x1344', '768x768'].map((value) => [value, value.replace('x', ' × ')])} />
        <NumberField label="Default duration (seconds)" value={defaults.duration} min={2} max={15} step={0.5} onChange={(duration) => updateDefaults({ duration })} />
        <SelectField label="Default quality" value={defaults.turbo === '4' ? '8' : defaults.turbo} onChange={(turbo) => updateDefaults({ turbo: turbo as 'off' | '8', ...(turbo === 'off' ? { steps: 30 } : {}) })} options={[["off", 'Native quality · 30 steps'], ["8", 'Official Turbo 8']]} />
        <SelectField label="Turbo 8 profile" value={defaults.turbo8Profile} onChange={(turbo8Profile) => updateDefaults({ turbo8Profile: turbo8Profile as Turbo8Profile })} options={[["stable", 'Stable · Euler + Simple'], ["balanced", 'Balanced · res_multistep + Simple'], ["motion", 'Motion · res_multistep + Beta'], ["euler-beta", 'Euler + Beta · controlled test']]} />
        <SelectField label="Default text encoder" value={defaults.textEncoderPreference} onChange={(textEncoderPreference) => updateDefaults({ textEncoderPreference: textEncoderPreference as 'fast' | 'quality' })} options={[["fast", 'Fast · NVFP4-AWQ · 15.7 GB'], ["quality", 'Slower · better encoding · INT8 ConvRot · 27.1 GB']]} />
        <NumberField label="Full-quality steps" value={defaults.steps} min={16} max={30} onChange={(steps) => updateDefaults({ steps })} />
        <SelectField label="Reference image fidelity" value={defaults.refImageSize} onChange={(refImageSize) => updateDefaults({ refImageSize: refImageSize as 'match' | 'max' })} options={[["match", 'Match output · faster'], ["max", 'Maximum identity · slower']]} />
        <SelectField label="Default refinement and upscale" value={defaults.upscaleMode} onChange={(upscaleMode) => updateDefaults({ upscaleMode: upscaleMode as UpscaleMode })} options={[["off", 'Off · fastest'], ["refine", 'Refine · same resolution'], ["h3", 'Refine + Upscale · H3 2×'], ["ltx", 'LTX 2.5 latent · 2×'], ["rtx", 'RTX/CUDA frames · 2× · experimental']]} />
        <label className="settings-check"><input type="checkbox" checked={defaults.livePreview} onChange={(event) => updateDefaults({ livePreview: event.target.checked })} /><span><strong>Live preview by default</strong><small>Uses ComfyUI progress and preview events.</small></span></label>
      </div>
      <details className="experimental-settings"><summary><AlertCircle size={15} /><span><strong>Experimental sampling</strong><small>Custom samplers, shifts, official Turbo LoRA weight, and 4-step FL2V can make output less stable.</small></span><ChevronDown size={15} /></summary><div className="generation-defaults-grid"><label className="settings-check"><input type="checkbox" checked={defaults.experimentalSampling} onChange={(event) => updateDefaults({ experimentalSampling: event.target.checked })} /><span><strong>Enable custom sampler</strong><small>Otherwise res_multistep + simple is forced.</small></span></label><SelectField label="Experimental Turbo override" value={defaults.turbo} onChange={(turbo) => updateDefaults({ turbo: turbo as 'off' | '4' | '8' })} options={[["off", 'Off'], ["8", 'Official 8-step'], ["4", '4-step preview testing']]} /><div className="turbo-lora-weight"><NumberField label="Official Turbo LoRA weight" value={defaults.loraStrength} min={0} max={2} step={0.05} onChange={(loraStrength) => updateDefaults({ loraStrength })} /><small>Sets the automatic Turbo adapter weight; manual Additional ComfyUI LoRAs use their own strengths.</small></div><SelectField label="Sampler" value={defaults.experimentalSampling ? defaults.sampler : 'res_multistep'} disabled={!defaults.experimentalSampling} onChange={(sampler) => updateDefaults({ sampler })} options={samplerOptions.map((value) => [value, value])} /><SelectField label="Scheduler" value={defaults.experimentalSampling ? defaults.scheduler : 'simple'} disabled={!defaults.experimentalSampling} onChange={(scheduler) => updateDefaults({ scheduler })} options={schedulerOptions.map((value) => [value, value])} /><SelectField label="Sigma shifts" value={defaults.sigmaShiftMode} onChange={(sigmaShiftMode) => updateDefaults({ sigmaShiftMode: sigmaShiftMode as 'model' | 'custom' })} options={[["model", 'Native model defaults · 12 / 3'], ["custom", 'Custom MiniMaxH3SigmaShift node']]} /><NumberField label="Video sigma shift" value={defaults.shiftVideo} min={0.01} max={100} step={0.01} disabled={defaults.sigmaShiftMode !== 'custom'} onChange={(shiftVideo) => updateDefaults({ shiftVideo })} /><NumberField label="Audio sigma shift" value={defaults.shiftAudio} min={0.01} max={100} step={0.01} disabled={defaults.sigmaShiftMode !== 'custom'} onChange={(shiftAudio) => updateDefaults({ shiftAudio })} /></div></details>
      {warnedSampler && <p className="settings-warning"><AlertCircle size={15} />This sampler is on the compatibility-risk list you supplied. Test a short clip before committing to a final render.</p>}
      <p className="settings-note">The production path is 1344 × 768, 30 steps, res_multistep + simple, CFG 1, denoise 1, 24 fps, native 12/3 shifts, and upscale off. Custom sampling is intentionally separated because it complicates quality diagnosis.</p>
    </section>
    <section className="settings-section character-detail-addon-section" id="settings-assistant">
      <div className="settings-heading"><div><ImageIcon size={19} /><span><strong>Character detail references</strong><small>Optional add-on for focused, custom-named visual references on a character.</small></span></div><span className={`health-pill ${settings.characterDetailReferencesEnabled ? 'online' : ''}`}>{settings.characterDetailReferencesEnabled ? 'Enabled' : 'Off'}</span></div>
      <label className="settings-check"><input type="checkbox" checked={settings.characterDetailReferencesEnabled} onChange={(event) => setSettings({ ...settings, characterDetailReferencesEnabled: event.target.checked })} /><span><strong>Enable character detail references</strong><small>Character Studio can store an uploaded image and optional render notes for any body area or visual detail you name. When enabled, these references are included in the character’s MiniMax reference budget; no fixed body-part categories are imposed by the app.</small></span></label>
    </section>
    <section className="settings-section experimental-msr-section"><div className="settings-heading"><div><Aperture size={19} /><span><strong>Experimental · LTX 2.5 MSR references</strong><small>Opt in to Licon MSR multi-reference conditioning for LTX 2.5.</small></span></div><span className={`health-pill ${settings.experimentalLtxMsrEnabled ? 'online' : ''}`}>{settings.experimentalLtxMsrEnabled ? 'Enabled' : 'Off'}</span></div><label className="settings-check"><input type="checkbox" checked={settings.experimentalLtxMsrEnabled} onChange={(event) => setSettings({ ...settings, experimentalLtxMsrEnabled: event.target.checked })} /><span><strong>Enable Licon MSR Reference Mode</strong><small>Enables the experimental LTX reference path only after its nodes and compatible LoRA are detected. It remains off by default because this is a third-party extension.</small></span></label><div className="settings-note"><strong>ComfyUI installation</strong><br />1. In <code>ComfyUI/custom_nodes</code>, run <code>git clone https://github.com/liconstudio/ComfyUI-LTX2.5-MSR</code>.<br />2. Install its requirements with your ComfyUI Python: <code>pip install -r ComfyUI-LTX2.5-MSR/requirements.txt</code>.<br />3. Download <code>LTX-2.5-Licon-MSR-V1.safetensors</code> from the Licon MSR V1 release into <code>ComfyUI/models/loras/ltx2.5/</code>.<br />4. Restart ComfyUI, Test connection, and Rescan models. The app requires <code>ComfyUILTX25MSRICLoRALoader</code> and <code>ComfyUILTX25MSRMultiReferenceGuide</code>. Use Image 1–4 for subjects/items and Image 5 for background; describe each role as Image 1, Image 2, and so on.</div></section>
    <section className="settings-section ollama-section">
      <div className="settings-heading">
        <div><Sparkles size={19} /><span><strong>Local AI prompt assistant</strong><small>Ollama remains the default; LM Studio is an optional local provider.</small></span></div>
        <span className={`health-pill ${currentLlmStatus?.connected ? 'online' : ''}`}>{llmHealthLabel}</span>
      </div>
      <fieldset className="llm-provider-picker">
        <legend>Provider</legend>
        <label className={settings.llmProvider === 'ollama' ? 'selected' : ''}><input type="radio" name="llm-provider" value="ollama" checked={settings.llmProvider === 'ollama'} onChange={() => setSettings({ ...settings, llmProvider: 'ollama' })} /><span><strong>Ollama</strong><small>Default · native local API</small></span></label>
        <label className={settings.llmProvider === 'lmstudio' ? 'selected' : ''}><input type="radio" name="llm-provider" value="lmstudio" checked={settings.llmProvider === 'lmstudio'} onChange={() => setSettings({ ...settings, llmProvider: 'lmstudio' })} /><span><strong>LM Studio</strong><small>Optional · enable explicitly</small></span></label>
      </fieldset>
      <div className="ollama-grid">
        <div className="field-group"><label htmlFor="llm-url">{llm.label} URL</label><input id="llm-url" value={settings[activeUrlField]} onChange={(event) => setSettings({ ...settings, [activeUrlField]: event.target.value })} /></div>
        <div className="field-group"><label htmlFor="llm-model">Local model</label><div className="select-wrap"><select id="llm-model" value={settings[activeModelField]} onChange={(event) => setSettings({ ...settings, [activeModelField]: event.target.value })} disabled={ollamaModels.length === 0}>{ollamaModels.length === 0 ? <option value="">No local models detected</option> : ollamaModels.map((model) => <option value={model.name} key={model.name}>{model.name}{model.parameterSize ? ` · ${model.parameterSize}` : ''}</option>)}</select><ChevronDown size={15} /></div></div>
        <button className="secondary-button test-button" onClick={onRefreshOllama} disabled={localLlmChecking}>{localLlmChecking ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}{localLlmChecking ? 'Checking…' : 'Test & refresh'}</button>
      </div>
      {currentLlmStatus?.error && <div className="llm-setup-message error"><AlertCircle size={16} /><span><strong>{llm.label} could not be reached</strong><small>{currentLlmStatus.error}</small></span></div>}
      {currentLlmStatus?.connected && ollamaModels.length === 0 && <div className="llm-setup-message warning"><Download size={16} /><span><strong>{llm.label} is running, but it has no usable local models</strong><small>{settings.llmProvider === 'ollama' ? <>Open a terminal, run <code>ollama pull qwen3:latest</code>, wait for it to finish, then choose <b>Test &amp; refresh</b>.</> : 'Load a text-generation model in LM Studio, start its Local Server, then choose Test & refresh.'}</small></span></div>}
      {settings.llmProvider === 'ollama' && !currentLlmStatus && <div className="llm-setup-message"><Sparkles size={16} /><span><strong>Ollama setup</strong><small>1. Install and start Ollama. 2. Run <code>ollama pull qwen3:latest</code> in a terminal. 3. Keep the default URL unless Ollama uses another port. 4. Choose <b>Test &amp; refresh</b>.</small></span></div>}
      <p className="settings-note">{settings.llmProvider === 'lmstudio' ? 'LM Studio is opt-in and restricted to loopback addresses (localhost, 127.0.0.1, or ::1). Start its Local Server and load a model before testing.' : 'Prompts and reference images go directly to the selected local Ollama server. Embedding and cloud-backed entries are excluded. Image analysis requires a vision-capable model; text-only models still support prompt refinement.'}</p>
    </section>
    <section className="settings-section" id="settings-models"><div className="settings-heading"><div><HardDrive size={19} /><span><strong>Model locations</strong><small>Files are indexed in place and are never moved or copied.</small></span></div><button className="secondary-button" onClick={onScan} disabled={scanning}>{scanning ? <LoaderCircle size={16} className="spin" /> : <RefreshCw size={16} />}{scanning ? 'Scanning…' : 'Rescan'}</button></div><div className="path-table">{pathRows.map((row) => { const count = models.filter((model) => model.kind === row.kind).length; return <div className="path-row" key={row.kind}><div className="path-kind"><Folder size={17} /><span><strong>{row.label}</strong><small>{row.note}</small></span></div><div className="path-input"><input value={settings.paths[row.kind]} onChange={(event) => setSettings({ ...settings, paths: { ...settings.paths, [row.kind]: event.target.value } })} /><button onClick={async () => { const path = await window.minimax.chooseDirectory(settings.paths[row.kind]); if (path) setSettings({ ...settings, paths: { ...settings.paths, [row.kind]: path } }) }} aria-label={`Browse for ${row.label}`}><FolderOpen size={17} /></button></div><span className="file-count">{count} files</span></div>})}</div></section>
    <section className="settings-section" id="settings-storage"><div className="settings-heading"><div><FolderOpen size={19} /><span><strong>Output & clip tools</strong><small>Completed videos, extracted frames, and editor exports stay local.</small></span></div></div>{detectedOutputDirectory && <p className={`settings-note ${outputDirectoryMismatch ? 'warning' : ''}`} role="status">Running ComfyUI output: <code>{detectedOutputDirectory}</code>{outputDirectoryMismatch && <button type="button" className="secondary-button" onClick={() => setSettings({ ...settings, outputDirectory: detectedOutputDirectory, clipMasterOutputDirectory: `${detectedOutputDirectory}\\video` })}>Use this folder</button>}</p>}<div className="connection-row"><div className="field-group grow"><label htmlFor="output-path">ComfyUI output directory</label><input id="output-path" value={settings.outputDirectory} onChange={(event) => setSettings({ ...settings, outputDirectory: event.target.value })} /></div><button className="secondary-button test-button" onClick={async () => { const path = await window.minimax.chooseDirectory(settings.outputDirectory); if (path) setSettings({ ...settings, outputDirectory: path }) }}><FolderOpen size={16} />Browse</button></div><div className="connection-row"><div className="field-group grow"><label htmlFor="clip-master-output-path">Clip Master default output folder</label><input id="clip-master-output-path" value={settings.clipMasterOutputDirectory} onChange={(event) => setSettings({ ...settings, clipMasterOutputDirectory: event.target.value })} /></div><button className="secondary-button test-button" onClick={async () => { const path = await window.minimax.chooseDirectory(settings.clipMasterOutputDirectory); if (path) setSettings({ ...settings, clipMasterOutputDirectory: path }) }}><FolderOpen size={16} />Browse</button></div><p className="settings-note">Defaults to ComfyUI/output/video. Clip Master creates a separate ClipMaster/source-clip folder here for frames and suggests this folder when exporting a trimmed video; the save dialog can still use another location.</p><div className="connection-row clip-tool-path"><div className="field-group grow"><label htmlFor="ffmpeg-path">FFmpeg executable</label><input id="ffmpeg-path" value={settings.ffmpegPath} onChange={(event) => setSettings({ ...settings, ffmpegPath: event.target.value })} /></div></div><p className="settings-note">The clip editor uses FFmpeg for frame extraction, trim points, joining, and full-project export.</p><label className="settings-check"><input type="checkbox" checked={settings.blurNsfwLivePreviews} onChange={(event) => setSettings({ ...settings, blurNsfwLivePreviews: event.target.checked })} /><span><strong>Blur sensitive live previews</strong><small>When enabled, the local preview blurs if the render prompt contains explicit-adult wording. Hover or keyboard-focus the preview to reveal it. This never blocks, changes, or uploads a render.</small></span></label><div className="legacy-migration-settings"><div><strong>Previous Studio data</strong><small>{legacyMigration?.needsBrowserStorageRepair ? 'Restore the previous local characters, projects, and workspace state. This replaces Oyama browser-backed workspace data, then requires a restart.' : legacyMigration?.migrated ? 'The previous MiniMax Studio profile was imported. Run this again only to collect files added to the old app after the first import.' : legacyMigration?.available ? 'Import your previous MiniMax Studio profile into Oyama. Existing Oyama data is never replaced.' : 'No previous MiniMax Studio profile was found on this computer.'}</small></div><button type="button" className="secondary-button" disabled={!legacyMigration?.available || legacyMigrationRunning} onClick={onRunLegacyMigration}>{legacyMigrationRunning ? <LoaderCircle className="spin" size={15} /> : <History size={15} />}{legacyMigrationRunning ? 'Importing…' : legacyMigration?.needsBrowserStorageRepair ? 'Restore projects & characters' : legacyMigration?.migrated ? 'Import missing data again' : 'Import previous data'}</button></div></section>
    <section className="settings-section factory-reset-section" id="settings-reset">
      <div className="settings-heading"><div><RotateCcw size={19} /><span><strong>Factory reset</strong><small>Clear all saved workspaces, characters, assets, projects, presets, and library history. Restore default settings.</small></span></div></div>
      <p className="settings-note">Generated media, imported files, models, and ComfyUI remain on disk. App records cannot be recovered through Undo. Finish or cancel active generations and close other editor windows first.</p>
      {!factoryResetOpen ? <button type="button" className="danger-button" onClick={() => { setFactoryResetPhrase(''); setFactoryResetOpen(true) }}>Reset the whole workspace…</button> : <form className="factory-reset-confirm" onSubmit={(event) => { event.preventDefault(); if (factoryResetPhrase === 'Reset') { onFactoryReset(); setFactoryResetPhrase(''); setFactoryResetOpen(false) } }}>
        <label htmlFor="factory-reset-confirmation">Type <strong>Reset</strong> to confirm<input id="factory-reset-confirmation" autoComplete="off" spellCheck={false} value={factoryResetPhrase} onChange={(event) => setFactoryResetPhrase(event.target.value)} /></label>
        <div><button type="button" className="secondary-button" onClick={() => { setFactoryResetOpen(false); setFactoryResetPhrase('') }}>Cancel</button><button type="submit" className="danger-button" disabled={factoryResetPhrase !== 'Reset'}>Factory reset and restart</button></div>
      </form>}
    </section>
  </div></div>
  {solGuideOpen && <div className="tips-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSolGuideOpen(false) }}>
    <section className="tips-modal sol-guide-modal" role="dialog" aria-modal="true" aria-labelledby="sol-guide-title">
      <header><div><span className="tips-modal-icon"><Gauge size={18} /></span><span><small>NVIDIA SOL ENGINE · WINDOWS</small><strong id="sol-guide-title">Install Sol-Attn in ComfyUI Desktop</strong><p>RTX 3090 · SM86 · Triton backend · MiniMax H3 video only</p></span></div><button type="button" className="icon-button" onClick={() => setSolGuideOpen(false)} aria-label="Close Sol setup guide"><X size={18} /></button></header>
      <div className="tips-modal-body sol-guide-body">
        <div className="sol-guide-callout"><AlertCircle size={16} /><p><strong>Use ComfyUI’s Python—not system Python.</strong> Your known environment is <code>C:\Users\James\Documents\ComfyUI\.venv\Scripts\python.exe</code>. The activated terminal should begin with <code>(.venv)</code>.</p></div>
        <article><span>01</span><div><strong>Open the ComfyUI Desktop terminal</strong><p>Confirm the active interpreter and hardware:</p><pre><code>python -c "import sys; print(sys.executable)"{`\n`}python -c "import torch; print(torch.__version__); print(torch.version.cuda); print(torch.cuda.get_device_name())"</code></pre><p>Expected on this machine: PyTorch 2.13.0+cu130, CUDA 13.0, and NVIDIA GeForce RTX 3090.</p></div></article>
        <article><span>02</span><div><strong>Install the ComfyUI custom node</strong><p>Use Manager → Custom Nodes Manager → Install via Git URL and paste:</p><pre><code>https://github.com/quzopl/ComfyUI-SolAttn-H3.git</code></pre><p>If Manager does not clone it, run this in the activated terminal:</p><pre><code>cd C:\Users\James\Documents\ComfyUI\custom_nodes{`\n`}git clone https://github.com/quzopl/ComfyUI-SolAttn-H3.git</code></pre></div></article>
        <article><span>03</span><div><strong>Clone NVIDIA’s Sol Engine branch</strong><p>The sparse kernel is intentionally not bundled with the custom node:</p><pre><code>cd C:\Users\James\Documents{`\n`}git clone --branch sol-engine --depth 1 https://github.com/NVlabs/Sana.git sana-sol-engine</code></pre></div></article>
        <article><span>04</span><div><strong>Install the kernel into ComfyUI’s environment</strong><pre><code>python -m pip install -e "C:\Users\James\Documents\sana-sol-engine\techniques\sparse_backends"</code></pre><p>For the RTX 3090, use the documented SM86 Triton path. CuTe DSL is for the newer SM89/90/100/120 paths and is not required here.</p></div></article>
        <article><span>05</span><div><strong>Install the compatible H3 cross-step cache</strong><pre><code>cd C:\Users\James\Documents\ComfyUI\custom_nodes{`\n`}git clone https://github.com/lihaoyun6/ComfyUI-MiniMaxH3-Cache.git</code></pre><p>This is the cache implementation explicitly exercised with the Sol-Attn port. The app uses threshold 0.10 and max_steps 5, matching the practical NVIDIA fullopt cache policy. Do not stack EasyCache, FirstBlockCache, CacheDiT, Spectrum, or another cache on the same H3 model path.</p></div></article>
        <article><span>06</span><div><strong>Verify Triton and run the self-test</strong><pre><code>python -c "import triton; print('Triton:', triton.__version__)"{`\n`}python "C:\Users\James\Documents\ComfyUI\custom_nodes\ComfyUI-SolAttn-H3\selftest.py"</code></pre><p>Look for RTX 3090, SM86, <code>backend=triton</code>, and <code>correctness gate PASS</code>. Do not enable Sol if the correctness gate fails.</p></div></article>
        <article><span>07</span><div><strong>Restart and detect the stack</strong><p>Fully quit and reopen ComfyUI Desktop, return here, and choose <strong>Test connection</strong>. This panel should detect both <code>SolAttnH3</code> and <code>MiniMaxH3Cache</code>. The app chains the official Turbo LoRA, cache, and Sol-Attn before sampling.</p></div></article>
        <article><span>08</span><div><strong>Benchmark before committing</strong><p>Sol is not guaranteed to beat SageAttention on every 3090 workload. Compare Native, SageAttention, Sol, and Sol + cache with the same model, prompt, seed, resolution, frames, steps, and references. Test the official eight-step LoRA separately from 20–50-step quality runs because fewer steps leave less cache reuse.</p></div></article>
        <div className="sol-guide-callout"><AlertCircle size={16} /><p><strong>Fullopt boundary:</strong> NVIDIA’s regional torch.compile kernels and resident BF16 VAE belong to its standalone Modular Diffusers runtime and are not safely exposed by the current ComfyUI Sol node. The Sol node itself documents a graph break under torch.compile. This app does not claim or enable those two optimizations until a compatible ComfyUI node reports them.</p></div>
        <div className="sol-guide-callout success"><Check size={16} /><p><strong>Recommended settings:</strong> tau 1.0, diag threshold, 20% dense warmup, two dense layers, prefix sink, correctness gate on, strict off, and kv_splits 1. The app supplies these automatically.</p></div>
      </div>
      <footer><span><AlertCircle size={14} />Sol applies only to new MiniMax H3 and Ref2VA video workflows.</span><button type="button" className="primary-button" onClick={() => setSolGuideOpen(false)}>Done</button></footer>
    </section>
  </div>}
  </div>
}

function AccessoryReferencePicker({ accessories, selectedPaths, onChange }: { accessories: AccessoryProject[]; selectedPaths: string[]; onChange(accessoryId: string): void }) {
  const usable = accessories.filter((accessory) => accessory.referenceImage?.path)
  if (!usable.length) return null
  return <fieldset className="character-reference-picker multi-character-picker accessory-reference-picker"><legend>Props and accessories in this render</legend><div><span><Watch size={17} /></span><span><strong>Prop library</strong><small>Select approved props, jewelry, bags, eyewear, and wearable details. They share the 9-picture limit.</small></span></div><div className="character-reference-choices">{usable.map((accessory) => { const image = accessory.referenceImage!; const selected = selectedPaths.includes(image.path); return <label className={selected ? 'selected' : ''} key={accessory.id}><input type="checkbox" checked={selected} onChange={() => onChange(accessory.id)} />{image.preview ? <img className="reference-choice-thumbnail" src={image.preview} alt="" /> : <span className="reference-choice-placeholder"><Watch size={18} /></span>}<span><strong>{accessory.name}</strong><small>{accessory.category === 'prop' ? 'Prop' : accessory.category} · approved reference</small><em>{accessory.materials || accessory.description || 'Reusable object reference'}</em></span></label> })}</div></fieldset>
}

export default App
