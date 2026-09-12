import { useRef, useState } from 'react'
import { LoaderCircle, Trash2 } from 'lucide-react'
import type { GenerationJob } from '../types'

export function DeleteGenerationButton({ job, disabled, onDelete }: { job: GenerationJob; disabled?: boolean; onDelete(job: GenerationJob, trashFile: boolean): Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [trashFile, setTrashFile] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (['queued', 'running'].includes(job.status)) return null
  const remove = async () => {
    setBusy(true); setError('')
    try {
      await onDelete(job, trashFile)
      dialog.current?.close()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally { setBusy(false) }
  }
  return <>
    <button type="button" className="danger-button" disabled={disabled} onClick={() => { setTrashFile(false); setError(''); dialog.current?.showModal() }}><Trash2 size={15} />Delete</button>
    <dialog ref={dialog} className="delete-generation-dialog" aria-label="Delete generation" onCancel={(event) => { if (busy) event.preventDefault() }}>
      <h2>Delete generation?</h2>
      <p className="delete-generation-prompt">{job.prompt}</p>
      <p>This removes the history from both Library and Queue.</p>
      <label><input type="checkbox" checked={trashFile} disabled={busy || !(job.localOutputPath || job.outputUrl)} onChange={(event) => setTrashFile(event.target.checked)} />Also move the generated file to Trash</label>
      <p>{trashFile ? 'Projects or clips using this file will lose access to it. If the file is already missing, only the history is removed.' : 'The generated file and any projects using it are kept.'}</p>
      {error && <p role="alert" className="job-error">{error}</p>}
      <footer><button type="button" className="secondary-button" disabled={busy} onClick={() => dialog.current?.close()}>Cancel</button><button type="button" className="danger-button" disabled={busy} onClick={() => void remove()}>{busy ? <LoaderCircle size={15} className="spin" /> : <Trash2 size={15} />}{busy ? 'Deleting…' : trashFile ? 'Delete history & trash file' : 'Delete history'}</button></footer>
    </dialog>
  </>
}
