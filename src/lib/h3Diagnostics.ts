import type { ModelFile } from "../types"
import { MINIMAX_VIDEO_RESOLUTIONS } from "./videoResolutions"

export type H3BenchmarkBackend = 'kitchen' | 'sage' | 'sol'
export type H3BenchmarkConfig = { duration: number; resolution: string }
export type H3BenchmarkResult = {
  backend: H3BenchmarkBackend
  label: string
  status: 'idle' | 'running' | 'completed' | 'failed' | 'unavailable'
  elapsedMs?: number
  renderMs?: number
  error?: string
  completedAt?: number
}
export const h3BenchmarkBackends: Array<{ backend: H3BenchmarkBackend; label: string }> = [
  { backend: 'kitchen', label: 'Kitchen INT8' },
  { backend: 'sage', label: 'SageAttention' },
  { backend: 'sol', label: 'NVIDIA Sol-Attn' },
]
export const H3_BENCHMARK_STORAGE_KEY = 'oyama.h3-attention-benchmark.v1'
export const H3_BENCHMARK_CONFIG_STORAGE_KEY = 'oyama.h3-attention-benchmark-config.v1'
export const defaultH3BenchmarkConfig: H3BenchmarkConfig = { duration: 3, resolution: '864x480' }

export function loadH3BenchmarkConfig(): H3BenchmarkConfig {
  try {
    const stored = JSON.parse(localStorage.getItem(H3_BENCHMARK_CONFIG_STORAGE_KEY) ?? '{}') as Partial<H3BenchmarkConfig>
    const duration = Math.max(1, Math.min(60, Math.round(Number(stored.duration) || defaultH3BenchmarkConfig.duration)))
    const resolution = typeof stored.resolution === 'string' && MINIMAX_VIDEO_RESOLUTIONS.includes(stored.resolution) ? stored.resolution : defaultH3BenchmarkConfig.resolution
    return { duration, resolution }
  } catch {
    return defaultH3BenchmarkConfig
  }
}

export function loadH3BenchmarkResults(): H3BenchmarkResult[] {
  try {
    const stored = JSON.parse(localStorage.getItem(H3_BENCHMARK_STORAGE_KEY) ?? '[]') as H3BenchmarkResult[]
    if (!Array.isArray(stored)) return []
    // A render interrupted by an app restart must not reappear as an active benchmark.
    return stored.filter((item) => item && typeof item.backend === 'string' && typeof item.label === 'string' && ['completed', 'failed', 'unavailable'].includes(item.status))
  } catch {
    return []
  }
}

export function formatBenchmarkDuration(ms?: number) {
  if (ms === undefined || !Number.isFinite(ms)) return '—'
  return ms >= 60_000 ? `${(ms / 60_000).toFixed(1)} min` : `${(ms / 1000).toFixed(1)} s`
}

export function benchmarkResultPatch(results: H3BenchmarkResult[], backend: H3BenchmarkBackend, patch: Partial<H3BenchmarkResult>) {
  return results.map((item) => item.backend === backend ? { ...item, ...patch } : item)
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

export function h3StackReport(models: ModelFile[]) {
  const rows = validatedH3Files.map((definition) => {
    const files = models.filter((model) => model.kind === definition.kind)
    const exact = files.find((model) => [definition.expected, ...(definition.alternatives ?? [])].some((name) => model.name.toLowerCase() === name.toLowerCase()))
    const fallback = files.find((model) => definition.fallback.test(model.name))
    // Variant filenames make a stack usable, but only known files receive the validated badge.
    return { ...definition, selected: exact?.name ?? fallback?.name ?? '', validated: Boolean(exact) }
  })
  return { rows, validated: rows.every((row) => row.optional || row.validated), ready: rows.every((row) => row.optional || row.selected) }
}

