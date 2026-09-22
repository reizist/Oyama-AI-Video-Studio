import { compileScene, parsePromptMarkup } from './h3SceneCompiler'
import { createSceneState } from './scenePromptState'

export type ScratchpadTarget = 'h3' | 'ltx25' | 'image' | 'music'

export function compileScratchpad(value: string, target: ScratchpadTarget, duration: number) {
  if (target === 'h3') return compileScene(createSceneState(value, duration, 'text')).prompt
  const markup = parsePromptMarkup(value)
  if (!markup.found) return value.trim()
  if (target === 'image') return [markup.scene, markup.location && `Location: ${markup.location}`, markup.lighting && `Lighting: ${markup.lighting}`, markup.styles.length && `Visual treatment: ${markup.styles.join(', ')}.`].filter(Boolean).join('\n\n')
  if (target === 'music') return (markup.music || markup.scene).trim()
  return [markup.scene, markup.location && `Location: ${markup.location}`, markup.lighting && `Lighting: ${markup.lighting}`, markup.styles.length && `Visual treatment: ${markup.styles.join(', ')}.`, markup.soundscape && `Soundscape: ${markup.soundscape}`, markup.music && `Music: ${markup.music}`].filter(Boolean).join('\n\n')
}
