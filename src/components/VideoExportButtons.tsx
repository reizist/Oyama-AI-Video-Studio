import { useState } from 'react'
import { Download } from 'lucide-react'
import type { GenerationJob } from '../types'

export function VideoExportButtons({ job }: { job: GenerationJob }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  if (job.status !== 'completed' || job.mediaType === 'image' || job.mediaType === 'audio' || !job.outputUrl) return null
  const save = async (segment: boolean) => {
    const source = segment ? job.segmentOutputPath ?? job.segmentOutputUrl : job.localOutputPath ?? job.outputUrl
    if (!source) return
    setBusy(true); setMessage(''); setFailed(false)
    try {
      const path = await window.minimax.exportVideo(source, `${job.outputName?.split('/').at(-1) ?? `Video-${job.id}`}${segment ? '_Beat' : ''}.mp4`)
      setMessage(path ? `Exported to ${path}` : 'Export cancelled.')
    } catch (error) { setFailed(true); setMessage(`${error instanceof Error ? error.message : String(error)} Try Export again.`) }
    finally { setBusy(false) }
  }
  return <div className="video-export-actions">
    {job.continuation && <button type="button" className="secondary-button" disabled={busy || !job.segmentOutputUrl} title={!job.segmentOutputUrl ? 'Regenerate this older beat to save an individual clip.' : 'Save only this beat without the repeated motion context'} onClick={() => void save(true)}><Download size={14} />Export beat</button>}
    <button type="button" className="secondary-button" disabled={busy} onClick={() => void save(false)}><Download size={14} />{busy ? 'Exporting…' : job.continuation ? 'Export combined video' : 'Export video'}</button>
    {message && <small role={failed ? 'alert' : 'status'} aria-live="polite">{message}</small>}
  </div>
}
