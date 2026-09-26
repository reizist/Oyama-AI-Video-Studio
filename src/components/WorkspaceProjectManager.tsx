import { useState } from 'react'
import { FolderOpen, Pencil, Save, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from './ui'
import { workspaceProjectLabel, type WorkspaceProjectScope } from '../lib/workspaceNavigation'
import type { WorkspaceProject } from '../lib/workspaceProjects'

export function WorkspaceProjectManager({ activeScope, projects, onClose, onSave, onLoad, onRename, onDelete, feedback }: { feedback: { tone: 'error' | 'success' | 'neutral'; text: string } | null; activeScope: WorkspaceProjectScope | null; projects: WorkspaceProject[]; onClose(): void; onSave(name: string, scope: WorkspaceProjectScope): boolean; onLoad(project: WorkspaceProject): void; onRename(project: WorkspaceProject): void; onDelete(project: WorkspaceProject): void }) {
  const [name, setName] = useState('')
  const [filter, setFilter] = useState<'all' | WorkspaceProjectScope>('all')
  const visibleProjects = projects.filter((project) => filter === 'all' || project.scope === filter)
  const details = (project: WorkspaceProject) => {
    const prompt = ['prompt', 'metadata', 'vocals', 'arrangement', 'lyrics'].map(key => typeof project.snapshot[key] === 'string' ? project.snapshot[key] : '').join(' ').trim()
    const references = ['referenceImages', 'referenceVideos', 'referenceAudios', 'msrReferences'].reduce((total, key) => total + (Array.isArray(project.snapshot[key]) ? project.snapshot[key].length : 0), 0) + (project.snapshot.firstFrame ? 1 : 0)
    return `${prompt ? `${prompt.length.toLocaleString()} character prompt` : 'No prompt'} · ${references} media reference${references === 1 ? '' : 's'}`
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent className="workspace-project-modal" aria-describedby={undefined} onCloseAutoFocus={event => { event.preventDefault(); Array.from(document.querySelectorAll<HTMLButtonElement>('[data-workspace-trigger]')).find(button => button.getClientRects().length > 0)?.focus() }}>
      <header><div><FolderOpen size={20} /><span><DialogTitle>Workspace projects</DialogTitle><small>Full local snapshots of prompts, controls, and selected reference files.</small></span></div></header>
      <div className="workspace-project-body">
        {feedback && <p className={`project-feedback ${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.text}</p>}
        {activeScope ? <form className="workspace-project-save" onSubmit={(event) => { event.preventDefault(); if (onSave(name, activeScope)) setName('') }}><span><strong>Save current {workspaceProjectLabel(activeScope)} workspace</strong><small>Includes the full prompt, render selections, and reference assignments. Files remain in their original local locations.</small></span><label><span>Project name</span><input autoFocus value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="e.g. Kitchen dialogue v1" /></label><button className="primary-button" type="submit" disabled={!name.trim()}><Save size={15} />Save project</button></form> : <p className="settings-note">Open Create, LTX 2.5, Create Image, or Music to save that workspace as a project. You can still open any saved project below.</p>}
        <div className="workspace-project-toolbar"><span><strong>Saved projects</strong><small>{projects.length} local project{projects.length === 1 ? '' : 's'}</small></span><label><span>Show</span><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">All workspaces</option><option value="create">MiniMax H3 / Ref2VA</option><option value="ltx25">LTX 2.5</option><option value="zimage">Create Image</option><option value="music">Music · ACE-Step</option><option value="music3">Music · Music 3</option></select></label></div>
        {visibleProjects.length ? <div className="workspace-project-list">{visibleProjects.map((project) => <article key={project.id}><div><span className="workspace-project-scope">{workspaceProjectLabel(project.scope)}</span><strong>{project.name}</strong><small>{details(project)}</small><small>Updated {new Date(project.updatedAt).toLocaleString()}</small></div><div><button type="button" className="secondary-button" onClick={() => onLoad(project)}>Open</button><button type="button" className="icon-button" aria-label={`Rename ${project.name}`} onClick={() => onRename(project)}><Pencil size={15} /></button><button type="button" className="icon-button danger-icon" aria-label={`Delete ${project.name}`} onClick={() => { if (window.confirm(`Delete project “${project.name}”? This does not delete any source files.`)) onDelete(project) }}><Trash2 size={15} /></button></div></article>)}</div> : <div className="workspace-project-empty"><FolderOpen size={26} /><strong>No projects here yet</strong><span>Save the active workspace to capture its prompt, settings, and references.</span></div>}
      </div>
      <footer><small>Projects are stored locally in Oyama AI Video Studio. Opening a project never changes its source images, videos, audio, or library assets.</small><button className="secondary-button" onClick={onClose}>Done</button></footer>
    </DialogContent>
  </Dialog>
}

