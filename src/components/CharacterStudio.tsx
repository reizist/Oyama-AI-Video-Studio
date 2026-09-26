import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, ChevronDown, CircleStop, Film, ImagePlus, Images, LoaderCircle, Mic2, Orbit, Plus, Scissors, Shirt, SlidersHorizontal, Sparkles, Star, Trash2, UserRound, WandSparkles, Watch, X } from 'lucide-react'
import { CHARACTER_LIBRARY_EVENT, characterReferences, loadCharacterProjects, newCharacterProject, removeCharacterImage, saveCharacterProjects } from '../lib/characterLibrary'
import { choices, type ObjectInfo } from '../lib/comfyInfo'
import { buildZImage } from '../lib/zimage'
import { resolveAttentionBackend } from '../lib/attentionBackend'
import { loadWardrobeProjects, wardrobeReferences, WARDROBE_LIBRARY_EVENT } from '../lib/wardrobeLibrary'
import { ACCESSORY_LIBRARY_EVENT, loadAccessoryProjects } from '../lib/accessoryLibrary'
import { HAIR_LIBRARY_EVENT, loadHairStyleProjects } from '../lib/hairLibrary'
import { ReferenceApprovalModal } from './ReferenceApprovalModal'
import { CharacterReadiness, type CharacterDetailTab } from './CharacterReadiness'
import { CharacterLibraryPanel } from './CharacterLibraryPanel'
import { CharacterReferenceList } from './CharacterReferenceList'
import { WorkspaceSectionTabs, type WorkspaceSectionTab } from './WorkspaceSectionTabs'
import { ReliableVideo } from './ReliableVideo'
import { characterAppearancePresets, characterPerformancePresets, characterVisualStylePresets, characterVoicePresets, appendPreset } from '../lib/characterPresets'
import { COPILOT_DECISION_EVENT, offerCopilotSuggestion } from '../lib/copilot'
import { createId } from '../lib/createId'
import { resolveLlmConnection } from '../lib/llmProvider'
import { analyzeReferenceImage } from '../lib/referenceAnalysis'
import type { AppSettings, CharacterProject, GenerationJob, MediaFile, ReferenceImageType } from '../types'
import { Badge, Button, Checkbox, Field, Input, ScrollArea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Separator, Tabs, TabsList, TabsTrigger, Textarea } from './ui'

const referenceTypeOptions: Array<{ value: ReferenceImageType; label: string }> = [
  { value: 'master', label: 'Master identity' },
  { value: 'face', label: 'Face close-up' },
  { value: 'full-body', label: 'Full body' },
  { value: 'three-quarter', label: 'Three-quarter' },
  { value: 'profile', label: 'Profile / side' },
  { value: 'back', label: 'Back view' },
  { value: 'detail', label: 'Identity detail' },
  { value: 'other', label: 'Other angle' },
]

type CharacterWorkspaceSection = 'library' | 'design' | 'generate'
const characterSections: readonly WorkspaceSectionTab<CharacterWorkspaceSection>[] = [
  { id: 'library', label: 'Characters', description: 'Browse saved identities' },
  { id: 'design', label: 'Design', description: 'Identity, look & voice' },
  { id: 'generate', label: 'Generate', description: 'Make & approve references' },
]

