import type { WorkflowGpuRouting } from '../types'
import { addRoutedLoader, type ComfyPrompt } from './workflow'

export type ZImageVariant = 'turbo' | 'base'

export const ZIMAGE_DEFAULT_NEGATIVE_PROMPT = 'low quality, low resolution, blurry, out of focus, jpeg artifacts, compression artifacts, color banding, posterization, oversharpened, overprocessed, distorted anatomy, malformed hands, extra fingers, missing fingers, fused fingers, extra limbs, duplicate subjects, warped geometry, inconsistent perspective, text, watermark, logo, signature'

// Comfy-Org workflow_templates/templates/image_z_image_turbo.json
// Comfy-Org workflow_templates/templates/image_z_image.json
export function buildZImage(prompt: string, width: number, height: number, seed: number, model: string, encoder: string, vae: string, steps = 8, cfg = 1, variant: ZImageVariant = 'turbo', negativePrompt = ZIMAGE_DEFAULT_NEGATIVE_PROMPT, attentionBackend?: string, gpuRouting?: WorkflowGpuRouting, livePreview = true): ComfyPrompt {
  const graph: ComfyPrompt = {}
  const modelBaseLink = addRoutedLoader(graph, '1', 'UNETLoader', { unet_name: model, weight_dtype: 'default' }, gpuRouting?.diffusion, '801')
  const clipLink = addRoutedLoader(graph, '2', 'CLIPLoader', { clip_name: encoder, type: 'lumina2', device: 'default' }, gpuRouting?.textEncoder, '802')
  const vaeLink = addRoutedLoader(graph, '3', 'VAELoader', { vae_name: vae }, gpuRouting?.videoVae, '803')
  const diffusionModel: [string, number] = attentionBackend ? ['85', 0] : modelBaseLink
  Object.assign(graph, {
    ...(attentionBackend ? { '85': { class_type: 'ModelAttentionBackend', inputs: { model: modelBaseLink, attention: attentionBackend } } } : {}),
    '4': { class_type: 'CLIPTextEncode', inputs: { clip: clipLink, text: prompt } },
    '5': variant === 'base'
      ? { class_type: 'CLIPTextEncode', inputs: { clip: clipLink, text: negativePrompt } }
      : { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['4', 0] } },
    '6': { class_type: 'EmptySD3LatentImage', inputs: { width, height, batch_size: 1 } },
    '7': { class_type: 'ModelSamplingAuraFlow', inputs: { model: diffusionModel, shift: 3 } },
    '8': { class_type: 'KSampler', inputs: { model: ['7', 0], positive: ['4', 0], negative: ['5', 0], latent_image: ['6', 0], seed, steps, cfg, sampler_name: 'res_multistep', scheduler: 'simple', denoise: 1 } },
    '9': { class_type: 'VAEDecode', inputs: { samples: ['8', 0], vae: vaeLink } },
    '10': { class_type: 'SaveImage', inputs: { images: ['9', 0], filename_prefix: 'MiniMax_first_frames/ZImage' } },
  })
  if (livePreview) graph['11'] = { class_type: 'PreviewImage', inputs: { images: ['9', 0] } }
  return graph
}
