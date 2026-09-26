import type { GenerationJob } from "../types"

export function queuePromptState(queue: unknown, promptId: string): 'queued' | 'running' | null {
  if (!queue || typeof queue !== 'object') return null
  const source = queue as { queue_running?: unknown; queue_pending?: unknown }
  const contains = (entries: unknown) => Array.isArray(entries) && entries.some((entry) => Array.isArray(entry) && String(entry[1]) === promptId)
  return contains(source.queue_running) ? 'running' : contains(source.queue_pending) ? 'queued' : null
}

export function queuePromptPosition(queue: unknown, promptId: string) {
  if (!queue || typeof queue !== 'object') return undefined
  const pending = (queue as { queue_pending?: unknown }).queue_pending
  if (!Array.isArray(pending)) return undefined
  const index = pending.findIndex((entry) => Array.isArray(entry) && String(entry[1]) === promptId)
  return index >= 0 ? index + 1 : undefined
}

export function comfyTerminalState(entry: { status?: { status_str?: string; completed?: boolean } } | undefined) {
  const status = entry?.status?.status_str?.toLowerCase() ?? ''
  // Explicit errors take precedence over a stale or inconsistent completed flag.
  if (/(?:error|failed|cancelled|interrupted)/.test(status)) return 'failed' as const
  if (entry?.status?.completed || /^(success|completed)$/.test(status)) return 'completed' as const
  return null
}

// History responses can arrive after cancellation, removal, or a later state change.
export function mayApplyHistoryUpdate(current: GenerationJob, expected: GenerationJob, cancellationRequested: boolean) {
  return !cancellationRequested && current.id === expected.id && current.promptId === expected.promptId && (current.status === "queued" || current.status === "running")
}
