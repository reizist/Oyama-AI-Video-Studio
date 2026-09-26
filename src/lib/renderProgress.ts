import type { GenerationJob } from '../types'

type SamplerUpdate = Pick<GenerationJob, 'currentStep' | 'samplerPass'>

export function samplerTimingUpdate(job: GenerationJob | Pick<GenerationJob, 'currentStep' | 'samplerPass' | 'estimatedSamplerStepMs' | 'lastSamplerStepAt' | 'refinementStepCostMultiplier'>, update: SamplerUpdate, now: number) {
  const passChanged = Boolean(update.samplerPass && update.samplerPass !== job.samplerPass)
  if (passChanged) return {
    lastSamplerStepAt: undefined,
    estimatedSamplerStepMs: job.estimatedSamplerStepMs && update.samplerPass === 'refine'
      ? Math.round(job.estimatedSamplerStepMs * (job.refinementStepCostMultiplier ?? 1))
      : job.estimatedSamplerStepMs,
  }
  const stepDelta = update.currentStep !== undefined && job.currentStep !== undefined ? update.currentStep - job.currentStep : 0
  if (stepDelta <= 0) return { lastSamplerStepAt: job.lastSamplerStepAt, estimatedSamplerStepMs: job.estimatedSamplerStepMs }
  const measuredStepMs = job.lastSamplerStepAt && now > job.lastSamplerStepAt ? (now - job.lastSamplerStepAt) / stepDelta : undefined
  return {
    lastSamplerStepAt: now,
    estimatedSamplerStepMs: measuredStepMs
      ? Math.round(job.estimatedSamplerStepMs ? job.estimatedSamplerStepMs * 0.65 + measuredStepMs * 0.35 : measuredStepMs)
      : job.estimatedSamplerStepMs,
  }
}

export function nodeTimingUpdate(job: Pick<GenerationJob, 'activeNodeId' | 'activeNodeStartedAt' | 'lastNodeDurationMs'>, nodeId: string | null | undefined, now: number) {
  if (nodeId === undefined || nodeId === job.activeNodeId) return { activeNodeId: job.activeNodeId, activeNodeStartedAt: job.activeNodeStartedAt, lastNodeDurationMs: job.lastNodeDurationMs }
  return {
    activeNodeId: nodeId ?? undefined,
    activeNodeStartedAt: nodeId ? now : undefined,
    lastNodeDurationMs: job.activeNodeStartedAt && job.activeNodeId && now >= job.activeNodeStartedAt ? now - job.activeNodeStartedAt : job.lastNodeDurationMs,
  }
}

export function samplerPassForNode(nodeId: string, nodeType?: string): GenerationJob['samplerPass'] | undefined {
  if (nodeId === '38' || nodeId === '111') return 'refine'
  if (nodeId === '15' || nodeType === 'KSampler') return 'first'
  return undefined
}

export function nodeStageLabel(nodeType: string | undefined, nodeId: string) {
  const h3Stages: Record<string, string> = {
    '161': 'Preparing motion context', '170': 'Loading source video for continuation',
    '1701': 'Loading source audio for continuation', '171': 'Trimming continuity overlap',
    '172': 'Merging source and new beat', '173': 'Encoding new beat',
    '174': 'Saving new beat', '190': 'Saving reusable motion context',
  }
  if (h3Stages[nodeId]) return h3Stages[nodeId]
  if (!nodeType) return `Running node ${nodeId}`
  if (/^UNETLoader$/i.test(nodeType)) return 'Loading diffusion model'
  if (/^(CLIPLoader|DualCLIPLoader)$/i.test(nodeType)) return 'Loading text encoder'
  if (/ModelAttentionBackend|SolAttnH3|MiniMaxH3AttentionParallel/i.test(nodeType)) return 'Applying attention backend'
  if (/LoraLoader/i.test(nodeType)) return 'Applying LoRA adapters'
  if (/MiniMaxH3.*(?:Reference|Image)ToVideo/i.test(nodeType)) return 'Preparing H3 conditioning and references'
  if (/MinimaxH3LatentUpscaler3DRefineHandoff/i.test(nodeType)) return 'Upscaling and refining H3 latent'
  if (/SamplerCustomAdvanced|KSampler$/i.test(nodeType)) return 'Starting sampler'
  if (/VAEDecode/i.test(nodeType)) return 'Decoding video frames'
  if (/CreateVideo/i.test(nodeType)) return 'Encoding video and audio'
  if (/Save(?:Video|Image|Audio)/i.test(nodeType)) return 'Saving output'
  return `Processing ${nodeType}`
}

export function samplerProgressSummary(job: GenerationJob | undefined, now: number) {
  if (!job || job.status !== 'running' || job.currentStep === undefined || !job.totalSteps || job.totalSteps <= 0) return null
  const refinementSteps = Math.max(0, job.refinementSteps ?? 0)
  const firstSteps = refinementSteps && job.steps ? job.steps : job.totalSteps
  const totalSteps = firstSteps + refinementSteps
  const currentStep = Math.min(totalSteps, (job.samplerPass === 'refine' ? firstSteps : 0) + job.currentStep)
  const progress = Math.min(100, Math.round(currentStep / totalSteps * 100))
  const rate = job.estimatedSamplerStepMs
  const stepAge = job.lastSamplerStepAt ? Math.max(0, now - job.lastSamplerStepAt) : undefined
  const stageRemaining = Math.max(0, job.totalSteps - job.currentStep)
  const nextStepIn = stageRemaining && rate && stepAge !== undefined ? Math.max(0, rate - stepAge) : undefined
  const stepOverdueBy = stageRemaining && rate && stepAge !== undefined && stepAge > rate * 1.35 ? stepAge - rate : undefined
  const remainingSteps = Math.max(0, totalSteps - currentStep)
  const currentStepElapsed = stageRemaining && rate && stepAge !== undefined ? Math.min(rate, stepAge) : 0
  const remainingMs = rate === undefined ? undefined : job.samplerPass === 'refine'
    ? Math.max(0, stageRemaining * rate - currentStepElapsed)
    : Math.max(0, stageRemaining * rate - currentStepElapsed) + refinementSteps * rate * (job.refinementStepCostMultiplier ?? 1)
  return { progress, currentStep, totalSteps, rate, nextStepIn, stepOverdueBy, remainingSteps, remainingMs, samplerPass: job.samplerPass ?? 'first' }
}
