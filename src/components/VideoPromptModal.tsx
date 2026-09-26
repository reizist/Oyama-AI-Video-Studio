import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, Clock3, Search, WandSparkles, X } from 'lucide-react'
import { findPromptCommands, promptPresetCategories } from '../lib/promptPresets'
import type { PromptPreset, PromptPresetCategory } from '../types'
import { H3PromptEditor, type H3PromptEditorHandle, type ProductionCommandTrigger } from './H3PromptEditor'

type VideoPromptModalProps = {
  value: string
  promptingTool: 'enhance' | 'timeline' | 'audio' | null
  onChange(value: string): void
  onPromptTool(tool: 'enhance' | 'timeline' | 'audio'): void
  onClose(): void
}

export function VideoPromptModal({ value, promptingTool, onChange, onPromptTool, onClose }: VideoPromptModalProps) {
  const editorRef = useRef<H3PromptEditorHandle>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const [commandTrigger, setCommandTrigger] = useState<ProductionCommandTrigger | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | PromptPresetCategory>('all')
  const [active, setActive] = useState(0)
  const results = useMemo(() => findPromptCommands(query, category), [category, query])

  useEffect(() => { setActive(0) }, [category, query])
  useEffect(() => {
    const timer = window.setTimeout(() => editorRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [])
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || commandTrigger) return
      onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [commandTrigger, onClose])

  const handleCommandTrigger = (next: ProductionCommandTrigger | null) => {
    setCommandTrigger(next)
    if (next) setQuery(next.query)
  }
  const insertCommand = (item: PromptPreset) => {
    editorRef.current?.insertText(item.insertion, commandTrigger ? { start: commandTrigger.start, end: commandTrigger.end } : undefined)
    setCommandTrigger(null)
    setQuery('')
  }
  const handleEditorKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (!commandTrigger) return false
    if (event.key === 'ArrowDown' && results.length) { event.preventDefault(); setActive(index => (index + 1) % results.length); return true }
    if (event.key === 'ArrowUp' && results.length) { event.preventDefault(); setActive(index => (index - 1 + results.length) % results.length); return true }
    if ((event.key === 'Enter' || event.key === 'Tab') && results[active]) { event.preventDefault(); insertCommand(results[active]); return true }
    if (event.key === 'Escape') { event.preventDefault(); setCommandTrigger(null); setQuery(''); return true }
    return false
  }
  const trapFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab' || event.defaultPrevented) return
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? [])
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  return createPortal(<div className="video-prompt-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="video-prompt-modal" role="dialog" aria-modal="true" aria-labelledby="video-prompt-modal-title" onKeyDown={trapFocus}>
      <header className="video-prompt-modal-header">
        <span><strong id="video-prompt-modal-title">Prompt workspace</strong><small>Write at full size and insert production language. The exact render prompt is in Scene details → Compiled.</small></span>
        <div>
          <button type="button" onClick={() => onPromptTool('timeline')} disabled={Boolean(promptingTool)}><Clock3 size={15} />{promptingTool === 'timeline' ? 'Building…' : 'Timeline'}</button>
          <button type="button" onClick={() => onPromptTool('enhance')} disabled={Boolean(promptingTool)}><WandSparkles size={15} />{promptingTool === 'enhance' ? 'Improving…' : 'Improve'}</button>
          <button type="button" className="video-prompt-modal-close" onClick={onClose} aria-label="Close large prompt editor"><X size={18} /></button>
        </div>
      </header>
      <div className="video-prompt-modal-body">
        <main className="video-prompt-modal-editor">
          <div className="video-prompt-modal-hints"><span><code>##</code> structured H3 tags</span><span><code>//</code> production commands</span><span>{value.length.toLocaleString()} characters</span></div>
          <H3PromptEditor ref={editorRef} idPrefix="video-prompt-modal" value={value} onChange={onChange} ariaLabel="Large video prompt editor" placeholder="Describe the scene. Type ## for H3 sections or // for production commands…" onProductionCommandChange={handleCommandTrigger} onProductionCommandKeyDown={handleEditorKeyDown} />
        </main>
        <aside className="video-prompt-command-sidebar" aria-label="Production command browser">
          <header><span><strong><code>//</code> Production commands</strong><small>{commandTrigger ? 'Keep typing to filter; Enter inserts.' : 'Browse or type // in the editor.'}</small></span><em>{results.length}</em></header>
          <label className="video-prompt-command-search"><Search size={14} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search camera, lens, lighting…" aria-label="Search production commands" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear command search"><X size={12} /></button>}</label>
          <div className="video-prompt-command-categories" role="group" aria-label="Command category">
            <button type="button" className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>All</button>
            {promptPresetCategories.map(item => <button type="button" className={category === item.id ? 'active' : ''} key={item.id} onClick={() => setCategory(item.id)}>{item.label}</button>)}
          </div>
          <div className="video-prompt-command-results" role="listbox" aria-label="Production commands">
            {results.map((item, index) => <button type="button" role="option" aria-selected={index === active} className={index === active ? 'active' : ''} key={item.id} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => insertCommand(item)}><span><strong>{item.label}</strong><em>{item.category}</em></span><small>{item.description}</small>{index === active && commandTrigger && <kbd>Enter</kbd>}</button>)}
            {!results.length && <div className="video-prompt-command-empty"><Search size={20} /><strong>No matching commands</strong><small>Try camera, orbit, lighting, dialogue, continuity, or lens.</small></div>}
          </div>
          <footer><Check size={13} /><span>Commands insert at the cursor and remain editable.</span></footer>
        </aside>
      </div>
    </section>
  </div>, document.body)
}
