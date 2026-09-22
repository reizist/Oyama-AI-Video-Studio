import type { View } from '../types'

export type MusicEngine = 'acestep' | 'music3'
export type WorkspaceDestination = { view: View; engine?: MusicEngine; label: string; description: string; group: string }

export const workspaceDestinations: WorkspaceDestination[] = [
  { view: 'scratchpad', label: 'Scratchpad', description: 'Plan a scene and develop prompts before generating.', group: 'Create' },
  { view: 'create', label: 'Video · MiniMax H3', description: 'Generate video from text, images, or references. T2V, I2V, Ref2VA.', group: 'Create' },
  { view: 'continue', label: 'Continue video', description: 'Extend an existing video with the next scene or beat.', group: 'Create' },
  { view: 'ltx25', label: 'Video · LTX 2.5', description: 'Generate video with the LTX engine.', group: 'Create' },
  { view: 'anime', label: 'Anime & Checkpoint', description: 'Generate anime and checkpoint still images with Anima or SD1.5/SDXL.', group: 'Create' },
  { view: 'zimage', label: 'Create image', description: 'Generate still images with Z-Image.', group: 'Create' },
  { view: 'music', engine: 'acestep', label: 'Music · ACE-Step', description: 'Compose music and vocals from lyrics and style.', group: 'Create' },
  { view: 'music', engine: 'music3', label: 'Music · Music 3', description: 'Generate songs with MiniMax Music 3.', group: 'Create' },
  { view: 'referenceprep', label: 'Reference Prep', description: 'Crop images and remove backgrounds for references.', group: 'Prepare assets' },
  { view: 'characters', label: 'Characters', description: 'Build reusable character identities and reference sets.', group: 'Prepare assets' },
  { view: 'hair', label: 'Hair', description: 'Create reusable hairstyles for characters.', group: 'Prepare assets' },
  { view: 'wardrobes', label: 'Wardrobe', description: 'Prepare clothing and outfit references.', group: 'Prepare assets' },
  { view: 'accessories', label: 'Accessories', description: 'Prepare props and accessories.', group: 'Prepare assets' },
  { view: 'locations', label: 'Locations', description: 'Build reusable scene and environment references.', group: 'Prepare assets' },
  { view: 'queue', label: 'Queue', description: 'Follow generation progress, stop jobs, and review errors.', group: 'Review & edit' },
  { view: 'library', label: 'Video library', description: 'Review finished videos and reference stills; bookmark frames.', group: 'Review & edit' },
  { view: 'movie', label: 'Movie editor', description: 'Assemble clips and audio on a timeline. Oyama AI Movie.', group: 'Review & edit' },
  { view: 'clipmaster', label: 'Clip Master', description: 'Trim, inspect, and refine individual clips.', group: 'Review & edit' },
  { view: 'settings', label: 'Settings', description: 'Connect ComfyUI, configure models, and troubleshoot setup.', group: 'Setup' },
]

export function workspaceLabel(view: View, engine: MusicEngine = 'acestep'): string {
  return workspaceDestinations.find(item => item.view === view && (!item.engine || item.engine === engine))?.label ?? view
}

export function findWorkspaces(query: string): WorkspaceDestination[] {
  const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ')
  const terms = normalized.split(' ').filter(Boolean)
  const rank = (item: WorkspaceDestination) => {
    const label = item.label.toLowerCase()
    return label === normalized ? 0 : label.startsWith(normalized) ? 1 : terms.every(term => label.includes(term)) ? 2 : 3
  }
  return workspaceDestinations
    .filter(item => terms.every(term => `${item.label} ${item.description} ${item.group}`.toLowerCase().includes(term)))
    .sort((a, b) => rank(a) - rank(b))
}

export type WorkspaceProjectScope = 'create' | 'ltx25' | 'zimage' | 'anime' | 'music' | 'music3'
export function workspaceProjectScope(view: View, engine: MusicEngine = 'acestep'): WorkspaceProjectScope | null {
  if (view === 'music') return engine === 'music3' ? 'music3' : 'music'
  return view === 'create' || view === 'ltx25' || view === 'zimage' || view === 'anime' ? view : null
}
export function workspaceProjectLabel(scope: WorkspaceProjectScope): string {
  return scope === 'music3' ? 'Music · Music 3' : workspaceLabel(scope, 'acestep')
}
export function workspaceStorageKey(scope: Exclude<WorkspaceProjectScope, 'create'>): string {
  return { anime: 'anime.workspace', ltx25: 'ltx25.workspace', zimage: 'minimax.zimage-workspace', music: 'acestep.workspace', music3: 'minimax.music3-workspace' }[scope]
}
