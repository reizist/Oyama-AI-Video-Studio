import { cameraAttributes, expandEmbeddedAudio, extractSceneDialogue, suggestScene, type Attribute, type Camera, type Conflict, type ScenePromptState, type SceneReference, type Value } from './scenePromptState'

export type H3Mode = 'T2VA' | 'I2VA' | 'FL2VA' | 'L2VA' | 'Ref2VA'
export type CompiledScene = { mode: H3Mode; prompt: string; conflicts: Conflict[]; references: Array<{ id: string; label: string; role: string }>; subjects: Array<{ label: string; name: string; attributes: string[]; excluded: string[] }>; speakers: Record<string, string>; timing: Array<{ shot: number; start: number; end: number }> }
const stamp = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toFixed(3).padStart(6, '0')}`
const clean = (text: string) => text.replace(/<\/?(?:Subject|Picture|Video|Audio|d|scenetrans|cutoff)\b[^>]*>/gi, '').trim()
const present = (field?: Value) => field?.value.trim() || ''
const same = (a: string, b: string) => a.toLowerCase().replace(/[-\s]/g, '') === b.toLowerCase().replace(/[-\s]/g, '')
const personAttributes: Attribute[] = ['identity', 'face', 'body', 'hair', 'wardrobe', 'accessories']

export const promptMarkupLegend = [
  { tag: '##scene', description: 'Main visual action, composition, and camera direction.' },
  { tag: '##music', description: 'Non-diegetic score; compiled into non_diegetic_music.' },
  { tag: '##soundscape', description: 'Diegetic ambience, effects, and sounds in the world.' },
  { tag: '##style', description: 'Comma-separated visual treatments.' },
  { tag: '##location', description: 'Environment and fixed geography.' },
  { tag: '##lighting', description: 'Lighting direction, color, and atmosphere.' },
] as const

export function parsePromptMarkup(input: string) {
  const known = new Set(promptMarkupLegend.map(item => item.tag.slice(2)))
  const fields = new Map<string, string[]>()
  const prelude: string[] = []
  let active: string | null = null
  let found = false
  for (const line of input.split(/\r?\n/)) {
    // Accept harmless authoring variations, but always compile them through
    // the canonical section names above. This is intentionally line-bound so
    // hashes in ordinary prose never become control syntax.
    const heading = line.match(/^\s*##\s*([a-z-]+)\s*(?::\s*)?(.*)$/i)
    if (heading && known.has(heading[1].toLowerCase())) {
      active = heading[1].toLowerCase()
      found = true
      fields.set(active, [...(fields.get(active) ?? []), ...(heading[2].trim() ? [heading[2].trim()] : [])])
    } else if (active) fields.set(active, [...(fields.get(active) ?? []), line])
    else prelude.push(line)
  }
  const get = (key: string) => fields.get(key)?.join('\n').trim() || ''
  return { found, scene: found ? [prelude.join('\n').trim(), get('scene')].filter(Boolean).join('\n\n') : input, music: get('music'), soundscape: get('soundscape'), styles: get('style').split(',').map(item => item.trim()).filter(Boolean), location: get('location'), lighting: get('lighting') }
}

export function compileScene(state: ScenePromptState): CompiledScene {
  const markup = parsePromptMarkup(state.scene)
  if (markup.found) state = { ...state, scene: markup.scene, music: markup.music ? { value: markup.music, source: 'USER' } : state.music, soundscape: markup.soundscape ? { value: markup.soundscape, source: 'USER' } : state.soundscape, styles: markup.styles.length ? markup.styles.map(item => ({ value: item, source: 'USER' as const })) : state.styles, environment: markup.location ? { value: markup.location, source: 'USER' } : state.environment, lighting: markup.lighting ? { value: markup.lighting, source: 'USER' } : state.lighting }
  const conflicts: Conflict[] = [...state.conflicts]
  state = extractSceneDialogue(state)
  // Explicit named clothing instructions outrank reusable wardrobe references.
  // Keep this conservative; ambiguous prose remains visible for author review.
  state = { ...state, characters: state.characters.map(character => {
    const name = character.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const wardrobe = state.scene.match(new RegExp(`\\b${name} (?:wears|is wearing|changes into) ([^.!?]+)`, 'i'))?.[1]
    const explicit = character.attributes.wardrobe
    if (wardrobe && explicit?.value && (explicit.source === 'USER' || explicit.locked) && !same(wardrobe, explicit.value)) {
      conflicts.push({ code: 'wardrobe-conflict', severity: 'error', message: `${character.name}: Scene requests ${wardrobe}, but Character wardrobe is ${explicit.value}.` })
      return character
    }
    return wardrobe && !explicit?.locked ? { ...character, attributes: { ...character.attributes, wardrobe: { value: wardrobe, source: 'USER' as const } } } : character
  }) }
  const error = (code: string, message: string, referenceId?: string) => conflicts.push({ code, message, severity: 'error', referenceId })
  const warning = (code: string, message: string, referenceId?: string) => conflicts.push({ code, message, severity: 'warning', referenceId })
  const explicitNudityDirection = /\b(?:nude|naked|undressed|topless|bare(?:-chested|-foot)?|without\s+(?:any\s+)?(?:clothes|clothing|garments))\b/i.test(state.scene)
  let wardrobeConflictReported = false
  const refs = expandEmbeddedAudio(state.references)
  const openings = refs.filter(ref => ref.anchor === 'opening')
  const endings = refs.filter(ref => ref.anchor === 'ending')
  const mode: H3Mode = state.mode === 'reference' ? 'Ref2VA' : openings.length && endings.length ? 'FL2VA' : endings.length ? 'L2VA' : openings.length ? 'I2VA' : 'T2VA'
  const counters = { image: 0, video: 0, audio: 0 }
  const labels = new Map(refs.map(ref => [ref.id, `<${ref.file.kind === 'image' ? 'Picture' : ref.file.kind === 'video' ? 'Video' : 'Audio'} ${++counters[ref.file.kind]}>`]))
  const mapping = refs.map(ref => ({ id: ref.id, label: labels.get(ref.id)!, role: ref.anchor || ref.audio?.layer || ref.videoRole || (ref.file.referenceRole === 'wardrobe' ? 'wardrobe' : '') || ref.preserve.join(', ') || 'unassigned' }))
  // A wardrobe-role picture is authoritative even if a legacy scene state did
  // not yet copy `wardrobe` into its preserve list. Keep this normalization in
  // the compiler so the transport and UI cannot accidentally drop clothing.
  const wardrobeRefs = refs.filter(ref => ref.file.kind !== 'audio' && (ref.file.referenceRole === 'wardrobe' || ref.preserve.includes('wardrobe')))
  const unownedWardrobeRefs = wardrobeRefs.filter(ref => !ref.ownerId)
  if (state.view !== 'manual' && !state.scene.trim() && !state.dialogue.length && !state.shots.some(shot => shot.description.trim())) error('empty-scene', 'The Scene field is empty.')
  if (!Number.isFinite(state.duration) || state.duration <= 0 || state.duration > 15) error('duration', 'Choose a clip duration greater than 0 and no longer than 15 seconds.')
  if (openings.length > 1 || endings.length > 1) error('multiple-anchors', 'Only one native Frame 0 anchor and one ending-frame anchor can be active.')
  if (state.mode === 'image' && !openings.length) error('missing-opening', 'Choose an opening frame for image-to-video.')
  if (state.mode === 'frames' && !endings.length) error('missing-ending', 'Choose an ending frame. The opening frame is optional for last-frame generation.')
  if (mode === 'Ref2VA' && !counters.image && !counters.video) error('visual-required', 'Reference generation requires an image or video; audio cannot be the only input.')
  if (counters.image > 9 || counters.video > 3 || counters.audio > 3) error('reference-limit', 'Reference limits are 9 images, 3 videos and 3 audio files.')
  if (new Set(refs.map(ref => ref.id)).size !== refs.length) error('duplicate-reference', 'Reference IDs must be unique.')
  const shots = state.shots
  if (!shots.length) error('missing-shots', 'Add at least one shot.')
  shots.forEach((shot, index) => {
    if (!Number.isFinite(shot.start) || !Number.isFinite(shot.end) || shot.end <= shot.start || shot.start < 0 || shot.end > state.duration || (index === 0 && shot.start !== 0) || (index > 0 && shot.start !== shots[index - 1].end)) error('shot-timing', `Shot ${index + 1} must follow the previous shot without gaps and stay inside ${state.duration}s.`)
  })
  if (shots.length && shots.at(-1)!.end !== state.duration) error('shot-end', 'The final shot must end at the selected clip duration.')
  const detected = suggestScene(state.scene)
  for (const suggestion of detected) {
    const explicit = state.camera[suggestion.field as keyof Camera]
    if (explicit?.source === 'USER' && explicit.value && !same(explicit.value, suggestion.value)) error('camera-conflict', `Scene requests ${suggestion.value}, but ${suggestion.field} is explicitly ${explicit.value}. Resolve the two user instructions.`)
  }
  for (const ref of refs) {
    if (ref.ownerId && !state.characters.some(character => character.id === ref.ownerId)) error('missing-owner', `${ref.name} belongs to a character that is no longer present.`, ref.id)
    const retainedPersonAttributes = [...new Set([...ref.preserve, ...(ref.file.referenceRole === 'wardrobe' ? ['wardrobe' as Attribute] : [])])].filter(attribute => personAttributes.includes(attribute))
    const wardrobeOnly = retainedPersonAttributes.length === 1 && retainedPersonAttributes[0] === 'wardrobe'
    if (!ref.ownerId && retainedPersonAttributes.length && !(wardrobeOnly && state.characters.length <= 1)) error('owner-required', `Assign a character to ${ref.name} before retaining identity, hair, accessories, or wardrobe shared by multiple subjects.`, ref.id)
    if (!ref.ownerId && wardrobeOnly && state.characters.length > 1) error('owner-required', `Assign ${ref.name} to the character who should wear it; an unassigned wardrobe cannot be shared by multiple subjects.`, ref.id)
    if (ref.anchor) {
      if (ref.file.kind !== 'image') error('anchor-kind', 'Literal frame anchors must be images.', ref.id)
      const shot = ref.anchor === 'ending' ? shots.at(-1) : shots[0]
      const camera = { ...state.camera, ...shot?.camera }
      for (const attribute of ['shotSize', 'angle'] as const) {
        const requested = present(camera[attribute]) || (ref.anchor === 'opening' ? detected.find(item => item.field === attribute)?.value : '')
        if (requested && ref.observed[attribute] && !same(requested, ref.observed[attribute]!)) error('anchor-conflict', `${ref.name} anchors ${ref.observed[attribute]}, conflicting with ${requested}. Remove the anchor or change the shot.`, ref.id)
        else if (requested && !ref.observed[attribute] && !ref.reviewed) error('anchor-review', `Review ${ref.name}'s framing against ${requested}; its ${attribute} has not been described.`, ref.id)
      }
      for (const attribute of ref.preserve) {
        const explicit = ref.ownerId ? state.characters.find(character => character.id === ref.ownerId)?.attributes[attribute] : state.overrides[attribute] || (attribute === 'environment' ? state.environment : attribute === 'lighting' ? state.lighting : undefined)
        if (explicit?.source === 'USER' && explicit.value && ref.observed[attribute] && !same(explicit.value, ref.observed[attribute]!)) error('anchor-attribute', `${ref.name} fixes ${attribute} as ${ref.observed[attribute]}. The explicit ${explicit.value} instruction conflicts with this literal frame.`, ref.id)
      }
    }
    for (const attribute of ref.locks) {
      const requested = attribute === 'shotSize' || attribute === 'angle' ? state.camera[attribute]?.value || detected.find(item => item.field === attribute)?.value : state.overrides[attribute]?.value
      if (requested && ref.observed[attribute] && !same(requested, ref.observed[attribute]!)) error('reference-lock', `${ref.name} locks ${attribute} to ${ref.observed[attribute]}, which conflicts with ${requested}. Unlock it to change the shot.`, ref.id)
    }
    if (mode === 'Ref2VA' && ref.file.kind === 'image' && !ref.preserve.length && !ref.locks.length && !ref.anchor) error('role-required', `Choose what ${ref.name} contributes, or remove it.`, ref.id)
  }
  if (state.continuity.exactFrame && !openings.length) error('continuation-anchor', 'Frame-0 continuation is required, but no picture is assigned as the native Frame 0 anchor.')
  const vocalDirection = /\b(?:says|whispers|shouts|speaks|asks|replies|sings|narrates)\b|<d>/i
  if (state.noDialogue && (state.dialogue.length || vocalDirection.test(`${state.scene}\n${state.soundscape.value}`) || refs.some(ref => ref.audio?.layer === 'voice'))) error('speech-disabled', 'Dialogue, vocal direction, or a voice reference is present while No dialogue is enabled.')
  if (/<(?:Subject|Picture|Video|Audio)\s+\d+>|(?:subject_definitions|integrated_multimodal_description|retention_analysis):/i.test(state.scene)) warning('legacy-format', 'This scene contains compiled H3 syntax. Use Manual Override to preserve an existing H3 prompt, or replace it with a natural scene description.')

  const speakers: Record<string, string> = {}
  const dialogue = [...state.dialogue].sort((a, b) => (shots.findIndex(shot => shot.id === a.shotId) - shots.findIndex(shot => shot.id === b.shotId)) || a.at - b.at)
  for (const line of dialogue) {
    const shot = shots.find(shot => shot.id === line.shotId)
    if (!shot || !Number.isFinite(line.at) || line.at < shot.start || line.at >= shot.end) error('dialogue-time', 'Dialogue must begin within its assigned shot.')
    if (!line.text.trim() || !line.language.trim() || !line.speakerIds.length) error('dialogue-fields', 'Each dialogue line needs a speaker, language and spoken words.')
    if (/<\/?(?:d|scenetrans|cutoff)>|[<>]/.test(line.text) || /[[\]<>]/.test(line.language)) error('dialogue-markup', 'Write plain dialogue and a language name; the compiler owns dialogue tags.')
    line.speakerIds.forEach(id => { if (!state.characters.some(character => character.id === id)) error('speaker-missing', 'A dialogue speaker is no longer in the scene.'); if (!speakers[id]) speakers[id] = `S${Object.keys(speakers).length + 1}` })
    if (shot && line.text.split(/\s+/).length / 3 > shot.end - line.at && !line.cutoff && !line.continues) warning('speech-fit', 'A dialogue line may be too long for its remaining shot time.')
    if ((line.continues === 'from' || line.continues === 'both') && !dialogue.some(other => other.shotId === shots[shots.findIndex(s => s.id === line.shotId) - 1]?.id && (other.continues === 'to' || other.continues === 'both') && other.speakerIds.join() === line.speakerIds.join())) error('speech-continuation', 'Dialogue across a cut needs matching continuation parts and the same speaker.')
    if ((line.continues === 'to' || line.continues === 'both') && !dialogue.some(other => other.shotId === shots[shots.findIndex(s => s.id === line.shotId) + 1]?.id && (other.continues === 'from' || other.continues === 'both') && other.speakerIds.join() === line.speakerIds.join())) error('speech-continuation', 'Add the dialogue continuation in the following shot.')
  }
  const definitions: string[] = [], retention: string[] = [], wardrobeContracts: string[] = []
  const subjects: CompiledScene['subjects'] = []
  const subjectByOwner = new Map<string, string>()
  const assignments = new Map<string, SceneReference[]>()
  const shotList = shots.map((_, i) => `[Shot ${i + 1}]`).join(', ')
  const defineSubject = (name: string, fields: Array<[Attribute, Value]>, key: string) => {
    const label = `<Subject ${subjects.length + 1}>`
    subjectByOwner.set(key, label)
    const attributes = fields.map(([attribute, field]) => {
      const references = field.referenceIds?.map(id => labels.get(id)).filter(Boolean).join(' + ') || ''
      const observed = field.value ? ` (${clean(field.value)})` : ''
      // A wardrobe preserve assignment needs an explicit clothing contract.
      // A bare `<Picture N>` is too weak for Ref2VA: the model can keep the
      // identity while treating the identity photo as irrelevant clothing and
      // generating an undressed subject. Keep this deterministic and scoped to
      // the assigned wardrobe source so other preserved attributes remain
      // independently composable.
      if (attribute === 'wardrobe' && (references || field.value)) {
        if (explicitNudityDirection && !wardrobeConflictReported) {
          error('wardrobe-nudity-conflict', 'Scene explicitly requests nudity while a preserved wardrobe is active. Remove the nudity direction or disable Wardrobe Preserve before rendering.', field.referenceIds?.[0])
          wardrobeConflictReported = true
        }
        const safety = explicitNudityDirection
          ? 'an explicit nudity direction conflicts with this preserved wardrobe and must be resolved before rendering'
          : 'do not remove clothing, substitute identity-photo clothing, or render the subject nude or undressed'
        // Keep the explicit value formatting used by the existing compiler
        // when a USER/PROJECT wardrobe overrides a reference. The extra
        // contract is appended without replacing that authored value.
        const contract = `${attribute}: ${references}${observed} (mandatory complete wardrobe; fully clothed in every assigned garment, layer, and item of footwear; retain the visible fit, coverage, materials, and closures; ${safety})`
        wardrobeContracts.push(`${label} wardrobe contract: ${contract}. Apply this clothing contract to ${clean(name)} only.`)
        return contract
      }
      return `${attribute}: ${references}${observed}`
    })
    const excluded = cameraAttributes.filter(attribute => !fields.some(([key]) => key === attribute))
    subjects.push({ label, name, attributes, excluded })
    definitions.push(`${label} is ${clean(name)}. ${attributes.join('; ')}. Only these assigned attributes belong to this subject.${excluded.length ? ` Unassigned ${excluded.join(', ')} are not inherited.` : ''} Do not transfer attributes from another subject's sources.`)
    retention.push(`${label} (appears in ${shotList}): fully_preserved - retain the defined attributes within their assigned scope; compose each target shot using its own camera direction.${fields.some(([attribute, field]) => attribute === 'wardrobe' && (field.referenceIds?.length || field.value)) ? ' The assigned wardrobe is mandatory for every frame; keep the subject clothed throughout the shot.' : ''}`)
  }
  refs.filter(ref => ref.file.kind !== 'audio').forEach(ref => {
    for (const attribute of [...new Set([...ref.preserve, ...(ref.file.referenceRole === 'wardrobe' ? ['wardrobe' as Attribute] : [])]), ...ref.locks]) {
      const key = `${personAttributes.includes(attribute) ? ref.ownerId || ref.id : 'scene'}:${attribute}`
      assignments.set(key, [...(assignments.get(key) || []), ref])
    }
  })
  const fieldsFor = (key: string, explicit: Partial<Record<Attribute, Value>>) => {
    const fields: Array<[Attribute, Value]> = []
    const attributes = [...new Set([...assignments.keys()].filter(item => item.startsWith(`${key}:`)).map(item => item.split(':').at(-1) as Attribute).concat(Object.keys(explicit) as Attribute[]))]
    for (const attribute of attributes) {
      const authored = explicit[attribute] || state.overrides[attribute]
      const sources = assignments.get(`${key}:${attribute}`) || []
      if (authored?.value && (authored.source === 'USER' || authored.locked || !sources.length)) { fields.push([attribute, authored]); continue }
      if (sources.length) {
        const owned = sources.filter(ref => ref.ownerId === key)
        const pool = owned.length ? owned : sources
        // Identity may intentionally have multiple angles. Other attributes need
        // one canonical source; competing sources are resolved in the UI.
        if (pool.length > 1 && !['identity', 'face', 'body'].includes(attribute)) error('attribute-sources', `${attribute} has multiple sources for ${state.characters.find(character => character.id === key)?.name || 'the scene'}. Choose one canonical source.`, pool[0].id)
        fields.push([attribute, { value: pool.map(ref => ref.observed[attribute]).filter(Boolean).join('; '), source: 'PRESERVE', referenceIds: pool.map(ref => ref.id) }])
      } else if (authored?.value) fields.push([attribute, authored])
    }
    return fields
  }
  for (const character of state.characters) {
    const fields = fieldsFor(character.id, character.attributes)
    // A standalone wardrobe is unowned by design when the scene has one
    // structured character. Attach it to that sole subject so the Ref2VA
    // subject definition carries the actual clothing source.
    if (state.characters.length === 1 && unownedWardrobeRefs.length && !fields.some(([attribute]) => attribute === 'wardrobe')) {
      fields.push(['wardrobe', { value: unownedWardrobeRefs.map(ref => ref.observed.wardrobe).filter(Boolean).join('; '), source: 'PRESERVE', referenceIds: unownedWardrobeRefs.map(ref => ref.id) }])
    }
    if (fields.length && mode === 'Ref2VA') defineSubject(character.name, fields, character.id)
  }
  if (!state.characters.length && unownedWardrobeRefs.length && mode === 'Ref2VA') {
    defineSubject('the visible subject', [['wardrobe', { value: unownedWardrobeRefs.map(ref => ref.observed.wardrobe).filter(Boolean).join('; '), source: 'PRESERVE', referenceIds: unownedWardrobeRefs.map(ref => ref.id) }]], 'visible-subject')
  }
  const environmentFields = fieldsFor('scene', { ...state.overrides, ...(state.environment.value ? { environment: state.environment } : {}), ...(state.lighting.value ? { lighting: state.lighting } : {}) })
  if (environmentFields.length && mode === 'Ref2VA') defineSubject('the target scene environment and visual treatment', environmentFields, 'scene')
  // Standalone Wardrobe Studio loads have no character owner. They are valid
  // for a single visible subject (or a scene with no structured cast), but the
  // clothing contract must still be emitted so H3 cannot fall back to nudity.
  unownedWardrobeRefs.filter(() => state.characters.length > 1).forEach(ref => {
    const label = labels.get(ref.id)!
    const observed = ref.observed.wardrobe ? ` (${clean(ref.observed.wardrobe)})` : ''
    const target = state.characters.length === 1 ? clean(state.characters[0].name) : 'the visible subject'
    if (explicitNudityDirection && !wardrobeConflictReported) {
      error('wardrobe-nudity-conflict', 'Scene explicitly requests nudity while a preserved wardrobe is active. Remove the nudity direction or disable Wardrobe Preserve before rendering.', ref.id)
      wardrobeConflictReported = true
    }
    const safety = explicitNudityDirection
      ? 'an explicit nudity direction conflicts with this preserved wardrobe and must be resolved before rendering'
      : 'do not remove clothing, substitute identity-photo clothing, or render the subject nude or undressed'
    wardrobeContracts.push(`${label} wardrobe contract: wardrobe: ${label}${observed} (mandatory complete wardrobe; fully clothed in every assigned garment, layer, and item of footwear; retain the visible fit, coverage, materials, and closures; ${safety}). Apply this clothing contract to ${target} only.`)
  })
  for (const ref of refs) {
    const label = labels.get(ref.id)!
    if (ref.anchor || ref.locks.includes('composition')) {
      const role = ref.anchor === 'ending' ? `[Shot ${shots.length}] last frame at ${state.duration.toFixed(2)} seconds` : ref.anchor === 'keyframe' ? `[Shot ${ref.anchorShot || 1}] keyframe at ${ref.anchorTime ?? 0} seconds` : ref.anchor === 'opening' ? '[Shot 1] first frame at 0.00 seconds' : 'explicit composition anchor'
      definitions.push(`${label} is the ${role}. Preserve the complete visual state, composition, placement, pose, wardrobe, environment and lighting.`)
      retention.push(`${label} (${role}): fully_preserved - match the literal visual state at its assigned time.`)
    }
    if (ref.file.kind === 'video') {
      const role = ref.videoRole || 'motion'
      definitions.push(`${label} provides ${role === 'continuation' ? 'the source video whose final state the target continues' : role === 'editing' ? 'the source video to edit' : role === 'structure' ? 'the source cut and pacing structure' : 'the requested movement qualities'}.`)
      retention.push(`${label} (${role}): ${role === 'editing' ? 'partially_preserved' : role === 'continuation' ? 'fully_preserved' : 'weak_reference'} - ${role === 'continuation' ? 'continue its final state with new subsequent action' : `use only the assigned ${role} relationship`}.`)
    }
    if (ref.audio) {
      const audio = ref.audio
      if (audio.layer === 'voice' && (!audio.speakerId || !speakers[audio.speakerId])) error('audio-speaker', `${ref.name} needs a target speaker with an actual vocal event.`, ref.id)
      if (audio.relation === 'fully_copy' && (audio.layer !== 'soundtrack' || state.dialogue.length || state.soundscape.value || state.music.value || refs.some(other => other.id !== ref.id && other.audio))) error('full-audio-conflict', 'Complete audio reuse must be the entire soundtrack without added dialogue, score, ambience or other audio sources.', ref.id)
      const speaker = audio.speakerId ? `${subjectByOwner.get(audio.speakerId) || state.characters.find(c => c.id === audio.speakerId)?.name || 'speaker'} (${speakers[audio.speakerId] || '?'})` : ''
      definitions.push(`${label} is the ${audio.layer} source${speaker ? ` for ${speaker}` : ''}: ${clean(audio.description)}.`)
      retention.push(`${label}: ${audio.relation} - ${audio.relation === 'reference' ? 'follow only the assigned sound characteristics; do not copy the original signal or words' : audio.relation === 'fully_copy' ? 'reuse the source as the complete final audio track' : audio.relation === 'partially_copy' ? 'copy only the specified source layers or time range' : 'use only broad auditory similarity'}.`)
    }
  }
  function cameraText(camera: Camera) {
    const move = present(camera.movement)
    const movements: Record<string, string> = { 'Pull Out': 'physically pulls backward', 'Push In': 'physically pushes forward', 'Zoom Out': 'zooms out by changing focal length while its body stays in place', 'Zoom In': 'zooms in by changing focal length while its body stays in place', 'Static Shot': 'holds a static shot' }
    return [present(camera.shotSize), present(camera.angle), move && `The camera ${movements[move] || move.toLowerCase()}${present(camera.amplitude) ? ` with ${present(camera.amplitude).toLowerCase()} amplitude` : ''}${present(camera.speed) ? ` at ${present(camera.speed).toLowerCase()} speed` : ''}`, present(camera.stabilization), present(camera.behavior)].filter(Boolean).map(text => text.replace(/[.]+$/, '')).join('. ')
  }
  const styles = state.styles.map(item => clean(item.value)).filter(Boolean).join(', ')
  const description = shots.map((shot, index) => {
    const prefix = index ? `[Shot ${index + 1}] At ${stamp(shot.start)}, the camera cuts to` : '[Shot 1]'
    const cast = state.characters.filter(character => !shot.characterIds.length || shot.characterIds.includes(character.id)).map(character => mode === 'Ref2VA' && subjectByOwner.has(character.id) ? `${subjectByOwner.get(character.id)} (${clean(character.name)})` : clean(character.name)).join(', ')
    const spoken = dialogue.filter(line => line.shotId === shot.id).map(line => {
      const names = line.speakerIds.map(id => mode === 'Ref2VA' && subjectByOwner.has(id) ? subjectByOwner.get(id) : clean(state.characters.find(character => character.id === id)?.name || 'Speaker')).join(' and ')
      const ids = line.speakerIds.map(id => speakers[id]).join(',')
      const before = line.continues === 'from' || line.continues === 'both' ? '<scenetrans>' : ''
      const after = line.cutoff ? '<cutoff>' : line.continues === 'to' || line.continues === 'both' ? '<scenetrans>' : ''
      const audio = refs.filter(ref => ref.audio?.layer === 'voice' && line.speakerIds.includes(ref.audio.speakerId || '')).map(ref => `${labels.get(ref.id)} (${ref.audio!.relation}: ${clean(ref.audio!.description)})`).join(', ')
      return `At ${line.at.toFixed(2)} seconds, ${names} (${ids}) ${line.voiceover ? 'says in an off-screen voiceover' : line.offscreen ? 'speaks off-screen' : 'says'}${line.delivery ? `, ${clean(line.delivery)}` : ''}${audio ? ` using ${audio}` : ''}: <d>[${line.language}] ${before}${line.text}${after}</d>${line.voiceover ? ' while the corresponding on-screen character’s lips remain completely closed.' : ''}${line.continues ? ' The audio continues seamlessly across the cut.' : ''}`
    }).join('\n')
    const anchor = openings.length && index === 0 ? `The shot begins from ${labels.get(openings[0].id)}, matching its literal visual state before motion develops.` : ''
    const ending = endings.length && index === shots.length - 1 ? `Converge continuously to ${labels.get(endings[0].id)} at ${state.duration.toFixed(2)} seconds.` : ''
    const environment = mode === 'Ref2VA' && subjectByOwner.has('scene') ? `Set in ${subjectByOwner.get('scene')}.` : [present(state.environment), present(state.lighting)].filter(Boolean).join('. ')
    return [prefix, !index && mode !== 'Ref2VA' && styles, anchor, cameraText({ ...state.camera, ...shot.camera }), cast && `Visible subjects: ${cast}.`, environment, index === 0 && clean(state.scene), clean(shot.description), spoken, ending].filter(Boolean).join(' ')
  }).join('\n')
  const audioLayer = (layer: string) => refs.filter(ref => ref.audio && (ref.audio.layer === layer || ref.audio.layer === 'soundtrack')).map(ref => `${labels.get(ref.id)}: ${ref.audio!.relation} - ${clean(ref.audio!.description)}.`).join(' ')
  const fullAudio = refs.some(ref => ref.audio?.relation === 'fully_copy')
  const sound = [
    present(state.soundscape) || (fullAudio ? '' : 'Natural environmental ambience and physical sounds follow the visible action.'),
    state.noDialogue && 'No dialogue, spoken words, human voices, narration, singing, vocalizations, lip-sync, crowd chatter, television or radio voices.',
    audioLayer('ambience'),
  ].filter(Boolean).join(' ')
  const music = [present(state.music), audioLayer('music')].filter(Boolean).join(' ') || 'N/A'
  const continuity = [state.continuity.scene && 'Maintain established scene identity and environment; each shot has its own composition.', state.continuity.camera && 'Preserve screen direction and the established side of the action axis.', present(state.continuity.notes), state.naturalMovement && 'Living subjects breathe and blink subtly without adding new gestures.', state.noDialogue && 'Audio rule: no speech, spoken words, dialogue, narration, voice-over, singing, vocalization or lip-sync. Keep mouths silent and closed except for natural breathing; use ambience and synchronized physical sounds only.'].filter(Boolean).join(' ')
  const task = refs.some(ref => ref.videoRole === 'editing') ? 'video editing' : refs.some(ref => ref.videoRole === 'continuation') ? 'video continuation' : 'reference generation'
  const audioTask = refs.some(ref => ref.audio?.relation === 'fully_copy' || ref.audio?.relation === 'partially_copy') ? ' + audio reuse' : refs.some(ref => ref.audio) ? ' + audio reference' : ''
  const alignment = mode === 'I2VA' ? 'For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.' : mode === 'FL2VA' ? `How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot ${shots.length}) aligns with the ${state.duration.toFixed(2)}-second mark of the target video.` : mode === 'L2VA' ? `How the reference pictures align with the target video — <Picture 1> (from [Shot ${shots.length}]) aligns with the ${state.duration.toFixed(2)}-second mark of the target video.` : ''
  const clothingDirection = wardrobeContracts.length
    ? explicitNudityDirection
      ? `WARDROBE PRESERVATION CONFLICT:\n${wardrobeContracts.join('\n')}\nThe authored Scene contains an explicit nudity direction. Resolve this conflict before rendering; the explicit user direction takes priority once the wardrobe preserve assignment is removed.`
      : `WARDROBE PRESERVATION (mandatory):\n${wardrobeContracts.join('\n')}\nDo not produce nudity or an undressed body when a wardrobe contract is active.`
    : ''
  const compiled = mode === 'Ref2VA' ? [`subject_definitions:\n${definitions.join('\n')}`, `summary: [${task}${audioTask}] Create a ${state.duration.toFixed(2)}-second target video using the defined reference roles.`, `retention_analysis:\n${retention.join('\n')}`, `detailed_description: ${styles ? `The target video uses ${styles}.\n` : ''}${clothingDirection ? `${clothingDirection}\n` : ''}${description}\n${continuity}`, `overall_soundscape: ${sound}`, `non_diegetic_music: ${music}`].join('\n\n') : [alignment, `integrated_multimodal_description: ${clothingDirection ? `${clothingDirection}\n` : ''}${description}\n${continuity}`, `overall_soundscape: ${sound}`, `non_diegetic_music: ${music}`].filter(Boolean).join('\n\n')
  const prompt = state.view === 'manual' ? state.manualPrompt : compiled
  if (state.view === 'manual') {
    if (!prompt.trim()) error('empty-manual', 'Manual Override is empty.')
    for (const match of prompt.matchAll(/<(Picture|Video|Audio)\s+(\d+)>/g)) {
      const count = match[1] === 'Picture' ? counters.image : match[1] === 'Video' ? counters.video : counters.audio
      if (+match[2] < 1 || +match[2] > count) error('manual-reference', `${match[0]} has no attached input. Update Manual Override after changing references.`)
    }
    for (const match of prompt.matchAll(/\[Shot (\d+)\] At (\d+):(\d+\.\d+)/g)) if (+match[2] * 60 + +match[3] >= state.duration) error('manual-timing', 'A manual cut falls outside the clip duration.')
  }
  return { mode, prompt, conflicts, references: mapping, subjects, speakers, timing: shots.map((shot, index) => ({ shot: index + 1, start: shot.start, end: shot.end })) }
}
