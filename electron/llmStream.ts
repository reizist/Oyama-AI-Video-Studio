import { TextDecoder } from 'node:util'

export type LlmStreamUpdate = { thinking: string; content: string }

// Both providers frame JSON incrementally. Keep partial lines between reads so
// a network chunk cannot turn a valid event into a dropped fragment.
export async function readLlmStream(body: ReadableStream<Uint8Array>, provider: 'ollama' | 'lmstudio', onUpdate: (update: LlmStreamUpdate) => void): Promise<LlmStreamUpdate> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  let thinking = ''
  let content = ''
  const consume = (line: string) => {
    const raw = provider === 'lmstudio' ? line.replace(/^data:\s*/, '') : line
    if (!raw || raw === '[DONE]' || (provider === 'lmstudio' && !line.startsWith('data:'))) return
    const item = JSON.parse(raw) as {
      error?: string | { message?: string }
      choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>
      message?: { content?: string; thinking?: string }
      response?: string
      thinking?: string
    }
    if (item.error) throw new Error(typeof item.error === 'string' ? item.error : item.error.message ?? 'Local model stream failed.')
    const nextThinking = provider === 'lmstudio' ? item.choices?.[0]?.delta?.reasoning_content ?? '' : item.message?.thinking ?? item.thinking ?? ''
    const nextContent = provider === 'lmstudio' ? item.choices?.[0]?.delta?.content ?? '' : item.message?.content ?? item.response ?? ''
    thinking += nextThinking
    content += nextContent
    if (nextThinking || nextContent) onUpdate({ thinking, content })
  }
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      pending += decoder.decode(value, { stream: true })
      const lines = pending.split(/\r?\n/)
      pending = lines.pop() ?? ''
      for (const line of lines) consume(line.trim())
    }
    pending += decoder.decode()
    if (pending.trim()) consume(pending.trim())
    return { thinking, content }
  } finally {
    reader.releaseLock()
  }
}
