import type { GenerationJob, JobStatus } from '../types'

const jobStatuses: JobStatus[] = ['queued', 'running', 'completed', 'failed', 'cancelled']

export function playableOutputUrl(value?: string) {
  if (!value || value.startsWith('minimax-media:')) return value
  try {
    const url = new URL(value)
    return url.pathname === '/view' ? `minimax-media://comfy?url=${encodeURIComponent(value)}` : value
  } catch {
    return value
  }
}

export function readSavedJobs(raw: string | null): GenerationJob[] {
  let stored: unknown
  try { stored = JSON.parse(raw ?? '[]') } catch { return [] }
  if (!Array.isArray(stored)) return []
  return stored.flatMap((value): GenerationJob[] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return []
    const job = value as Partial<GenerationJob>
    // Reject only entries that cannot be identified or displayed; preserve older optional fields.
    if (typeof job.id !== 'string' || !job.id || typeof job.prompt !== 'string' || !Number.isFinite(job.createdAt) || !Number.isFinite(new Date(job.createdAt!).getTime())) return []
    const status = jobStatuses.includes(job.status as JobStatus) ? job.status! : 'failed'
    const promptId = typeof job.promptId === 'string' && job.promptId ? job.promptId : undefined
    const interrupted = !promptId && (status === 'queued' || status === 'running')
    return [{
      ...job,
      id: job.id,
      prompt: job.prompt,
      createdAt: job.createdAt!,
      mode: ['text', 'image', 'frames', 'reference'].includes(job.mode ?? '') ? job.mode! : 'text',
      status: interrupted ? 'failed' : status,
      progress: Number.isFinite(job.progress) ? Math.max(0, Math.min(100, job.progress!)) : 0,
      width: Number.isFinite(job.width) ? job.width! : 0,
      height: Number.isFinite(job.height) ? job.height! : 0,
      duration: Number.isFinite(job.duration) ? job.duration! : 0,
      promptId,
      outputUrl: typeof job.outputUrl === 'string' ? playableOutputUrl(job.outputUrl) : undefined,
      comfyActivity: Array.isArray(job.comfyActivity) ? job.comfyActivity.filter((entry) => entry && typeof entry.message === 'string' && Number.isFinite(entry.at) && Number.isFinite(new Date(entry.at).getTime())) : undefined,
      ...(interrupted ? {
        error: 'The app lost this render before it received a prompt ID. Check ComfyUI queue or history before retrying to avoid a duplicate; your source and script are safe.',
        progressLabel: 'Submission interrupted',
      } : {}),
    }]
  })
}
