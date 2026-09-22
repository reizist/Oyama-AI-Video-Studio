import type { MediaFile } from '../types'

export const movieFrameTargets = [
  ['h3-reference-first', 'H3 Ref2VA · native Frame 0 anchor'],
  ['h3-i2v', 'H3 I2V · first-frame input'],
  ['h3-first', 'H3 · first + last: opening frame'],
  ['h3-last', 'H3 · first + last: closing frame'],
  ['h3-reference', 'H3 Ref2VA · reference only (no frame lock)'],
  ['ltx', 'LTX 2.5 · image to video'],
  ['save', 'Save frame only'],
] as const
export type MovieFrameTarget = typeof movieFrameTargets[number][0]
export const MOVIE_HANDOFF_KEY = 'oyama.movie-frame-handoff'
export type MovieFrameHandoff = { id: string; file: MediaFile; target: MovieFrameTarget; sourceName: string }

export function parseMovieHandoff(raw: string | null): MovieFrameHandoff | null {
  try {
    const value = JSON.parse(raw ?? 'null')
    if (!value || typeof value.id !== 'string' || typeof value.sourceName !== 'string' || value.file?.kind !== 'image' || typeof value.file.path !== 'string' || !value.file.path || typeof value.file.name !== 'string' || !movieFrameTargets.some(([target]) => target === value.target)) return null
    return value
  } catch { return null }
}

export function movieSourceFrame(start: number, sourceIn: number, length: number, playhead: number, position: 'current' | 'first' | 'last') {
  const offset = position === 'first' ? 0 : position === 'last' ? length - 1 : playhead - start
  return sourceIn + Math.max(0, Math.min(length - 1, offset))
}
