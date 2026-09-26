export type ComfyCancellation = { cancelled: boolean; state: 'running' | 'pending' | 'finished' | 'unknown' }
type ComfyRequest = (path: string, init?: RequestInit) => Promise<Response>

async function readResponse(response: Response) {
  const body = await response.text().catch(() => '')
  if (!response.ok) throw new Error(body || `ComfyUI returned ${response.status}`)
  return body ? JSON.parse(body) as unknown : null
}

function queueState(queue: unknown, promptId: string): 'running' | 'pending' | null {
  if (!queue || typeof queue !== 'object') return null
  const entries = queue as { queue_running?: unknown; queue_pending?: unknown }
  const includes = (items: unknown) => Array.isArray(items) && items.some(item => Array.isArray(item) && item[1] === promptId)
  return includes(entries.queue_running) ? 'running' : includes(entries.queue_pending) ? 'pending' : null
}

async function finishedState(promptId: string, request: ComfyRequest): Promise<ComfyCancellation> {
  const history = await readResponse(await request(`/history/${encodeURIComponent(promptId)}`))
  return { cancelled: false, state: history && typeof history === 'object' && promptId in history ? 'finished' : 'unknown' }
}

export async function cancelComfyPrompt(promptId: string, request: ComfyRequest): Promise<ComfyCancellation> {
  if (!promptId) throw new Error('A ComfyUI prompt ID is required to cancel a generation.')
  const current = queueState(await readResponse(await request('/queue')), promptId)
  if (!current) return finishedState(promptId, request)

  // New ComfyUI versions cancel by ID atomically. Older versions use /interrupt or /queue.
  const direct = await request(`/api/jobs/${encodeURIComponent(promptId)}/cancel`, { method: 'POST' })
  if (direct.status !== 404 && direct.status !== 405) {
    const result = await readResponse(direct) as { cancelled?: unknown }
    return result?.cancelled === true ? { cancelled: true, state: current } : finishedState(promptId, request)
  }

  // Recheck immediately before the legacy operation so a completed job does not
  // interrupt the next queued job through an older global /interrupt endpoint.
  const latest = queueState(await readResponse(await request('/queue')), promptId)
  if (!latest) return finishedState(promptId, request)
  const path = latest === 'running' ? '/interrupt' : '/queue'
  const body = latest === 'running' ? { prompt_id: promptId } : { delete: [promptId] }
  await readResponse(await request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
  return { cancelled: true, state: latest }
}
