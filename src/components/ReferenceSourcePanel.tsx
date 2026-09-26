import { ImagePlus, MapPin, Music2, Plus, Scissors, Trash2, Users, Video } from 'lucide-react'
import { characterReferences } from '../lib/characterLibrary'
import { locationReferences } from '../lib/locationLibrary'
import type { CharacterProject, LocationProject, MediaFile, MediaKind } from '../types'

interface ReferenceSourcePanelProps {
  characters: CharacterProject[]
  locations: LocationProject[]
  selectedCharacterIds: string[]
  selectedLocationIds: string[]
  imageCount: number
  videoCount: number
  audioCount: number
  images: MediaFile[]
  videos: MediaFile[]
  audios: MediaFile[]
  managedImagePaths: ReadonlySet<string>
  onAddCharacter(id: string): void
  onAddLocation(id: string): void
  onClear(): void
  onChoose(kind: 'image' | 'video' | 'audio'): void
  onRemove(kind: MediaKind, index: number): void
  onEditVideo(index: number): void
  onOpenCharacters(): void
  onOpenLocations(): void
}

export function ReferenceSourcePanel(props: ReferenceSourcePanelProps) {
  const hasReferences = props.selectedCharacterIds.length + props.selectedLocationIds.length + props.imageCount + props.videoCount + props.audioCount > 0
  const standaloneImages = props.images.map((file, index) => ({ file, index, kind: 'image' as const })).filter(item => !props.managedImagePaths.has(item.file.path))
  const attachedMedia = [...standaloneImages, ...props.videos.map((file, index) => ({ file, index, kind: 'video' as const })), ...props.audios.map((file, index) => ({ file, index, kind: 'audio' as const }))]

  return <section className="reference-source-panel" aria-label="Reference inputs">
    <header>
      <span><strong>Reference inputs</strong><small>Choose reusable subjects and places, then add scene media.</small></span>
      <span className="reference-source-total">{props.imageCount}/9 images · {props.videoCount}/3 videos · {props.audioCount}/3 audio</span>
      {hasReferences && <button type="button" className="reference-source-clear" onClick={props.onClear}>Clear shot references</button>}
    </header>

    <details open>
      <summary><Users size={16} /><span>Characters</span><small>{props.selectedCharacterIds.length} selected</small></summary>
      <div className="reference-source-options">
        {props.characters.length ? props.characters.map(character => {
          const references = characterReferences(character)
          const selected = props.selectedCharacterIds.includes(character.id)
          return <button type="button" key={character.id} className={selected ? 'selected' : ''} aria-pressed={selected} disabled={!references.length} onClick={() => props.onAddCharacter(character.id)}>
            {references[0]?.preview ? <img src={references[0].preview} alt="" /> : <Users size={18} />}
            <span><strong>{character.name}</strong><small>{references.length ? `${references.length} approved image${references.length === 1 ? '' : 's'}` : 'Add an approved identity image in Character Studio'}</small></span>
            <span>{selected ? 'Remove' : references.length ? 'Add' : 'Needs image'}</span>
          </button>
        }) : <p>No characters in the library yet.</p>}
        <button type="button" className="reference-source-manage" onClick={props.onOpenCharacters}>Open Character Studio</button>
      </div>
    </details>

    <details>
      <summary><MapPin size={16} /><span>Locations</span><small>{props.selectedLocationIds.length} selected</small></summary>
      <div className="reference-source-options">
        {props.locations.length ? props.locations.map(location => {
          const references = locationReferences(location)
          const selected = props.selectedLocationIds.includes(location.id)
          return <button type="button" key={location.id} className={selected ? 'selected' : ''} aria-pressed={selected} disabled={!references.length} onClick={() => props.onAddLocation(location.id)}>
            {references[0]?.preview ? <img src={references[0].preview} alt="" /> : <MapPin size={18} />}
            <span><strong>{location.name}</strong><small>{references.length ? `${references.length} approved view${references.length === 1 ? '' : 's'}` : 'Add an approved view in Location Studio'}</small></span>
            <span>{selected ? 'Remove' : references.length ? 'Add' : 'Needs image'}</span>
          </button>
        }) : <p>No locations in the library yet.</p>}
        <button type="button" className="reference-source-manage" onClick={props.onOpenLocations}>Open Location Studio</button>
      </div>
    </details>

    <details>
      <summary><ImagePlus size={16} /><span>Scene media</span><small>{attachedMedia.length} attached</small></summary>
      {attachedMedia.length > 0 && <ul className="reference-source-files" aria-label="Attached scene media">{attachedMedia.map(({ file, index, kind }) => <li key={`${kind}:${file.path}:${index}`}>
        <span className="reference-source-file-icon">{kind === 'image' && file.preview ? <img src={file.preview} alt="" /> : kind === 'video' ? <Video size={16} /> : kind === 'audio' ? <Music2 size={16} /> : <ImagePlus size={16} />}</span>
        <span className="reference-source-file-name"><strong>{file.name}</strong><small>{kind === 'video' && file.clip ? `Video · ${(file.clip.end - file.clip.start).toFixed(1)}s clip` : kind === 'image' ? 'Picture' : kind === 'video' ? 'Video' : 'Audio'}</small></span>
        {kind === 'video' && <button type="button" className="reference-source-file-action" onClick={() => props.onEditVideo(index)} aria-label={`Edit clip ${file.name}`} title="Edit clip"><Scissors size={15} /></button>}
        <button type="button" className="reference-source-file-action" onClick={() => props.onRemove(kind, index)} aria-label={`Remove ${file.name} from this shot`} title="Remove from this shot"><Trash2 size={15} /></button>
      </li>)}</ul>}
      <div className="reference-source-add">
        <button type="button" disabled={props.imageCount >= 9} onClick={() => props.onChoose('image')}><Plus size={14} /><ImagePlus size={16} />Image</button>
        <button type="button" disabled={props.videoCount >= 3} onClick={() => props.onChoose('video')}><Plus size={14} /><Video size={16} />Video</button>
        <button type="button" disabled={props.audioCount >= 3} onClick={() => props.onChoose('audio')}><Plus size={14} /><Music2 size={16} />Audio</button>
      </div>
    </details>
  </section>
}
