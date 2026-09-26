export function shortPrompt(prompt: string) {
  return prompt.length > 76 ? `${prompt.slice(0, 76)}…` : prompt
}

export function libraryPromptTitle(prompt: string) {
  const authored = prompt.match(/(?:integrated_multimodal_description|detailed_description):\s*([\s\S]*?)(?=\n\s*(?:overall_soundscape|non_diegetic_music):|$)/i)?.[1] || prompt
  const line = authored.split(/\r?\n/).map(part => part.replace(/\[Shot\s+\d+\](?:\s+At\s+[\d:.]+,?\s+the\s+camera\s+cuts\s+to)?/gi, '').replace(/<[^>]+>/g, '').trim()).find(Boolean)
  return shortPrompt(line || 'Untitled render')
}

export function modelPrecisionLabel(model?: string) {
  if (!model) return undefined
  if (/nvfp4/i.test(model)) return 'NVFP4'
  if (/int8.*convrot|convrot.*int8/i.test(model)) return 'INT8 ConvRot'
  if (/bf16/i.test(model)) return 'BF16'
  if (/fp16/i.test(model)) return 'FP16'
  if (/int8/i.test(model)) return 'INT8'
  return undefined
}

export function modelLabel(model?: string) {
  if (!model) return undefined
  return model.replace(/\.safetensors$/i, '').replace(/^minimax_h3_/i, 'H3 ').replace(/^ltx-2\.5-/i, 'LTX 2.5 ').replace(/[_-]+/g, ' ')
}
