import type { ContinueBeat, ContinueScript, ContinuationSettings } from '../components/ContinueWorkspace'
import type { GenerationJob } from '../types'
import { createSceneState, defaultPreservedAttributes, type ScenePromptState, type SceneReference } from './scenePromptState'

export type ContinuationOpenRequest = { id: number; sourceId: string | null }

export function nextContinuationOpenRequest(current: ContinuationOpenRequest, sourceId: string | null = null): ContinuationOpenRequest {
  return { id: current.id + 1, sourceId }
}

export function continuationSourceState(job: GenerationJob): ScenePromptState {
  const state = job.continuityState ? { ...job.continuityState } : createSceneState(job.prompt, job.duration, job.mode)
  if (job.continuityState?.references.length && job.continuityState.references.every(ref => ref.ownerId || ref.file.referenceRole !== 'subject')) return job.continuityState
  const files = job.referenceFiles ?? []
  const sourceFiles = state.references.length ? state.references.map(ref => ref.file) : files
  const named = [...new Set(sourceFiles.map(file => file.name.match(/^Character:\s*([^/]+?)(?:\s*\/|$)/i)?.[1]?.trim()).filter((name): name is string => Boolean(name)))]
  const subjectFiles = sourceFiles.filter(file => file.referenceRole === 'subject')
  const soleName = named.length === 1 ? named[0] : named.length === 0 && subjectFiles.length === 1 ? 'Source character' : undefined
  const names = named.length ? named : soleName ? [soleName] : []
  state.characters = [...state.characters, ...names.filter(name => !state.characters.some(character => character.name.toLocaleLowerCase() === name.toLocaleLowerCase())).map(name => ({ id: `legacy-character:${encodeURIComponent(name.toLocaleLowerCase())}`, name, attributes: {}, source: 'CHARACTER' as const }))]
  const existingReferences = new Map(state.references.map(ref => [ref.file.path, ref]))
  state.references = sourceFiles.map(file => {
    const existing = existingReferences.get(file.path)
    const namedOwner = file.name.match(/^Character:\s*([^/]+?)(?:\s*\/|$)/i)?.[1]?.trim()
    const ownerName = namedOwner ?? ((file.referenceRole === 'subject' || file.referenceRole === 'wardrobe') ? soleName : undefined)
    const ownerId = state.characters.find(character => character.name === ownerName)?.id
    return existing ? { ...existing, ownerId: existing.ownerId ?? ownerId } : { id: `${file.kind}:${file.path}`, file, name: file.name, ownerId, preserve: file.kind === 'image' ? defaultPreservedAttributes({ file, ownerId }) : [], locks: [], observed: {}, source: ownerId ? 'CHARACTER' : 'PRESERVE' } as SceneReference
  })
  return state
}

export function normalizeContinuationSources(beats: ContinueBeat[]) {
  return beats.map((beat, index) => {
    if (index === 0) return { ...beat, sourceMode: 'original' as const, sourceBeatId: undefined }
    if (beat.sourceMode === 'beat' && !beats.slice(0, index).some(item => item.id === beat.sourceBeatId)) return { ...beat, sourceMode: 'previous' as const, sourceBeatId: undefined }
    return beat.sourceMode ? beat : { ...beat, sourceMode: 'previous' as const, sourceBeatId: undefined }
  })
}

export function continuationReferenceReplaced(beat: ContinueBeat, file: SceneReference['file'], references: SceneReference[]) {
  const role = file.referenceRole === 'subject' ? 'character' : file.referenceRole
  if (!role || !(role in beat.replacements) || !beat.replacements[role as keyof ContinueBeat['replacements']]) return false
  if (role !== 'character' && role !== 'wardrobe') return true
  const ownerId = beat.replacementOwnerIds?.[role]
  return !ownerId || references.some(ref => ref.file.path === file.path && ref.ownerId === ownerId)
}

