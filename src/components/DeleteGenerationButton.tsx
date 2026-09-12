import { useRef, useState } from 'react'
import { LoaderCircle, Trash2 } from 'lucide-react'
import type { GenerationJob } from '../types'

export function DeleteGenerationButton({ job, disabled, onDelete }: { job: GenerationJob; disabled?: boolean; onDelete(job: GenerationJob, mode: 'history' | 'trash' | 'permanent'): Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [mode, setMode] = useState<'history' | 'trash' | 'permanent'>('history')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (['queued', 'running'].includes(job.status)) return null
  const remove = async () => {
    setBusy(true); setError('')
    try {
      await onDelete(job, mode)
      dialog.current?.close()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally { setBusy(false) }
  }
  return <>
    <button type="button" className="danger-button" disabled={disabled} onClick={() => { setMode('history'); setError(''); dialog.current?.showModal() }}><Trash2 size={15} />Delete</button>
    <dialog ref={dialog} className="delete-generation-dialog" aria-label="Delete generation" onCancel={(event) => { if (busy) event.preventDefault() }}>
      <h2>Delete generation?</h2>
      <p className="delete-generation-prompt">{job.prompt}</p>
      <p>This removes the history from both Library and Queue.</p>
      <label>Generated file<select value={mode} disabled={busy} onChange={(event) => setMode(event.target.value as typeof mode)}>
        <option value="history">Keep file · delete history only</option>
        <option value="trash" disabled={!(job.localOutputPath || job.outputUrl)}>Move file to Trash</option>
        <option value="permanent" disabled={!(job.localOutputPath || job.outputUrl)}>Permanently delete file · WSL / network folders</option>
      </select></label>
      <p>{mode === 'permanent' ? 'The file will be permanently deleted without using Trash. This cannot be undone. Projects or clips using it will lose access.' : mode === 'trash' ? 'Projects or clips using this file will lose access to it. WSL and network folders may not support Trash.' : 'The generated file and any projects using it are kept.'}</p>
      {mode !== 'history' && <p>If the file is already missing, only the history is removed.</p>}
      {error && <p role="alert" className="job-error">{error}</p>}
      <footer><button type="button" className="secondary-button" disabled={busy} onClick={() => dialog.current?.close()}>Cancel</button><button type="button" className="danger-button" disabled={busy} onClick={() => void remove()}>{busy ? <LoaderCircle size={15} className="spin" /> : <Trash2 size={15} />}{busy ? 'Deleting…' : mode === 'permanent' ? 'Permanently delete file & history' : mode === 'trash' ? 'Delete history & trash file' : 'Delete history'}</button></footer>
    </dialog>
  </>
}
