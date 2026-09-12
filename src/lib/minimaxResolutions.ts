export const MINIMAX_RESOLUTIONS = {
  landscape: ['608x352', '736x416', '768x448', '864x480', '960x544', '1024x576', '1056x608', '1152x640', '1216x672', '1280x736', '1344x768'],
  ultrawide: ['672x288', '896x384', '1120x480', '1216x512', '1344x576'],
  portrait: ['352x608', '416x736', '448x768', '480x864', '544x960', '576x1024', '608x1056', '640x1152', '672x1216', '736x1280', '768x1344'],
  square: ['512x512', '640x640', '768x768'],
} as const

export type MinimaxOrientation = keyof typeof MINIMAX_RESOLUTIONS

// Z-Image/Anime canvases pick free image aspect ratios and megapixels, but
// MiniMax H3 I2V only accepts a fixed, capped list of resolutions (see
// MINIMAX_RESOLUTIONS above). Handing an image canvas size to the video
// workspace unchanged can silently exceed that cap (e.g. 1024x1024 > 1344x768's
// pixel budget), which ComfyUI rejects at prompt-validation time before it ever
// reaches history or the log. Snap to the nearest same-orientation MiniMax size
// before handoff.
export function snapToMinimaxResolution(resolution: string): string {
  const [w, h] = resolution.split('x').map(Number)
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return '1344x768'
  const orientation: MinimaxOrientation = w === h ? 'square' : w / h >= 2.1 ? 'ultrawide' : w > h ? 'landscape' : 'portrait'
  const area = w * h
  return MINIMAX_RESOLUTIONS[orientation].reduce((best, option) => {
    const [ow, oh] = option.split('x').map(Number)
    const [bw, bh] = best.split('x').map(Number)
    return Math.abs(ow * oh - area) < Math.abs(bw * bh - area) ? option : best
  })
}
