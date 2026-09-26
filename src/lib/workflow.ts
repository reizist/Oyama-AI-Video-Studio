import type { GenerationOptions, ModelSelection, UploadedFile, WorkflowComponentRoute } from '../types'
import { compileScene } from './h3SceneCompiler'
import { routingDeviceForNode } from './gpuRouting'

type Link = [string, number]

export function addRoutedLoader(prompt: ComfyPrompt, id: string, baseNodeType: string, inputs: Record<string, string | number | boolean | Link>, route?: WorkflowComponentRoute, selectorId = `${id}99`): Link {
  if (route?.method === 'loader') {
    prompt[id] = { class_type: route.nodeType, inputs: { ...inputs, device: routingDeviceForNode(route), ...(route.offloadDevice ? { offload_device: route.offloadDevice === 'cpu' ? 'cpu' : `cuda:${route.offloadDevice.slice(4)}` } : {}) } }
    return [id, 0]
  }
  prompt[id] = { class_type: baseNodeType, inputs }
  if (route?.method === 'selector') {
    prompt[selectorId] = { class_type: route.nodeType, inputs: { [baseNodeType === 'UNETLoader' ? 'model' : baseNodeType.includes('CLIP') ? 'clip' : 'vae']: [id, 0], device: routingDeviceForNode(route) } }
    return [selectorId, 0]
  }
  return [id, 0]
}
type ComfyNode = { class_type: string; inputs: Record<string, string | number | boolean | Link> }
export type ComfyPrompt = Record<string, ComfyNode>

// The official ComfyUI MiniMax H3 templates use this pair for both the
// full-quality and distilled graphs. Turbo LoRAs are trained for it, so do not
// let a stale/custom UI choice silently change a turbo render.
export const OFFICIAL_H3_SAMPLER = 'res_multistep'
export const OFFICIAL_H3_SCHEDULER = 'simple'

export function h3SamplingSteps(turbo: GenerationOptions['turbo'], steps: number) {
  if (turbo === '4') return 4
  if (turbo === 'fast') return 8
  if (turbo === 'off') return steps
  const requested = Math.round(Number(steps))
  return requested >= 4 && requested <= 12 ? requested : 8
}

export function frameCount(seconds: number) {
  const base = Math.max(5, Math.round(seconds * 24))
  return base + ((5 - (base % 17) + 17) % 17)
}

export function uploadedName(file: UploadedFile) {
  return file.subfolder ? `${file.subfolder.replace(/\\/g, '/')}/${file.name}` : file.name
}

function addLoader(prompt: ComfyPrompt, id: string, kind: 'image' | 'video' | 'audio', name: string): Link {
  if (kind === 'image') {
    prompt[id] = { class_type: 'LoadImage', inputs: { image: name } }
    return [id, 0]
  }
  if (kind === 'audio') {
    prompt[id] = { class_type: 'LoadAudio', inputs: { audio: name } }
    return [id, 0]
  }
  prompt[id] = { class_type: 'LoadVideo', inputs: { file: name } }
  prompt[`${id}1`] = { class_type: 'GetVideoComponents', inputs: { video: [id, 0] } }
  return [`${id}1`, 0]
}