export const continuationBeatSignature = (beat: ContinueBeat, videoName = '', route = '', continuity?: ContinuationSettings) => JSON.stringify({ name: beat.name, videoName, route, prompt: beat.prompt, duration: beat.duration, frameTime: beat.frameTime, continuity, cameraOverride: beat.cameraOverride, continuityBreak: beat.continuityBreak, sourceMode: beat.sourceMode ?? 'previous', sourceBeatId: beat.sourceBeatId, replacements: Object.entries(beat.replacements).map(([role, file]) => [role, file?.path, beat.replacementOwnerIds?.[role as keyof ContinueBeat['replacementOwnerIds']]]) })

export function continuationFilenamePart(value: string, fallback: string, maxLength = 48) {
  return value.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, maxLength) || fallback.slice(0, maxLength)
}

export function continuationLineage(script: ContinueScript, target: ContinueBeat) {
  const lineage: ContinueBeat[] = []
  const seen = new Set<string>()
  let current: ContinueBeat | undefined = target
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    lineage.unshift(current)
    const index = script.beats.findIndex(beat => beat.id === current?.id)
    const parentId: string | undefined = current.sourceMode === 'original' ? undefined : current.sourceMode === 'beat' ? current.sourceBeatId : script.beats[index - 1]?.id
    current = parentId ? script.beats.find(beat => beat.id === parentId) : undefined
  }
  return lineage
}

export function continuationOutputStem(script: ContinueScript, target: ContinueBeat) {
  const video = continuationFilenamePart(script.videoName, 'Untitled-Video')
  const lineage = continuationLineage(script, target)
  // Keep every beat visible while staying below common filesystem component
  // limits. Longer scripts shorten each label evenly instead of dropping
  // middle beats and making the saved lineage misleading.
  const nameBudget = Math.max(6, Math.min(48, Math.floor((198 - video.length - lineage.length * 10) / Math.max(1, lineage.length))))
  const chain = lineage.map(beat => {
    const index = script.beats.findIndex(item => item.id === beat.id) + 1
    return `beat${index}-${continuationFilenamePart(beat.name, `Beat-${index}`, nameBudget)}`
  })
  return `${video}__${chain.join('_')}`
}

export function continuationOutputName(script: ContinueScript, target: ContinueBeat) {
  const video = continuationFilenamePart(script.videoName, 'Untitled-Video')
  const lineage = continuationOutputStem(script, target)
  const filename = script.beats.at(-1)?.id === target.id ? `Final_${lineage}` : lineage
  return `continuations/${video}/${filename}`
}

export function continuationTiming(seconds: number, overlapFrames: number, blendFrames = 0) {
  const requestedFrames = Math.max(1, Math.round(seconds * 24))
  const overlap = Math.max(0, Math.round(overlapFrames))
  const blend = Math.max(0, Math.round(blendFrames))
  const targetRaw = requestedFrames + overlap + blend
  // H3 accepts temporal lengths in the 5 + 17k family. Pick the closest grid
  // point to the requested delivered duration. Grid surplus is real generated
  // motion and must never be removed from the head of the clip.
  const renderFrames = Math.max(5, 5 + Math.round((targetRaw - 5) / 17) * 17)
  // Loop Trim removes only the repeated guide returned by the motion-context
  // node. A merge crossfade consumes blend frames from the total timeline.
  const trimFrames = overlap
  const deliveredFrames = Math.max(1, renderFrames - trimFrames - blend)
  // The public duration control tops out at 15s, which H3 maps to its final
  // valid grid length of 362 frames. Preserve that accepted input at the
  // boundary instead of exposing 362/24 as an invalid 15.08s control value.
  const renderDuration = renderFrames <= 362 ? Math.min(15, renderFrames / 24) : renderFrames / 24
  return { requestedFrames, renderFrames, trimFrames, deliveredFrames, renderDuration, deliveredDuration: deliveredFrames / 24 }
}

export function continuationPreviousAction(
  script: ContinueScript,
  source: { continuation?: { scriptId: string; beatId: string }; continuityState?: { scene: string } },
) {
  if (!source.continuation) return source.continuityState?.scene.trim() ?? ''
  if (source.continuation.scriptId !== script.id) return ''
  return script.beats.find(beat => beat.id === source.continuation?.beatId)?.prompt.trim() ?? ''
}
