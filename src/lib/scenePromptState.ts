import type { GenerationMode, MediaFile, MovieReferenceBinding } from '../types'

export type Source = 'USER' | 'CHARACTER' | 'PRESERVE' | 'PROJECT' | 'AI' | 'DEFAULT'
export type Value = { value: string; source: Source; locked?: boolean; referenceIds?: string[] }
export type Attribute = 'identity' | 'face' | 'body' | 'hair' | 'wardrobe' | 'accessories' | 'environment' | 'lighting' | 'props' | 'style' | 'pose' | 'shotSize' | 'angle' | 'composition' | 'motion'
export const preserveAttributes: Attribute[] = ['identity', 'face', 'body', 'hair', 'wardrobe', 'accessories', 'environment', 'lighting', 'props', 'style']
export const cameraAttributes: Attribute[] = ['shotSize', 'angle', 'pose', 'composition']
export type Camera = Partial<Record<'shotSize' | 'angle' | 'movement' | 'speed' | 'stabilization' | 'amplitude' | 'behavior', Value>>
export type SceneReference = {
  id: string; file: MediaFile; ownerId?: string; name: string; preserve: Attribute[]; locks: Attribute[]
  anchor?: 'opening' | 'ending' | 'keyframe'; anchorShot?: number; anchorTime?: number
  observed: Partial<Record<Attribute, string>>; reviewed?: boolean; source: Source
  videoRole?: 'motion' | 'structure' | 'continuation' | 'editing'
  embeddedAudio?: SceneReference['audio']
  audio?: { relation: 'fully_copy' | 'partially_copy' | 'reference' | 'weak_reference'; layer: 'voice' | 'ambience' | 'music' | 'soundtrack'; speakerId?: string; description: string }
}

/**
 * Defaults for the compact Preserve action in Scene Composer. The action
 * preserves the reference's declared handoff role; it must never turn an
 * approved wardrobe source into an identity-only source just because the
 * reference is owned by a character.
 */
export function defaultPreservedAttributes(ref: Pick<SceneReference, 'file' | 'ownerId'>): Attribute[] {
  switch (ref.file.referenceRole) {
    case 'wardrobe': return ['wardrobe']
    case 'subject': return ['identity', 'face', 'body']
    case 'location': return ['environment', 'lighting']
    case 'prop': return ['props']
    case 'lighting-style': return ['lighting', 'style']
    // A reusable shot reference carries the world and any explicitly owned
    // wardrobe forward, while its framing remains free for the new shot.
    case 'composition': return ref.ownerId ? ['wardrobe', 'environment', 'lighting'] : ['environment', 'lighting']
    default: return ref.ownerId ? ['identity', 'face', 'body'] : ['environment', 'lighting']
  }
}
export type SceneCharacter = { id: string; name: string; attributes: Partial<Record<Attribute, Value>>; source?: Source }
export type SceneShot = { id: string; start: number; end: number; description: string; camera: Camera; characterIds: string[] }
export type SceneDialogue = { id: string; shotId: string; at: number; speakerIds: string[]; language: string; text: string; delivery: string; voiceover?: boolean; offscreen?: boolean; continues?: 'from' | 'to' | 'both'; cutoff?: boolean }
export type Conflict = { code: string; severity: 'error' | 'warning'; message: string; referenceId?: string }
export type ScenePromptState = {
  version: 1; scene: string; mode: GenerationMode; duration: number; references: SceneReference[]; characters: SceneCharacter[]
  camera: Camera; environment: Value; lighting: Value; styles: Value[]; shots: SceneShot[]; dialogue: SceneDialogue[]
  soundscape: Value; music: Value; noDialogue: boolean; naturalMovement: boolean
  continuity: { scene: boolean; camera: boolean; exactFrame: boolean; notes: Value }
  overrides: Partial<Record<Attribute, Value>>; conflicts: Conflict[]; inferred: Array<{ field: string; value: string; evidence: string }>
  view: 'creative' | 'compiled' | 'manual'; manualPrompt: string
}
export const value = (text = '', source: Source = 'USER'): Value => ({ value: text, source })

// Preserve the trailing space while the user is typing. Trimming each token on
// every change makes a controlled input turn "Found footage" into
// "Foundfootage" because React renders away the space before the next keypress.
export const parseStyleValues = (text: string): Value[] => text.split(',').map(item => value(item.replace(/^\s+/, '')))
export function createSceneState(scene = '', duration = 5, mode: GenerationMode = 'text'): ScenePromptState {
  return { version: 1, scene, mode, duration, references: [], characters: [], camera: {}, environment: value('', 'DEFAULT'), lighting: value('', 'DEFAULT'), styles: [], shots: [{ id: 'shot-1', start: 0, end: duration, description: '', camera: {}, characterIds: [] }], dialogue: [], soundscape: value('', 'DEFAULT'), music: value('', 'DEFAULT'), noDialogue: false, naturalMovement: false, continuity: { scene: false, camera: false, exactFrame: false, notes: value('', 'DEFAULT') }, overrides: {}, conflicts: [], inferred: [], view: 'creative', manualPrompt: '' }
}

