export type SolRuntimeState = 'unavailable' | 'warmup' | 'sparse' | 'declined' | 'failed'

export type SolRuntimeDiagnostics = {
  state: SolRuntimeState
  backend?: string
  sparseCalls?: number
  denseCalls?: number
  sparseFraction?: number
  density?: number
  step?: number
  steps?: number
  denseSteps?: number
  denseLayers?: number
  sink?: number
  sequenceLength?: number
  tau?: number
  correctnessGate?: 'PASS' | 'FAIL'
  declineReason?: string
}

const numberAfter = (text: string, expression: RegExp) => {
  const match = text.match(expression)
  return match ? Number(match[1].replace(/,/g, '')) : undefined
}

/**
 * SolAttn writes its instrumentation to the ComfyUI process log, and some
 * custom-node versions also surface those lines in execution messages. Keep
 * parsing deliberately permissive so a minor wording change does not turn a
 * dense warmup into a misleading error in the Studio UI.
 */
export function parseSolRuntimeDiagnostics(raw: string): SolRuntimeDiagnostics {
  const text = raw.replace(/\s+/g, ' ').trim()
  const lower = text.toLowerCase()
  const sparseCalls = numberAfter(text, /sparse(?:\s+calls?)?\s*[=:]\s*(\d[\d,]*)/i)
  const denseCalls = numberAfter(text, /dense(?:\s+calls?)?\s*[=:]\s*(\d[\d,]*)/i)
  const sparseFraction = numberAfter(text, /(?:sparse[_\s-]*(?:fraction|ratio)|sparse\s*%)\s*[=:]\s*([\d.]+)/i)
  const density = numberAfter(text, /(?:routing\s*)?density\s*[=:]\s*([\d.]+)/i)
  const step = numberAfter(text, /step\s*[=:]?\s*(\d+)\s*(?:\/|of)\s*\d+/i)
  const steps = numberAfter(text, /step\s*[=:]?\s*\d+\s*(?:\/|of)\s*(\d+)/i)
  const denseSteps = numberAfter(text, /(?:first_)?dense[_\s-]*steps?\s*[=:]\s*([\d.]+)/i)
  const denseLayers = numberAfter(text, /(?:first_)?dense[_\s-]*layers?\s*[=:]\s*(\d+)/i)
  const sink = numberAfter(text, /sink(?:\s+(?:prefix|rows?))?\s*[=:]\s*(\d[\d,]*)/i)
  const sequenceLength = numberAfter(text, /(?:seq(?:uence)?(?:\s+len(?:gth)?)?)\s*[=:]\s*(\d[\d,]*)/i)
  const tau = numberAfter(text, /tau\s*[=:]\s*([\d.]+)/i)
  const gate = /correctness(?:\s+gate)?\s*(?:=|:)?\s*pass\b/i.test(text) ? 'PASS' as const : /correctness(?:\s+gate)?\s*(?:=|:)?\s*fail\b/i.test(text) ? 'FAIL' as const : undefined
  const decline = text.match(/(?:sparse\s+)?(?:declined|fallback)(?:\s*[:=-]\s*|\s+because\s+)([^|;]+)/i)?.[1]?.trim()
  const backend = text.match(/backend\s*[=:]\s*([\w.-]+)/i)?.[1]
  const state: SolRuntimeState = gate === 'FAIL' ? 'failed'
    : decline ? 'declined'
      : sparseCalls && sparseCalls > 0 ? 'sparse'
        : /warmup|first[_\s-]*dense|dense fallback/i.test(lower) ? 'warmup'
          : 'unavailable'
  return { state, backend, sparseCalls, denseCalls, sparseFraction, density, step, steps, denseSteps, denseLayers, sink, sequenceLength, tau, correctnessGate: gate, declineReason: decline }
}

export function solRuntimeLabel(diagnostics: SolRuntimeDiagnostics) {
  if (diagnostics.state === 'sparse') return diagnostics.correctnessGate === 'PASS' ? 'Sparse active · correctness gate passed' : 'Sparse active'
  if (diagnostics.state === 'warmup') return 'Warmup / dense fallback'
  if (diagnostics.state === 'declined') return `Sparse declined${diagnostics.declineReason ? ` · ${diagnostics.declineReason}` : ''}`
  if (diagnostics.state === 'failed') return 'Correctness gate failed · dense fallback required'
  return 'No Sol runtime statistics received yet'
}
