import type { GenerationJob } from '../types'

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
  const remainingMs = rate === undefined ? undefined : job.samplerPass === 'refine'
    ? stageRemaining * rate
    : stageRemaining * rate + refinementSteps * rate * (job.refinementStepCostMultiplier ?? 1)
  return { progress, currentStep, totalSteps, rate, nextStepIn, stepOverdueBy, remainingSteps, remainingMs, samplerPass: job.samplerPass ?? 'first' }
}
