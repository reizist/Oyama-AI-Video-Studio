import type { GenerationJob } from '../types'

export function formatRuntime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatStepDuration(milliseconds: number) {
  const seconds = Math.max(0, milliseconds / 1000)
  return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s/step`
}

export function appendComfyActivity(job: GenerationJob, event: NonNullable<GenerationJob['comfyActivity']>[number]) {
  const activity = job.comfyActivity ?? []
  const previous = activity.at(-1)
  // Polling and the event socket can report the same transition. Keep a useful
  // transcript rather than filling the console with duplicate heartbeat lines.
  if (previous?.message === event.message && event.at - previous.at < 3_000) return job
  return { ...job, comfyActivity: [...activity, event].slice(-32) }
}

export function comfyHistoryActivity(messages: unknown[] | undefined) {
  if (!messages?.length) return []
  return messages.slice(-4).flatMap((message) => {
    if (!Array.isArray(message)) return []
    const node = message[0] === undefined ? '' : `Node ${String(message[0])}: `
    const kind = typeof message[1] === 'string' ? message[1] : ''
    const detail = message[2] && typeof message[2] === 'object' ? message[2] as { exception_message?: unknown; message?: unknown } : undefined
    const text = detail?.exception_message ?? detail?.message ?? kind
    if (!text || typeof text !== 'string') return []
    const readable = text.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (!readable) return []
    const tinyVaeMismatch = /taeh3.*(?:decoder|decode).*?(?:mismatch|shape|channel)|(?:mismatch|shape|channel).*taeh3/i.test(readable)
    const notice = tinyVaeMismatch
      ? 'H3 Tiny VAE preview is incompatible with this latent shape. Preview decoder disabled; final full Video VAE decode continues without retrying Tiny VAE.'
      : `${node}${readable}`.slice(0, 260)
    return [{ level: tinyVaeMismatch ? 'warning' as const : /error|fail|interrupt/i.test(kind) ? 'error' as const : 'info' as const, message: notice }]
  })
}

export function formatStepCountdown(milliseconds: number) {
  const seconds = Math.max(0, milliseconds / 1000)
  if (seconds < 0.25) return 'due now'
  return `${seconds < 10 ? seconds.toFixed(1) : Math.ceil(seconds)}s`
}

