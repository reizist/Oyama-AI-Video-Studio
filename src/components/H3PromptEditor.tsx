import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Check, ChevronRight, Hash } from 'lucide-react'
import { promptMarkupLegend } from '../lib/h3SceneCompiler'

type PromptTag = (typeof promptMarkupLegend)[number]

export type ProductionCommandTrigger = { start: number; end: number; query: string }
export type H3PromptEditorHandle = {
  focus(): void
  insertText(text: string, range?: { start: number; end: number }): void
}

type H3PromptEditorProps = {
  value: string
  onChange(value: string): void
  ariaLabel?: string
  placeholder?: string
  completion?: string
  onAcceptCompletion?(): void
  idPrefix?: string
  onProductionCommandChange?(trigger: ProductionCommandTrigger | null): void
  onProductionCommandKeyDown?(event: ReactKeyboardEvent<HTMLTextAreaElement>): boolean | void
}

function tagAtCursor(value: string, cursor: number) {
  const lineStart = value.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1
  const beforeCursor = value.slice(lineStart, cursor)
  const match = beforeCursor.match(/^\s*##\s*([a-z-]*)$/i)
  return match ? { start: lineStart + beforeCursor.indexOf('##'), query: match[1].toLowerCase() } : null
}

function productionCommandAtCursor(value: string, cursor: number): ProductionCommandTrigger | null {
  const beforeCursor = value.slice(0, cursor)
  const match = beforeCursor.match(/(?:^|\s)\/\/([^\n\r/]*)$/)
  if (!match) return null
  const tokenLength = match[1].length + 2
  return { start: cursor - tokenLength, end: cursor, query: match[1].trimStart() }
}

function existingTag(value: string, tag: string) {
  const escaped = tag.slice(2).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`^\\s*##\\s*${escaped}\\s*(?:$|:)`, 'im').exec(value)
  return match ? { start: match.index, end: match.index + match[0].length } : null
}