export function buildMiniMaxWorkflow(
  options: GenerationOptions,
  models: ModelSelection,
  uploads: {
    first?: UploadedFile
    last?: UploadedFile
    images: UploadedFile[]
    videos: UploadedFile[]
    audios: UploadedFile[]
    source?: UploadedFile
  },
): ComfyPrompt {
  if (options.turbo === 'fast' && options.mode !== 'text') throw new Error('FastVideo FastH3 supports text-to-audio-video only. Use the base MiniMax H3 model for image, first/last-frame, or reference generation.')
  const scene = options.sceneState
  if (!Number.isFinite(options.duration) || options.duration <= 0 || options.duration > 15) throw new Error('Clip duration must be greater than 0 and no longer than 15 seconds.')
  const compiled = scene ? compileScene(scene) : undefined
  if (!options.ignoreSceneConflicts && compiled?.conflicts.some(item => item.severity === 'error')) throw new Error(compiled.conflicts.filter(item => item.severity === 'error').map(item => item.message).join('\n'))
  if (scene) {
    if (scene.mode !== options.mode || scene.duration !== options.duration) throw new Error('Scene mode and duration must match the render payload.')
    const counts = { image: uploads.images.length, video: uploads.videos.length, audio: uploads.audios.length }
    if (options.mode === 'reference' && Object.entries(counts).some(([kind, count]) => scene.references.filter(ref => ref.file.kind === kind).length !== count)) throw new Error('Reference upload order/count differs from the compiled scene.')
    if (options.mode !== 'reference' && (Boolean(uploads.first) !== scene.references.some(ref => ref.anchor === 'opening') || Boolean(uploads.last) !== scene.references.some(ref => ref.anchor === 'ending'))) throw new Error('Frame uploads differ from the compiled scene anchors.')
  }
  const prompt: ComfyPrompt = {}
  const routed = options.gpuRouting
  let modelLink = addRoutedLoader(prompt, '1', 'UNETLoader', { unet_name: options.turbo === 'fast' ? models.fastH3 : options.mode === 'reference' ? models.ref2va : models.fl2va, weight_dtype: 'default' }, routed?.diffusion, '801')
  const clipLink = addRoutedLoader(prompt, '2', 'CLIPLoader', { clip_name: models.textEncoder, type: 'minimax', device: 'default' }, routed?.textEncoder, '802')
  const videoVaeLink = addRoutedLoader(prompt, '3', 'VAELoader', { vae_name: models.videoVae }, routed?.videoVae, '803')
  const audioVaeLink = addRoutedLoader(prompt, '4', 'VAELoader', { vae_name: models.audioVae }, routed?.audioVae, '804')
  const loraName = options.mode === 'reference' ? models.ref2vLora : models.fl2vLora
  if (options.turbo !== 'off' && options.turbo !== 'fast' && loraName) {
    prompt['5'] = { class_type: 'LoraLoaderModelOnly', inputs: { model: modelLink, lora_name: loraName, strength_model: options.loraStrength ?? 1 } }
    modelLink = ['5', 0]
  }
  // User-selected adapters are intentionally loaded after the official Turbo
  // adapter. This keeps Turbo automatic and allows up to three additional
  // ComfyUI LoRAs without treating the Turbo file as a manual slot.
  (options.turbo === 'fast' ? [] : options.userLoras ?? []).filter((lora) => lora.name.trim()).slice(0, 3).forEach((lora, index) => {
    const id = `${90 + index}`
    prompt[id] = { class_type: 'LoraLoaderModelOnly', inputs: { model: modelLink, lora_name: lora.name, strength_model: lora.strength } }
    modelLink = [id, 0]
  })
  // The cache implementation validated by the Sol-Attn port patches H3's
  // block_loop, while Sol stamps individual double_block calls. Applying the
  // cache first preserves both hooks and mirrors NVIDIA's cache-before-sparse
  // fullopt stack. Other cache node families are intentionally not substituted.
  if (options.solCache) {
    prompt['83'] = { class_type: options.solCache.nodeType, inputs: { model: modelLink, resuse_threshold: options.solCache.threshold, start_percent: 0.15, end_percent: 0.9, max_steps: options.solCache.maxSteps, device: 'auto', verbose: false } }
    modelLink = ['83', 0]
  }
  // Sol-Attn is an H3-specific patch, separate from ComfyUI's generic
  // ModelAttentionBackend. Keep NVIDIA's validated policy defaults here.
  if (options.solAttention) {
    prompt['84'] = { class_type: options.solAttention.nodeType, inputs: { model: modelLink, enabled: true, tau: options.solAttention.tau, thresh_type: 'diag', first_dense_steps: 0.2, first_dense_layers: 2, sink_mode: 'prefix', correctness_gate: true, strict: false, kv_splits: 1 } }
    modelLink = ['84', 0]
  }
  // ModelAttentionBackend is a native ComfyUI model patch. It changes only the
  // H3 model in this graph, so global server settings and unrelated workflows
  // are left untouched. ComfyUI itself falls back when a requested backend is
  // no longer available after an update.
  if (options.attentionBackend && !options.solAttention) {
    prompt['85'] = { class_type: 'ModelAttentionBackend', inputs: { model: modelLink, attention: options.attentionBackend } }
    modelLink = ['85', 0]
  }
  // The optional H3 Parallel node shards Kitchen INT8 attention heads across
  // peer-accessible GPUs in this one ComfyUI process. The node itself validates
  // peer access and fails early; it is never emitted unless the app detected it.
  if (options.h3ParallelAttention) {
    prompt['86'] = { class_type: options.h3ParallelAttention.nodeType, inputs: { model: modelLink, devices: options.h3ParallelAttention.devices, min_sequence_length: 32768 } }
    modelLink = ['86', 0]
  }
  // Sigma shifts are an explicit user choice. Turbo recipes can recommend a
  // starting point, but must not silently replace custom video/audio values.
  if (options.sigmaShift) {
    prompt['6'] = {
      class_type: 'MiniMaxH3SigmaShift',
      inputs: { model: modelLink, shift_video: options.sigmaShift.video, shift_audio: options.sigmaShift.audio },
    }
    modelLink = ['6', 0]
  }
  if (options.livePreview !== false && options.previewOverride) {
    prompt['7'] = {
      class_type: options.previewOverride.nodeType ?? 'MiniMaxH3PreviewOverride',
      inputs: {
        model: modelLink,
        max_resolution: 512,
        preview_frames: options.previewOverride.frames,
        preview_fps: options.previewOverride.fps,
        // This is the tiny per-step RGB decoder from models/vae_approx, not the
        // full MiniMax video VAE used by the final decode branch.
        vae_name: options.previewOverride.vaeName ?? models.previewVae,
        ...(routed?.previewVae?.method === 'inline' ? { device: routingDeviceForNode(routed.previewVae) } : {}),
        jpeg_quality: options.previewOverride.jpegQuality ?? 85,
        suppress_default_preview: true,
      },
    }
    modelLink = ['7', 0]
  }

  const conditioningInputs: Record<string, string | number | boolean | Link> = {
    clip: clipLink,
    vae: videoVaeLink,
    prompt: compiled?.prompt ?? options.prompt,
    width: options.width,
    height: options.height,
    length: frameCount(options.duration),
  }

  if (options.mode === 'reference') {
    conditioningInputs.audio_vae = audioVaeLink
    conditioningInputs.ref_image_size = options.refImageSize
    uploads.images.forEach((file, index) => {
      const link = addLoader(prompt, `30${index}`, 'image', uploadedName(file))
      conditioningInputs[`ref_images.ref_image_${index}`] = link
    })
    uploads.videos.forEach((file, index) => {
      const loaderId = `40${index}`
      const link = addLoader(prompt, loaderId, 'video', uploadedName(file))
      conditioningInputs[`ref_videos.ref_video_${index}`] = link
      // Video audio is opt-in. An implicit soundtrack would shift every later
      // Audio N assignment and can leak unrelated voices into the target.
      if (scene?.references.filter(ref => ref.file.kind === 'video')[index]?.embeddedAudio) conditioningInputs[`ref_video_audios.ref_video_audio_${index}`] = [`${loaderId}1`, 1]
    })
    uploads.audios.forEach((file, index) => {
      const link = addLoader(prompt, `50${index}`, 'audio', uploadedName(file))
      conditioningInputs[`ref_audios.ref_audio_${index}`] = link
    })
    prompt['10'] = { class_type: 'MiniMaxH3ReferenceToVideo', inputs: conditioningInputs }
  } else {
    if (uploads.first) conditioningInputs.first_frame = addLoader(prompt, '20', 'image', uploadedName(uploads.first))
    if (uploads.last) conditioningInputs.last_frame = addLoader(prompt, '21', 'image', uploadedName(uploads.last))
    prompt['10'] = { class_type: 'MiniMaxH3ImageToVideo', inputs: conditioningInputs }
  }

  let positive: Link = ['10', 0]
  if (options.mode === 'reference' && scene) {
    scene.references.filter(ref => ref.file.kind === 'image').forEach((ref, index) => {
      if (!ref.anchor) return
      const id = `60${index}`
      prompt[id] = { class_type: 'MiniMaxH3AddGuide', inputs: { positive, latent: ['10', 1], vae: videoVaeLink, image: [`30${index}`, 0], frame_idx: ref.anchor === 'ending' ? -1 : ref.anchor === 'keyframe' ? Math.round((ref.anchorTime || 0) * 24) : 0 } }
      positive = [id, 0]
    })
  }
  if (routed?.preloadDiffusion) {
    // Input order is deliberate: Comfy evaluates the model input first, which
    // starts residency on the diffusion GPU, then evaluates H3 conditioning on
    // the separately routed text-encoder GPU. The await node is a mandatory
    // barrier, so sampling can never observe a partially loaded transformer.
    prompt['87'] = { class_type: routed.preloadDiffusion.startNodeType, inputs: { model: modelLink } }
    prompt['88'] = { class_type: routed.preloadDiffusion.awaitNodeType, inputs: { model: ['87', 0], conditioning: positive, preload: ['87', 1] } }
    modelLink = ['88', 0]
    positive = ['88', 1]
  }
  if (options.motionContext) {
    if (options.motionContext.suppressAudio) {
      // The wrapper treats a saved joint AV latent as both video and audio
      // context. Use the lower-level node so No dialogue can retain the exact
      // video latent tail without feeding the prior voice/audio latent back.
      prompt['160'] = { class_type: 'MiniMaxH3LoadLatent', inputs: { latent_path: options.motionContext.latentPath, clip_index: 0, vae: videoVaeLink } }
      prompt['161'] = { class_type: 'MiniMaxH3MotionContext', inputs: { conditioning: positive, latent: ['10', 1], vae: videoVaeLink, context_frames: ['160', 1], context_length: options.motionContext.contextFrames, encode_mode: 'video', anchor_mode: 'head', crop: 'disabled', audio_context_length: 0, audio_mode: 'timeline', video_context_latent: ['160', 0], target_start: 0 } }
    } else {
      prompt['160'] = { class_type: 'MiniMaxH3LoadLatent', inputs: { latent_path: options.motionContext.latentPath, clip_index: 0 } }
      prompt['161'] = { class_type: 'MiniMaxH3VideoExtender', inputs: { conditioning: positive, latent: ['10', 1], vae: videoVaeLink, mode: 'always_extend', context_length: options.motionContext.contextFrames, encode_mode: 'video', anchor_mode: 'head', crop: 'disabled', audio_context_length: options.motionContext.contextFrames, audio_mode: options.motionContext.carryAudio ? 'timeline' : 'ref', prev_latent: ['160', 0], audio_vae: audioVaeLink } }
    }
    positive = ['161', 0]
  }
  prompt['11'] = { class_type: 'RandomNoise', inputs: { noise_seed: options.seed } }
  prompt['12'] = { class_type: 'BasicGuider', inputs: { model: modelLink, conditioning: positive } }
  // Turbo 8 profiles are intentional, tested recipes—not an accidental custom
  // override. Full-quality and Turbo 4 retain the upstream safe pair unless a
  // user explicitly opts into experimental sampling.
  const useRequestedSampling = options.experimentalSampling || options.turbo === '8' || options.turbo === 'fast'
  const sampler = useRequestedSampling ? options.sampler : OFFICIAL_H3_SAMPLER
  const scheduler = useRequestedSampling ? options.scheduler : OFFICIAL_H3_SCHEDULER
  prompt['13'] = { class_type: 'KSamplerSelect', inputs: { sampler_name: sampler } }
  // Turbo 8 is trained at eight steps, with controlled testing available up
  // to twelve steps for cases that benefit from extra coherence or detail.
  // Turbo 4 is a separate trained recipe and stays fixed at four.
  const scheduledSteps = h3SamplingSteps(options.turbo, options.steps)
  prompt['14'] = {
    class_type: 'BasicScheduler',
    inputs: { model: modelLink, scheduler, steps: scheduledSteps, denoise: 1 },
  }
  prompt['15'] = {
    class_type: 'SamplerCustomAdvanced',
    inputs: { noise: ['11', 0], guider: ['12', 0], sampler: ['13', 0], sigmas: ['14', 0], latent_image: ['10', 1] },
  }
  prompt['16'] = { class_type: 'VAEDecode', inputs: { samples: ['15', 0], vae: videoVaeLink } }
  prompt['17'] = { class_type: 'VAEDecodeAudio', inputs: { samples: ['15', 0], vae: audioVaeLink } }
  prompt['18'] = {
    class_type: 'CreateVideo',
    inputs: { images: ['16', 0], audio: ['17', 0], fps: 24, bit_depth: 8, color_space: 'sRGB' },
  }
  prompt['19'] = {
    class_type: 'SaveVideo',
    inputs: { video: ['18', 0], filename_prefix: options.filenamePrefix, format: 'auto', 'format.codec': 'auto' },
  }
  // The final output remains available when preview work is disabled.
  if (options.livePreview !== false) {
    prompt['71'] = { class_type: 'ImageFromBatch', inputs: { image: ['16', 0], batch_index: 0, length: 1 } }
    prompt['72'] = { class_type: 'PreviewImage', inputs: { images: ['71', 0] } }
  }
  if (options.upscale?.type === 'refine') {
    const { steps, denoise } = options.upscale
    if (!Number.isInteger(steps) || steps < 1 || steps > 30 || !Number.isFinite(denoise) || denoise <= 0 || denoise > 1) throw new Error('H3 refinement requires 1–30 steps and a denoise strength above 0 and at most 1.')
    prompt['110'] = { class_type: 'BasicScheduler', inputs: { model: modelLink, scheduler, steps, denoise } }
    prompt['111'] = { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['11', 0], guider: ['12', 0], sampler: ['13', 0], sigmas: ['110', 0], latent_image: ['15', 0] } }
    prompt['16'] = { class_type: 'VAEDecode', inputs: { samples: ['111', 0], vae: videoVaeLink } }
    prompt['19'] = { class_type: 'SaveVideo', inputs: { video: ['18', 0], filename_prefix: `${options.filenamePrefix}_H3_Refine`, format: 'auto', 'format.codec': 'auto' } }
  } else if (options.upscale?.type === 'h3') {
    // H3 Latent Upscale Pro keeps pass one in H3's joint AV latent domain,
    // applies the learned 3D video upscale, then performs a real low-sigma H3
    // refinement pass. The integrated node resizes target conditioning and
    // preserves the pass-one audio behind a zero denoise mask.
    prompt['110'] = {
      class_type: 'BasicScheduler',
      inputs: { model: modelLink, scheduler, steps: options.upscale.refineSteps, denoise: options.upscale.refineDenoise },
    }
    prompt['111'] = {
      class_type: 'MinimaxH3LatentUpscaler3DRefineHandoff',
      inputs: {
        latent: ['15', 0], noise: ['11', 0], sampler: ['13', 0], sigmas: ['110', 0],
        model: modelLink, positive, model_name: options.upscale.model,
        mode: 'scale by multiplier', scale: options.upscale.scale,
        width: options.width * 2, height: options.height * 2, megapixels: (options.width * options.height * 4) / 1_000_000,
        align: 32, keep_proportion: true, lock_audio: true, cfg: 1,
        device: 'cuda', precision: 'fp16', offload_after_upscale: true,
      },
    }
    // The final decode also supplies the preview. A separate first-pass output
    // would force a second full H3 VAE decode and audio decode for this graph.
    prompt['113'] = { class_type: 'VAEDecode', inputs: { samples: ['111', 0], vae: videoVaeLink } }
    prompt['114'] = { class_type: 'VAEDecodeAudio', inputs: { samples: ['111', 0], vae: audioVaeLink } }
    prompt['18'] = { class_type: 'CreateVideo', inputs: { images: ['113', 0], audio: ['114', 0], fps: 24, bit_depth: 8, color_space: 'sRGB' } }
    prompt['19'] = { class_type: 'SaveVideo', inputs: { video: ['18', 0], filename_prefix: `${options.filenamePrefix}_H3_Latent_Pro_2x`, format: 'auto', 'format.codec': 'auto' } }
    if (!options.continuationAssembly) {
      delete prompt['16']
      delete prompt['17']
      if (options.livePreview !== false) prompt['71'].inputs.image = ['113', 0]
    }
  } else if (options.upscale?.type === 'ltx') {
    // MiniMax post-processing intentionally remains non-generative: encode the
    // completed H3 frame sequence into the LTX video latent domain, apply the
    // learned spatial x2 node, decode, then remux the untouched H3 audio.
    // Padding to 8n+1 satisfies the LTX video VAE temporal layout and is removed
    // after decoding so clip duration cannot drift.
    let images: Link = ['16', 0]
    const frames = frameCount(options.duration)
    const pad = (8 - ((frames - 1) % 8)) % 8
    if (pad) {
      prompt['60'] = { class_type: 'ImageFromBatch', inputs: { image: images, batch_index: frames - 1, length: 1 } }
      prompt['61'] = { class_type: 'RepeatImageBatch', inputs: { image: ['60', 0], amount: pad } }
      prompt['62'] = { class_type: 'ImageBatch', inputs: { image1: images, image2: ['61', 0] } }
      images = ['62', 0]
    }
    prompt['63'] = { class_type: 'VAELoader', inputs: { vae_name: options.upscale.vae } }
    prompt['64'] = { class_type: 'VAEEncodeTiled', inputs: { pixels: images, vae: ['63', 0], tile_size: 512, overlap: 64, temporal_size: 64, temporal_overlap: 8 } }
    prompt['65'] = { class_type: 'LatentUpscaleModelLoader', inputs: { model_name: options.upscale.model } }
    prompt['66'] = { class_type: 'LTXVLatentUpsampler', inputs: { samples: ['64', 0], upscale_model: ['65', 0], vae: ['63', 0] } }
    prompt['67'] = { class_type: 'VAEDecodeTiled', inputs: { samples: ['66', 0], vae: ['63', 0], tile_size: 512, overlap: 64, temporal_size: 64, temporal_overlap: 8 } }
    prompt['68'] = { class_type: 'ImageFromBatch', inputs: { image: ['67', 0], batch_index: 0, length: frames } }
    prompt['69'] = { class_type: 'CreateVideo', inputs: { images: ['68', 0], audio: ['17', 0], fps: 24, bit_depth: 8, color_space: 'sRGB' } }
    prompt['70'] = { class_type: 'SaveVideo', inputs: { video: ['69', 0], filename_prefix: `${options.filenamePrefix}_LTX25_2x`, format: 'auto', 'format.codec': 'auto' } }
  } else if (options.upscale?.type === 'rtx') {
    // Frame-based AI upscaling runs through ComfyUI's CUDA/PyTorch device. It is
    // independent of LTX and is normalized to an exact 2x output even when the
    // selected ESRGAN model's native scale is larger.
    prompt['80'] = { class_type: 'UpscaleModelLoader', inputs: { model_name: options.upscale.model } }
    prompt['81'] = { class_type: 'ImageUpscaleWithModel', inputs: { upscale_model: ['80', 0], image: ['16', 0] } }
    prompt['82'] = { class_type: 'ImageScale', inputs: { image: ['81', 0], upscale_method: 'lanczos', width: options.width * 2, height: options.height * 2, crop: 'disabled' } }
    prompt['83'] = { class_type: 'CreateVideo', inputs: { images: ['82', 0], audio: ['17', 0], fps: 24, bit_depth: 8, color_space: 'sRGB' } }
    prompt['84'] = { class_type: 'SaveVideo', inputs: { video: ['83', 0], filename_prefix: `${options.filenamePrefix}_RTX_AI_2x`, format: 'auto', 'format.codec': 'auto' } }
  }
  if (options.continuationAssembly) {
    if (!uploads.source) throw new Error('Continuation assembly requires the completed source video upload.')
    const previousFrames = addLoader(prompt, '170', 'video', uploadedName(uploads.source))
    const trimFrames: number | Link = options.continuationAssembly.useMotionTrim && options.motionContext
      ? ['161', 1]
      : options.continuationAssembly.trimFrames
    prompt['171'] = { class_type: 'MiniMaxH3LoopTrim', inputs: { images: ['16', 0], audio: ['17', 0], trim_frames: trimFrames, fps: 24, match_tail: true } }
    prompt['173'] = { class_type: 'CreateVideo', inputs: { images: ['171', 0], audio: ['171', 1], fps: 24, bit_depth: 8, color_space: 'sRGB' } }
    prompt['174'] = { class_type: 'SaveVideo', inputs: { video: ['173', 0], filename_prefix: `${options.filenamePrefix}_Beat`, format: 'auto', 'format.codec': 'auto' } }
    prompt['172'] = { class_type: 'MiniMaxH3VideoMerge', inputs: { images_a: previousFrames, audio_a: ['1701', 1], images_b: ['171', 0], audio_b: ['171', 1], seam_smooth: options.continuationAssembly.hardCut ? 0 : 1, color_match: options.continuationAssembly.hardCut ? 'disabled' : 'seam_fade', blend_frames: options.continuationAssembly.hardCut ? 0 : options.continuationAssembly.blendFrames, fps: 24 } }
    prompt['18'] = { class_type: 'CreateVideo', inputs: { images: ['172', 0], audio: ['172', 1], fps: 24, bit_depth: 8, color_space: 'sRGB' } }
  }
  if (options.latentCapture) {
    prompt['190'] = { class_type: 'MiniMaxH3SaveLatent', inputs: { latent: options.upscale?.type === 'refine' || options.upscale?.type === 'h3' ? ['111', 0] : ['15', 0], filename_prefix: options.latentCapture.filenamePrefix, clip_index: 1 } }
  }
  return prompt
}

