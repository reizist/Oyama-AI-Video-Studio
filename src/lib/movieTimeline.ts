import type { MovieEditorProject } from '../types'

export function adjacentEditFrame(playheadFrame: number, direction: -1 | 1, totalFrames: number, clips: Array<{ startFrame: number; frameCount: number }>) {
  const editPoints = Array.from(new Set([0, totalFrames, ...clips.flatMap((clip) => [clip.startFrame, clip.startFrame + clip.frameCount])])).sort((a, b) => a - b)
  if (direction < 0) return [...editPoints].reverse().find((frame) => frame < playheadFrame) ?? 0
  return editPoints.find((frame) => frame > playheadFrame) ?? totalFrames
}

export function previewSourceFrame(sourceInFrame: number, frameCount: number, timelineStartFrame: number, playheadFrame: number) {
  const lastFrame = sourceInFrame + Math.max(1, frameCount) - 1
  return Math.min(lastFrame, Math.max(sourceInFrame, sourceInFrame + playheadFrame - timelineStartFrame))
}

export function preserveLockedClips(before: MovieEditorProject, after: MovieEditorProject) {
    const locked = new Set(before.tracks.filter((track) => track.locked).map((track) => track.id))
    const protectedIds = new Set(before.clips.filter((clip) => locked.has(clip.trackId)).map((clip) => clip.id))
    return [...after.clips.filter((clip) => !locked.has(clip.trackId) && !protectedIds.has(clip.id)), ...before.clips.filter((clip) => locked.has(clip.trackId))]
  }
