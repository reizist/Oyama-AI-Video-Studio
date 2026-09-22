import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Clipboard, Clock3, Copy, Eraser, FileText, LoaderCircle, MessageSquareText, RefreshCw, RotateCcw, Sparkles, WandSparkles } from 'lucide-react'
import { promptMarkupLegend } from '../lib/h3SceneCompiler'
import { compileScratchpad, type ScratchpadTarget } from '../lib/scratchpadCompiler'
import type { OllamaModel } from '../types'
import { H3PromptEditor } from './H3PromptEditor'

const STORAGE_KEY = 'oyama.prompt-scratchpad.v1'
const targets: Array<{ id: ScratchpadTarget; label: string; note: string }> = [
  { id: 'h3', label: 'MiniMax H3', note: 'Official multimodal fields' },
  { id: 'ltx25', label: 'LTX 2.5', note: 'Natural video direction' },
  { id: 'image', label: 'Create Image', note: 'Still-image direction' },
  { id: 'music', label: 'Music', note: 'Score and production direction' },
]

function loadDraft() {
  try { return localStorage.getItem(STORAGE_KEY) ?? '' } catch { return '' }
}

const toolInstructions = {
  refine: 'Rewrite this as a polished, production-ready prompt. Preserve every intentional fact, remove repetition, and return only the revised prompt.',
  expand: 'Expand this prompt with concrete subject action, composition, camera, environment, lighting, physical continuity, and sound where appropriate. Do not change its intent. Return only the revised prompt.',
  concise: 'Condense this prompt without losing identity, continuity, camera, action, lighting, or audio constraints. Return only the revised prompt.',
  structure: `Convert this prompt into the canonical authoring sections ${promptMarkupLegend.map(item => item.tag).join(', ')}. Use only relevant sections, place each tag on its own line, and return only the tagged prompt.`,
  timeline: 'Rewrite this as an achievable timed shot plan for a short generated video. Keep actions physically coherent and cuts readable. Return only the revised prompt.',
  audio: 'Improve only dialogue, ambience, foley, synchronization, and non-diegetic music direction. Preserve the visual intent. Return the complete revised prompt only.',
} as const

