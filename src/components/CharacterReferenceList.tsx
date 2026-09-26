import { ImagePlus, Images, Plus, Trash2 } from 'lucide-react'
import type { MediaFile } from '../types'

interface CharacterReferenceListProps {
  files: MediaFile[]
  selectedPath: string
  selectedReferencePaths?: string[]
  onSelect(path: string): void
  onRemove(path: string): void
  onAdd(): void
}

export function CharacterReferenceList({ files, selectedPath, selectedReferencePaths, onSelect, onRemove, onAdd }: CharacterReferenceListProps) {
  return <section className="character-reference-list" aria-label="Approved character images">
    <header><span><strong>Approved identity images</strong><small>{files.length} image{files.length === 1 ? '' : 's'} · select one to inspect</small></span><button type="button" onClick={onAdd}><Plus size={14} />Add image</button></header>
    {files.length ? <div className="character-reference-list-items">{files.map((file, index) => {
      const included = selectedReferencePaths === undefined || selectedReferencePaths.includes(file.path)
      return <article key={file.path} className={selectedPath === file.path ? 'selected' : ''}>
        <button type="button" className="character-reference-list-select" aria-pressed={selectedPath === file.path} onClick={() => onSelect(file.path)}>
          {file.preview ? <img src={file.preview} alt="" /> : <Images size={20} />}
          <span><strong>{file.name}</strong><small>{file.referenceType ?? `Angle ${index + 1}`} · {included ? 'In selected set' : 'Not selected'}</small></span>
        </button>
        <button type="button" className="character-reference-list-remove" aria-label={`Remove ${file.name} from character`} title="Remove from this character; keep the original file" onClick={() => onRemove(file.path)}><Trash2 size={15} /></button>
      </article>
    })}</div> : <p><ImagePlus size={18} />No approved images yet. Add an image to build a reference set.</p>}
  </section>
}
