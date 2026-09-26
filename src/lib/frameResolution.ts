export type FrameSize = { width: number; height: number }
export type FrameResolution = { mode: 'balanced' | 'detailed' | 'source' | 'custom'; width: number; height: number }

export const defaultFrameResolution: FrameResolution = { mode: 'balanced', width: 768, height: 512 }

const align = (value: number) => Math.max(256, Math.round(value / 32) * 32)

export function isValidFrameSize(size: FrameSize | null): size is FrameSize {
  return Boolean(size && Number.isInteger(size.width) && Number.isInteger(size.height) && size.width >= 256 && size.height >= 256 && size.width <= 2048 && size.height <= 2048 && size.width % 32 === 0 && size.height % 32 === 0)
}

export function resolveFrameSize(source: FrameSize | null, resolution: FrameResolution): FrameSize | null {
  if (resolution.mode === 'custom') return isValidFrameSize(resolution) ? { width: resolution.width, height: resolution.height } : null
  if (!source?.width || !source.height) return null
  const longest = resolution.mode === 'balanced' ? 768 : resolution.mode === 'detailed' ? 1024 : Math.max(source.width, source.height)
  const scale = longest / Math.max(source.width, source.height)
  const size = { width: align(source.width * scale), height: align(source.height * scale) }
  return isValidFrameSize(size) ? size : null
}

export function sourceAspectChanges(source: FrameSize, output: FrameSize): boolean {
  return Math.abs(source.width / source.height - output.width / output.height) / (source.width / source.height) > 0.01
}
