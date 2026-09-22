import { useRef, useState, type KeyboardEvent } from 'react'
import { ArrowRight, Check, FolderOpen, HelpCircle, Search, RotateCcw } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui'
import { findWorkspaces, workspaceLabel, type MusicEngine } from '../lib/workspaceNavigation'
import type { View } from '../types'
import './workspace-navigator.css'

export function WorkspaceNavigator({ open, onOpenChange, view, engine, onNavigate, onProjects, onTips, onFind, onReset }: {
  open: boolean; onOpenChange(open: boolean): void; view: View; engine: MusicEngine
  onNavigate(view: View, engine?: MusicEngine): void; onProjects(): void; onTips(): void; onFind(): void
  onReset?: () => void
}) {
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const results = findWorkspaces(query)
  const groups = [...new Set(results.map(item => item.group))]
  const run = (action: () => void) => { onOpenChange(false); action() }
  const moveFocus = (event: KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return
    const buttons = Array.from(content.current?.querySelectorAll<HTMLButtonElement>('[data-workspace-result]') ?? [])
    if (!buttons.length) return
    event.preventDefault()
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = index < 0 ? (event.key === 'ArrowDown' ? 0 : buttons.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
    buttons[next].focus()
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="workspace-navigator" onOpenAutoFocus={event => { event.preventDefault(); setQuery(''); input.current?.focus() }} onCloseAutoFocus={event => {
      event.preventDefault()
      if (document.querySelector('[role="dialog"][aria-modal="true"]:not(.workspace-navigator)')) return
      Array.from(document.querySelectorAll<HTMLButtonElement>('[data-workspace-trigger]')).find(button => button.getClientRects().length > 0)?.focus()
    }}>
      <header><DialogTitle>Workspaces</DialogTitle><DialogDescription>Choose a tool for your next step. Currently in {workspaceLabel(view, engine)}.</DialogDescription></header>
      <label className="workspace-navigator-search"><Search size={18} /><input ref={input} type="search" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { moveFocus(event); if (event.key === 'Enter' && results[0]) { event.preventDefault(); run(() => onNavigate(results[0].view, results[0].engine)) } }} placeholder="Find a tool or describe a task…" aria-label="Search workspaces" /></label>
      <div className="workspace-navigator-results" ref={content} onKeyDown={moveFocus}>
        {groups.map(group => <section key={group} aria-label={group}><h2>{group}</h2><div>{results.filter(item => item.group === group).map(item => {
          const active = item.view === view && (!item.engine || item.engine === engine)
          return <button type="button" key={`${item.view}-${item.engine ?? ''}`} data-workspace-result aria-current={active ? 'page' : undefined} onClick={() => run(() => onNavigate(item.view, item.engine))}><span><strong>{item.label}</strong><small>{item.description}</small></span>{active ? <Check size={17} aria-label="Current workspace" /> : <ArrowRight size={17} aria-hidden="true" />}</button>
        })}</div></section>)}
        {!results.length && <p role="status">No matching workspaces. Try “video”, “music”, “trim”, or “settings”. <button type="button" onClick={() => { setQuery(''); input.current?.focus() }}>Clear search</button></p>}
      </div>
      <footer><button type="button" onClick={() => run(onProjects)}><FolderOpen size={16} />Projects</button><button type="button" onClick={() => run(onTips)}><HelpCircle size={16} />Workspace tips</button><button type="button" onClick={() => run(onFind)}><Search size={16} />Find a setting</button>{onReset && <button type="button" onClick={() => { if (window.confirm('Reset the current workspace? Save a project first to keep its prompt, controls, and references. Saved projects and media files are kept.')) run(onReset) }}><RotateCcw size={16} />Reset workspace</button>}<small>Ctrl/Cmd K: workspaces · Ctrl/Cmd F: settings · ↑ ↓ navigate · Enter open · Esc close</small></footer>
    </DialogContent>
  </Dialog>
}
