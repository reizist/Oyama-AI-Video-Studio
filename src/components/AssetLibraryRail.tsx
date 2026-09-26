import { useId, useMemo, useState, type ReactNode } from 'react'
import { Plus, Search, X } from 'lucide-react'

export interface AssetLibraryItem {
  id: string
  name: string
  detail: string
  preview?: string
  placeholder: ReactNode
  searchText?: string
}

interface AssetLibraryRailProps {
  title: string
  items: AssetLibraryItem[]
  activeId: string
  onAdd(): void
  onSelect(id: string): void
}

export function AssetLibraryRail({ title, items, activeId, onAdd, onSelect }: AssetLibraryRailProps) {
  const [search, setSearch] = useState('')
  const inputId = useId()
  const query = search.trim().toLocaleLowerCase()
  const visible = useMemo(() => items.filter(item => `${item.name} ${item.detail} ${item.searchText ?? ''}`.toLocaleLowerCase().includes(query)), [items, query])

  return <aside className="character-project-list asset-library-rail" aria-label={`${title} library`}>
    <header><span><strong>{title}</strong><small>{items.length} saved globally</small></span><button type="button" onClick={onAdd}><Plus size={14} />New</button></header>
    <label className="asset-library-search" htmlFor={inputId}><Search size={15} /><input id={inputId} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={`Search ${title.toLocaleLowerCase()}…`} />{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}</label>
    <p className="asset-library-count" role="status">{query ? `${visible.length} of ${items.length} matching` : `${items.length} ${items.length === 1 ? 'item' : 'items'}`}</p>
    <div>{visible.length ? visible.map(item => <button type="button" key={item.id} className={item.id === activeId ? 'active' : ''} aria-current={item.id === activeId ? 'true' : undefined} onClick={() => onSelect(item.id)}>{item.preview ? <img src={item.preview} alt="" /> : <span>{item.placeholder}</span>}<span><strong>{item.name}</strong><small>{item.detail}</small></span></button>) : <div className="asset-library-empty"><strong>{query ? 'No matches' : `No ${title.toLocaleLowerCase()} yet`}</strong><span>{query ? 'Try a different name or detail.' : `Create your first ${title.toLocaleLowerCase()} item.`}</span>{query ? <button type="button" onClick={() => setSearch('')}>Clear search</button> : <button type="button" onClick={onAdd}>Create new</button>}</div>}</div>
  </aside>
}
