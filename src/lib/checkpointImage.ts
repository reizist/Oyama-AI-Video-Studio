import type { ComfyPrompt } from './workflow'

// Standard single-file checkpoint pipeline (CheckpointLoaderSimple + CLIPTextEncode +
// KSampler + VAEDecode). Covers SD1.5/SDXL-family checkpoints — including anime
// checkpoints such as Anima, Illustrious, NoobAI, Pony, and AnimagineXL — which bundle
// their own CLIP and VAE rather than using the split diffusion_models/text_encoders/vae
// files the other workspaces expect.
export function buildCheckpointImage(prompt: string, negativePrompt: string, width: number, height: number, seed: number, checkpoint: string, steps: number, cfg: number, samplerName: string, scheduler: string, clipSkip = 1, loraName = '', loraStrengthModel = 1, loraStrengthClip = 1): ComfyPrompt {
  const promptGraph: ComfyPrompt = {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: checkpoint } },
    '2': { class_type: 'CLIPSetLastLayer', inputs: { clip: ['1', 1], stop_at_clip_layer: -Math.abs(clipSkip) } },
    '3': { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 0], text: prompt } },
    '4': { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 0], text: negativePrompt } },
    '5': { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
    '6': { class_type: 'KSampler', inputs: { model: ['1', 0], positive: ['3', 0], negative: ['4', 0], latent_image: ['5', 0], seed, steps, cfg, sampler_name: samplerName, scheduler, denoise: 1 } },
    '7': { class_type: 'VAEDecode', inputs: { samples: ['6', 0], vae: ['1', 2] } },
    '8': { class_type: 'SaveImage', inputs: { images: ['7', 0], filename_prefix: 'MiniMax_first_frames/Checkpoint' } },
  }
  if (loraName) {
    promptGraph['9'] = { class_type: 'LoraLoader', inputs: { model: ['1', 0], clip: ['1', 1], lora_name: loraName, strength_model: loraStrengthModel, strength_clip: loraStrengthClip } }
    promptGraph['2'].inputs.clip = ['9', 1]
    promptGraph['6'].inputs.model = ['9', 0]
  }
  return promptGraph
}