function cleanSinglePrompt(value: string) {
  return value
    .replace(/\\\s*(?:\r?\n|$)/g, ' ')
    .replace(/[*_#`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export type CharacterSurveyRenderOptions = {
  turbo: 'off' | '8'
  steps: number
  width: number
  height: number
}

export function CharacterStudio({ settings, info, connected, ollamaAvailable, automationJobs, onCreateTurntable, onNotice, onUseInScene, onOpenLibrary }: {
  settings: AppSettings
  info: ObjectInfo
  connected: boolean
  ollamaAvailable: boolean
  automationJobs?: GenerationJob[]
  onCreateTurntable(project: CharacterProject, options: CharacterSurveyRenderOptions): Promise<string | null>
  onNotice(tone: 'error' | 'success' | 'neutral', text: string): void
  onUseInScene(characterId: string): void
  onOpenLibrary(view: 'hair' | 'wardrobes' | 'accessories'): void
}) {
  const initial = useMemo(() => {
    const stored = loadCharacterProjects()
    return stored.length ? stored : [newCharacterProject()]
  }, [])
  const [projects, setProjects] = useState(initial)
  const [activeId, setActiveId] = useState(initial[0].id)
  const [videoDuration, setVideoDuration] = useState(0)
  const [splitting, setSplitting] = useState(false)
  const [assisting, setAssisting] = useState(false)
  const [masterJob, setMasterJob] = useState<{ id: string; url: string; characterId: string; target: 'master' | 'sheet' } | null>(null)
  const [masterBusy, setMasterBusy] = useState(false)
  const [masterMessage, setMasterMessage] = useState('')
  const [masterError, setMasterError] = useState(false)
  const [identityCandidateCount, setIdentityCandidateCount] = useState<1 | 2 | 4>(4)
  const [identitySteps, setIdentitySteps] = useState(8)
  const [surveyProfile, setSurveyProfile] = useState<'native' | 'turbo8' | 'turbo10' | 'turbo12'>('turbo10')
  const [surveyResolution, setSurveyResolution] = useState<'608x1056' | '768x1344'>('768x1344')
  const [sheetLayout, setSheetLayout] = useState<'coverage' | 'turnaround'>('coverage')
  const [candidate, setCandidate] = useState<{ characterId: string; target: 'master' | 'sheet'; file: MediaFile } | null>(null)
  const [batchJobs, setBatchJobs] = useState<Array<{ id: string; url: string; characterId: string }>>([])
  const [identityCandidates, setIdentityCandidates] = useState<MediaFile[]>([])
  const [selectedCandidatePaths, setSelectedCandidatePaths] = useState<string[]>([])
  const [candidateStep, setCandidateStep] = useState<'choose' | 'survey'>('choose')
  const [approvedFlowProject, setApprovedFlowProject] = useState<CharacterProject | null>(null)
  const [identitySurveyStartedAt, setIdentitySurveyStartedAt] = useState<number | null>(null)
  const [identitySurveySubmitting, setIdentitySurveySubmitting] = useState(false)
  const [identitySurveyError, setIdentitySurveyError] = useState('')
  const [refinementSuggestionId, setRefinementSuggestionId] = useState('')
  const [refinementSuggestion, setRefinementSuggestion] = useState('')
  const [wardrobes, setWardrobes] = useState(loadWardrobeProjects)
  const [accessories, setAccessories] = useState(loadAccessoryProjects)
  const [hairStyles, setHairStyles] = useState(loadHairStyleProjects)
  const [activeTab, setActiveTab] = useState<CharacterDetailTab>('identity')
  const [workspaceSection, setWorkspaceSection] = useState<CharacterWorkspaceSection>('design')
  const [selectedReferencePath, setSelectedReferencePath] = useState('')
  const active = projects.find((project) => project.id === activeId) ?? projects[0]
  const llm = resolveLlmConnection(settings)
  const activeAutomation = automationJobs?.find((job) => job.characterProjectId === active.id)
  const surveyTurbo = surveyProfile === 'native' ? 'off' as const : '8' as const
  const surveySteps = surveyProfile === 'native' ? 30 : surveyProfile === 'turbo8' ? 8 : surveyProfile === 'turbo12' ? 12 : 10
  const [surveyWidth, surveyHeight] = surveyResolution.split('x').map(Number)
  const surveyRenderOptions: CharacterSurveyRenderOptions = { turbo: surveyTurbo, steps: surveySteps, width: surveyWidth, height: surveyHeight }

  useEffect(() => {
    const refresh = () => {
      const next = loadCharacterProjects()
      if (next.length) setProjects(next)
    }
    window.addEventListener(CHARACTER_LIBRARY_EVENT, refresh)
    return () => window.removeEventListener(CHARACTER_LIBRARY_EVENT, refresh)
  }, [])
  useEffect(() => { const refresh = () => setWardrobes(loadWardrobeProjects()); window.addEventListener(WARDROBE_LIBRARY_EVENT, refresh); return () => window.removeEventListener(WARDROBE_LIBRARY_EVENT, refresh) }, [])
  useEffect(() => { const refresh = () => setAccessories(loadAccessoryProjects()); window.addEventListener(ACCESSORY_LIBRARY_EVENT, refresh); return () => window.removeEventListener(ACCESSORY_LIBRARY_EVENT, refresh) }, [])
  useEffect(() => { const refresh = () => setHairStyles(loadHairStyleProjects()); window.addEventListener(HAIR_LIBRARY_EVENT, refresh); return () => window.removeEventListener(HAIR_LIBRARY_EVENT, refresh) }, [])
  useEffect(() => {
    const decide = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; decision: 'approve' | 'dismiss' }>).detail
      if (!refinementSuggestionId || detail.id !== refinementSuggestionId) return
      if (detail.decision === 'approve') { patchProject(active.id, { referencePrompt: cleanSinglePrompt(refinementSuggestion) }); onNotice('success', 'Approved identity refinement applied to the master prompt.') }
      setRefinementSuggestionId(''); setRefinementSuggestion('')
    }
    window.addEventListener(COPILOT_DECISION_EVENT, decide)
    return () => window.removeEventListener(COPILOT_DECISION_EVENT, decide)
  }, [active.id, onNotice, refinementSuggestion, refinementSuggestionId])

  const commit = (next: CharacterProject[]) => { setProjects(next); saveCharacterProjects(next) }
  const patchProject = (id: string, change: Partial<CharacterProject>) => setProjects((current) => {
    const next = current.map((project) => project.id === id ? { ...project, ...change, updatedAt: Date.now() } : project)
    saveCharacterProjects(next)
    return next
  })
  const patch = (change: Partial<CharacterProject>) => commit(projects.map((project) => project.id === active.id ? { ...project, ...change, updatedAt: Date.now() } : project))
  const add = () => {
    const project = newCharacterProject(projects.length + 1)
    commit([...projects, project]); setActiveId(project.id)
  }
  const remove = () => {
    if (!window.confirm(`Delete the character project “${active.name}”? The original image and video files will remain on disk.`)) return
    const next = projects.filter((project) => project.id !== active.id)
    const fallback = next.length ? next : [newCharacterProject()]
    commit(fallback); setActiveId(fallback[0].id)
  }
  const chooseImage = async (target: 'base' | 'reference') => {
    const picked = await window.minimax.chooseMedia('image')
    if (!picked) return
    if (target === 'reference' && active.referenceImages.length >= 9 && !active.referenceImages.some(file => file.path === picked.path)) {
      onNotice('error', 'This character already has 9 approved images. Remove one before adding another.')
      return
    }
    const projectId = active.id
    const file: MediaFile = { ...picked, kind: 'image', referenceType: target === 'base' ? 'master' : 'full-body', preview: await window.minimax.mediaUrl(picked.path) }
    patch(target === 'base' ? { baseImage: file } : {
      referenceImages: active.referenceImages.some(item => item.path === file.path) ? active.referenceImages.map(item => item.path === file.path ? file : item) : [...active.referenceImages, file],
      selectedReferencePaths: active.selectedReferencePaths === undefined ? undefined : [...new Set([...active.selectedReferencePaths, file.path])],
    })
    if (!ollamaAvailable) { onNotice('neutral', `Image added. Connect a local vision model to fill the ${target === 'base' ? 'character profile' : 'missing profile fields'} automatically.`); return }
    onNotice('neutral', 'Image added. The local vision model is filling empty character fields…')
    try {
      const result = await analyzeReferenceImage(settings, picked.path, 'character')
      const current = loadCharacterProjects().find((item) => item.id === projectId)
      if (!current) return
      patchProject(projectId, {
        name: !current.name.trim() || /^Character \d+$/i.test(current.name) ? result.name || current.name : current.name,
        description: current.description.trim() ? current.description : result.description,
        hairPreset: current.hairPreset.trim() ? current.hairPreset : result.hairPreset,
        visualStyle: current.visualStyle.trim() && current.visualStyle !== 'cinematic photorealism' ? current.visualStyle : result.visualStyle || current.visualStyle,
      })
      onNotice('success', 'Existing image analyzed; empty character fields were filled for review.')
    } catch (reason) { onNotice('error', `The image was added, but automatic description failed: ${reason instanceof Error ? reason.message : String(reason)}`) }
  }
  const addDetailReference = () => patch({ detailReferences: [...active.detailReferences, { id: createId(), label: '', notes: '', images: [] }] })
  const patchDetailReference = (id: string, change: Partial<CharacterProject['detailReferences'][number]>) => patch({ detailReferences: active.detailReferences.map((detail) => detail.id === id ? { ...detail, ...change } : detail) })
  const removeDetailReference = (id: string) => patch({ detailReferences: active.detailReferences.filter((detail) => detail.id !== id) })
  const chooseDetailReferenceImage = async (id: string, imageIndex: number) => {
    const picked = await window.minimax.chooseMedia('image')
    if (!picked) return
    const image = { ...picked, kind: 'image' as const, preview: await window.minimax.mediaUrl(picked.path) }
    const detail = active.detailReferences.find((item) => item.id === id)
    if (!detail) return
    const images = [...detail.images]
    images[imageIndex] = image
    patchDetailReference(id, { images: images.filter(Boolean) })
  }
  const removeDetailReferenceImage = (id: string, imageIndex: number) => {
    const detail = active.detailReferences.find((item) => item.id === id)
    if (detail) patchDetailReference(id, { images: detail.images.filter((_, index) => index !== imageIndex) })
  }
  const chooseTurntable = async () => {
    const picked = await window.minimax.chooseMedia('video')
    if (!picked) return
    patch({ turntableVideo: { ...picked, kind: 'video', preview: await window.minimax.mediaUrl(picked.path) } })
    setVideoDuration(0)
  }
  const enhance = async () => {
    if (!ollamaAvailable || assisting) return
    setAssisting(true)
    try {
      const instruction = `Rewrite the character notes below as one concise, production-ready Z-Image identity reference prompt. Preserve every intentional identity detail, but remove repeated facts. Include the name, complexion when supplied, stable face geometry, age range, assigned hair, build, distinguishing marks, and the visible performance baseline. If reference images are attached, inspect them and express only stable visible traits that agree across the images; never infer sensitive traits or invent hidden details. Do not introduce wardrobe, jewelry, accessories, or recurring props; those are managed by their own studios. End with the requested visual style and these constraints: plain neutral studio background, even soft lighting, eye-level 50mm lens, relaxed symmetrical stance, hands visible, accurate anatomy, plain fitted neutral studio clothing, no text, no props, one adult person only. Return exactly one plain-text paragraph with no Markdown or line breaks.\n\nName: ${active.name}\nAppearance: ${active.description}\nAssigned hair: ${hairDirection || 'No separate hair design assigned.'}\nVoice and performance: ${active.voiceNotes}\nVisual style: ${active.visualStyle}`
      const imagePaths = [active.baseImage?.path, ...active.referenceImages.map((file) => file.path), activeHairStyle?.referenceImage?.path].filter(Boolean) as string[]
      let result: string
      if (imagePaths.length) {
        try { result = await window.minimax.generateWithOllamaVision(llm.url, llm.model, instruction, imagePaths, llm.provider) }
        catch { result = await window.minimax.generateWithOllama(llm.url, llm.model, instruction, llm.provider) }
      } else result = await window.minimax.generateWithOllama(llm.url, llm.model, instruction, llm.provider)
      const id = createId(); const cleaned = cleanSinglePrompt(result)
      setRefinementSuggestionId(id); setRefinementSuggestion(cleaned)
      offerCopilotSuggestion({ id, title: `Refine ${active.name}'s identity`, text: cleaned, target: 'character-identity', targetId: active.id, sourceLabel: `${llm.model} · ${llm.label} · ${imagePaths.length ? `${Math.min(6, imagePaths.length)} visual reference${imagePaths.length === 1 ? '' : 's'}` : 'profile notes'}` })
      onNotice('neutral', 'Identity refinement is ready to approve or dismiss in Studio copilot.')
    } catch (error) { onNotice('error', error instanceof Error ? error.message : String(error)) }
    finally { setAssisting(false) }
  }
  const activeHairStyle = hairStyles.find((item) => item.id === active.hairStyleIds[0])
  const hairDirection = activeHairStyle ? `Hair design: ${activeHairStyle.name}. ${activeHairStyle.description} Texture: ${activeHairStyle.texture}. Length: ${activeHairStyle.length}. ${activeHairStyle.color ? `Color: ${activeHairStyle.color}.` : ''} Hairline and part: ${activeHairStyle.hairline}. Finish: ${activeHairStyle.finish}.` : active.hairPreset ? `Hair: ${active.hairPreset}.` : ''
  const defaultZPrompt = [
    `Create exactly one full-body identity portrait of one adult character: ${active.name}.`, active.identityTemplate !== 'custom' && `${active.identityTemplate} casting reference treatment.`, active.skinTone && `Skin tone: ${active.skinTone}.`, hairDirection, active.description,
    `${active.visualStyle}. The complete body is visible from head through both feet, centered and front-facing, with the face large enough to identify. Plain fitted neutral studio clothing without jewelry or accessories. Plain neutral studio background, even soft lighting, eye-level 50mm lens, relaxed symmetrical stance, both hands visible, accurate anatomy. One person, one view, one frame; no collage, split panel, contact sheet, duplicate person, cropped feet, text, labels, logos, or props.`,
  ].filter(Boolean).join(' ')
  const editableZPrompt = active.referencePrompt.trim() || defaultZPrompt
  const identityGuardrails = 'Identity render contract: exactly one adult person and one coherent view. Preserve the requested identity traits without adding relatives, alternates, duplicates, inset portraits, collages, split panels, text, labels, props, or additional people. Show accurate anatomy with both hands and both feet visible.'
  const zPrompt = `${editableZPrompt} ${identityGuardrails}`
  const sheetPrompt = [
    `Experimental character reference sheet for one adult character: ${active.name}.`, active.skinTone && `Skin tone: ${active.skinTone}.`, active.description, hairDirection,
    sheetLayout === 'coverage'
      ? 'Create one clean 2-by-2 studio contact sheet with exactly four equal panels in this fixed order: top left is a complete straight-on full-body view with head, hands, and feet visible; top right is a sharp front-facing face close-up from shoulders up; bottom left is a complete left side-profile view with head and feet visible; bottom right is a complete straight rear view with head, hair, hands, and feet visible.'
      : 'Create one clean horizontal turnaround sheet with exactly four evenly spaced complete full-body views in this fixed order: straight front, three-quarter front, exact left side profile, and straight rear. Every view includes the complete head, both hands, and both feet.',
    `${active.visualStyle}. Every panel depicts the exact same person at the same age with identical face geometry, skin tone, hairstyle, body proportions, neutral expression, and fitted neutral studio clothing. Keep scale, lighting, white balance, and lens character consistent. Seamless neutral background with clear gutters. Do not blend anatomy across panels. Exactly four views of one identity; no extra people, duplicate panels, alternate outfits, pose changes, action, props, jewelry, text, labels, logos, borders through the body, cropped limbs, or invented details.`,
  ].filter(Boolean).join(' ')
  const zModel = choices(info, 'UNETLoader', 'unet_name').find((name) => /z[_-]?image.*turbo/i.test(name)) ?? 'z_image_turbo_bf16.safetensors'
  const zEncoder = choices(info, 'CLIPLoader', 'clip_name').find((name) => /qwen[_-]?3[_-]?4b/i.test(name)) ?? 'qwen_3_4b.safetensors'
  const zVae = choices(info, 'VAELoader', 'vae_name').find((name) => /^ae\.safetensors$/i.test(name)) ?? 'ae.safetensors'
  const zReady = connected && choices(info, 'UNETLoader', 'unet_name').includes(zModel) && choices(info, 'CLIPLoader', 'clip_name').includes(zEncoder) && choices(info, 'VAELoader', 'vae_name').includes(zVae)
  const identitySurveyRef2vaModel = choices(info, 'UNETLoader', 'unet_name').find((name) => /minimax_h3_ref2va/i.test(name))
  const identitySurveyTurboLora = choices(info, 'LoraLoaderModelOnly', 'lora_name').find((name) => /minimax_h3_ref2v_turbo_8step/i.test(name))
  const identitySurveyTextEncoder = choices(info, 'CLIPLoader', 'clip_name').find((name) => /qwen3vl_32b_minimax_h3/i.test(name))
  const identitySurveyVideoVae = choices(info, 'VAELoader', 'vae_name').find((name) => /minimax_h3_video_vae/i.test(name))
  const identitySurveyAudioVae = choices(info, 'VAELoader', 'vae_name').find((name) => /minimax_h3_audio_vae/i.test(name))
  const identitySurveyRef2vaReady = connected && Boolean(identitySurveyRef2vaModel && (surveyTurbo === 'off' || identitySurveyTurboLora) && identitySurveyTextEncoder && identitySurveyVideoVae && identitySurveyAudioVae)
  const identitySurveyRef2vaReason = !connected
    ? 'Start ComfyUI and Test connection.'
    : !identitySurveyRef2vaModel
      ? 'Install the MiniMax H3 Ref2VA diffusion model and rescan models.'
      : surveyTurbo !== 'off' && !identitySurveyTurboLora
        ? 'Install the MiniMax H3 Ref2V Turbo 8-step LoRA and rescan models.'
      : !identitySurveyTextEncoder
        ? 'Install a MiniMax H3 Qwen3-VL text encoder and rescan models.'
        : !identitySurveyVideoVae || !identitySurveyAudioVae ? 'Install both MiniMax H3 video and audio VAEs, then rescan models.' : ''
  const createMaster = async (target: 'master' | 'sheet' = 'master') => {
    const renderPrompt = target === 'sheet' ? sheetPrompt : zPrompt
    if (!zReady || masterBusy || !renderPrompt.trim()) return
    setMasterBusy(true); setMasterError(false); setMasterMessage(target === 'sheet' ? 'Submitting the four-view character sheet to Z-Image Turbo…' : 'Submitting the master reference to Z-Image Turbo…')
    try {
      const response = await window.minimax.submitPrompt(settings.comfyUrl, buildZImage(renderPrompt.trim(), target === 'sheet' ? 1024 : 768, target === 'sheet' ? 1024 : 1024, Math.floor(Math.random() * 1_000_000_000), zModel, zEncoder, zVae, identitySteps, 1, 'turbo', '', resolveAttentionBackend(settings.attentionBackend, choices(info, 'ModelAttentionBackend', 'attention'))))
      setMasterJob({ id: response.prompt_id, url: settings.comfyUrl, characterId: active.id, target })
      setMasterMessage(target === 'sheet' ? 'Constructing the character sheet in ComfyUI…' : 'Rendering the character master reference in ComfyUI…')
    } catch (error) {
      setMasterMessage(error instanceof Error ? error.message : String(error)); setMasterError(true); setMasterBusy(false)
    }
  }
  const createIdentityBatch = async (requestedCount = identityCandidateCount) => {
    const count = requestedCount === 4 ? identityCandidateCount : requestedCount
    if (!zReady || masterBusy || !zPrompt.trim()) return
    setMasterBusy(true); setMasterError(false); setIdentityCandidates([]); setSelectedCandidatePaths([]); setCandidateStep('choose'); setApprovedFlowProject(null); setIdentitySurveyStartedAt(null); setMasterMessage(`Queueing ${count} distinct identity candidates…`)
    try {
      const responses = await Promise.allSettled(Array.from({ length: count }, () => window.minimax.submitPrompt(settings.comfyUrl, buildZImage(zPrompt.trim(), 768, 1024, Math.floor(Math.random() * 1_000_000_000), zModel, zEncoder, zVae, identitySteps, 1, 'turbo', '', resolveAttentionBackend(settings.attentionBackend, choices(info, 'ModelAttentionBackend', 'attention'))))))
      const queued = responses.flatMap((response) => response.status === 'fulfilled' ? [{ id: response.value.prompt_id, url: settings.comfyUrl, characterId: active.id }] : [])
      if (!queued.length) throw new Error(responses.find((response) => response.status === 'rejected')?.reason instanceof Error ? responses.find((response) => response.status === 'rejected')!.reason.message : 'No identity candidates could be queued.')
      setBatchJobs(queued)
      setMasterMessage(queued.length === count ? `${count} candidates queued. They will appear together for approval.` : `${queued.length} of ${count} candidates queued. The successful renders will still appear for approval.`)
    } catch (error) { setMasterMessage(error instanceof Error ? error.message : String(error)); setMasterError(true); setMasterBusy(false) }
  }
  const cancelBatch = async () => { await Promise.allSettled(batchJobs.map((item) => window.minimax.cancelPrompt(item.url, item.id))); setBatchJobs([]); setMasterBusy(false); setMasterMessage('Identity batch cancelled.') }
  const cancelMaster = async () => {
    if (!masterJob) return
    try { await window.minimax.cancelPrompt(masterJob.url, masterJob.id); setMasterMessage('Master-reference render cancelled.'); setMasterError(false) }
    catch (error) { setMasterMessage(error instanceof Error ? error.message : String(error)); setMasterError(true) }
    finally { setMasterJob(null); setMasterBusy(false) }
  }

  useEffect(() => {
    if (!masterJob) return
    let disposed = false
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const history = await window.minimax.getHistory(masterJob.url, masterJob.id)
        const entry = history[masterJob.id] as { status?: { status_str?: string }; outputs?: Record<string, { images?: Array<{ filename: string; subfolder?: string; type?: string }> }> } | undefined
        if (entry?.status?.status_str === 'error') throw new Error('Master-reference generation failed. Check the ComfyUI log.')
        const image = Object.values(entry?.outputs ?? {}).flatMap((output) => output.images ?? [])[0]
        if (image) {
          const preview = await window.minimax.getOutputImage(masterJob.url, image)
          const saved = await window.minimax.saveComfyOutputImage(masterJob.url, image, settings.outputDirectory)
          if (!disposed) {
            const file = { ...saved, preview, kind: 'image' as const }
            setCandidate({ characterId: masterJob.characterId, target: masterJob.target, file })
            setMasterMessage('Reference ready for approval.'); setMasterJob(null); setMasterBusy(false); setMasterError(false)
          }
          return
        }
      } catch (error) {
        if (!disposed) { setMasterMessage(error instanceof Error ? error.message : String(error)); setMasterError(true); setMasterBusy(false); setMasterJob(null) }
        return
      }
      if (!disposed) timer = setTimeout(poll, 2000)
    }
    void poll()
    return () => { disposed = true; clearTimeout(timer) }
  }, [masterJob, onNotice, settings.outputDirectory])
  useEffect(() => {
    if (!batchJobs.length) return
    let disposed = false; let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const completed: Array<{ batchJob: (typeof batchJobs)[number]; image: { filename: string; subfolder?: string; type?: string } }> = []
        for (const batchJob of batchJobs) {
          const history = await window.minimax.getHistory(batchJob.url, batchJob.id)
          const entry = history[batchJob.id] as { status?: { status_str?: string }; outputs?: Record<string, { images?: Array<{ filename: string; subfolder?: string; type?: string }> }> } | undefined
          if (entry?.status?.status_str === 'error') throw new Error('One identity candidate failed. Check the ComfyUI log.')
          const image = Object.values(entry?.outputs ?? {}).flatMap((output) => output.images ?? [])[0]
          if (image) completed.push({ batchJob, image })
        }
        if (completed.length === batchJobs.length) {
          const ready = await Promise.all(completed.map(async ({ batchJob, image }) => { const preview = await window.minimax.getOutputImage(batchJob.url, image); const saved = await window.minimax.saveComfyOutputImage(batchJob.url, image, settings.outputDirectory); return { ...saved, preview, kind: 'image' as const } }))
          if (!disposed) { setIdentityCandidates(ready); setSelectedCandidatePaths(ready.map((file) => file.path)); setBatchJobs([]); setMasterBusy(false); setMasterMessage(`${ready.length} identity candidates ready. Approve one or more.`) }; return
        }
        if (!disposed) setMasterMessage(`Rendering identity batch… ${completed.length} of ${batchJobs.length} ready`)
      } catch (error) { if (!disposed) { setMasterMessage(error instanceof Error ? error.message : String(error)); setMasterError(true); setBatchJobs([]); setMasterBusy(false) }; return }
      timer = setTimeout(poll, 2000)
    }
    void poll(); return () => { disposed = true; clearTimeout(timer) }
  }, [batchJobs, settings.outputDirectory])
  const splitTurntable = async () => {
    if (!active.turntableVideo || videoDuration <= 0 || splitting) return
    setSplitting(true)
    try {
      const positions = [0.05, 0.25, 0.5, 0.75, 0.95].map((ratio) => Math.max(0, Math.min(videoDuration - 0.04, videoDuration * ratio)))
      const angleTypes: ReferenceImageType[] = ['full-body', 'face', 'three-quarter', 'profile', 'back']
      const extracted = await Promise.all(positions.map(async (position, index) => {
        const result = await window.minimax.extractVideoFrame(active.turntableVideo!.path, position, settings.outputDirectory, settings.ffmpegPath)
        return { ...result, kind: 'image' as const, referenceType: angleTypes[index], preview: await window.minimax.mediaUrl(result.path) }
      }))
      patch({ referenceImages: extracted, referenceMode: 'set', selectedReferencePaths: undefined })
      onNotice('success', 'Five turntable angles were extracted into this character reference set.')
    } catch (error) { onNotice('error', error instanceof Error ? error.message : String(error)) }
    finally { setSplitting(false) }
  }
  const approveCandidate = () => {
    if (!candidate) return
    const project = loadCharacterProjects().find((item) => item.id === candidate.characterId)
    if (!project) { setCandidate(null); return }
    if (candidate.target === 'sheet') {
      patchProject(project.id, { referenceMode: 'set', referenceImages: [...project.referenceImages, { ...candidate.file, referenceType: 'other' }], selectedReferencePaths: [...new Set([...(project.selectedReferencePaths ?? project.referenceImages.map((item) => item.path)), candidate.file.path])] })
      setCandidate(null); setMasterMessage('Four-view character sheet approved.'); onNotice('success', 'Character sheet added to the approved reference set.')
      return
    }
    patchProject(project.id, { baseImage: { ...candidate.file, referenceType: 'master' } })
    setCandidate(null); setMasterMessage('Master approved. Preparing the turntable…')
    void onCreateTurntable({ ...project, baseImage: { ...candidate.file, referenceType: 'master' } }, surveyRenderOptions).then((failure) => {
      if (failure) { setMasterMessage(failure); setMasterError(true); onNotice('error', failure) }
    })
  }
  const closeIdentityFlow = () => { setIdentityCandidates([]); setApprovedFlowProject(null); setIdentitySurveyStartedAt(null); setIdentitySurveySubmitting(false); setIdentitySurveyError(''); setCandidateStep('choose') }
  const approveIdentitySelection = () => {
    const chosen = selectedCandidatePaths.map((path) => identityCandidates.find((file) => file.path === path)).filter(Boolean) as MediaFile[]
    if (!chosen.length) return
    const master = { ...chosen[0], referenceType: 'master' as const }
    const references = [...active.referenceImages, ...chosen.map((file, index) => index === 0 ? master : { ...file, referenceType: file.referenceType ?? 'three-quarter' as const })].filter((file, index, all) => all.findIndex((item) => item.path === file.path) === index)
    const project = { ...active, baseImage: master, referenceImages: references, referenceMode: 'set' as const, selectedReferencePaths: references.map((file) => file.path) }
    patchProject(active.id, { baseImage: master, referenceMode: 'set', referenceImages: references, selectedReferencePaths: references.map((file) => file.path) })
    setApprovedFlowProject(project); setCandidateStep('survey'); setIdentitySurveyError(''); setMasterMessage(`${chosen.length} identity candidate${chosen.length === 1 ? '' : 's'} approved. Ready for the MiniMax H3 Ref2VA angle survey.`)
    onNotice('success', `${chosen.length} identity candidate${chosen.length === 1 ? '' : 's'} approved. Review the MiniMax H3 Ref2VA angle survey next.`)
  }
  const identitySurveyJob = identitySurveyStartedAt !== null && activeAutomation && activeAutomation.createdAt >= identitySurveyStartedAt - 1000 ? activeAutomation : undefined
  const startIdentitySurvey = async () => {
    if (!approvedFlowProject || !connected) return
    setIdentitySurveyStartedAt(Date.now()); setIdentitySurveySubmitting(true); setIdentitySurveyError('')
    try {
      const failure = await onCreateTurntable(approvedFlowProject, surveyRenderOptions)
      if (failure) { setIdentitySurveyStartedAt(null); setIdentitySurveyError(failure) }
    } catch (error) { setIdentitySurveyStartedAt(null); setIdentitySurveyError(error instanceof Error ? error.message : String(error)) }
    finally { setIdentitySurveySubmitting(false) }
  }
  const renderTurntable = async () => {
    if (!active.baseImage) return
    setIdentitySurveyError(''); setMasterMessage('Preparing the MiniMax H3 Ref2VA identity survey…'); setMasterError(false)
    try {
      const failure = await onCreateTurntable(active, surveyRenderOptions)
      if (failure) { setMasterMessage(failure); setMasterError(true) }
      else setMasterMessage('Identity survey queued in MiniMax H3. Progress is shown here and in Queue.')
    } catch (error) { setMasterMessage(error instanceof Error ? error.message : String(error)); setMasterError(true) }
  }

  const selectedReference = active.referenceImages.find((file) => file.path === selectedReferencePath)
  const removeImageFromCharacter = (path: string) => {
    patch(removeCharacterImage(active, path))
    if (selectedReferencePath === path) setSelectedReferencePath('')
    onNotice('success', 'Image removed from this character. The original file was kept.')
  }
  const toggleReferenceUse = (path: string, use: boolean) => {
    const current = active.selectedReferencePaths ?? active.referenceImages.map(file => file.path)
    const selectedReferencePaths = use ? [...new Set([...current, path])] : current.filter(selected => selected !== path)
    if (!selectedReferencePaths.length) {
      onNotice('error', 'Keep one identity image selected, or remove the image from this character.')
      return
    }
    patch({ referenceMode: 'set', selectedReferencePaths })
  }
  const tabs = [
    ['identity', 'Identity', UserRound], ['hair', 'Hair', Scissors], ['wardrobe', 'Wardrobe', Shirt],
    ['accessories', 'Accessories', Watch], ['voice', 'Voice', Mic2], ['references', 'References', Images],
  ] as const
  const moveReference = (path: string, direction: -1 | 1) => {
    const index = active.referenceImages.findIndex((file) => file.path === path)
    const target = index + direction
    if (index < 0 || target < 0 || target >= active.referenceImages.length) return
    const next = [...active.referenceImages]
    ;[next[index], next[target]] = [next[target], next[index]]
    patch({ referenceImages: next })
  }

  return <><div className="standard-page character-studio character-workspace-v2">
    <div className="character-studio-grid">
      <section className={`character-workbench character-tab-${activeTab}`}>
        <header className="character-titlebar"><div><span><strong>{active.name || 'Untitled Character'}</strong><small>{active.description || 'Add a stable identity description in the inspector.'}</small></span><button className={`character-favorite ${active.favorite ? 'active' : ''}`} aria-label={active.favorite ? 'Remove from favorites' : 'Add to favorites'} onClick={() => patch({ favorite: !active.favorite })}><Star size={14} fill={active.favorite ? 'currentColor' : 'none'} /></button></div><div><Badge tone={active.baseImage ? 'success' : 'warning'}>{active.baseImage ? 'Primary ready' : 'Needs primary'}</Badge><Button variant="primary" onClick={() => onUseInScene(active.id)} disabled={!characterReferences(active).length}>Use in Scene</Button><Button variant="icon" aria-label="Delete character" title="Delete character" onClick={remove}><Trash2 size={15} /></Button></div></header>
        <WorkspaceSectionTabs<CharacterWorkspaceSection> tabs={characterSections} active={workspaceSection} onChange={setWorkspaceSection} label="Character workflow sections" />
        <div className="character-library-tab-panel" hidden={workspaceSection !== 'library'}>
          <CharacterLibraryPanel projects={projects} activeId={active.id} onAdd={() => { add(); setWorkspaceSection('design') }} onSelect={id => { setActiveId(id); setVideoDuration(0); setSelectedReferencePath(''); setWorkspaceSection('design') }} />
        </div>
        <section className="character-visual-canvas" aria-label={`${active.name} character canvas`}>
          <figure className="character-primary-preview">{active.baseImage?.preview ? <img src={active.baseImage.preview} alt={`${active.name} primary reference`} /> : <button type="button" onClick={() => void chooseImage('base')}><ImagePlus size={30} /><strong>Add primary image</strong><span>Choose an identity anchor</span></button>}<figcaption><Badge tone="primary">Primary</Badge><span className="character-primary-actions"><Button size="sm" variant="ghost" onClick={() => void chooseImage('base')}>{active.baseImage ? 'Replace' : 'Choose'}</Button>{active.baseImage && <Button size="sm" variant="ghost" aria-label="Remove primary image from character" title="Remove this image from the character; keep the original file" onClick={() => { if (active.baseImage) removeImageFromCharacter(active.baseImage.path) }}><Trash2 size={14} /></Button>}</span></figcaption></figure>
          <div className="character-reference-mosaic">{active.referenceImages.slice(0,6).map((file,index) => <button type="button" className={file.path === selectedReferencePath ? 'selected' : ''} key={file.path} onClick={() => { setSelectedReferencePath(file.path); setWorkspaceSection('design'); setActiveTab('references') }}>{file.preview ? <img src={file.preview} alt={`${active.name} reference ${index+1}`} /> : <Images size={22} />}<span>{file.referenceType ?? 'other'}</span></button>)}<button type="button" className="character-add-tile" onClick={() => void chooseImage('reference')}><Plus size={21} /><span>Add Images</span></button></div>
        </section>
        <div className="character-readiness-panel" hidden={workspaceSection === 'library'}>
          <CharacterReadiness primaryReady={Boolean(active.baseImage)} referenceCount={active.referenceImages.length} hairName={activeHairStyle?.name || active.hairPreset} wardrobeCount={active.wardrobeIds.length} accessoryCount={active.accessoryIds.length} onOpen={(tab: CharacterDetailTab) => { setWorkspaceSection('design'); setActiveTab(tab) }} onAddPrimary={() => void chooseImage('base')} />
        </div>
        <Tabs hidden={workspaceSection !== 'design'} value={activeTab} onValueChange={value => setActiveTab(value as typeof activeTab)} className="character-workspace-tabs"><TabsList>{tabs.map(([id,label,Icon]) => <TabsTrigger value={id} key={id}><Icon size={14}/>{label}</TabsTrigger>)}</TabsList></Tabs>
        <aside hidden={workspaceSection !== 'design'} className="character-context-inspector" aria-label={`${tabs.find(([id]) => id === activeTab)?.[1]} inspector`}><header><strong>{tabs.find(([id]) => id === activeTab)?.[1]}</strong><span><SlidersHorizontal size={13}/>Inspector</span></header><ScrollArea className="character-inspector-scroll"><div className="character-inspector-body">
          {activeTab === 'identity' && <>
            <Field label="Character name"><Input value={active.name} onChange={event => patch({ name:event.target.value,referencePrompt:'' })}/></Field>
            <Field label="Identity priority"><Select value={active.identityPriority} onValueChange={value => patch({identityPriority:value as CharacterProject['identityPriority']})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="balanced">Balanced identity</SelectItem><SelectItem value="face">Face first</SelectItem><SelectItem value="full-body">Full body first</SelectItem></SelectContent></Select></Field>
            <Field label="Identity template"><Select value={active.identityTemplate} onValueChange={value => patch({identityTemplate:value as CharacterProject['identityTemplate'],referencePrompt:''})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="cinematic">Cinematic</SelectItem><SelectItem value="editorial">Editorial casting</SelectItem><SelectItem value="everyday">Natural everyday</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent></Select></Field>
            <Field label="Skin tone"><Select value={active.skinTone || 'manual'} onValueChange={value => patch({skinTone:value === 'manual' ? '' : value,referencePrompt:''})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="manual">Describe manually</SelectItem>{['MST 1 · very light','MST 2 · light','MST 3 · light-medium','MST 4 · medium-light','MST 5 · medium','MST 6 · medium-deep','MST 7 · deep','MST 8 · deep-rich','MST 9 · very deep','MST 10 · deepest'].map(tone=><SelectItem value={tone} key={tone}>{tone}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Physical description"><Textarea value={active.description} onChange={event => patch({description:event.target.value,referencePrompt:''})} placeholder="Age, face geometry, eyes, build, distinguishing marks…"/></Field>
            <Field label="Body & proportion notes"><Textarea value={active.bodyNotes} onChange={event => patch({bodyNotes:event.target.value,referencePrompt:''})} placeholder="Height, proportions, posture, silhouette, mobility…"/></Field>
            <Field label="Visual style"><Input value={active.visualStyle} onChange={event => patch({visualStyle:event.target.value,referencePrompt:''})}/></Field>
            <Separator/><div className="character-inspector-actions"><Button variant="secondary" disabled={!ollamaAvailable || assisting} onClick={() => void enhance()}>{assisting?<LoaderCircle className="spin" size={14}/>:<WandSparkles size={14}/>}Refine identity</Button><Button variant="outline" onClick={() => void chooseImage('base')}><ImagePlus size={14}/>Choose primary</Button></div>
            <details className="character-inspector-advanced"><summary>Advanced identity prompt<ChevronDown size={13}/></summary><Field label="Master prompt" help={`${zPrompt.length} chars`}><Textarea value={editableZPrompt} onChange={event=>patch({referencePrompt:event.target.value})}/></Field><div className="character-preset-compact"><Field label="Appearance preset"><select defaultValue="custom" onChange={event=>{const preset=characterAppearancePresets.find(([id])=>id===event.target.value);if(preset?.[2])patch({description:appendPreset(active.description,preset[2]),referencePrompt:''})}}>{characterAppearancePresets.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></Field><Field label="Style preset"><select value={characterVisualStylePresets.includes(active.visualStyle as typeof characterVisualStylePresets[number])?active.visualStyle:'custom'} onChange={event=>{if(event.target.value!=='custom')patch({visualStyle:event.target.value,referencePrompt:''})}}><option value="custom">Custom</option>{characterVisualStylePresets.map(style=><option key={style}>{style}</option>)}</select></Field></div></details>
          </>}
          {activeTab === 'hair' && <><div className="character-inspector-intro"><Scissors size={16}/><span><strong>Assigned hairstyle</strong><small>One style is authoritative for this character.</small></span></div>{activeHairStyle ? <article className="character-attached-asset">{activeHairStyle.referenceImage?.preview?<img src={activeHairStyle.referenceImage.preview} alt=""/>:<Scissors/>}<span><strong>{activeHairStyle.name}</strong><small>{activeHairStyle.texture} · {activeHairStyle.length}</small><small>{activeHairStyle.color}</small></span><Button variant="icon" size="sm" onClick={()=>patch({hairStyleIds:[],referencePrompt:''})}><X size={13}/></Button></article>:<p className="character-empty-copy">No library hairstyle assigned.</p>}<Field label="Manual fallback"><Select value={active.hairPreset || 'manual'} disabled={Boolean(activeHairStyle)} onValueChange={value=>patch({hairPreset:value==='manual'?'':value,referencePrompt:''})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['manual','short straight hair','long straight hair','short wavy hair','long wavy hair','short curly hair','long curly hair','coily natural hair','braided hair','locs','buzz cut','shaved head'].map(value=><SelectItem value={value} key={value}>{value==='manual'?'Describe manually':value}</SelectItem>)}</SelectContent></Select></Field><Separator/><strong className="character-inspector-label">Hair library</strong><div className="character-library-assets">{hairStyles.map(hair=><label key={hair.id} className={active.hairStyleIds[0]===hair.id?'selected':''}><Checkbox checked={active.hairStyleIds[0]===hair.id} disabled={!hair.referenceImage} onCheckedChange={checked=>patch({hairStyleIds:checked?[hair.id]:[],referencePrompt:''})}/>{hair.referenceImage?.preview?<img src={hair.referenceImage.preview} alt=""/>:<span><Scissors size={14}/></span>}<span><strong>{hair.name}</strong><small>{hair.referenceImage?`${hair.texture} · ${hair.length}`:'Reference needed'}</small></span></label>)}</div><Button variant="outline" onClick={()=>onOpenLibrary('hair')}>Open Hair Library</Button>{activeHairStyle?.referenceImage&&<Button variant="primary" disabled={masterBusy||!zReady||!active.name.trim()} onClick={()=>void createMaster('master')}><Sparkles size={14}/>Render hair onto primary</Button>}</>}
          {activeTab === 'wardrobe' && <><div className="character-inspector-intro"><Shirt size={16}/><span><strong>Attached wardrobes</strong><small>The first selected outfit is the render priority.</small></span></div><div className="character-library-assets">{wardrobes.map(item=>{const count=wardrobeReferences(item).length;const checked=active.wardrobeIds.includes(item.id);return <label key={item.id} className={checked?'selected':''}><Checkbox checked={checked} disabled={!count} onCheckedChange={value=>patch({wardrobeIds:value?[...new Set([...active.wardrobeIds,item.id])]:active.wardrobeIds.filter(id=>id!==item.id)})}/>{item.referenceImages[0]?.preview?<img src={item.referenceImages[0].preview} alt=""/>:<span><Shirt size={14}/></span>}<span><strong>{item.name}{active.wardrobeIds[0]===item.id?' · Primary':''}</strong><small>{count?`${count} approved image${count===1?'':'s'}`:'No approved images'}</small></span></label>})}</div><Button variant="outline" onClick={()=>onOpenLibrary('wardrobes')}>Open Wardrobe Library</Button></>}
          {activeTab === 'accessories' && <><div className="character-inspector-intro"><Watch size={16}/><span><strong>Attached accessories</strong><small>Only checked library items follow this character.</small></span></div><div className="character-library-assets">{accessories.map(item=>{const checked=active.accessoryIds.includes(item.id);return <label key={item.id} className={checked?'selected':''}><Checkbox checked={checked} disabled={!item.referenceImage} onCheckedChange={value=>patch({accessoryIds:value?[...new Set([...active.accessoryIds,item.id])]:active.accessoryIds.filter(id=>id!==item.id)})}/>{item.referenceImage?.preview?<img src={item.referenceImage.preview} alt=""/>:<span><Watch size={14}/></span>}<span><strong>{item.name}</strong><small>{item.referenceImage?item.category:'Reference needed'}</small></span></label>})}</div><Button variant="outline" onClick={()=>onOpenLibrary('accessories')}>Open Accessories Library</Button></>}
          {activeTab === 'voice' && <><Field label="Voice preset"><select defaultValue="custom" onChange={event=>{const preset=characterVoicePresets.find(([id])=>id===event.target.value);if(preset?.[2])patch({voiceNotes:appendPreset(active.voiceNotes,preset[2]),referencePrompt:''})}}>{characterVoicePresets.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></Field><Field label="Performance preset"><select defaultValue="custom" onChange={event=>{const preset=characterPerformancePresets.find(([id])=>id===event.target.value);if(preset?.[2])patch({voiceNotes:appendPreset(active.voiceNotes,preset[2]),referencePrompt:''})}}>{characterPerformancePresets.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></Field><Field label="Speaker / voice ID"><Input value={active.voiceSpeakerId} onChange={event=>patch({voiceSpeakerId:event.target.value})} placeholder="Optional local speaker ID"/></Field><Field label="Language"><Input value={active.voiceLanguage} onChange={event=>patch({voiceLanguage:event.target.value})}/></Field><Field label="Voice & performance baseline"><Textarea value={active.voiceNotes} onChange={event=>patch({voiceNotes:event.target.value,referencePrompt:''})} placeholder="Register, pace, accent, diction, emotional range, posture, gaze…"/></Field></>}
          {activeTab === 'references' && <><div className="character-reference-mode"><Field label="Canonical source"><Select value={active.referenceMode} onValueChange={value=>patch({referenceMode:value as CharacterProject['referenceMode']})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="single">Primary image only</SelectItem><SelectItem value="set">Selected reference set</SelectItem></SelectContent></Select></Field><Field label="Survey quality"><Select value={surveyProfile} onValueChange={value=>setSurveyProfile(value as typeof surveyProfile)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="native">Native · 30 steps</SelectItem><SelectItem value="turbo8">Turbo · 8 steps</SelectItem><SelectItem value="turbo10">Turbo · 10 steps</SelectItem><SelectItem value="turbo12">Turbo · 12 steps</SelectItem></SelectContent></Select></Field><Field label="Survey resolution"><Select value={surveyResolution} onValueChange={value=>setSurveyResolution(value as typeof surveyResolution)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="608x1056">608 × 1056</SelectItem><SelectItem value="768x1344">768 × 1344</SelectItem></SelectContent></Select></Field></div><CharacterReferenceList files={active.referenceImages} selectedPath={selectedReferencePath} selectedReferencePaths={active.selectedReferencePaths} onSelect={setSelectedReferencePath} onRemove={removeImageFromCharacter} onAdd={() => void chooseImage("reference")} />{selectedReference?<><Separator/><div className="character-selected-reference">{selectedReference.preview&&<img src={selectedReference.preview} alt=""/>}<strong>{selectedReference.name}</strong><Field label="Reference role"><Select value={selectedReference.referenceType??'other'} onValueChange={value=>patch({referenceImages:active.referenceImages.map(file=>file.path===selectedReference.path?{...file,referenceType:value as ReferenceImageType}:file)})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{referenceTypeOptions.map(option=><SelectItem value={option.value} key={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></Field><Field label="Preservation"><Select value={selectedReference.referenceRetention??'preserve'} onValueChange={value=>patch({referenceImages:active.referenceImages.map(file=>file.path===selectedReference.path?{...file,referenceRetention:value as 'preserve'|'guide'}:file)})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="preserve">Preserve identity</SelectItem><SelectItem value="guide">Visual guide only</SelectItem></SelectContent></Select></Field><label className="character-reference-include"><input type="checkbox" checked={active.selectedReferencePaths === undefined || active.selectedReferencePaths.includes(selectedReference.path)} onChange={event => toggleReferenceUse(selectedReference.path, event.target.checked)} />Use in selected reference set</label><div className="character-reference-order"><Button size="sm" variant="outline" onClick={()=>moveReference(selectedReference.path,-1)}>Move earlier</Button><Button size="sm" variant="outline" onClick={()=>moveReference(selectedReference.path,1)}>Move later</Button></div><Button size="sm" variant="outline" onClick={() => removeImageFromCharacter(selectedReference.path)}><Trash2 size={14} />Remove image from character</Button></div></>:<p className="character-empty-copy">Select an approved image above to edit its role, preservation, and order.</p>}<Separator/><details className="character-inspector-advanced"><summary>Expert reference controls<ChevronDown size={13}/></summary><div className="character-preset-compact"><Field label="Identity candidates"><Select value={String(identityCandidateCount)} onValueChange={value=>setIdentityCandidateCount(Number(value) as 1|2|4)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="1">1 candidate</SelectItem><SelectItem value="2">2 candidates</SelectItem><SelectItem value="4">4 candidates</SelectItem></SelectContent></Select></Field><Field label="Sampling steps"><Input type="number" min={4} max={30} value={identitySteps} onChange={event=>setIdentitySteps(Math.max(4,Math.min(30,Number(event.target.value)||8)))}/></Field><Field label="Sheet layout"><Select value={sheetLayout} onValueChange={value=>setSheetLayout(value as typeof sheetLayout)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="coverage">Face + body coverage</SelectItem><SelectItem value="turnaround">Whole-body turnaround</SelectItem></SelectContent></Select></Field></div></details></>}
        </div></ScrollArea></aside>
        <div className="character-production-workspace" hidden={workspaceSection !== 'generate'}>
        {settings.characterDetailReferencesEnabled && <section className="character-detail-references" aria-labelledby="character-detail-references-title"><header><div><span><Images size={16} /></span><span><strong id="character-detail-references-title">Character detail references</strong><small>Add up to two focused images for each named body area or visual detail. They use the character’s shared 9-picture render budget only while this add-on is enabled.</small></span></div><button type="button" className="secondary-button" onClick={addDetailReference}><Plus size={14} />Add detail</button></header>{active.detailReferences.length ? <div className="character-detail-reference-list">{active.detailReferences.map((detail, index) => <article key={detail.id}><div className="character-detail-image-pair">{[0, 1].map((imageIndex) => { const image = detail.images[imageIndex]; return <div className="character-detail-image-slot" key={imageIndex}><button type="button" className="character-detail-image" onClick={() => void chooseDetailReferenceImage(detail.id, imageIndex)} aria-label={image ? `Replace detail ${index + 1}, view ${imageIndex + 1}` : `Upload detail ${index + 1}, view ${imageIndex + 1}`}>{image?.preview ? <img src={image.preview} alt={`${detail.label || `Character detail reference ${index + 1}`} view ${imageIndex + 1}`} /> : <><ImagePlus size={17} /><span>View {imageIndex + 1}</span></>}</button>{image && <button type="button" className="character-detail-image-remove" onClick={() => removeDetailReferenceImage(detail.id, imageIndex)} aria-label={`Remove detail ${index + 1}, view ${imageIndex + 1}`}><X size={11} /></button>}</div> })}</div><div><label>Detail name or body area<input value={detail.label} onChange={(event) => patchDetailReference(detail.id, { label: event.target.value })} placeholder="Use any name you need" /></label><label>Rendering notes<textarea value={detail.notes} onChange={(event) => patchDetailReference(detail.id, { notes: event.target.value })} placeholder="Describe exactly what both views must preserve" /></label></div><button type="button" className="icon-button" onClick={() => removeDetailReference(detail.id)} aria-label={`Remove detail reference ${index + 1}`}><X size={16} /></button></article>)}</div> : <p className="character-detail-empty">No extra detail references yet. Add only the details that need more precision so the 9-picture render budget stays useful.</p>}</section>}
        {!settings.characterDetailReferencesEnabled && <div className="character-detail-disabled" role="status"><Images size={16} /><span><strong>Character detail references are off</strong><small>Enable the optional add-on in Settings to upload focused body-area or visual-detail references.</small></span></div>}
        <div className="character-production-heading"><span>Reference production</span><small>Build the master, create the turntable, then approve the useful angles.</small><em>{Number(Boolean(active.baseImage)) + Number(Boolean(active.turntableVideo)) + Number(characterReferences(active, settings.characterDetailReferencesEnabled).length > 0)} of 3 ready</em></div>
        <div className="identity-render-controls character-survey-render-controls"><label><span>Survey quality</span><select aria-label="Identity survey quality" value={surveyProfile} disabled={Boolean(activeAutomation && ['queued', 'running'].includes(activeAutomation.status))} onChange={(event) => setSurveyProfile(event.target.value as typeof surveyProfile)}><option value="native">Native quality · 30 steps</option><option value="turbo8">Turbo · 8 steps</option><option value="turbo10">Turbo · 10 steps (recommended)</option><option value="turbo12">Turbo · 12 steps</option></select></label><label><span>Survey resolution</span><select aria-label="Identity survey resolution" value={surveyResolution} disabled={Boolean(activeAutomation && ['queued', 'running'].includes(activeAutomation.status))} onChange={(event) => setSurveyResolution(event.target.value as typeof surveyResolution)}><option value="608x1056">608 × 1056 · faster</option><option value="768x1344">768 × 1344 · recommended</option></select></label><small>{surveyTurbo === 'off' ? 'Native Ref2VA without a Turbo LoRA.' : `Ref2VA Turbo 8-step LoRA sampled for ${surveySteps} steps.`}</small></div>
        <div className="character-production-grid">
          <article className="character-master-card"><header><span><strong>1. Identity generation</strong><small>Generate one focused identity or a comparison batch, then approve the strongest result.</small></span><span className={`master-engine-state ${zReady ? 'ready' : ''}`}>{zReady ? <Check size={12} /> : <AlertCircle size={12} />}{zReady ? 'Z-Image ready' : 'Z-Image unavailable'}</span></header>
            <div className="character-media-stage">{active.baseImage?.preview ? <img src={active.baseImage.preview} alt={`${active.name} master reference`} /> : masterBusy ? <div><LoaderCircle className="spin" size={26} /><span>Creating character references…</span></div> : <div><ImagePlus size={26} /><span>No approved identity</span></div>}</div>
            {masterMessage && <div className={`character-master-message ${masterError ? 'error' : ''}`} role={masterError ? 'alert' : 'status'}>{masterBusy && <LoaderCircle className="spin" size={13} />}<span>{masterMessage}</span></div>}
            <div className="identity-render-controls"><label><span>Candidates</span><select aria-label="Identity candidate count" value={identityCandidateCount} disabled={masterBusy} onChange={event => setIdentityCandidateCount(Number(event.target.value) as 1 | 2 | 4)}><option value={1}>1 candidate</option><option value={2}>2 candidates</option><option value={4}>4 candidates</option></select></label><label><span>Sampling steps</span><input aria-label="Identity sampling steps" type="number" min={4} max={30} step={1} value={identitySteps} disabled={masterBusy} onChange={event => setIdentitySteps(Math.max(4, Math.min(30, Math.round(Number(event.target.value) || 8))))} /></label><label className="identity-sheet-layout"><span>Experimental sheet</span><select aria-label="Character sheet layout" value={sheetLayout} disabled={masterBusy} onChange={event => setSheetLayout(event.target.value as 'coverage' | 'turnaround')}><option value="coverage">Full body · Face · Side · Rear</option><option value="turnaround">Whole-body turnaround</option></select></label></div>
            <small className="identity-render-note">Each candidate uses its own seed. Higher steps take longer; 8 is the Z-Image Turbo baseline. Sheet layouts produce one image with exactly four identity-matched views.</small>
            <footer><button className="secondary-button" disabled={masterBusy} onClick={() => void chooseImage('base')}><ImagePlus size={14} />Choose existing</button>{masterBusy && <button className="danger-button" onClick={() => batchJobs.length ? void cancelBatch() : void cancelMaster()}><CircleStop size={14} />Cancel queue</button>}<button className="secondary-button experimental-sheet-button" disabled={masterBusy || !active.name.trim() || !zReady} onClick={() => void createMaster('sheet')}><Images size={14} />Experimental 4-view sheet</button><button className="primary-button" disabled={masterBusy || !active.name.trim() || !zReady || !zPrompt.trim()} onClick={() => void createIdentityBatch(identityCandidateCount)}><Sparkles size={14} />{masterBusy ? 'Rendering queue…' : `Generate ${identityCandidateCount} candidate${identityCandidateCount === 1 ? '' : 's'}`}</button></footer>
          </article>
          <article><header><span><strong>2. Turntable / identity survey</strong><small>Generate a neutral face-to-full-body coverage pass using the selected Ref2VA render profile.</small></span>{activeAutomation ? <span className={`status-badge ${activeAutomation.status}`}>{activeAutomation.status}</span> : <span className={`master-engine-state ${identitySurveyRef2vaReady ? 'ready' : ''}`}>{identitySurveyRef2vaReady ? <Check size={12} /> : <AlertCircle size={12} />}{identitySurveyRef2vaReady ? `${surveyTurbo === 'off' ? 'Native' : 'Turbo'} ${surveySteps} ready` : 'Survey setup required'}</span>}</header><div className="character-media-stage">{active.turntableVideo?.preview ? <ReliableVideo src={active.turntableVideo.preview} controls preload="metadata" onLoadedMetadata={(event) => setVideoDuration(event.currentTarget.duration)} /> : activeAutomation && ['queued', 'running'].includes(activeAutomation.status) ? <div><LoaderCircle className="spin" size={26} /><span>{activeAutomation.progressLabel ?? 'Rendering identity survey…'} · {Math.round(activeAutomation.progress)}%</span></div> : <div><Orbit size={26} /><span>No turntable video</span></div>}</div>{!identitySurveyRef2vaReady && <p className="field-help error"><AlertCircle size={13} />{identitySurveyRef2vaReason}</p>}<footer><button className="secondary-button" onClick={() => void chooseTurntable()}><Film size={14} />Choose rendered video</button><button className="primary-button" disabled={!connected || !active.baseImage || !identitySurveyRef2vaReady || Boolean(activeAutomation && ['queued', 'running'].includes(activeAutomation.status))} title={!connected ? 'Connect ComfyUI before rendering' : !active.baseImage ? 'Approve a master identity first' : !identitySurveyRef2vaReady ? identitySurveyRef2vaReason : ''} onClick={() => void renderTurntable()}><Orbit size={14} />{activeAutomation && ['queued', 'running'].includes(activeAutomation.status) ? 'Rendering…' : `Render ${surveyTurbo === 'off' ? 'Native' : 'Turbo'} ${surveySteps} survey`}</button></footer></article>
        </div>
        <section className="character-reference-set"><header><span><strong>3. Approved references</strong><small>Classify each image so face and full-body anchors are allocated correctly to movies and MiniMax Reference.</small></span><button className="secondary-button" disabled={!active.turntableVideo || !videoDuration || splitting} onClick={() => void splitTurntable()}>{splitting ? <LoaderCircle className="spin" size={14} /> : <Images size={14} />}{splitting ? 'Extracting…' : 'Split into 5 angles'}</button></header><fieldset><legend>Use in movies</legend><label><input type="radio" name="character-reference-mode" checked={active.referenceMode === 'single'} onChange={() => patch({ referenceMode: 'single' })} />Single master image</label><label><input type="radio" name="character-reference-mode" checked={active.referenceMode === 'set'} onChange={() => patch({ referenceMode: 'set' })} />Selected reference images</label></fieldset><div className="character-reference-grid">{active.referenceImages.map((file, index) => { const selected = active.selectedReferencePaths === undefined || active.selectedReferencePaths.includes(file.path); return <figure className={selected ? 'selected' : ''} key={`${file.path}-${index}`}><img src={file.preview} alt={`${active.name} reference ${index + 1}`} /><figcaption><label><input type="checkbox" checked={selected} onChange={(event) => toggleReferenceUse(file.path, event.target.checked)} />Use angle {index + 1}</label><label className="reference-type-picker">Type<select aria-label={`Reference type for angle ${index + 1}`} value={file.referenceType ?? 'other'} onChange={(event) => patch({ referenceImages: active.referenceImages.map((item, itemIndex) => itemIndex === index ? { ...item, referenceType: event.target.value as ReferenceImageType } : item) })}>{referenceTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></figcaption><button aria-label={`Remove reference angle ${index + 1}`} onClick={() => removeImageFromCharacter(file.path)}><X size={13} /></button></figure> })}<button className="character-add-reference" onClick={() => void chooseImage('reference')}><ImagePlus size={19} /><span>Add reference</span></button></div></section>
        </div>
      </section>
    </div>
  </div>{identityCandidates.length > 0 && <div className="character-candidate-backdrop"><section className="character-candidate-modal" role="dialog" aria-modal="true" aria-labelledby="character-candidate-title"><header><span><strong id="character-candidate-title">{candidateStep === 'choose' ? 'Choose identity candidates' : 'Create identity angle survey'}</strong><small>{candidateStep === 'choose' ? 'Approve one or more. The first selected image becomes the master; every selection joins the approved reference set.' : 'MiniMax H3 Ref2VA uses the approved pictures as identity anchors while recording the face and complete body.'}</small></span><button className="icon-button" aria-label="Close character builder" onClick={closeIdentityFlow}><X size={18} /></button></header>{candidateStep === 'choose' ? <><div className="character-candidate-grid">{identityCandidates.map((file, index) => { const selected = selectedCandidatePaths.includes(file.path); return <label className={selected ? 'selected' : ''} key={file.path}><img src={file.preview} alt={`${active.name} identity candidate ${index + 1}`} /><span><input type="checkbox" checked={selected} onChange={(event) => setSelectedCandidatePaths(event.target.checked ? [...selectedCandidatePaths, file.path] : selectedCandidatePaths.filter((path) => path !== file.path))} /><strong>Candidate {index + 1}</strong>{selectedCandidatePaths[0] === file.path && <em>Master</em>}</span></label> })}</div><footer><span>{selectedCandidatePaths.length} of {identityCandidates.length} selected</span><div><button className="secondary-button" onClick={() => { closeIdentityFlow(); void createIdentityBatch(4) }}>Generate another set</button><button className="primary-button" disabled={!selectedCandidatePaths.length} onClick={approveIdentitySelection}><Check size={14} />Approve and continue</button></div></footer></> : <><div className="character-survey-stage">{identitySurveySubmitting && !identitySurveyJob ? <div className="character-survey-progress"><LoaderCircle className="spin" size={30} /><strong>Preparing the approved Ref2VA identity pictures…</strong><p>Building and submitting the native-quality MiniMax H3 Ref2VA workflow.</p><small>Please keep this window open.</small></div> : identitySurveyJob && ['queued', 'running'].includes(identitySurveyJob.status) ? <div className="character-survey-progress"><LoaderCircle className="spin" size={30} /><strong>{identitySurveyJob.progressLabel ?? 'Rendering the MiniMax H3 Ref2VA identity survey'}</strong><p>Reference-anchored face coverage and full-body angles are being generated in the same clip.</p><div className="progress"><i style={{ width: `${identitySurveyJob.progress}%` }} /></div><small>{Math.round(identitySurveyJob.progress)}%</small></div> : identitySurveyJob?.status === 'completed' ? <div className="character-survey-result"><div>{active.turntableVideo?.preview ? <ReliableVideo src={active.turntableVideo.preview} controls preload="metadata" /> : <Film size={30} />}</div><span><Check size={18} /><span><strong>Identity survey complete</strong><small>Five frames are extracted automatically into Approved references. Review and deselect any weak angle there.</small></span></span></div> : <div className="character-survey-plan"><figure>{approvedFlowProject?.baseImage?.preview && <img src={approvedFlowProject.baseImage.preview} alt={`${active.name} approved identity master`} />}<figcaption>Picture 1 · primary Ref2VA identity anchor</figcaption></figure><div><span className="recommended-badge">MiniMax H3 Ref2VA · 10 seconds</span><strong>Face + full-body coverage</strong><ol><li><b>0–2s</b><span>Neutral full-body front view with hands and feet visible.</span></li><li><b>2–5s</b><span>Slow stabilized push to a sharp head-and-shoulders close-up.</span></li><li><b>5–7s</b><span>Front and three-quarter facial geometry held clearly.</span></li><li><b>7–10s</b><span>Pull back to full body, then reveal side and rear angles.</span></li></ol><p>No cuts, pose changes, expression changes, wardrobe changes, motion blur, smearing, or identity drift.</p>{!identitySurveyRef2vaReady && <div className="character-survey-error" role="alert"><AlertCircle size={15} /><span><strong>MiniMax H3 Ref2VA is required</strong><small>{identitySurveyRef2vaReason}</small></span></div>}{identitySurveyError && <div className="character-survey-error" role="alert"><AlertCircle size={15} /><span><strong>Survey did not start</strong><small>{identitySurveyError}</small></span></div>}{!connected && <small className="location-builder-note">Start ComfyUI to render this MiniMax H3 survey.</small>}</div></div>}</div><footer><span>{identitySurveyJob?.status === 'completed' ? `${characterReferences(active).length} approved reference images ready` : identitySurveySubmitting ? 'Preparing MiniMax H3 Ref2VA…' : 'Step 2 of 2 · MiniMax H3 Ref2VA survey'}</span><div>{identitySurveyJob?.status === 'completed' ? <button className="primary-button" onClick={closeIdentityFlow}><Check size={14} />Finish character</button> : <><button className="secondary-button" disabled={identitySurveySubmitting || Boolean(identitySurveyJob && ['queued', 'running'].includes(identitySurveyJob.status))} onClick={() => setCandidateStep('choose')}>Back to candidates</button><button className="primary-button" disabled={!connected || !identitySurveyRef2vaReady || identitySurveySubmitting || Boolean(identitySurveyJob && ['queued', 'running'].includes(identitySurveyJob.status))} title={!identitySurveyRef2vaReady ? identitySurveyRef2vaReason : ''} onClick={() => void startIdentitySurvey()}>{identitySurveySubmitting ? <LoaderCircle className="spin" size={14} /> : <Orbit size={14} />}{identitySurveySubmitting ? 'Preparing survey…' : identitySurveyJob && ['queued', 'running'].includes(identitySurveyJob.status) ? 'Rendering survey…' : 'Render Ref2VA survey'}</button></>}</div></footer></>}</section></div>}{candidate && <ReferenceApprovalModal title={candidate.target === 'sheet' ? 'Approve character sheet' : 'Approve character master'} description={candidate.target === 'sheet' ? 'Review identity consistency across the front, side, and back views.' : 'Approve this identity anchor before the automated turntable begins.'} image={candidate.file.preview ?? ''} approveLabel={candidate.target === 'sheet' ? 'Approve sheet' : 'Approve & make Ref2VA survey'} nextStep={candidate.target === 'sheet' ? 'Approval adds the sheet to this character’s selected reference images.' : 'Approval saves this master, queues the MiniMax H3 Ref2VA survey, then imports the video and five reference angles here.'} approveStartsGeneration={candidate.target !== 'sheet'} onClose={() => setCandidate(null)} onRetry={() => { const target = candidate.target; setCandidate(null); void createMaster(target) }} onApprove={approveCandidate} />}</>
}