/**
 * Assign one image as Ref2VA's native frame-index-0 guide. A normal reference
 * influences reusable appearance or composition, while this opening anchor is
 * VAE-encoded into MiniMaxH3AddGuide and attached to frame_idx 0.
 */
export function setFrameZeroGuide(state: ScenePromptState, referenceId?: string): ScenePromptState {
  const selected = referenceId ? state.references.find(ref => ref.id === referenceId && ref.file.kind === 'image') : undefined
  return {
    ...state,
    references: state.references.map(ref => ({
      ...ref,
      anchor: ref.id === selected?.id ? 'opening' : ref.anchor === 'opening' ? undefined : ref.anchor,
      ...(ref.id === selected?.id ? { reviewed: false } : {}),
    })),
    continuity: {
      ...state.continuity,
      scene: selected ? true : state.continuity.scene,
      exactFrame: Boolean(selected),
    },
  }
}

// Compatibility boundary: library allocation decides transport order; this adapter
// owns role semantics. No reference prose is appended to the author's scene.
export function bindSceneReferences(state: ScenePromptState, bindings: MovieReferenceBinding[], videos: MediaFile[] = [], audios: MediaFile[] = [], first?: MediaFile | null, last?: MediaFile | null): ScenePromptState {
  const previous = new Map(state.references.map(ref => [ref.id, ref]))
  const characters = new Map(state.characters.map(character => [character.id, character]))
  const refs: SceneReference[] = []
  const add = (file: MediaFile, binding?: MovieReferenceBinding, anchor?: SceneReference['anchor']) => {
    const id = `${file.kind}:${file.path}${anchor ? `:${anchor}` : ''}`
    const old = previous.get(id)
    // The current allocator is authoritative for ownership. A reference can
    // move from a standalone scene slot into a Character Studio assignment
    // (or between characters) while the same path remains in the workspace;
    // retaining the old owner would orphan wardrobe preservation and allow the
    // identity subject to render without its assigned clothing.
    const ownerId = binding?.characterId ?? old?.ownerId
    if (ownerId && !characters.has(ownerId)) characters.set(ownerId, { id: ownerId, name: binding?.label.replace(/^Character:\s*/, '').split(' / ')[0].split(' for ').at(-1) || 'Character', attributes: {}, source: 'CHARACTER' })
    const role = binding?.purpose && binding.purpose !== 'generic' ? binding.purpose : file.referenceRole
    // A library binding is more authoritative than stale metadata on the
    // original file. Normalize it before the compiler and before the UI reads
    // the quick Preserve role.
    const handoffRole: MediaFile['referenceRole'] = role === 'character' || role === 'character-angle' || role === 'subject' ? 'subject' : role === 'wardrobe' ? 'wardrobe' : role === 'location' ? 'location' : role === 'hair' ? 'subject' : role === 'accessory' || role === 'detail' || role === 'prop' || role === 'product' ? 'prop' : role === 'lighting-style' || role === 'style' ? 'lighting-style' : role === 'continuity' ? 'composition' : role === 'composition' ? 'composition' : undefined
    const resolvedFile = handoffRole ? { ...file, referenceRole: handoffRole } : file
    const attributes: Attribute[] = role === 'character' || role === 'character-angle' || role === 'subject' ? ['identity', 'face', 'body'] : role === 'location' ? ['environment', 'lighting'] : role === 'hair' ? ['hair'] : role === 'wardrobe' ? ['wardrobe'] : role === 'accessory' ? ['accessories'] : role === 'detail' ? ['body'] : role === 'lighting-style' ? ['lighting', 'style'] : role === 'style' ? ['style'] : role === 'prop' || role === 'product' ? ['props'] : file.referenceRetention === 'preserve' ? ['environment', 'lighting'] : []
    // Library roles are hard assignments. Preserve any authored attributes,
    // but always add the role's canonical attribute so an assigned wardrobe
    // cannot silently degrade into an unowned identity or composition source.
    // If an asset changes handoff role (for example a prior scene reference is
    // later assigned as a character identity), discard stale role attributes so
    // environment or clothing cannot bleed into the new owner. Within the same
    // role, keep authored attribute additions and add the canonical role field.
    const roleChanged = Boolean(old && (old.file.referenceRole ?? '') !== (resolvedFile.referenceRole ?? ''))
    const preserve = old && !roleChanged ? [...new Set([...old.preserve, ...attributes])] : attributes
    refs.push(old ? { ...old, file: resolvedFile, ownerId, preserve, source: binding?.characterId ? 'CHARACTER' : old.source === 'CHARACTER' ? 'PRESERVE' : old.source } : { id, file: resolvedFile, ownerId, name: binding?.label ?? file.name, preserve, locks: role === 'composition' ? ['composition'] : [], anchor: anchor ?? (file.openingFrameTreatment === 'match' || file.openingFrameTreatment === 'arc' || binding?.purpose === 'continuity' ? 'opening' : undefined), observed: {}, source: binding?.characterId ? 'CHARACTER' : 'PRESERVE', ...(file.kind === 'video' ? { videoRole: 'motion' as const } : {}), ...(file.kind === 'audio' ? { audio: { relation: 'reference' as const, layer: 'ambience' as const, description: 'Sound texture' } } : {}) })
  }
  if (state.mode === 'reference') { bindings.forEach(binding => add(binding.file, binding)); videos.forEach(file => add(file)); audios.forEach(file => add(file)) }
  else { if (first && (state.mode === 'image' || state.mode === 'frames')) add(first, undefined, 'opening'); if (last && state.mode === 'frames') add(last, undefined, 'ending') }
  const activeIds = new Set(refs.map(ref => ref.id))
  const activeValue = (field?: Value): Value | undefined => {
    if (!field?.referenceIds?.length) return field
    const referenceIds = field.referenceIds.filter(id => activeIds.has(id))
    if (!referenceIds.length && (field.source === 'PRESERVE' || field.source === 'CHARACTER')) return undefined
    return { ...field, referenceIds: referenceIds.length ? referenceIds : undefined }
  }
  const cleanAttributes = (attributes: Partial<Record<Attribute, Value>>) => Object.fromEntries(Object.entries(attributes).map(([key, field]) => [key, activeValue(field)]).filter((entry) => entry[1])) as Partial<Record<Attribute, Value>>
  const activeCharacters = [...characters.values()].filter(character => character.source !== 'CHARACTER' || refs.some(ref => ref.ownerId === character.id)).map(character => ({ ...character, attributes: cleanAttributes(character.attributes) }))
  const activeCharacterIds = new Set(activeCharacters.map(character => character.id))
  return {
    ...state,
    references: refs,
    characters: activeCharacters,
    overrides: cleanAttributes(state.overrides),
    shots: state.shots.map(shot => ({ ...shot, characterIds: shot.characterIds.filter(id => activeCharacterIds.has(id)) })),
    dialogue: state.dialogue.map(line => ({ ...line, speakerIds: line.speakerIds.filter(id => activeCharacterIds.has(id)) })),
    continuity: { ...state.continuity, exactFrame: state.continuity.exactFrame && refs.some(ref => ref.anchor === 'opening') },
  }
}

