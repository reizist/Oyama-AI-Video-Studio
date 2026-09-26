const sectionLabels: Record<string, string> = {
  scene: 'scene', action: 'scene', sound: 'soundscape', soundscape: 'soundscape',
  ambience: 'soundscape', audio: 'soundscape', music: 'music', score: 'music',
}

export function autoTagPrompt(prompt: string): string {
  if (!prompt.trim() || /^\s*##[a-z-]+/im.test(prompt)) return prompt
  const sections: Record<string, string[]> = { scene: [], soundscape: [], music: [] }
  let current = 'scene'
  for (const line of prompt.trim().split(/\r?\n/)) {
    const label = line.match(/^\s*(scene|action|sound|soundscape|ambience|audio|music|score)\s*:\s*(.*)$/i)
    if (label) {
      current = sectionLabels[label[1].toLowerCase()]
      if (label[2]) sections[current].push(label[2])
    } else sections[current].push(line)
  }
  return (['scene', 'soundscape', 'music'] as const)
    .filter(section => sections[section].some(line => line.trim()))
    .map(section => `##${section}\n${sections[section].join('\n').trim()}`)
    .join('\n\n')
}
