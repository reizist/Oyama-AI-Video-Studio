import type { ComfyPrompt } from './workflow'

// Anima's native ComfyUI graph (UNETLoader + CLIPLoader + VAELoader), matching the
// official "Text to Image (Anima Base 1.0)" blueprint shipped with ComfyUI core.
// UNETLoader can also load "model only" checkpoint merges (e.g. community CapPixel
// turbo merges saved via CheckpointSaveModelOnly) since ComfyUI strips the
// model.diffusion_model. prefix and ignores any embedded VAE/CLIP weights.
export function buildAnima(prompt: string, negativePrompt: string, width: number, height: number, seed: number, unetName: string, clipName: string, vaeName: string, steps: number, cfg: number, samplerName: string, scheduler: string, loraName = '', loraStrengthModel = 1, loraStrengthClip = 1): ComfyPrompt {
  const promptGraph: ComfyPrompt = {
    '1': { class_type: 'UNETLoader', inputs: { unet_name: unetName, weight_dtype: 'default' } },
    '2': { class_type: 'CLIPLoader', inputs: { clip_name: clipName, type: 'stable_diffusion', device: 'default' } },
    '3': { class_type: 'VAELoader', inputs: { vae_name: vaeName } },
    '4': { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 0], text: prompt } },
    '5': { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 0], text: negativePrompt } },
    '6': { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
    '7': { class_type: 'KSampler', inputs: { model: ['1', 0], positive: ['4', 0], negative: ['5', 0], latent_image: ['6', 0], seed, steps, cfg, sampler_name: samplerName, scheduler, denoise: 1 } },
    '8': { class_type: 'VAEDecode', inputs: { samples: ['7', 0], vae: ['3', 0] } },
    '9': { class_type: 'SaveImage', inputs: { images: ['8', 0], filename_prefix: 'MiniMax_first_frames/Anima' } },
  }
  if (loraName) {
    promptGraph['10'] = { class_type: 'LoraLoader', inputs: { model: ['1', 0], clip: ['2', 0], lora_name: loraName, strength_model: loraStrengthModel, strength_clip: loraStrengthClip } }
    promptGraph['4'].inputs.clip = ['10', 1]
    promptGraph['5'].inputs.clip = ['10', 1]
    promptGraph['7'].inputs.model = ['10', 0]
  }
  return promptGraph
}
