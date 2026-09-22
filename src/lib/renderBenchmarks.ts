import type { GenerationJob, GpuTelemetry } from '../types'

export type RenderBenchmark = {
  jobId: string
  hardwareKey: string
  hardwareLabel: string
  provider: 'minimax'
  mode: GenerationJob['mode']
  turbo: NonNullable<GenerationJob['turbo']>
  attention: string
  width: number
  height: number
  duration: number
  steps: number
  engineMs: number
  measuredAt: number
}

export type RenderEstimateRequest = Pick<RenderBenchmark, 'provider' | 'mode' | 'turbo' | 'attention' | 'width' | 'height' | 'duration' | 'steps'>

export function renderHardware(gpu: GpuTelemetry | null) {
  const devices = gpu?.devices?.length ? gpu.devices : gpu?.name ? [{ name: gpu.name, vramTotalMb: gpu.vramTotalMb ?? 0 }] : []
  const parts = devices.map((device) => `${device.name}|${device.vramTotalMb ?? 0}`)
  return { key: parts.join('::') || 'unknown-gpu', label: devices.map((device) => device.name).join(' + ') || 'Unknown GPU' }
}

export function benchmarkFromJob(job: GenerationJob, gpu: GpuTelemetry | null): RenderBenchmark | null {
  if (job.status !== 'completed' || job.provider !== 'minimax' || job.mediaType !== 'video' || !job.renderDurationMs || !job.width || !job.height || !job.duration || !job.steps) return null
  const hardware = renderHardware(gpu)
  // renderDurationMs is measured from local submission. Exclude a known queue
  // wait so an unrelated ComfyUI job cannot inflate later estimates.
  const queueMs = job.startedAt ? Math.max(0, job.startedAt - job.createdAt) : 0
  const engineMs = Math.max(1_000, job.renderDurationMs - queueMs)
  return {
    jobId: job.id, hardwareKey: hardware.key, hardwareLabel: hardware.label,
    provider: 'minimax', mode: job.mode, turbo: job.turbo ?? 'off',
    attention: job.execution?.attentionBackend ?? 'Unknown attention',
    width: job.renderWidth ?? job.width, height: job.renderHeight ?? job.height,
    duration: job.duration, steps: job.steps, engineMs, measuredAt: job.createdAt + job.renderDurationMs,
  }
}

export function estimateRenderMs(samples: RenderBenchmark[], hardwareKey: string, request: RenderEstimateRequest) {
  const compatible = samples.filter((sample) => sample.hardwareKey === hardwareKey
    && sample.provider === request.provider && sample.mode === request.mode
    && sample.turbo === request.turbo && sample.attention === request.attention
    && sample.engineMs > 0)
  if (!compatible.length) return null
  const targetCost = Math.max(1, request.width * request.height * request.duration * request.steps)
  const normalized = compatible.map((sample) => sample.engineMs / Math.max(1, sample.width * sample.height * sample.duration * sample.steps))
  normalized.sort((a, b) => a - b)
  const middle = Math.floor(normalized.length / 2)
  const median = normalized.length % 2 ? normalized[middle] : (normalized[middle - 1] + normalized[middle]) / 2
  return { milliseconds: Math.round(median * targetCost), sampleCount: compatible.length }
}
