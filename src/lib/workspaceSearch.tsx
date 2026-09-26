export type WorkspaceSearchEntry = {
  id: string
  label: string
  context: string
  searchableText: string
  target: HTMLElement
  focusElement: HTMLElement
}

export function compactSearchText(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

export function highlightWorkspaceSearchText(text: string, query: string) {
  const terms = compactSearchText(query).split(' ').filter(Boolean)
  if (!terms.length) return text

  const matcher = new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return text.split(matcher).map((part, index) => terms.some((term) => part.toLowerCase() === term.toLowerCase()) ? <mark key={`${part}-${index}`}>{part}</mark> : part)
}

function searchLabelText(label: HTMLLabelElement | null) {
  if (!label) return ''
  const strong = compactSearchText(label.querySelector('strong')?.textContent)
  if (strong) return strong
  // Remove live control values and help text; the result should name the field.
  const clone = label.cloneNode(true) as HTMLElement
  clone.querySelectorAll('input, select, textarea, button, small, svg, output').forEach((node) => node.remove())
  return compactSearchText(clone.textContent)
}

function searchContextText(control: HTMLElement) {
  const section = control.closest<HTMLElement>('section, fieldset, .create-section, .composer-panel, .preview-panel')
  if (!section) return ''
  const heading = section.querySelector<HTMLElement>('.settings-heading strong, .ref2va-setting-heading strong, .create-section-heading strong, h1, h2, h3, legend')
  return compactSearchText(heading?.textContent)
}

function searchTargetForControl(control: HTMLElement, label: HTMLLabelElement | null) {
  return control.closest<HTMLElement>('.field-group, .settings-check, .connection-row, .path-row, .ui-scale-control, .user-lora-slot, .render-controls > label, .render-extras > label, .upscale-options > label') ?? label ?? control
}

function isHiddenWorkspaceSearchControl(control: HTMLElement) {
  let current: HTMLElement | null = control
  while (current) {
    if (current.hidden) return true
    current = current.parentElement
  }
  return false
}

export function collectWorkspaceSearchEntries(root: HTMLElement): WorkspaceSearchEntry[] {
  const controls = Array.from(root.querySelectorAll<HTMLElement>('input:not([type="hidden"]), select, textarea'))
  return controls.flatMap((control, index) => {
    if (isHiddenWorkspaceSearchControl(control)) return []
    const parentLabel = control.closest('label') as HTMLLabelElement | null
    const id = control.getAttribute('id')
    const associatedLabel = id
      ? Array.from(root.querySelectorAll<HTMLLabelElement>('label[for]')).find((candidate) => candidate.htmlFor === id) ?? null
      : null
    const label = searchLabelText(parentLabel ?? associatedLabel)
      || compactSearchText(control.getAttribute('aria-label'))
      || compactSearchText(control.getAttribute('placeholder'))
      || compactSearchText(control.getAttribute('title'))
      || compactSearchText(id)
      || 'Workspace setting'
    const context = searchContextText(control)
    const target = searchTargetForControl(control, parentLabel ?? associatedLabel)
    const searchableText = compactSearchText([
      label,
      context,
      control.getAttribute('aria-label'),
      control.getAttribute('placeholder'),
      control.getAttribute('title'),
      control.getAttribute('name'),
      id,
      target.textContent,
    ].filter(Boolean).join(' ')).toLowerCase()
    return [{ id: `workspace-setting-${index}`, label, context, searchableText, target, focusElement: control }]
  })
}
