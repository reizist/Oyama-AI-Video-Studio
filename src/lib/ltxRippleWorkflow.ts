import type { Ltx25ModelSelection, UploadedFile } from '../types'
import { addRoutedLoader, uploadedName, type ComfyPrompt } from './workflow'
import { isValidFrameSize } from './frameResolution'

export const LTX_RIPPLE_DEFAULT_PROMPT = 'Use the reference video for motion, timing, camera movement, composition, and unchanged scene content, while consistently propagating the visual edit established in the first frame throughout the video.'
export const LTX_RIPPLE_PRESET_SECONDS = [5, 10, 15, 20] as const
export const LTX_RIPPLE_MAX_FRAMES = 481
export const LTX_RIPPLE_REQUIRED_NODES = [
  'UNETLoader', 'CLIPLoader', 'VAELoader', 'LoraLoaderModelOnly', 'LoadVideo', 'GetVideoComponents',
  'LoadImage', 'ImageScale', 'ImageBatch', 'ImageFromBatch', 'LTXVConditioning',
  'CLIPTextEncode',
  'LTXAddVideoICLoRAGuide', 'LTXVCropGuides', 'EmptyLTXVLatentVideo', 'LTXVEmptyLatentAudio',
  'LTXVConcatAVLatent', 'LTXVSeparateAVLatent', 'CFGGuider', 'BasicScheduler',
  'KSamplerSelect', 'SamplerCustomAdvanced', 'RandomNoise', 'VAEDecode', 'CreateVideo', 'SaveVideo',
] as const

export type LtxRippleOptions = {
  prompt: string
  negativePrompt: string
  width: number
  height: number
  frames: number
  strength: number
  guideStrength?: number
  seed: number
  filenamePrefix: string
  livePreview?: boolean
  previewOverride?: { nodeType: string; fps: number }
}

export function rippleFrameOptions(sourceFrames: number): number[] {
  return Array.from({ length: (LTX_RIPPLE_MAX_FRAMES - 49) / 8 + 1 }, (_, index) => 49 + index * 8).filter(frames => frames - 1 <= sourceFrames)
}

export function rippleFramesForSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 2 || seconds > 20) throw new Error('Choose a Ripple edit length between 2 and 20 seconds.')
  return Math.ceil((Math.round(seconds * 24) - 1) / 8) * 8 + 1
}

export function rippleSize(width: number, height: number): { width: number; height: number } {
  const scale = 768 / Math.max(width, height)
  return {
    width: Math.max(256, Math.round(width * scale / 32) * 32),
    height: Math.max(256, Math.round(height * scale / 32) * 32),
  }
}

