import { useMemo, useState } from 'react'
import { Plus, Search, Star, UserRound } from 'lucide-react'
import { characterReferences } from '../lib/characterLibrary'
import type { CharacterProject } from '../types'
import { Button, Input } from './ui'

interface CharacterLibraryPanelProps {
  projects: CharacterProject[]
  activeId: string
  onAdd(): void
  onSelect(id: string): void
}

export function CharacterLibraryPanel({ projects, activeId, onAdd, onSelect }: CharacterLibraryPanelProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'favorites' | 'recent'>('all')
  const visible = useMemo(() => projects
    .filter(project => project.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .filter(project => filter !== 'favorites' || project.favorite)
    .sort((a, b) => filter === 'recent' ? b.updatedAt - a.updatedAt : 0), [projects, search, filter])

  return <section className="character-library-panel" aria-label="Character library">
    <header><span><strong>Character library</strong><small>{projects.length} saved locally · choose one to edit</small></span><Button variant="primary" onClick={onAdd}><Plus size={15} />New character</Button></header>
    <div className="character-library-tools"><label className="character-search"><Search size={15} /><Input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search characters…" aria-label="Search characters" /></label><div className="character-filter-row" role="group" aria-label="Character filter">{(['all', 'favorites', 'recent'] as const).map(item => <Button size="sm" variant={filter === item ? 'primary' : 'ghost'} aria-pressed={filter === item} key={item} onClick={() => setFilter(item)}>{item[0].toUpperCase() + item.slice(1)}</Button>)}</div></div>
    <p className="character-library-count" role="status">{visible.length} of {projects.length} characters</p>
    {visible.length ? <div className="character-library-grid">{visible.map(project => <button type="button" key={project.id} className={`character-library-card ${project.id === activeId ? 'active' : ''}`} aria-current={project.id === activeId ? 'true' : undefined} onClick={() => onSelect(project.id)}>{project.baseImage?.preview ? <img src={project.baseImage.preview} alt="" /> : <span className="character-library-placeholder"><UserRound size={25} /></span>}<span className="character-library-card-body"><strong>{project.name}</strong><small>{project.baseImage ? 'Primary image ready' : 'Primary image needed'}</small><small>{characterReferences(project).length} approved reference{characterReferences(project).length === 1 ? '' : 's'}</small></span>{project.favorite && <Star size={15} fill="currentColor" aria-label="Favorite" />}</button>)}</div> : <div className="character-library-empty"><strong>No matching characters</strong><span>Try a different search or filter.</span><button type="button" onClick={() => { setSearch(''); setFilter('all') }}>Show all characters</button></div>}
  </section>
}