export function buildMiniMaxReferenceStillWorkflow(options: GenerationOptions, models: ModelSelection, uploads: { images: UploadedFile[]; videos: UploadedFile[]; audios: UploadedFile[] }): ComfyPrompt {
  // Ref2VA requires a video-shaped latent. Five frames is the node's minimum
  // valid 17k + 5 batch, so never spend a full video render on a still.
  // Still generation is an explicit separate artifact. Do not overwrite the
  // authored video timeline with the five-frame implementation detail.
  const prompt = buildMiniMaxWorkflow({ ...options, sceneState: undefined, duration: 5 / 24 }, models, uploads)
  delete prompt['17']; delete prompt['18']; delete prompt['19']; delete prompt['72']
  // Use the fifth decoded frame as the still. The short Ref2VA sequence gives
  // the generation room to settle, and the final frame is the requested handoff
  // image for the later I2V pass.
  prompt['71'] = { class_type: 'ImageFromBatch', inputs: { image: ['16', 0], batch_index: 4, length: 1 } }
  prompt['73'] = { class_type: 'SaveImage', inputs: { images: ['71', 0], filename_prefix: options.filenamePrefix } }
  return prompt
}

export type ComfyOutputFile = { filename: string; subfolder?: string; type?: string }

export function extractOutputFile(history: Record<string, unknown>, promptId: string, mediaType: 'video' | 'audio' | 'image' = 'video', nodeId?: string): ComfyOutputFile | undefined {
  const entry = history[promptId] as { outputs?: Record<string, Record<string, unknown>> } | undefined
  if (!entry?.outputs) return undefined
  const candidates: ComfyOutputFile[] = []
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (!value || typeof value !== 'object') return
    const object = value as Record<string, unknown>
    if (typeof object.filename === 'string') {
      candidates.push({
        filename: object.filename,
        subfolder: typeof object.subfolder === 'string' ? object.subfolder : undefined,
        type: typeof object.type === 'string' ? object.type : undefined,
      })
    }
    Object.values(object).forEach(visit)
  }
  if (nodeId) visit(entry.outputs[nodeId])
  else if (mediaType === 'image' && entry.outputs['73']) visit(entry.outputs['73'])
  else if (entry.outputs['84']) visit(entry.outputs['84'])
  else if (entry.outputs['70']) visit(entry.outputs['70'])
  else if (mediaType === 'video' && entry.outputs['19']) visit(entry.outputs['19'])
  else visit(entry.outputs)
  const expected = mediaType === 'audio' ? /\.(flac|wav|mp3|ogg|m4a|aac|opus)$/i : mediaType === 'image' ? /\.(png|jpe?g|webp)$/i : /\.(mp4|webm|mov|mkv|gif)$/i
  // Do not fall through to an arbitrary output. In particular, a SaveVideo
  // MP4 must never enter the still-image download path, where ComfyUI/Pillow
  // quite correctly rejects it as an image.
  return candidates.find((candidate) => expected.test(candidate.filename))
}