export function buildLtxRippleWorkflow(options: LtxRippleOptions, models: Ltx25ModelSelection, lora: string, source: UploadedFile, editedFrame: UploadedFile): ComfyPrompt {
  if (!Number.isInteger(options.frames) || options.frames < 49 || options.frames > LTX_RIPPLE_MAX_FRAMES || (options.frames - 1) % 8 !== 0) throw new Error('Choose a supported Ripple frame count (8n + 1, up to 20 seconds).')
  if (!isValidFrameSize(options)) throw new Error('Ripple dimensions must be 256–2048 pixels and aligned to 32 pixels.')
  if (!Number.isFinite(options.strength) || options.strength < 0.5 || options.strength > 2) throw new Error('Ripple strength must be between 0.5 and 2.')
  if (options.guideStrength !== undefined && (!Number.isFinite(options.guideStrength) || options.guideStrength < 0 || options.guideStrength > 1)) throw new Error('Motion guide strength must be between 0 and 1.')
  const graph: ComfyPrompt = {}
  const model = addRoutedLoader(graph, '1', 'UNETLoader', { unet_name: models.diffusion, weight_dtype: 'default' })
  const clip = addRoutedLoader(graph, '2', 'CLIPLoader', { clip_name: models.textEncoder, type: 'ltxv', device: 'default' })
  const vae = addRoutedLoader(graph, '3', 'VAELoader', { vae_name: models.videoVae })
  const audioVae = addRoutedLoader(graph, '4', 'VAELoader', { vae_name: models.audioVae })
  Object.assign(graph, {
    '5': { class_type: 'LoraLoaderModelOnly', inputs: { model, lora_name: lora, strength_model: options.strength } },
    '6': { class_type: 'CLIPTextEncode', inputs: { clip, text: options.prompt.trim() || LTX_RIPPLE_DEFAULT_PROMPT } },
    '7': { class_type: 'CLIPTextEncode', inputs: { clip, text: options.negativePrompt.trim() } },
    '8': { class_type: 'LTXVConditioning', inputs: { positive: ['6', 0], negative: ['7', 0], frame_rate: 24 } },
    '9': { class_type: 'LoadVideo', inputs: { file: uploadedName(source) } },
    '10': { class_type: 'GetVideoComponents', inputs: { video: ['9', 0] } },
    '11': { class_type: 'LoadImage', inputs: { image: uploadedName(editedFrame) } },
    '12': { class_type: 'ImageScale', inputs: { image: ['10', 0], upscale_method: 'lanczos', width: options.width, height: options.height, crop: 'center' } },
    '13': { class_type: 'ImageScale', inputs: { image: ['11', 0], upscale_method: 'lanczos', width: options.width, height: options.height, crop: 'center' } },
    '14': { class_type: 'ImageBatch', inputs: { image1: ['13', 0], image2: ['12', 0] } },
    '15': { class_type: 'ImageFromBatch', inputs: { image: ['14', 0], batch_index: 0, length: options.frames } },
    '16': { class_type: 'EmptyLTXVLatentVideo', inputs: { width: options.width, height: options.height, length: options.frames, batch_size: 1 } },
    '17': { class_type: 'LTXAddVideoICLoRAGuide', inputs: { positive: ['8', 0], negative: ['8', 1], vae, latent: ['16', 0], image: ['15', 0], frame_idx: 0, strength: options.guideStrength ?? 1, latent_downscale_factor: 1, crop: 'disabled', use_tiled_encode: options.frames > 121, tile_size: 256, tile_overlap: 64 } },
    '18': { class_type: 'LTXVEmptyLatentAudio', inputs: { audio_vae: audioVae, frames_number: options.frames, frame_rate: 24, batch_size: 1 } },
    '19': { class_type: 'LTXVConcatAVLatent', inputs: { video_latent: ['17', 2], audio_latent: ['18', 0] } },
    '20': { class_type: 'RandomNoise', inputs: { noise_seed: options.seed } },
    '21': { class_type: 'CFGGuider', inputs: { model: ['5', 0], positive: ['17', 0], negative: ['17', 1], cfg: 1 } },
    '22': { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
    '23': { class_type: 'BasicScheduler', inputs: { model: ['5', 0], scheduler: 'simple', steps: 8, denoise: 1 } },
    '24': { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['20', 0], guider: ['21', 0], sampler: ['22', 0], sigmas: ['23', 0], latent_image: ['19', 0] } },
    '25': { class_type: 'LTXVSeparateAVLatent', inputs: { av_latent: ['24', 0] } },
    '26': { class_type: 'LTXVCropGuides', inputs: { positive: ['17', 0], negative: ['17', 1], latent: ['25', 0] } },
    '27': { class_type: 'VAEDecode', inputs: { samples: ['26', 2], vae } },
    '28': { class_type: 'CreateVideo', inputs: { images: ['27', 0], audio: ['10', 1], fps: 24, bit_depth: 8, color_space: 'sRGB' } },
    '29': { class_type: 'SaveVideo', inputs: { video: ['28', 0], filename_prefix: options.filenamePrefix, format: 'auto', 'format.codec': 'auto' } },
  })
  if (options.livePreview !== false) {
    graph['30'] = { class_type: 'ImageFromBatch', inputs: { image: ['27', 0], batch_index: 0, length: 1 } }
    graph['31'] = { class_type: 'PreviewImage', inputs: { images: ['30', 0] } }
    if (options.previewOverride) {
      graph['32'] = { class_type: options.previewOverride.nodeType, inputs: { model: ['5', 0], preview_rate: options.previewOverride.fps, vae } }
      graph['21'].inputs.model = ['32', 0]
    }
  }
  return graph
}
