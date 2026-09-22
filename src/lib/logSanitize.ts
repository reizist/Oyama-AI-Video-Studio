/**
 * Produces a short, technical-only error summary for UI fallbacks and logs.
 * Generation errors can include a user's prompt, so raw error messages must
 * never be rendered by the global crash handler.
 */
export type SanitizedError = { name: string; reason: string; path: string }

const MAX_LENGTH = 200
const REDACTED = '[details redacted]'
const TECHNICAL_FRAGMENT = /\b(?:node|comfyui|workflow|cuda|vram|gpu|oom|timeout|failed|error|invalid|missing|connection|refused|reset|aborted|cancelled|status|http|https|ws|json|ffmpeg|python|ollama|econnrefused|etimedout|enoent|eacces)\b|\b\d+(?:\.\d+)?\b|\b[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*\b|\b[A-Za-z_][A-Za-z0-9]*_[A-Za-z0-9_]+\b|\b[A-Za-z]:\\[^\s]+|\/[\w.@-]+(?:\/[\w.@-]+)+/gi

export function sanitizeErrorMessage(message: string): string {
  if (!message) return ''
  const fragments = message.match(TECHNICAL_FRAGMENT) ?? []
  const summary = fragments.join(' ').replace(/\s+/g, ' ').trim()
  return (summary || REDACTED).slice(0, MAX_LENGTH)
}

export function sanitizeError(error: unknown): SanitizedError {
  const source = error !== null && typeof error === 'object'
    ? error as { name?: unknown; message?: unknown; stack?: unknown }
    : undefined
  const name = typeof source?.name === 'string' && source.name ? source.name : error instanceof Error ? error.name : 'Error'
  const message = typeof source?.message === 'string' ? source.message : typeof error === 'string' ? error : ''
  const stack = typeof source?.stack === 'string' ? source.stack : ''
  const frame = stack.split('\n').find((line) => /^\s*at\s+.*:\d+:\d+\)?\s*$/.test(line))
  const path = frame?.replace(/^\s*at\s+/, '').trim() ?? ''
  return { name, reason: sanitizeErrorMessage(message), path: path.slice(0, MAX_LENGTH) }
}