export function extractOutputUrl(history: Record<string, unknown>, promptId: string, comfyUrl: string, mediaType: 'video' | 'audio' | 'image' = 'video', nodeId?: string) {
  const file = extractOutputFile(history, promptId, mediaType, nodeId)
  if (file) {
    const query = new URLSearchParams({ filename: file.filename, subfolder: file.subfolder ?? '', type: file.type ?? 'output' })
    const upstream = `${comfyUrl.replace(/\/+$/, '')}/view?${query.toString()}`
    return `minimax-media://comfy?url=${encodeURIComponent(upstream)}`
  }
  return undefined
}

/** Recover the exact ComfyUI output descriptor from a persisted media URL. */
export function outputFileFromUrl(value: string): ComfyOutputFile | undefined {
  try {
    const wrapped = new URL(value)
    if (wrapped.protocol !== 'minimax-media:' || wrapped.hostname !== 'comfy') return undefined
    const upstream = wrapped.searchParams.get('url')
    if (!upstream) return undefined
    const target = new URL(upstream)
    if (target.pathname !== '/view') return undefined
    const filename = target.searchParams.get('filename')
    if (!filename) return undefined
    return { filename, subfolder: target.searchParams.get('subfolder') || undefined, type: target.searchParams.get('type') || undefined }
  } catch { return undefined }
}

/** Ordered recovery sources for an existing completed video. Older persisted
 * jobs may contain a media URL in localOutputPath; newer jobs contain a path.
 * The remote ComfyUI URL remains a valid final fallback when the configured
 * output folder is different from the server's output folder. */
export function continuationSourceCandidates(job: { localOutputPath?: string; outputUrl?: string }, resolvedOutput?: string | null) {
  const localFromUrl = (() => {
    if (!job.outputUrl) return undefined
    try {
      const parsed = new URL(job.outputUrl)
      return parsed.protocol === 'minimax-media:' && (parsed.hostname === 'local' || parsed.hostname === 'selected') ? parsed.searchParams.get('path') || undefined : undefined
    } catch { return undefined }
  })()
  // Prefer a path resolved from the current output directory. Persisted jobs
  // can retain an old localOutputPath after the output directory is corrected.
  return [...new Set([resolvedOutput || undefined, localFromUrl, job.localOutputPath, job.outputUrl].filter((source): source is string => Boolean(source)))]
}
