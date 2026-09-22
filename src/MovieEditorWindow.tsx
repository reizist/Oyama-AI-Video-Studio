import { MOVIE_HANDOFF_KEY } from './lib/movieHandoff'
import { createId } from './lib/createId'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { MovieEditor } from './components/MovieEditor'
import { ClipMasterBeta } from './components/ClipMasterBeta'
import type { AppSettings, ClipItem, GenerationJob, MediaFile } from './types'

function readJobs(): GenerationJob[] {
  try { const jobs = JSON.parse(localStorage.getItem('minimax.jobs') ?? '[]') as GenerationJob[]; return Array.isArray(jobs) ? jobs : [] } catch { return [] }
}

export function MovieEditorWindow() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [jobs, setJobs] = useState<GenerationJob[]>(readJobs)
  const [notice, setNotice] = useState<string | null>(null)
  const [clipMasterClip, setClipMasterClip] = useState<ClipItem | null>(null)
  useEffect(() => { document.title = 'Oyama AI Movie'; void window.minimax.getSettings().then(setSettings) }, [])
  useEffect(() => {
    const refresh = (event: StorageEvent) => { if (event.key === 'minimax.jobs') setJobs(readJobs()) }
    window.addEventListener('storage', refresh)
    return () => { window.removeEventListener('storage', refresh) }
  }, [])
  if (!settings) return <main className="oyama-movie-loading">Opening Oyama AI Movie…</main>
  return <main className="oyama-movie-window">
    {notice && <div className="oyama-movie-notice" role="status">{notice}<button onClick={() => setNotice(null)} aria-label="Dismiss notice"><X size={14} /></button></div>}
    <MovieEditor standalone settings={settings} jobs={jobs} onNotice={(_tone, message) => setNotice(message)} onOpenClipMaster={setClipMasterClip} onUseFrame={async (file: MediaFile, target, clip: ClipItem) => { if (target === 'save') { setNotice(`${file.name} saved to the output folder.`); return } const savedFile = { ...file }; delete savedFile.preview; localStorage.setItem(MOVIE_HANDOFF_KEY, JSON.stringify({ id: createId(), file: savedFile, target, sourceName: clip.name })); await window.minimax.openStudio(); setNotice(`${file.name} sent to the studio. Review the destination before generating.`) }} />
    {clipMasterClip && <ClipMasterBeta clip={clipMasterClip} settings={settings} onClose={() => setClipMasterClip(null)} onNotice={(_tone, message) => setNotice(message)} onExportClip={(clip) => { window.dispatchEvent(new CustomEvent('oyama-movie-add-media', { detail: clip })); setNotice(`${clip.name} returned to the Movie media bin.`); setClipMasterClip(null) }} />}
  </main>
}
