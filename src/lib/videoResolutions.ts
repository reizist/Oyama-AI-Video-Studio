export const MINIMAX_VIDEO_RESOLUTION_GROUPS: Record<'landscape' | 'ultrawide' | 'portrait' | 'square', string[]> = {
  landscape: ['608x352', '736x416', '768x448', '864x480', '960x544', '1024x576', '1056x608', '1152x640', '1216x672', '1280x736', '1344x768'],
  ultrawide: ['672x288', '896x384', '1120x480', '1216x512', '1344x576'],
  portrait: ['352x608', '416x736', '448x768', '480x864', '544x960', '576x1024', '608x1056', '640x1152', '672x1216', '736x1280', '768x1344'],
  square: ['512x512', '640x640', '768x768'],
}

export const MINIMAX_VIDEO_RESOLUTIONS = Object.values(MINIMAX_VIDEO_RESOLUTION_GROUPS).flat()

export function videoResolutionLabel(size: string) {
  const group = (Object.keys(MINIMAX_VIDEO_RESOLUTION_GROUPS) as Array<keyof typeof MINIMAX_VIDEO_RESOLUTION_GROUPS>)
    .find((orientation) => MINIMAX_VIDEO_RESOLUTION_GROUPS[orientation].includes(size))
  const [width, height] = size.split('x').map(Number)
  const orientation = group ?? (width === height ? 'square' : width > height ? 'landscape' : 'portrait')
  const name = orientation === 'ultrawide' ? 'Ultrawide' : orientation[0].toUpperCase() + orientation.slice(1)
  return `${name} · ${size.replace('x', ' × ')}`
}
