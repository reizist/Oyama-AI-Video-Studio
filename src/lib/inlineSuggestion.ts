export function normalizeInlineSuggestion(answer: string) {
  const firstLine = answer.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? ''
  const cleaned = firstLine.replace(/^(?:continuation|suggestion)\s*:\s*/i, '').replace(/^[\s'"“]+|[\s'"”]+$/g, '').trim()
  if (!cleaned || /^(?:##|\/\/|[-*]\s)/.test(cleaned)) return ''
  return cleaned.slice(0, 160).trimEnd()
}
