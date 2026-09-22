const assert = require('node:assert/strict')
const { load } = require('./test-ts-loader.cjs')
const { createSceneState, value, parseStyleValues, applySceneCommand, applySceneSuggestions, bindSceneReferences, defaultPreservedAttributes, extractSceneDialogue, setFrameZeroGuide } = load('src/lib/scenePromptState.ts')
const { compileScene, parsePromptMarkup } = load('src/lib/h3SceneCompiler.ts')
const { buildMiniMaxWorkflow } = load('src/lib/workflow.ts')
const { importSceneDraft } = load('src/lib/sceneLegacyAdapter.ts')
const { compileScratchpad } = load('src/lib/scratchpadCompiler.ts')
const clone = object => JSON.parse(JSON.stringify(object))
const image = name => ({ kind: 'image', name, path: `${name}.png` })
function kitchen() {
  let state = createSceneState('An extreme close-up of Kierra in the kitchen. The camera backs away.', 8, 'reference')
  state = bindSceneReferences(state, [
    { file: image('Face'), purpose: 'character', label: 'Character: Kierra / face', characterId: 'kierra', source: 'character-studio' },
    { file: image('Body'), purpose: 'character-angle', label: 'Character: Kierra / body', characterId: 'kierra', source: 'character-studio' },
    { file: image('Kitchen'), purpose: 'generic', label: 'Kitchen previous shot', source: 'shot' },
  ])
  state.references[2] = { ...state.references[2], ownerId: 'kierra', preserve: ['wardrobe', 'environment', 'lighting'], observed: { wardrobe: 'grey cardigan', environment: 'apartment kitchen', lighting: 'warm practical lights', shotSize: 'Medium Shot', angle: 'Eye Level' } }
  return state
}
const errors = state => compileScene(state).conflicts.filter(item => item.severity === 'error')
const markup = parsePromptMarkup('##scene\nA dancer crosses the room.\n\n##soundscape\nFootsteps on wood.\n\n##music\nSparse non-diegetic strings.')
assert.equal(markup.scene, 'A dancer crosses the room.')
assert.equal(markup.soundscape, 'Footsteps on wood.')
assert.equal(markup.music, 'Sparse non-diegetic strings.')
const completeMarkup = parsePromptMarkup('Opening prelude.\n\n## scene\nA dancer crosses the room.\n##STYLE: 35mm film, natural color\n## location\nA daylight studio.\n##LIGHTING\nSoft window light.\n##soundscape\nFootsteps.\n##music\nN/A')
assert.equal(completeMarkup.scene, 'Opening prelude.\n\nA dancer crosses the room.')
assert.equal(completeMarkup.styles.join('|'), '35mm film|natural color')
assert.equal(completeMarkup.location, 'A daylight studio.')
assert.equal(completeMarkup.lighting, 'Soft window light.')
const markupState = createSceneState('##scene\nA dancer crosses the room.\n##music\nSparse non-diegetic strings.', 5, 'text')
assert.match(compileScene(markupState).prompt, /non_diegetic_music: Sparse non-diegetic strings\./)
assert.doesNotMatch(compileScene(markupState).prompt, /##music/)
const completeMarkupState = createSceneState('## scene\nA dancer crosses the room.\n##STYLE: 35mm film, natural color\n## location\nA daylight studio.\n##LIGHTING\nSoft window light.\n##soundscape\nFootsteps.\n##music\nN/A', 5, 'text')
const completePrompt = compileScene(completeMarkupState).prompt
assert.match(completePrompt, /^integrated_multimodal_description:/)
assert.match(completePrompt, /overall_soundscape: Footsteps\./)
assert.match(completePrompt, /non_diegetic_music: N\/A$/)
assert.doesNotMatch(completePrompt, /##(?:scene|style|location|lighting|soundscape|music)/i)
assert.equal(compileScratchpad('##scene\nPortrait of a courier.\n##soundscape\nRain.\n##music\nStrings.', 'image', 5), 'Portrait of a courier.')
assert.equal(compileScratchpad('##scene\nA courier runs.\n##soundscape\nRain.\n##music\nStrings.', 'ltx25', 5), 'A courier runs.\n\nSoundscape: Rain.\n\nMusic: Strings.')
assert.equal(compileScratchpad('##scene\nA courier runs.\n##music\nStrings.', 'music', 5), 'Strings.')
assert.doesNotMatch(compileScratchpad('##scene\nA courier runs.\n##music\nStrings.', 'h3', 5), /##music/)
const refContinuation = bindSceneReferences(createSceneState('She continues walking.', 5, 'reference'), [{ file: { ...image('Previous final frame'), referenceRole: 'composition', referenceRetention: 'preserve', openingFrameTreatment: 'match' }, purpose: 'generic', label: 'Previous final frame', source: 'shot' }])
assert.equal(refContinuation.references[0].anchor, 'opening', 'Ref2VA continuation frame is a literal opening anchor')
assert.ok(refContinuation.references[0].locks.includes('composition'))
let frameZeroState = bindSceneReferences(createSceneState('Continue the shot.', 5, 'reference'), [
  { file: image('Identity'), purpose: 'character', label: 'Identity', characterId: 'person', source: 'character-studio' },
  { file: image('Previous frame'), purpose: 'generic', label: 'Previous frame', source: 'shot' },
])
frameZeroState = setFrameZeroGuide(frameZeroState, frameZeroState.references[1].id)
assert.equal(frameZeroState.references[1].anchor, 'opening', 'Frame 0 setting assigns the selected image as the native opening guide')
assert.equal(frameZeroState.references[0].anchor, undefined)
assert.equal(frameZeroState.continuity.exactFrame, true)
assert.equal(frameZeroState.continuity.scene, true)
frameZeroState = setFrameZeroGuide(frameZeroState, frameZeroState.references[0].id)
assert.equal(frameZeroState.references[0].anchor, 'opening', 'Selecting another Frame 0 guide replaces the previous opening guide')
assert.equal(frameZeroState.references[1].anchor, undefined)
frameZeroState = setFrameZeroGuide(frameZeroState)
assert.equal(frameZeroState.references.some(ref => ref.anchor === 'opening'), false)
assert.equal(frameZeroState.continuity.exactFrame, false)
const removedSource = bindSceneReferences(frameZeroState, [{ file: image('Identity'), purpose: 'character', label: 'Identity', characterId: 'person', source: 'character-studio' }])
assert.equal(removedSource.references.length, 1)
assert.equal(removedSource.continuity.exactFrame, false, 'removing the opening source clears frame continuity')
const removedAllSources = bindSceneReferences(removedSource, [])
assert.equal(removedAllSources.references.length, 0)
assert.equal(removedAllSources.characters.length, 0, 'removed library character leaves no stale subject')
assert.doesNotMatch(compileScene({ ...removedAllSources, mode: 'text' }).prompt, /<Picture|<Subject/)
const inheritedIdentity = bindSceneReferences(removedSource, [{ file: image('Identity'), purpose: 'generic', label: 'Inherited identity', source: 'continuity' }])
assert.equal(inheritedIdentity.references[0].ownerId, 'person', 'continuation retains the original character assignment')
assert.equal(compileScene(inheritedIdentity).conflicts.some(conflict => conflict.code === 'owner-required'), false)
assert.equal([...defaultPreservedAttributes({ file: { ...image('Wardrobe'), referenceRole: 'wardrobe' }, ownerId: 'kierra' })].join(','), 'wardrobe', 'Wardrobe Preserve keeps the wardrobe role')
assert.equal([...defaultPreservedAttributes({ file: { ...image('Identity'), referenceRole: 'subject' }, ownerId: 'kierra' })].join(','), 'identity,face,body', 'Identity Preserve keeps the identity role')
assert.equal(parseStyleValues('Found ')[0].value, 'Found ', 'style entry preserves a trailing space while typing')
assert.equal(parseStyleValues('Found footage, Low light').map(item => item.value).join(', '), 'Found footage, Low light')
let state = kitchen(), output = compileScene(state)
assert.equal(errors(state).length, 0)
assert.match(output.prompt, /<Subject 1> is Kierra/)
assert.match(output.prompt, /identity: <Picture 1> \+ <Picture 2>/)
assert.match(output.prompt, /wardrobe: <Picture 3>/)
assert.match(output.prompt, /mandatory complete wardrobe; fully clothed/)
assert.match(output.prompt, /Do not produce nudity or an undressed body/)
assert.doesNotMatch(output.prompt, /<Picture 3> is the .*frame/)
assert.ok(output.subjects[0].excluded.includes('shotSize'))
assert.doesNotMatch(output.prompt, /Medium Shot/)
assert.deepEqual(clone(state), clone(kitchen()), 'Compilation is pure')
let wardrobeOnly = bindSceneReferences(createSceneState('Kierra turns toward camera.', 5, 'reference'), [{ file: image('Approved wardrobe'), purpose: 'wardrobe', label: 'Wardrobe: Grey cardigan for Kierra', characterId: 'kierra', source: 'wardrobe-studio' }])
wardrobeOnly.characters = wardrobeOnly.characters.map(character => character.id === 'kierra' ? { ...character, name: 'Kierra' } : character)
output = compileScene(wardrobeOnly)
assert.match(output.prompt, /wardrobe: <Picture 1> \(mandatory complete wardrobe/)
assert.match(output.prompt, /fully clothed in every assigned garment/)
assert.match(output.prompt, /Do not produce nudity or an undressed body/)
wardrobeOnly.characters[0].attributes.wardrobe = value('the grey cardigan and trousers')
wardrobeOnly.references = []
output = compileScene(wardrobeOnly)
assert.match(output.prompt, /wardrobe: {2}\(the grey cardigan and trousers\) \(mandatory complete wardrobe/)
assert.match(output.prompt, /assigned wardrobe is mandatory for every frame/)
wardrobeOnly.scene = 'Kierra turns toward camera while nude.'
output = compileScene(wardrobeOnly)
assert.ok(errors(wardrobeOnly).some(item => item.code === 'wardrobe-nudity-conflict'))
assert.match(output.prompt, /explicit nudity direction conflicts with this preserved wardrobe/)
assert.match(output.prompt, /explicit user direction takes priority/)
assert.doesNotMatch(output.prompt, /Do not produce nudity or an undressed body when a wardrobe contract is active/)
state = applySceneSuggestions(state)
assert.equal(state.camera.movement.value, 'Pull Out')
assert.match(compileScene(state).prompt, /physically pulls backward/)
state = applySceneCommand(state, 'shot', 'Wide Shot')
assert.equal(applySceneSuggestions(state).camera.shotSize.value, 'Wide Shot', 'Suggestions cannot replace USER controls')
assert.ok(errors(state).some(item => item.code === 'camera-conflict'))
state = kitchen(); state.references[2].anchor = 'opening'
assert.ok(errors(state).some(item => item.code === 'anchor-conflict'))
state.references[2].observed.shotSize = ''
assert.ok(errors(state).some(item => item.code === 'anchor-review'))
state.references[2].reviewed = true
assert.equal(errors(state).length, 0)
state = kitchen(); state.camera.angle = value('Low Angle')
assert.equal(errors(state).length, 0, 'Preserve does not retain old camera angle')
state.references[2].locks = ['angle']
assert.ok(errors(state).some(item => item.code === 'reference-lock'))
state = kitchen(); state.characters[0].attributes.wardrobe = value('red coat')
output = compileScene(state)
assert.match(output.prompt, /wardrobe: {2}\(red coat\)/)
assert.doesNotMatch(output.subjects[0].attributes.join(), /grey cardigan/)
state = kitchen(); state.scene += ' Kierra wears a red coat.'
assert.match(compileScene(state).subjects[0].attributes.join(), /red coat/)
state = kitchen(); state.characters.push({ id: 'ben', name: 'Ben', attributes: {} })
state.references.push({ id: 'ben-face', file: image('Ben'), ownerId: 'ben', name: 'Ben face', preserve: ['identity'], locks: [], observed: {}, source: 'CHARACTER' })
output = compileScene(state)
assert.match(output.subjects.find(subject => subject.name === 'Ben').attributes.join(), /Picture 4/)
assert.doesNotMatch(output.subjects.find(subject => subject.name === 'Kierra').attributes.join(), /Picture 4/)
state.references[3].ownerId = 'missing'
assert.ok(errors(state).some(item => item.code === 'missing-owner'))
state = kitchen(); state.continuity.exactFrame = true
assert.ok(errors(state).some(item => item.code === 'continuation-anchor'))
state = kitchen(); state.scene = 'Kierra whispers, “What is it?”'
output = compileScene(state)
assert.match(output.prompt, /<Subject 1> \(S1\).*<d>\[English\] What is it\?<\/d>/)
assert.equal((output.prompt.match(/What is it/g) || []).length, 1)
assert.equal(extractSceneDialogue(state).dialogue[0].text, 'What is it?')
state.noDialogue = true
assert.ok(errors(state).some(item => item.code === 'speech-disabled'))
state = kitchen(); state.noDialogue = true; state.scene = 'Kierra waits silently by the counter.'
output = compileScene(state)
assert.match(output.prompt, /Audio rule: no speech, spoken words, dialogue, narration, voice-over, singing, vocalization or lip-sync/)
assert.match(output.prompt, /overall_soundscape: Natural environmental ambience and physical sounds follow the visible action\. No dialogue, spoken words, human voices, narration, singing, vocalizations, lip-sync, crowd chatter, television or radio voices\./)
state.scene = 'Kierra sings softly while she waits.'
assert.ok(errors(state).some(item => item.code === 'speech-disabled'))
state = kitchen(); state.shots = [{ id: 's1', start: 0, end: 4, description: '', camera: {}, characterIds: [] }, { id: 's2', start: 4, end: 8, description: 'She turns.', camera: {}, characterIds: [] }]
state.dialogue = [{ id: 'd1', shotId: 's1', at: 1, speakerIds: ['kierra'], language: 'English', text: 'I remember', delivery: 'quietly', continues: 'to' }, { id: 'd2', shotId: 's2', at: 4, speakerIds: ['kierra'], language: 'English', text: 'that room.', delivery: '', continues: 'from', voiceover: true }]
output = compileScene(state)
assert.match(output.prompt, /\[Shot 2\] At 00:04.000/)
assert.doesNotMatch(output.prompt, /\[Shot 1\] At/)
assert.equal((output.prompt.match(/<scenetrans>/g) || []).length, 2)
assert.match(output.prompt, /says in an off-screen voiceover/)
assert.match(output.prompt, /lips remain completely closed/)
state.shots[1].end = 9
assert.ok(errors(state).some(item => item.code === 'shot-timing'))
for (const [mode, first, last, expected] of [['text', null, null, 'T2VA'], ['image', image('first'), null, 'I2VA'], ['frames', image('first'), image('last'), 'FL2VA'], ['frames', null, image('last'), 'L2VA']]) {
  const base = bindSceneReferences(createSceneState('A leaf falls.', 8, mode), [], [], [], first, last)
  const result = compileScene(base)
  assert.equal(result.mode, expected)
  assert.equal(errors(base).length, 0)
  assert.match(result.prompt, /integrated_multimodal_description: \[Shot 1\]/)
  if (last) assert.match(result.prompt, /8\.00-second mark/)
  if (expected === 'L2VA') assert.match(result.prompt, /^How .*<Picture 1>/)
}
state = kitchen(); state.references.push({ id: 'sound', file: { kind: 'audio', path: 'voice.wav', name: 'Voice' }, name: 'Voice', preserve: [], locks: [], observed: {}, source: 'USER', audio: { layer: 'voice', relation: 'reference', speakerId: 'kierra', description: 'Breathy timbre' } })
state.scene = 'Kierra whispers, “What is it?”'
output = compileScene(state)
assert.match(output.prompt, /<Audio 1> is the voice source for <Subject 1> \(S1\)/)
assert.match(output.prompt, /\[reference generation \+ audio reference\]/)
assert.doesNotMatch(output.prompt.split('retention_analysis:')[1].split('detailed_description:')[0], /\(S1\)/)
state.scene = 'Kierra waits silently by the counter.'
state.noDialogue = true
assert.ok(errors(state).some(item => item.code === 'speech-disabled'))
state.noDialogue = false
state.soundscape = value('Quiet room tone.')
state.references[3].audio = { layer: 'soundtrack', relation: 'fully_copy', description: 'Entire original track' }
assert.ok(errors(state).some(item => item.code === 'full-audio-conflict'))
state = kitchen(); state.references.push({ id: 'video', file: { kind: 'video', path: 'v.mp4', name: 'Video' }, name: 'Movement', preserve: [], locks: [], observed: {}, source: 'USER', videoRole: 'motion', embeddedAudio: { layer: 'ambience', relation: 'reference', description: 'Rain texture' } }, { id: 'audio', file: { kind: 'audio', path: 'a.wav', name: 'Audio' }, name: 'Score', preserve: [], locks: [], observed: {}, source: 'USER', audio: { layer: 'music', relation: 'reference', description: 'Slow piano' } })
output = compileScene(state)
assert.equal(output.references.find(ref => ref.id === 'video:soundtrack').label, '<Audio 1>')
assert.equal(output.references.find(ref => ref.id === 'audio').label, '<Audio 2>')
state = kitchen(); state.view = 'manual'; state.manualPrompt = 'MY deliberate manual prompt'
assert.equal(compileScene(state).prompt, state.manualPrompt)
state.camera.angle = value('High Angle')
assert.equal(compileScene(state).prompt, state.manualPrompt)
const imported = importSceneDraft('integrated_multimodal_description: [Shot 1] A leaf falls.\noverall_soundscape: N/A\nnon_diegetic_music: N/A', 5, 'text')
assert.equal(imported.view, 'manual')
assert.equal(compileScene(imported).prompt, imported.manualPrompt)
state = kitchen(); state.scene = 'Kierra waits in the kitchen.'; state.references[2].anchor = 'opening'
const models = { fl2va:'base', ref2va:'reference', textEncoder:'encoder', videoVae:'video', audioVae:'audio' }
const options = { mode:'reference', sceneState:state, prompt:compileScene(state).prompt, duration:8, width:1344, height:768, seed:1, steps:20, turbo:'off', sampler:'res_multistep', scheduler:'simple', refImageSize:'match', filenamePrefix:'test', referenceImages:state.references.map(ref=>ref.file.path), referenceVideos:[], referenceAudios:[] }
const uploads = { images:state.references.map(ref=>({ name:ref.file.path })), videos:[], audios:[] }
const graph = buildMiniMaxWorkflow(options, models, uploads)
assert.equal(graph['602'].class_type, 'MiniMaxH3AddGuide')
assert.equal(graph['602'].inputs.frame_idx, 0)
assert.deepEqual(clone(graph['12'].inputs.conditioning), ['602',0])
assert.equal(graph['10'].inputs.prompt, compileScene(state).prompt)
assert.throws(()=>buildMiniMaxWorkflow(options,models,{...uploads,images:[]}), /upload order\/count/)
const conflicting = clone(state)
conflicting.continuity.exactFrame = true
conflicting.references = conflicting.references.map(ref => ({ ...ref, anchor: undefined }))
const overrideOptions = { ...options, sceneState: conflicting }
assert.throws(() => buildMiniMaxWorkflow(overrideOptions, models, uploads), /Frame 0 anchor/)
assert.equal(buildMiniMaxWorkflow({ ...overrideOptions, ignoreSceneConflicts: true }, models, uploads)['10'].inputs.prompt, compileScene(conflicting).prompt)
assert.throws(() => buildMiniMaxWorkflow({ ...overrideOptions, ignoreSceneConflicts: true }, models, { ...uploads, images: [] }), /upload order\/count/, 'Override must not bypass transport validation')
const manualOnly = createSceneState('', 5)
manualOnly.view = 'manual'; manualOnly.manualPrompt = 'A leaf falls.'
assert.ok(!errors(manualOnly).some(item => item.code === 'empty-scene'))
const clothingConflict = kitchen()
clothingConflict.scene = 'Kierra wears a red coat.'
clothingConflict.characters[0].attributes.wardrobe = value('blue jacket')
assert.ok(errors(clothingConflict).some(item => item.code === 'wardrobe-conflict'))
console.log('PASS: kitchen preservation, camera semantics, frame conflicts, attribute priority, two-character isolation, all five modes, dialogue, audio numbering, timing, manual persistence and native guide payloads')
