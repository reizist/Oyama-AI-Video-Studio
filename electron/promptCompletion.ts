export type PromptCompletionProvider = 'ollama' | 'lmstudio'

export function buildPromptCompletionRequest(provider: PromptCompletionProvider, model: string, context: string) {
  const excerpt = context.slice(-1800)
  const instruction = `Complete the user's MiniMax H3 video direction with one short, useful continuation of at most 18 words. Return exactly one line of new text to append, without repeating existing words, headings, markdown, or explanation. Keep the same language and style. Existing direction:\n${excerpt}`
  return provider === 'lmstudio'
    ? { path: '/chat/completions', body: { model, messages: [{ role: 'user', content: instruction }], stream: false, temperature: 0.4, max_tokens: 72, reasoning_effort: 'none' } }
    : { path: '/api/generate', body: { model, prompt: instruction, stream: false, keep_alive: '10m', think: false, options: { temperature: 0.4, num_predict: 72 } } }
}
