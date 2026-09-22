import type { GenerationMode, MediaFile, MovieReferenceBinding } from '../types'
import { bindSceneReferences, createSceneState, value, type ScenePromptState } from './scenePromptState'

/** Import boundary for saved pre-composer drafts. Existing H3 is preserved as
 * manual text instead of being stripped and wrapped a second time. */
export function importSceneDraft(prompt: string, duration: number, mode: GenerationMode): ScenePromptState {
  const state = createSceneState(prompt, duration, mode)
  if (/\b(?:integrated_multimodal_description|subject_definitions|detailed_description)\s*:/i.test(prompt)) {
    state.view = 'manual'
    state.manualPrompt = prompt
    const description = prompt.match(/(?:detailed_description|integrated_multimodal_description)\s*:\s*([\s\S]*?)(?=\n\s*(?:overall_soundscape|non_diegetic_music)\s*:|$)/i)?.[1]
    state.scene = description?.trim() || 'Imported H3 direction'
  }
  return state
}

/** Only older callers with a textual reference map use this path. New callers
 * always pass real media bindings and an authored ScenePromptState. */
export function stateFromReferenceMap(direction: string, duration: number, mode: GenerationMode, referenceMap: string[] = []): ScenePromptState {
  const bindings: MovieReferenceBinding[] = [], videos: MediaFile[] = [], audios: MediaFile[] = []
  for (const entry of referenceMap) {
    const match = entry.match(/<?(Picture|Video|Audio)\s+(\d+)>?\s*=\s*(.*)/i)
    if (!match) continue
    const kind = match[1].toLowerCase() === 'picture' ? 'image' : match[1].toLowerCase() === 'video' ? 'video' : 'audio'
    const file: MediaFile = { path: `legacy-${kind}-${match[2]}`, name: match[3], kind }
    if (kind === 'video') videos.push(file)
    else if (kind === 'audio') audios.push(file)
    else {
      const owner = match[3].match(/^Character:\s*([^/]+)/i)?.[1]?.trim() || match[3].match(/\sfor\s(.+)$/i)?.[1]?.trim()
      const purpose = /^Wardrobe:/i.test(match[3]) ? 'wardrobe' : /^Hair:/i.test(match[3]) ? 'hair' : /^Accessory:/i.test(match[3]) ? 'accessory' : owner ? 'character' : 'location'
      bindings.push({ file, label: match[3], purpose, characterId: owner, source: 'shot' })
    }
  }
  const state = bindSceneReferences(createSceneState(direction, duration, mode), bindings, videos, audios,
    mode === 'image' || mode === 'frames' ? { path: 'legacy-first', name: 'Opening frame', kind: 'image' } : undefined,
    mode === 'frames' ? { path: 'legacy-last', name: 'Ending frame', kind: 'image' } : undefined)
  state.references = state.references.map(ref => ({ ...ref, reviewed: true }))
  state.soundscape = value('', 'DEFAULT')
  return state
}
