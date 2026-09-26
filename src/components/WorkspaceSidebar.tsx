import { Aperture, Clapperboard, FileText, Film, HardDrive, Image as ImageIcon, ImagePlus, Library, ListVideo, MapPin, Menu, Music2, PanelLeftClose, Scan, Scissors, Settings, Shirt, SkipForward, Users, WandSparkles, Watch, type LucideIcon } from 'lucide-react'
import type { View } from '../types'

type MusicEngine = 'acestep' | 'music3'
type SidebarItem = { view: View; label: string; icon: LucideIcon; engine?: MusicEngine; count?: number; tone?: string }

interface WorkspaceSidebarProps {
  view: View
  musicEngine: MusicEngine
  open: boolean
  connected: boolean
  modelReady: boolean
  modelCount: number
  pendingCount: number
  projectName: string
  workspaceName: string
  onToggle(): void
  onClose(): void
  onBrowse(): void
  onNavigate(view: View, engine?: MusicEngine): void
  onVideo(): void
}

export function WorkspaceSidebar(props: WorkspaceSidebarProps) {
  const groups: Array<{ label: string; items: SidebarItem[] }> = [
    { label: 'Create', items: [
      { view: 'scratchpad', label: 'Scratchpad', icon: FileText },
      { view: 'create', label: 'H3 Video', icon: WandSparkles },
      { view: 'continue', label: 'Continue', icon: SkipForward },
      { view: 'zimage', label: 'Image', icon: ImageIcon },
      { view: 'referenceprep', label: 'Reference Prep', icon: Scan },
      { view: 'ltx25', label: 'LTX 2.5', icon: Aperture },
      { view: 'ltxripple', label: 'LTX Ripple', icon: Aperture },
      { view: 'photoedit', label: 'Photo Edit', icon: ImagePlus },
      { view: 'music', engine: 'acestep', label: 'ACE-Step', icon: Music2 },
      { view: 'music', engine: 'music3', label: 'Music 3', icon: Music2 },
    ] },
    { label: 'Libraries', items: [
      { view: 'characters', label: 'Characters', icon: Users, tone: 'character' },
      { view: 'hair', label: 'Hair', icon: Scissors },
      { view: 'wardrobes', label: 'Wardrobe', icon: Shirt, tone: 'wardrobe' },
      { view: 'accessories', label: 'Accessories', icon: Watch },
      { view: 'locations', label: 'Locations', icon: MapPin, tone: 'location' },
      { view: 'library', label: 'Renders', icon: Library },
    ] },
    { label: 'Project', items: [
      { view: 'queue', label: 'Queue', icon: ListVideo, count: props.pendingCount },
      { view: 'movie', label: 'Oyama AI Movie', icon: Clapperboard },
      { view: 'clipmaster', label: 'Clip Master', icon: Film },
    ] },
  ]
  return <>
    {props.open && <button className="mobile-sidebar-backdrop" aria-label="Close workspace menu" onClick={props.onClose} />}
    <aside className="sidebar" aria-label="Workspace sidebar" onClick={event => { if (window.innerWidth <= 680 && (event.target as HTMLElement).closest('.nav-button')) props.onClose() }}>
      <div className="sidebar-top"><button className="icon-button sidebar-toggle" onClick={props.onToggle} aria-label={props.open ? 'Collapse sidebar' : 'Expand sidebar'}><PanelLeftClose size={18} /></button></div>
      <div className="sidebar-brand"><span className="brand-mark" aria-hidden="true"><Film size={18} /></span><span className="sidebar-brand-text"><strong>Oyama AI Video Studio</strong><small>Workspaces</small></span></div>
      <button className="sidebar-browse" type="button" data-workspace-trigger onClick={props.onBrowse} aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K" title="Browse all workspaces (Ctrl+K)"><Menu size={16} /><span>Browse workspaces</span></button>
      <nav className="sidebar-nav" aria-label="Primary navigation">{groups.map(group => <div className="nav-group" key={group.label}><span className="nav-section-label">{group.label}</span>{group.items.map(item => {
        const Icon = item.icon
        const active = props.view === item.view && (!item.engine || item.engine === props.musicEngine)
        return <button type="button" key={`${item.view}-${item.engine ?? ''}`} className={`nav-button ${active ? 'active' : ''}`} data-item-type={item.tone} title={item.label} aria-current={active ? 'page' : undefined} aria-label={item.label} onClick={() => item.view === 'create' ? props.onVideo() : props.onNavigate(item.view, item.engine)}><Icon size={19} /><span>{item.label}</span>{item.count ? <em>{item.count}</em> : null}</button>
      })}</div>)}</nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-status">
        {props.connected ? <div className="sidebar-status-current connected"><span className="sidebar-status-dot" aria-hidden="true" /><div><strong>Engine connected</strong><small>{props.workspaceName} · {props.projectName}</small></div></div> : <button className="sidebar-status-current offline" type="button" onClick={() => props.onNavigate('settings')} title="Offline · open Settings to connect"><span className="sidebar-status-dot" aria-hidden="true" /><div><strong>Offline · Set up</strong><small>{props.workspaceName} · {props.projectName}</small></div></button>}
        <div className={`model-health ${props.modelReady ? 'healthy' : ''}`}><HardDrive size={17} /><div><strong>{props.modelReady ? 'Models ready' : 'Models incomplete'}</strong><span>{props.modelCount} local files indexed</span></div></div>
        <button type="button" className={`nav-button ${props.view === 'settings' ? 'active' : ''}`} title="Settings" aria-current={props.view === 'settings' ? 'page' : undefined} onClick={() => props.onNavigate('settings')}><Settings size={19} /><span>Settings</span></button>
      </div>
    </aside>
  </>
}
