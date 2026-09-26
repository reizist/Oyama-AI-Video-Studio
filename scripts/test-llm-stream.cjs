const assert = require('node:assert/strict')
const { load } = require('./test-ts-loader.cjs')
const { readLlmStream } = load('electron/llmStream.ts')
const { normalizeInlineSuggestion } = load('src/lib/inlineSuggestion.ts')

function stream(parts) {
  const encoder = new TextEncoder()
  return new ReadableStream({ start(controller) { parts.forEach(part => controller.enqueue(encoder.encode(part))); controller.close() } })
}

async function main() {
  const lmUpdates = []
  const lm = await readLlmStream(stream(['data: {"choices":[{"delta":{"reasoning_content":"Check', ' scene"}}]}\n\n', 'data: {"choices":[{"delta":{"content":"{\\"direction\\":\\"Shot\\"}"}}]}\n\ndata: [DONE]\n\n']), 'lmstudio', update => lmUpdates.push(update))
  assert.equal(lm.thinking, 'Check scene')
  assert.equal(lm.content, '{"direction":"Shot"}')
  assert.equal(lmUpdates.length, 2)
  const ollama = await readLlmStream(stream(['{"message":{"thinking":"Plan"}}\n{"message":{"content":"Result"}}\n']), 'ollama', () => {})
  assert.equal(ollama.thinking, 'Plan')
  assert.equal(ollama.content, 'Result')
  assert.equal(normalizeInlineSuggestion('Suggestion: with soft light\nand a second line'), 'with soft light')
  assert.equal(normalizeInlineSuggestion('##scene\nMore text'), '')
  assert.ok(!normalizeInlineSuggestion('A'.repeat(300)).includes('\n'))
  assert.ok(normalizeInlineSuggestion('A'.repeat(300)).length <= 160)
  process.stdout.write('PASS: split LM Studio/Ollama reasoning streams and single-line inline suggestions\n')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