export const H3PromptEditor = forwardRef<H3PromptEditorHandle, H3PromptEditorProps>(function H3PromptEditor({ value, onChange, ariaLabel = 'Video prompt', placeholder, completion = '', onAcceptCompletion, idPrefix = 'h3-prompt', onProductionCommandChange, onProductionCommandKeyDown }, forwardedRef) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [trigger, setTrigger] = useState<{ start: number; query: string } | null>(null)
  const [active, setActive] = useState(0)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const matches = useMemo(() => promptMarkupLegend.filter(item => item.tag.slice(2).includes(trigger?.query ?? '')), [trigger?.query])

  useEffect(() => setActive(0), [trigger?.query])
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('pointerdown', close)
    window.addEventListener('blur', close)
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('blur', close) }
  }, [contextMenu])

  const updateTrigger = (textarea: HTMLTextAreaElement) => {
    const tagTrigger = tagAtCursor(textarea.value, textarea.selectionStart)
    setTrigger(tagTrigger)
    onProductionCommandChange?.(tagTrigger ? null : productionCommandAtCursor(textarea.value, textarea.selectionStart))
  }
  const placeCursor = (start: number, end = start) => requestAnimationFrame(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    textarea.setSelectionRange(start, end)
  })
  const insertTag = (item: PromptTag, replaceTrigger = false) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const existing = existingTag(value, item.tag)
    if (existing && !(replaceTrigger && trigger && existing.start === trigger.start)) {
      setTrigger(null); setContextMenu(null)
      placeCursor(existing.end + (value[existing.end] === '\n' ? 1 : 0))
      return
    }
    const start = replaceTrigger && trigger ? trigger.start : textarea.selectionStart
    const end = replaceTrigger && trigger ? textarea.selectionStart : textarea.selectionEnd
    const before = value.slice(0, start)
    const after = value.slice(end)
    const prefix = before && !before.endsWith('\n\n') ? before.endsWith('\n') ? '\n' : '\n\n' : ''
    const suffix = after ? after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n' : ''
    const insertion = `${prefix}${item.tag}\n${suffix}`
    const next = `${before}${insertion}${after}`
    onChange(next)
    setTrigger(null); setContextMenu(null)
    placeCursor(start + prefix.length + item.tag.length + 1)
  }
  useImperativeHandle(forwardedRef, () => ({
    focus: () => textareaRef.current?.focus(),
    insertText: (text, range) => {
      const textarea = textareaRef.current
      if (!textarea) return
      const start = range?.start ?? textarea.selectionStart
      const end = range?.end ?? textarea.selectionEnd
      const before = value.slice(0, start)
      const after = value.slice(end)
      const prefix = before && !/\s$/.test(before) ? ' ' : ''
      const suffix = after && !/^\s/.test(after) ? ' ' : ''
      onChange(`${before}${prefix}${text}${suffix}${after}`)
      setTrigger(null)
      onProductionCommandChange?.(null)
      placeCursor(start + prefix.length + text.length + suffix.length)
    },
  }), [onChange, onProductionCommandChange, value])
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (!trigger || !matches.length) {
      if (onProductionCommandKeyDown?.(event)) return
      if (event.key === 'Tab' && completion && onAcceptCompletion) { event.preventDefault(); onAcceptCompletion() }
      return
    }
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(index => (index + 1) % matches.length) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => (index - 1 + matches.length) % matches.length) }
    else if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); insertTag(matches[active], true) }
    else if (event.key === 'Escape') { event.preventDefault(); setTrigger(null) }
  }

  return <div className="h3-prompt-editor">
    <textarea ref={textareaRef} aria-label={ariaLabel} aria-autocomplete="list" aria-expanded={Boolean(trigger)} aria-controls={trigger ? `${idPrefix}-tag-options` : undefined} aria-activedescendant={trigger && matches[active] ? `${idPrefix}-tag-${matches[active].tag.slice(2)}` : undefined} value={value} onChange={event => { onChange(event.target.value); updateTrigger(event.currentTarget) }} onClick={event => updateTrigger(event.currentTarget)} onKeyUp={event => { if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) updateTrigger(event.currentTarget) }} onKeyDown={handleKeyDown} onBlur={event => { if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) setTrigger(null) }} onContextMenu={event => { event.preventDefault(); textareaRef.current?.setSelectionRange(event.currentTarget.selectionStart, event.currentTarget.selectionEnd); setTrigger(null); onProductionCommandChange?.(null); setContextMenu({ x: event.clientX, y: event.clientY }) }} placeholder={placeholder} />
    {trigger && <div id={`${idPrefix}-tag-options`} className="h3-tag-autocomplete" role="listbox" aria-label="Prompt tags">
      <div className="h3-tag-autocomplete-title"><Hash size={13} /><span>{matches.length ? 'Insert prompt tag' : 'No matching prompt tag'}</span><kbd>Esc</kbd></div>
      {matches.map((item, index) => <button type="button" id={`${idPrefix}-tag-${item.tag.slice(2)}`} role="option" aria-selected={index === active} className={index === active ? 'active' : ''} key={item.tag} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => insertTag(item, true)}><code>{item.tag}</code><span>{item.description}</span>{existingTag(value, item.tag) && <em><Check size={11} />Added</em>}</button>)}
      {matches.length > 0 && <footer><span>↑↓ choose</span><span>Enter or Tab insert</span></footer>}
    </div>}
    {contextMenu && <div className="h3-tag-context-menu" role="menu" aria-label="Insert prompt tag" style={{ left: Math.min(contextMenu.x, window.innerWidth - 290), top: Math.min(contextMenu.y, window.innerHeight - 310) }} onPointerDown={event => event.stopPropagation()}>
      <header><Hash size={14} /><span>Insert prompt tag</span></header>
      {promptMarkupLegend.map(item => { const exists = existingTag(value, item.tag); return <button type="button" role="menuitem" key={item.tag} onClick={() => insertTag(item)}><code>{item.tag}</code><span>{exists ? 'Go to section' : item.description}</span>{exists ? <Check size={13} /> : <ChevronRight size={13} />}</button> })}
    </div>}
    {completion && <button type="button" className="h3-inline-completion" onClick={onAcceptCompletion}><span>Local autocomplete</span><p>{completion}</p><kbd>Tab to accept</kbd></button>}
  </div>
})