export function ScratchpadWorkspace({ provider, url, model, models, available, checking, connectionError, onRefresh, onModelChange, onSend, onNotice }: { provider: 'ollama' | 'lmstudio'; url: string; model: string; models: OllamaModel[]; available: boolean; checking: boolean; connectionError?: string; onRefresh(): void; onModelChange(model: string): void; onSend(target: ScratchpadTarget, authored: string, compiled: string): void; onNotice(tone: 'error' | 'success' | 'neutral', text: string): void }) {
  const [draft, setDraft] = useState(loadDraft)
  const [target, setTarget] = useState<ScratchpadTarget>('h3')
  const [duration, setDuration] = useState(5)
  const [busy, setBusy] = useState<keyof typeof toolInstructions | null>(null)
  const [completionEnabled, setCompletionEnabled] = useState(true)
  const [completion, setCompletion] = useState('')
  const [completionStatus, setCompletionStatus] = useState<'idle' | 'waiting' | 'working' | 'error'>('idle')
  const [completionError, setCompletionError] = useState('')
  const [beforeAi, setBeforeAi] = useState('')
  const [copied, setCopied] = useState(false)
  const completionRevision = useRef(0)
  const compiled = useMemo(() => compileScratchpad(draft, target, duration), [draft, duration, target])
  const selectedModel = models.some(item => item.name === model) ? model : models[0]?.name ?? ''
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, draft) } catch { /* Draft remains available for this session. */ } }, [draft])
  useEffect(() => {
    setCompletion('')
    setCompletionError('')
    if (!completionEnabled || !available || !selectedModel || draft.trim().length < 32 || busy) { setCompletionStatus('idle'); return }
    setCompletionStatus('waiting')
    const revision = ++completionRevision.current
    const timer = window.setTimeout(async () => {
      setCompletionStatus('working')
      try {
        const result = await window.minimax.generateWithOllama(url, selectedModel, `Continue the prompt below with one useful next phrase or sentence, at most 30 words. Match its style and do not repeat existing text. Return only the continuation, with no quotes or Markdown.\n\n${draft.slice(-2400)}`, provider)
        if (completionRevision.current === revision) { setCompletion(result.trim().replace(/^(?:continuation\s*:\s*|["'])|["']$/gi, '')); setCompletionStatus('idle') }
      } catch (error) {
        if (completionRevision.current === revision) { setCompletion(''); setCompletionStatus('error'); setCompletionError(error instanceof Error ? error.message : String(error)) }
      }
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [available, busy, completionEnabled, draft, provider, selectedModel, url])

  const runTool = async (tool: keyof typeof toolInstructions) => {
    if (!draft.trim() || !available || busy) return
    setBusy(tool); setCompletion('')
    try {
      const result = await window.minimax.generateWithOllama(url, selectedModel, `${toolInstructions[tool]}\n\nTarget: ${targets.find(item => item.id === target)?.label}\nDuration: ${duration} seconds\n\nSOURCE PROMPT\n${draft}`, provider)
      setBeforeAi(draft); setDraft(result.trim())
      onNotice('success', `${tool[0].toUpperCase() + tool.slice(1)} pass applied. You can undo it in Scratchpad.`)
    } catch (error) { onNotice('error', `Local prompt tool failed: ${error instanceof Error ? error.message : String(error)}`) }
    finally { setBusy(null) }
  }
  const acceptCompletion = () => { if (!completion) return; setDraft(current => `${current}${/\s$/.test(current) ? '' : ' '}${completion}`); setCompletion('') }
  const copyCompiled = async () => {
    await navigator.clipboard.writeText(compiled)
    setCopied(true); window.setTimeout(() => setCopied(false), 1400)
  }

  return <div className="scratchpad-workspace">
    <header className="scratchpad-hero"><div><span className="scratchpad-kicker"><Sparkles size={13} />Prompt workshop</span><h1>Scratchpad</h1><p>Write freely, shape ideas with your local model, inspect the final payload, then send it directly into a production workspace.</p></div><div className={`scratchpad-status ${connectionError ? 'error' : ''}`} role="status" aria-live="polite"><i className={available ? 'ready' : ''} /><span><strong>{checking ? `Checking ${provider === 'ollama' ? 'Ollama' : 'LM Studio'}…` : available ? selectedModel : 'Local model offline'}</strong><small>{available ? `${provider === 'ollama' ? 'Ollama' : 'LM Studio'} · ${models.length} local model${models.length === 1 ? '' : 's'} ready` : connectionError || 'Connect a provider in Settings'}</small></span><button type="button" onClick={onRefresh} disabled={checking} title={`Refresh ${provider === 'ollama' ? 'Ollama' : 'LM Studio'} connection`} aria-label={`Refresh ${provider === 'ollama' ? 'Ollama' : 'LM Studio'} connection`}>{checking ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}</button></div></header>
    <div className="scratchpad-layout">
      <section className="scratchpad-canvas">
        <header><div><FileText size={16} /><span><strong>Draft</strong><small>{words} words · {draft.length.toLocaleString()} characters · saved locally</small></span></div><div><button type="button" disabled={!beforeAi} onClick={() => { setDraft(beforeAi); setBeforeAi('') }}><RotateCcw size={14} />Undo AI</button><button type="button" disabled={!draft} onClick={() => { if (window.confirm('Clear the Scratchpad draft?')) { setDraft(''); setBeforeAi('') } }}><Eraser size={14} />Clear</button></div></header>
        <H3PromptEditor value={draft} onChange={setDraft} ariaLabel="Scratchpad prompt" placeholder="Start with an idea, or type ## for structured H3 sections…" completion={completion} onAcceptCompletion={acceptCompletion} />
        {(completionStatus === 'waiting' || completionStatus === 'working' || completionStatus === 'error') && <div className={`scratchpad-completion-status ${completionStatus === 'error' ? 'error' : ''}`} role="status" aria-live="polite">{completionStatus === 'error' ? <><span>Inline autocomplete could not reach {provider === 'ollama' ? 'Ollama' : 'LM Studio'}: {completionError}</span><button type="button" onClick={onRefresh}>Reconnect</button></> : <><LoaderCircle className="spin" size={12} /><span>{completionStatus === 'waiting' ? 'Autocomplete queued…' : `${provider === 'ollama' ? 'Ollama' : 'LM Studio'} is writing locally…`}</span></>}</div>}
        <footer><span>Type <code>##</code> for tags · right-click for the tag menu</span><label><input type="checkbox" checked={completionEnabled} onChange={event => setCompletionEnabled(event.target.checked)} />Local inline autocomplete</label></footer>
      </section>
      <aside className="scratchpad-tools">
        <section><header><WandSparkles size={15} /><span><strong>Local writing tools</strong><small>Edits stay on this computer</small></span></header><div className="scratchpad-tool-grid">{([
          ['refine', 'Refine', 'Polish and clarify'], ['expand', 'Expand', 'Add production detail'], ['concise', 'Condense', 'Tighten without loss'], ['structure', 'Add H3 tags', 'Create clean sections'], ['timeline', 'Shot timeline', 'Build timed action'], ['audio', 'Audio pass', 'Sound and dialogue'],
        ] as const).map(([id, label, note]) => <button type="button" key={id} disabled={!available || !draft.trim() || Boolean(busy)} onClick={() => void runTool(id)}>{busy === id ? <LoaderCircle className="spin" size={15} /> : id === 'audio' ? <MessageSquareText size={15} /> : id === 'timeline' ? <Clock3 size={15} /> : <Sparkles size={15} />}<span><strong>{label}</strong><small>{note}</small></span></button>)}</div></section>
        <section className="scratchpad-model"><label><span>Writing model</span><select value={selectedModel} disabled={!models.length} onChange={event => onModelChange(event.target.value)}>{models.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label><small>{models.length ? `${provider === 'ollama' ? 'Ollama' : 'LM Studio'} is connected at ${url}` : 'Refresh the connection after starting your local model server.'}</small></section>
      </aside>
      <section className="scratchpad-compiler">
        <header><div><Clipboard size={16} /><span><strong>Compiled prompt</strong><small>Exact destination-ready output</small></span></div><button type="button" disabled={!compiled} onClick={() => void copyCompiled()}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}</button></header>
        <div className="scratchpad-destinations" role="tablist" aria-label="Compile destination">{targets.map(item => <button type="button" role="tab" aria-selected={target === item.id} className={target === item.id ? 'active' : ''} key={item.id} onClick={() => setTarget(item.id)}><strong>{item.label}</strong><small>{item.note}</small></button>)}</div>
        {target === 'h3' && <label className="scratchpad-duration"><span>Clip duration</span><input type="number" min={1} max={60} value={duration} onChange={event => setDuration(Math.max(1, Math.min(60, Number(event.target.value) || 1)))} /><small>seconds</small></label>}
        <pre>{compiled || 'Your compiled prompt will appear here.'}</pre>
        <footer><span>{target === 'h3' ? 'Tagged source remains editable; H3 recompiles it authoritatively when rendering.' : 'Structured tags are flattened for this destination.'}</span><button type="button" className="primary-button" disabled={!draft.trim()} onClick={() => onSend(target, draft, compiled)}>Send to {targets.find(item => item.id === target)?.label}<ArrowRight size={15} /></button></footer>
      </section>
    </div>
  </div>
}
