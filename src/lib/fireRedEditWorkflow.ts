import type { UploadedFile } from '../types'
import { choices, type ObjectInfo } from './comfyInfo'
import { uploadedName, type ComfyPrompt } from './workflow'
import { isValidFrameSize, type FrameSize } from './frameResolution'

export const FIRE_RED_REQUIRED_NODES = [
  'UNETLoader', 'CLIPLoader', 'VAELoader', 'LoadImage', 'ImageScale',
  'VAEEncode', 'TextEncodeQwenImageEditPlus', 'ModelSamplingAuraFlow',
  'CFGNorm', 'KSampler', 'VAEDecode', 'SaveImage',
] as const

export type FireRedSelection = { model: string; modelLoader: 'UNETLoader' | 'UnetLoaderGGUF'; encoder: string; vae: string; lightningLora: string }

export function inferFireRedSelection(info: ObjectInfo): FireRedSelection {
  const gguf = choices(info, 'UnetLoaderGGUF', 'unet_name')
    .filter(name => /firered[-_ ]image[-_ ]edit/i.test(name))
    .sort((a, b) => Number(/q4_k_m/i.test(b)) - Number(/q4_k_m/i.test(a)) || Number(/1\.1/.test(b)) - Number(/1\.1/.test(a)))[0]
  const safetensors = choices(info, 'UNETLoader', 'unet_name')
    .filter(name => /firered[-_ ]image[-_ ]edit/i.test(name))
    .sort((a, b) => Number(/1\.1/.test(b)) - Number(/1\.1/.test(a)))[0]
  const model = gguf ?? safetensors ?? ''
  const modelLoader = gguf ? 'UnetLoaderGGUF' : 'UNETLoader'
  const encoder = choices(info, 'CLIPLoader', 'clip_name')
    .find(name => /qwen[-_ ]?2[._]?5[-_ ]?vl[-_ ]?7b/i.test(name)) ?? ''
  const vae = choices(info, 'VAELoader', 'vae_name')
    .find(name => /(?:^|[\\/])qwen_image_vae\.safetensors$/i.test(name)) ?? ''
  const lightningLora = choices(info, 'LoraLoaderModelOnly', 'lora_name')
    .filter(name => /firered[-_ ]image[-_ ]edit.*lightning[-_ ]8steps/i.test(name))
    .sort((a, b) => Number(/image[-_ ]edit[-_ ]1\.1[-_ ]lightning/i.test(b)) - Number(/image[-_ ]edit[-_ ]1\.1[-_ ]lightning/i.test(a)) || Number(/v1\.2/i.test(b)) - Number(/v1\.2/i.test(a)) || Number(/v1\.1/i.test(b)) - Number(/v1\.1/i.test(a)))[0] ?? ''
  return { model, modelLoader, encoder, vae, lightningLora }
}

export function buildFireRedEditWorkflow(source: UploadedFile, prompt: string, seed: number, selection: FireRedSelection, mode: 'turbo' | 'quality', size: FrameSize, references: UploadedFile[] = []): ComfyPrompt {
  if (!prompt.trim()) throw new Error('Describe the photo edit before rendering.')
  if (!selection.model || !selection.encoder || !selection.vae) throw new Error('FireRed model, text encoder, and VAE are required.')
  if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('Choose a valid nonnegative seed.')
  if (mode !== 'turbo' && mode !== 'quality') throw new Error('Choose Turbo or Quality mode.')
  if (mode === 'turbo' && !selection.lightningLora) throw new Error('Turbo requires a FireRed 8-step Lightning LoRA.')
  if (!isValidFrameSize(size)) throw new Error('FireRed dimensions must be 256–2048 pixels and aligned to 32 pixels.')
  if (references.length > 2) throw new Error('FireRed supports up to two reference images alongside the source photo.')
  const turbo = mode === 'turbo'
  const graph: ComfyPrompt = {
    '1': { class_type: selection.modelLoader, inputs: selection.modelLoader === 'UnetLoaderGGUF' ? { unet_name: selection.model } : { unet_name: selection.model, weight_dtype: 'default' } },
    '2': { class_type: 'CLIPLoader', inputs: { clip_name: selection.encoder, type: 'qwen_image', device: 'default' } },
    '3': { class_type: 'VAELoader', inputs: { vae_name: selection.vae } },
    '4': { class_type: 'LoadImage', inputs: { image: uploadedName(source) } },
    '5': { class_type: 'ImageScale', inputs: { image: ['4', 0], upscale_method: 'lanczos', width: size.width, height: size.height, crop: 'center' } },
    '6': { class_type: 'VAEEncode', inputs: { pixels: ['5', 0], vae: ['3', 0] } },
    '7': { class_type: 'TextEncodeQwenImageEditPlus', inputs: { clip: ['2', 0], vae: ['3', 0], image1: ['5', 0], prompt: prompt.trim() } },
    '8': { class_type: 'TextEncodeQwenImageEditPlus', inputs: { clip: ['2', 0], vae: ['3', 0], image1: ['5', 0], prompt: '' } },
    '9': { class_type: 'ModelSamplingAuraFlow', inputs: { model: turbo ? ['13', 0] : ['1', 0], shift: 3.1 } },
    '10': { class_type: 'CFGNorm', inputs: { model: ['9', 0], strength: 1 } },
    '11': { class_type: 'KSampler', inputs: { model: ['10', 0], positive: ['7', 0], negative: ['8', 0], latent_image: ['6', 0], seed, steps: turbo ? 8 : 40, cfg: turbo ? 1 : 4, sampler_name: 'euler', scheduler: 'simple', denoise: 1 } },
    '12': { class_type: 'VAEDecode', inputs: { samples: ['11', 0], vae: ['3', 0] } },
    '14': { class_type: 'SaveImage', inputs: { images: ['12', 0], filename_prefix: 'FireRed/Photo_Edit' } },
  }
  references.forEach((reference, index) => {
    const nodeId = String(15 + index)
    const input = `image${index + 2}`
    graph[nodeId] = { class_type: 'LoadImage', inputs: { image: uploadedName(reference) } }
    graph['7'].inputs[input] = [nodeId, 0]
    graph['8'].inputs[input] = [nodeId, 0]
  })
  if (turbo) graph['13'] = { class_type: 'LoraLoaderModelOnly', inputs: { model: ['1', 0], lora_name: selection.lightningLora, strength_model: 1 } }
  return graph
}