/** Conservative extraction: only explicit speech verbs and exact quoted words.
 * Ambiguous speakers remain unassigned and validation asks for a choice. */
export function extractSceneDialogue(state: ScenePromptState): ScenePromptState {
  const dialogue = [...state.dialogue]
  let scene = state.scene
  const pattern = /\b([\p{L}\w'-]+)\s+(says|whispers|shouts|asks|replies|sings)\s*[,;:]?\s*[“"]([^”"]+)[”"]/gu
  for (const match of state.scene.matchAll(pattern)) {
    const person = state.characters.find(character => character.name.toLowerCase() === match[1].toLowerCase()) || (state.characters.length === 1 && /^(she|he|they)$/i.test(match[1]) ? state.characters[0] : undefined)
    const id = `scene-speech-${match.index}`
    if (!dialogue.some(line => line.text === match[3])) dialogue.push({ id, shotId: state.shots[0]?.id || '', at: 0, speakerIds: person ? [person.id] : [], language: 'English', text: match[3], delivery: match[2] })
    scene = scene.replace(match[0], '')
  }
  return { ...state, scene: scene.trim(), dialogue }
}

export function expandEmbeddedAudio(references: SceneReference[]): SceneReference[] {
  return references.flatMap(ref => ref.file.kind === 'video' && ref.embeddedAudio ? [{ ...ref, id: `${ref.id}:soundtrack`, file: { ...ref.file, kind: 'audio' as const }, audio: ref.embeddedAudio, preserve: [], locks: [], anchor: undefined }, ref] : [ref])
}

export const cameraOptions = {
  shotSize: ['Extreme Close-Up', 'Close-Up', 'Medium Close-Up', 'Medium Shot', 'Medium Wide Shot', 'Wide Shot', 'Extreme Wide Shot'],
  angle: ['Eye Level', 'Low Angle', 'High Angle', 'Overhead', 'Dutch Angle', 'Over the Shoulder', 'POV'],
  movement: ['Static Shot', 'Push In', 'Pull Out', 'Zoom In', 'Zoom Out', 'Pan Left', 'Pan Right', 'Truck Left', 'Truck Right', 'Tilt Up', 'Tilt Down', 'Pedestal Up', 'Pedestal Down', 'Arc Shot', 'Tracking Shot', 'Roll Clockwise', 'Roll Counterclockwise'],
  speed: ['Slow', 'Normal', 'Fast'], stabilization: ['Handheld', 'Tripod', 'Gimbal', 'Steadicam'], amplitude: ['Small', 'Medium', 'Large'],
}
export function suggestScene(scene: string): ScenePromptState['inferred'] {
  const suggestions: ScenePromptState['inferred'] = []
  for (const field of ['shotSize', 'angle', 'movement'] as const) {
    const found = [...cameraOptions[field]].sort((a, b) => b.length - a.length).find(option => new RegExp(`\\b${option.replaceAll('-', '[- ]')}\\b`, 'i').test(scene))
    if (found) suggestions.push({ field, value: found, evidence: found })
  }
  if (/camera (?:backs|moves|pulls) (?:away|back|backward)/i.test(scene)) suggestions.push({ field: 'movement', value: 'Pull Out', evidence: 'camera backs away' })
  if (/found footage/i.test(scene)) suggestions.push({ field: 'stabilization', value: 'Handheld', evidence: 'found footage' }, { field: 'behavior', value: 'Subtle handheld tremble, autofocus breathing, responsive auto-exposure and low-light sensor noise.', evidence: 'found footage' })
  else if (/handheld/i.test(scene)) suggestions.push({ field: 'stabilization', value: 'Handheld', evidence: 'handheld' })
  return suggestions
}
export function applySceneSuggestions(state: ScenePromptState): ScenePromptState {
  const camera = { ...state.camera }
  const inferred = suggestScene(state.scene)
  inferred.forEach(item => { const key = item.field as keyof Camera; if (!camera[key]?.locked && (!camera[key]?.value || camera[key]?.source === 'AI' || camera[key]?.source === 'DEFAULT')) camera[key] = value(item.value, 'AI') })
  return { ...state, camera, inferred }
}
export function resizeScene(state: ScenePromptState, duration: number): ScenePromptState {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 15) return state
  return { ...state, duration, shots: state.shots.length === 1 ? [{ ...state.shots[0], end: duration }] : state.shots }
}
export function applySceneCommand(state: ScenePromptState, category: string, label: string, instruction = ''): ScenePromptState {
  const field = ({ camera: 'movement', shot: 'shotSize', angle: 'angle', movement: 'speed' } as Record<string, keyof Camera>)[category]
  if (field) return { ...state, camera: { ...state.camera, [field]: value(label) } }
  if (category === 'style') return { ...state, styles: [...state.styles.filter(item => item.value !== label), value(label)] }
  if (category === 'sound' || category === 'audio') return { ...state, soundscape: value(instruction || label) }
  if (category === 'location') return { ...state, environment: value(label) }
  if (category === 'lighting') return { ...state, lighting: value(instruction || label) }
  if (category === 'preserve') {
    const target = label.match(/^Picture\s+(\d+)\s+(.+)$/i)
    const pictures = state.references.filter(ref => ref.file.kind === 'image')
    const selected = target ? pictures[Number(target[1]) - 1] : pictures.length === 1 ? pictures[0] : undefined
    if (!selected) return { ...state, conflicts: [{ code: 'command-target', severity: 'warning', message: 'Specify the reference: //preserve Picture 3 wardrobe, environment, lighting' }] }
    const attributes = (target?.[2] || label).split(/[,·]/).map(item => item.trim().toLowerCase()).filter((item): item is Attribute => preserveAttributes.includes(item as Attribute))
    return { ...state, references: state.references.map(ref => ref.id === selected.id ? { ...ref, preserve: attributes } : ref), conflicts: [] }
  }
  if (category === 'character') return state.characters.some(item => item.name === label) ? state : { ...state, characters: [...state.characters, { id: `character-${label}`, name: label, attributes: {} }] }
  return { ...state, continuity: { ...state.continuity, notes: value(instruction || label) } }
}
