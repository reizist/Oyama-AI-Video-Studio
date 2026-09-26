const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('ws')

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const browserPath = process.env.E2E_BROWSER_PATH || edgePath
const port = 9335 + Math.floor(Math.random() * 500)
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'oyama-ui-e2e-'))
let browser
let socket
let nextId = 0
const pending = new Map()
const characterSelector = '.character-studio:not(.accessory-studio):not(.wardrobe-studio):not(.location-studio):not(.hair-studio)'
const browserErrors = []

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

async function until(fn, label, timeout = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const value = await fn().catch(() => null)
    if (value) return value
    await delay(150)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

function send(method, params = {}) {
  const id = ++nextId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result?.value
}

async function clickText(text) {
  return evaluate(`(() => {
    const target = [...document.querySelectorAll('button, [role="tab"], a')]
      .find(node => node.textContent.trim() === ${JSON.stringify(text)});
    if (!target) return false;
    target.click(); return true;
  })()`)
}

async function clickStudioText(text) {
  const rect = await evaluate(`(() => {
    const target = [...document.querySelectorAll(${JSON.stringify(characterSelector + ' [role="tab"]')})]
      .find(node => node.textContent.trim() === ${JSON.stringify(text)});
    return target?.getBoundingClientRect().toJSON() ?? null;
  })()`)
  if (!rect) return false
  const x = rect.x + rect.width / 2
  const y = rect.y + rect.height / 2
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
  return true
}

async function main() {
  assert.ok(fs.existsSync(browserPath), `Browser missing: ${browserPath}`)
  browser = spawn(browserPath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' })

  const target = await until(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`)
    return (await response.json()).find(item => item.type === 'page')
  }, 'browser debug endpoint')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject) })
  socket.on('message', data => {
    const message = JSON.parse(String(data))
    if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails.text)
    if (!message.id || !pending.has(message.id)) return
    const request = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) request.reject(new Error(message.error.message))
    else request.resolve(message.result)
  })

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1379, height: 982, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/' })
  await until(() => evaluate(`document.querySelector('#root')?.textContent.includes('Oyama AI Video Studio')`), 'app shell')

  const firstView = await evaluate(`document.body.innerText.slice(0, 3000)`)
  assert.ok(firstView.includes('Browse workspaces'))
  assert.ok(firstView.includes('Offline · Set up'), 'ComfyUI disconnection is visible')
  assert.ok(await evaluate(`(() => { const generate = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === 'Generate' && node.offsetWidth > 0); return generate?.disabled === true })()`), 'H3 Generate is disabled while ComfyUI is offline')
  assert.ok(await evaluate(`document.querySelector('.video-preview-section input[type="checkbox"]')?.checked === true`), 'Live preview control is visible in Generation Settings')
  await evaluate(`document.querySelector('.video-preview-section input[type="checkbox"]').click()`)
  assert.ok(await evaluate(`document.querySelector('.video-preview-section input[type="checkbox"]')?.checked === false && !document.querySelector('.video-preview-section select') && document.querySelector('.video-preview-health')?.textContent.includes('Live preview off')`), 'Turning previews off retains a clear status and hides preview-specific controls')
  await evaluate(`document.querySelector('.video-preview-section input[type="checkbox"]').click()`)
  await evaluate(`document.querySelector('.video-continuation-opt-in summary').click()`)
  assert.ok(await clickText('Open Continue workspace'), 'H3 exposes the Continue workspace')
  await until(() => evaluate(`Boolean(document.querySelector('.continue-workspace')?.getClientRects().length)`), 'in-app Continue workspace')
  assert.ok(await evaluate(`!document.querySelector('.continuation-popout') && Boolean(document.querySelector('.continue-source-banner'))`), 'Continue is rendered inside the application with a source step')
  assert.ok(await evaluate(`Boolean(document.querySelector('.continue-live-monitor[aria-label="Sequence player"]')) && document.querySelector('.continue-origin-tile')?.textContent.includes('Original')`), 'Continue has an in-app sequence player and explicit original clip tile')
  await evaluate(`document.querySelector('.continue-script-sidebar>footer button').click()`)
  await until(() => evaluate(`document.querySelectorAll('.continue-script-item').length === 2`), 'second continuation beat')
  assert.ok(await evaluate(`document.querySelectorAll('.continue-script-item')[1]?.textContent.includes('From Beat 1')`), 'Beat 2 identifies Beat 1 as its incoming source')
  await evaluate(`document.querySelectorAll('.continue-script-item')[1].click()`)
  assert.ok(await evaluate(`document.querySelector('.continue-handoff')?.textContent.includes('Generate Beat 1 first')`), 'Beat editor identifies the missing parent render')
  await evaluate(`document.querySelector('.continue-cut-cue button').click()`)
  assert.ok(await evaluate(`document.querySelector('.continue-prompt-field textarea')?.value.includes('hard cut to a new camera angle')`), 'Cut cue is inserted into the authored beat prompt')
  assert.ok(await evaluate(`document.querySelector('.continue-camera-controls input[type="checkbox"]')?.checked === false`), 'Between-beat hard cut stays off by default for smooth continuity')
  await evaluate(`document.querySelector('.continue-heading-actions button').click()`)
  await until(() => evaluate(`Boolean(document.querySelector('.continue-source-modal'))`), 'source picker')
  assert.ok(await evaluate(`document.querySelector('.continue-source-modal')?.textContent.includes('No finished renders yet')`), 'Empty source picker explains how to start')
  await evaluate(`document.querySelector('.continue-source-modal [aria-label="Close source video picker"]').click()`)
  await send('Emulation.setDeviceMetricsOverride', { width: 860, height: 620, deviceScaleFactor: 1, mobile: false })
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth && Boolean(document.querySelector('.continue-heading-actions button')?.getClientRects().length)`), 'Continue fits compact app layout')
  await send('Emulation.setDeviceMetricsOverride', { width: 1379, height: 982, deviceScaleFactor: 1, mobile: false })
  assert.ok(await clickText('Photo Edit'), 'Photo Edit is available from the workspace sidebar')
  await until(() => evaluate(`Boolean(document.querySelector('.photo-edit-workspace')?.getClientRects().length)`), 'in-app Photo Edit workspace')
  assert.ok(await evaluate(`document.querySelector('.photo-edit-setup')?.textContent.includes('FireRed') && document.querySelector('.photo-edit-generate')?.disabled === true`), 'Missing FireRed model is explained and rendering is disabled')
  await evaluate(`document.querySelectorAll('.photo-edit-mode label')[1].click()`)
  assert.ok(await evaluate(`document.querySelector('.photo-edit-mode input:checked')?.closest('label')?.textContent.includes('Quality') && JSON.parse(localStorage.getItem('oyama.photo-edit.workspace.v1')).mode === 'quality'`), 'Quality mode is explicitly selectable and saved')
  await evaluate(`document.querySelectorAll('.photo-edit-mode label')[0].click()`)
  assert.ok(await evaluate(`document.querySelector('.photo-edit-mode input:checked')?.closest('label')?.textContent.includes('Turbo')`), 'Turbo mode can be reselected')
  await send('Emulation.setDeviceMetricsOverride', { width: 860, height: 620, deviceScaleFactor: 1, mobile: false })
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth && Boolean(document.querySelector('.photo-edit-image-picker')?.getClientRects().length)`), 'Photo Edit fits compact app layout')
  await send('Emulation.setDeviceMetricsOverride', { width: 1379, height: 982, deviceScaleFactor: 1, mobile: false })
  assert.ok(await clickText('Back to Ripple'), 'Photo Edit returns to Ripple')
  await until(() => evaluate(`Boolean(document.querySelector('.ripple-workspace')?.getClientRects().length)`), 'Ripple after Photo Edit')
  await evaluate(`(() => { const image = { path: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="24"/%3E', name: 'edited-frame.svg', kind: 'image' }; localStorage.setItem('oyama.photo-edit.workspace.v1', JSON.stringify({ source: image, result: image, prompt: 'Make the jacket red.', seed: 42, job: null })); })()`)
  assert.ok(await clickText('Photo Edit'), 'Reopen Photo Edit with saved result')
  await until(() => evaluate(`document.querySelector('.photo-edit-result-stage img')?.naturalWidth > 0 && !document.querySelector('.photo-edit-use')?.disabled`), 'loaded edited photo preview')
  assert.ok(await clickText('Use as Ripple replacement'), 'Send edited photo to Ripple')
  await until(() => evaluate(`Boolean(document.querySelector('.ripple-frame-button img'))`), 'Ripple replacement preview')
  assert.ok(await evaluate(`JSON.parse(localStorage.getItem('ltx-ripple.workspace.v1')).editedFrame.name === 'edited-frame.svg'`), 'Ripple persists the selected replacement image')
  assert.ok(await clickText('H3 Video'), 'Return to H3 from Continue')
  await until(() => evaluate(`Boolean(document.querySelector('.video-workspace-shell')?.getClientRects().length)`), 'H3 workspace after Continue')
  await until(() => evaluate(`Boolean(document.querySelector('.create-prompt-panel'))`), 'Create prompt panel')
  assert.ok(await evaluate(`Boolean(document.querySelector('.video-suggestions-toggle')?.getClientRects().length)`), 'Suggestion switch is in the bottom bar')
  await evaluate(`document.querySelector('.video-suggestions-toggle').click()`)
  assert.ok(await evaluate(`document.querySelector('.video-suggestions-toggle')?.getAttribute('aria-pressed') === 'true' && localStorage.getItem('minimax.inline-suggestions-enabled') === 'true'`), 'Suggestion preference is saved')
  await evaluate(`document.querySelector('.create-prompt-panel textarea[aria-label="Video prompt"]').focus()`)
  await send('Input.insertText', { text: 'A lone traveler steps into a quiet station at dawn.' })
  await until(() => evaluate(`Boolean(document.querySelector('.create-prompt-panel .h3-inline-completion'))`), 'local inline suggestion')
  await evaluate(`document.querySelector('.create-prompt-panel .h3-inline-completion').click()`)
  await until(() => evaluate(`document.querySelector('.create-prompt-panel textarea[aria-label="Video prompt"]')?.value.includes('slow, steady camera move')`), 'accepted inline suggestion')
  await send('Input.insertText', { text: ' //orbit' })
  await until(() => evaluate(`Boolean(document.querySelector('.create-production-menu .create-production-results button'))`), 'inline production command menu')
  assert.ok(await evaluate(`document.querySelector('.create-prompt-panel textarea[aria-label="Video prompt"]')?.getAttribute('aria-expanded') === 'true'`), 'Command menu is exposed to assistive technology')
  await send('Emulation.setDeviceMetricsOverride', { width: 860, height: 620, deviceScaleFactor: 1, mobile: false })
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth && Boolean(document.querySelector('.create-production-menu')?.getClientRects().length) && Boolean(document.querySelector('.video-suggestions-toggle')?.getClientRects().length)`), 'Command menu and bottom switch fit compact Create layout')
  await send('Emulation.setDeviceMetricsOverride', { width: 1379, height: 982, deviceScaleFactor: 1, mobile: false })
  await evaluate(`document.querySelector('.create-production-menu .create-production-results button').click()`)
  await until(() => evaluate(`!document.querySelector('.create-production-menu') && document.querySelector('.create-prompt-panel textarea[aria-label="Video prompt"]')?.value.includes('Camera:')`), 'command inserted at cursor')
  await evaluate(`([...document.querySelectorAll('.create-prompt-toolbar button')].find(button => button.textContent.includes('Auto tag'))).click()`)
  await until(() => evaluate(`document.querySelector('.create-prompt-panel textarea[aria-label="Video prompt"]')?.value.startsWith('##scene')`), 'automatic H3 tagging')
  await evaluate(`document.querySelector('.video-suggestions-toggle').click()`)
  assert.ok(await evaluate(`document.querySelector('.video-suggestions-toggle')?.getAttribute('aria-pressed') === 'false'`), 'Suggestions can be turned off')

  await evaluate(`(() => {
    const image = { path: 'C:/oyama-ui-e2e/identity.png', name: 'identity.png', kind: 'image', preview: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/%3E' };
    const secondImage = { ...image, path: 'C:/oyama-ui-e2e/profile.png', name: 'profile.png', referenceType: 'profile' };
    localStorage.setItem('minimax.character-projects', JSON.stringify([
      { id: 'ui-e2e-character', name: 'Test Character', referenceMode: 'set', baseImage: image, referenceImages: [image, secondImage], wardrobeIds: [], accessoryIds: [], hairStyleIds: [] },
      { id: 'ui-e2e-unready', name: 'Needs Reference', referenceMode: 'set', referenceImages: [], wardrobeIds: [], accessoryIds: [], hairStyleIds: [] },
    ]));
    window.dispatchEvent(new CustomEvent('minimax-character-library-changed'));
  })()`)
  assert.ok(await evaluate(`(() => { const tab = [...document.querySelectorAll('.video-workspace-shell .workspace-section-tabs button')].find(node => node.querySelector('strong')?.textContent === 'Source'); tab?.click(); return Boolean(tab) })()`), 'H3 Source tab is available')
  await until(() => evaluate(`document.querySelector('.video-workspace-tab-panel[aria-label="Source"]')?.hidden === false`), 'H3 Source tab')
  assert.ok(await clickText('References'), 'Reference mode is available')
  await until(() => evaluate(`Boolean([...document.querySelectorAll('.reference-source-options button')].find(node => node.textContent.includes('Test Character')))`), 'test character in reference inputs')
  assert.ok(await evaluate(`(() => { const button = [...document.querySelectorAll('.reference-source-options button')].find(node => node.textContent.includes('Needs Reference')); return button?.disabled && button.textContent.includes('Add an approved identity image') })()`), 'Character without approved images shows a recovery path')
  assert.ok(await evaluate(`Boolean(document.querySelector('.reference-source-manage')?.getClientRects().length)`), 'Character Studio is reachable from the picker')
  const toggleCharacter = `(() => { const button = [...document.querySelectorAll('.reference-source-options button')].find(node => node.textContent.includes('Test Character')); button?.click(); return Boolean(button) })()`
  assert.ok(await evaluate(toggleCharacter), 'Character can be selected from Source')
  await until(() => evaluate(`document.querySelector('.reference-source-options button[aria-pressed="true"]')?.textContent.includes('Test Character')`), 'character selected')
  assert.ok(await evaluate(toggleCharacter), 'Selected character can be removed from Source')
  await until(() => evaluate(`document.querySelector('.reference-source-options button[aria-pressed="false"]')?.textContent.includes('Test Character')`), 'character removed')
  assert.ok(await evaluate(toggleCharacter), 'Character can be selected again')
  await until(() => evaluate(`Boolean(document.querySelector('.reference-source-clear'))`), 'clear shot references action')
  await evaluate(`document.querySelector('.reference-source-clear').click()`)
  await until(() => evaluate(`!document.querySelector('.reference-source-clear') && document.querySelector('.reference-source-options button[aria-pressed="false"]')?.textContent.includes('Test Character')`), 'shot references cleared')
  assert.ok(await evaluate(`JSON.parse(localStorage.getItem('minimax.character-projects')).some(item => item.id === 'ui-e2e-character')`), 'Clear leaves the Character library intact')
  assert.ok(await evaluate(toggleCharacter), 'Character can be reselected after clear')
  await until(() => evaluate(`document.querySelector('.reference-source-options button[aria-pressed="true"]')?.textContent.includes('Test Character')`), 'character reselected')
  await send('Emulation.setDeviceMetricsOverride', { width: 860, height: 620, deviceScaleFactor: 1, mobile: false })
  const compactReferences = await evaluate(`({ scrollWidth: document.documentElement.scrollWidth, innerWidth, clearVisible: Boolean(document.querySelector('.reference-source-clear')?.getClientRects().length) })`)
  assert.ok(compactReferences.scrollWidth <= compactReferences.innerWidth && compactReferences.clearVisible, `Reference clear action fits compact layout: ${JSON.stringify(compactReferences)}`)
  assert.ok(await evaluate(`Boolean(document.querySelector('.video-mode-reset')?.getClientRects().length)`), 'Titlebar clear action stays visible at compact size')
  await evaluate(`document.querySelector('.reference-source-clear').click()`)
  await until(() => evaluate(`!document.querySelector('.reference-source-clear') && document.querySelector('.reference-source-options button[aria-pressed="false"]')?.textContent.includes('Test Character')`), 'compact clear state')
  await send('Emulation.setDeviceMetricsOverride', { width: 1379, height: 982, deviceScaleFactor: 1, mobile: false })

  await evaluate(`(() => {
    const file = (kind, name) => ({ kind, name, path: 'C:/oyama-ui-e2e/' + name });
    localStorage.setItem('minimax.workspace', JSON.stringify({ mode: 'reference', prompt: 'Reset this draft', duration: 8, resolution: '1344x768', seed: 4321, referenceImages: [file('image', 'shot.png')], referenceVideos: [file('video', 'motion.mp4')], referenceAudios: [file('audio', 'ambience.wav')], selectedReferenceCharacterIds: [], selectedReferenceLocationIds: [] }));
  })()`)
  await send('Page.reload')
  await until(() => evaluate(`document.readyState === 'complete' && performance.getEntriesByType('navigation')[0]?.type === 'reload' && Boolean(document.querySelector('.video-workspace-shell'))`), 'reloaded H3 workspace')
  await evaluate(`([...document.querySelectorAll('.video-workspace-shell .workspace-section-tabs button')].find(node => node.querySelector('strong')?.textContent === 'Source'))?.click()`)
  await until(() => evaluate(`document.querySelector('.video-workspace-tab-panel[aria-label="Source"]')?.hidden === false`), 'reloaded Source tab')
  await evaluate(`document.querySelector('.reference-source-panel details:last-child summary')?.click()`)
  await until(() => evaluate(`document.querySelectorAll('.reference-source-files li').length === 3`), 'three attached media files')
  assert.ok(await evaluate(`Boolean(document.querySelector('[aria-label="Edit clip motion.mp4"]'))`), 'Video clip editing is available')
  for (const name of ['shot.png', 'motion.mp4', 'ambience.wav']) {
    await evaluate(`document.querySelector(${JSON.stringify(`[aria-label="Remove ${name} from this shot"]`)})?.click()`)
  }
  await until(() => evaluate(`!document.querySelector('.reference-source-files') && !document.querySelector('.reference-source-clear')`), 'individual media removal')
  assert.ok(await evaluate(toggleCharacter), 'Character can be selected before titlebar reset')
  await until(() => evaluate(`document.querySelector('.reference-source-options button[aria-pressed="true"]')?.textContent.includes('Test Character')`), 'character selected before reset')
  assert.ok(await evaluate(`Boolean(document.querySelector('.video-mode-reset')?.getClientRects().length)`), 'Workspace reset is visible in H3 titlebar')
  await evaluate(`window.confirm = () => false; document.querySelector('.video-mode-reset').click()`)
  assert.ok(await evaluate(`document.querySelector('.reference-source-options button[aria-pressed="true"]')?.textContent.includes('Test Character')`), 'Declined reset preserves sources')
  await evaluate(`window.confirm = () => true; document.querySelector('.video-mode-reset').click()`)
  await until(() => evaluate(`document.querySelector('.reference-source-options button[aria-pressed="false"]')?.textContent.includes('Test Character') && !document.querySelector('.reference-source-clear')`), 'titlebar reset clears sources')
  assert.ok(await evaluate(`(() => { const prompt = document.querySelector('textarea[aria-label="Video prompt"]'); return prompt?.value === '' && document.querySelector('.video-source-modes button[aria-pressed="true"]')?.textContent === 'References' && document.querySelector('.video-resolution-label select')?.value === '1344x768' && document.querySelector('.video-seed-field input')?.value === '4321' })()`), 'Titlebar reset clears prompt but preserves mode, resolution, and seed')

  assert.ok(await clickText('Characters'), 'Characters navigation is available')
  await until(() => evaluate(`Boolean(document.querySelector(${JSON.stringify(characterSelector)})?.getClientRects().length)`), 'Characters workspace')
  assert.ok(await evaluate(`(() => { const button = document.querySelector('[aria-label="Find workspace setting"]'); if (!button?.getClientRects().length) return false; button.click(); return true })()`), 'Companion workspace exposes visible setting search')
  await until(() => evaluate(`Boolean(document.querySelector('.workspace-search-backdrop'))`), 'Workspace setting search')
  await until(() => evaluate(`document.activeElement?.matches('.workspace-search-input-wrap input')`), 'setting search focus')
  await send('Input.insertText', { text: 'Character name' })
  await until(() => evaluate(`document.querySelector('.workspace-search-result')?.textContent.includes('Character name')`), 'Character name search result')
  await evaluate(`document.querySelector('.workspace-search-result')?.click()`)
  await until(() => evaluate(`!document.querySelector('.workspace-search-backdrop')`), 'setting search close')
  assert.ok(await clickStudioText('Hair'), 'Hair inspector tab is available')
  await until(() => evaluate(`document.querySelector(${JSON.stringify(characterSelector + ' .character-context-inspector')})?.getAttribute('aria-label') === 'Hair inspector'`), 'Hair inspector')
  assert.ok(await clickStudioText('Wardrobe'), 'Wardrobe inspector tab is available')
  await until(() => evaluate(`document.querySelector(${JSON.stringify(characterSelector + ' .character-context-inspector')})?.getAttribute('aria-label') === 'Wardrobe inspector'`), 'Wardrobe inspector')
  assert.ok(await clickStudioText('Identity'), 'Identity inspector tab is available')
  await until(() => evaluate(`document.querySelector(${JSON.stringify(characterSelector + ' .character-context-inspector')})?.getAttribute('aria-label') === 'Identity inspector'`), 'Identity inspector')
  assert.ok(await clickStudioText('References'), 'References inspector tab is available')
  await until(() => evaluate(`document.querySelector(${JSON.stringify(characterSelector + ' .character-context-inspector')})?.getAttribute('aria-label') === 'References inspector'`), 'References inspector')
  assert.equal(await evaluate(`document.querySelectorAll(${JSON.stringify(characterSelector + ' .character-reference-list-items article')}).length`), 2, 'All approved images are listed')
  await send('Emulation.setDeviceMetricsOverride', { width: 860, height: 620, deviceScaleFactor: 1, mobile: false })
  assert.ok(await evaluate(`Boolean(document.querySelector('[aria-label="Remove profile.png from character"]')?.getClientRects().length) && document.documentElement.scrollWidth <= innerWidth`), 'Character reference removal fits compact layout')
  await send('Emulation.setDeviceMetricsOverride', { width: 1379, height: 982, deviceScaleFactor: 1, mobile: false })
  await evaluate(`document.querySelector('[aria-label="Remove profile.png from character"]').click()`)
  await until(() => evaluate(`document.querySelectorAll(${JSON.stringify(characterSelector + ' .character-reference-list-items article')}).length === 1`), 'individual character reference removal')
  assert.ok(await evaluate(`Boolean(document.querySelector(${JSON.stringify(characterSelector + ' .character-primary-preview > img')}))`), 'Removing a secondary image preserves the primary')
  await evaluate(`document.querySelector('[aria-label="Remove primary image from character"]').click()`)
  await until(() => evaluate(`document.querySelectorAll(${JSON.stringify(characterSelector + ' .character-reference-list-items article')}).length === 0`), 'primary character image removal')
  assert.ok(await evaluate(`(() => { const character = JSON.parse(localStorage.getItem('minimax.character-projects')).find(item => item.id === 'ui-e2e-character'); return character && !character.baseImage && character.referenceImages.length === 0 && (!character.selectedReferencePaths || character.selectedReferencePaths.length === 0) })()`), 'Individual image removal saves while keeping the character')
  assert.ok(await evaluate(`(() => { const tab = [...document.querySelectorAll(${JSON.stringify(characterSelector + ' .workspace-section-tabs button')})].find(node => node.querySelector('strong')?.textContent === 'Generate'); tab?.click(); return Boolean(tab) })()`), 'Character Generate section is available')
  await until(() => evaluate(`document.querySelector(${JSON.stringify(characterSelector + ' .workspace-section-tabs button.active strong')})?.textContent === 'Generate'`), 'Character Generate section')
  assert.ok(await evaluate(`document.querySelector(${JSON.stringify(characterSelector + ' .character-visual-canvas')})?.getBoundingClientRect().width > 0`), 'Character preview stays visible in Generate')
  assert.ok(await evaluate(`(() => { const tab = [...document.querySelectorAll(${JSON.stringify(characterSelector + ' .workspace-section-tabs button')})].find(node => node.querySelector('strong')?.textContent === 'Characters'); tab?.click(); return Boolean(tab) })()`), 'Character library section is available')
  await until(() => evaluate(`document.querySelector(${JSON.stringify(characterSelector + ' .workspace-section-tabs button.active strong')})?.textContent === 'Characters'`), 'Character library section')
  assert.ok(await evaluate(`document.querySelector(${JSON.stringify(characterSelector + ' .character-library-tab-panel')})?.hidden === false`), 'Character library is visible')

  await send('Emulation.setDeviceMetricsOverride', { width: 860, height: 620, deviceScaleFactor: 1, mobile: false })
  await delay(250)
  const compact = await evaluate(`({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, text: document.body.innerText.slice(0, 3000) })`)
  assert.equal(compact.viewport, 860)
  assert.ok(compact.scrollWidth <= 860, `Horizontal document overflow: ${compact.scrollWidth}px`)
  assert.ok(await evaluate(`Boolean(document.querySelector('[aria-label="Find workspace setting"]')?.getClientRects().length)`), 'Setting search remains accessible at compact size')
  await send('Emulation.setDeviceMetricsOverride', { width: 1379, height: 982, deviceScaleFactor: 1, mobile: false })
  assert.ok(await clickText('Queue'), 'Queue navigation is available')
  await until(() => evaluate(`document.querySelector('.job-list, .empty-page')?.getClientRects().length`), 'Queue view')
  assert.ok(await evaluate(`document.body.innerText.includes('No generations have been queued.')`), 'Empty Queue explains its state')
  assert.ok(await clickText('Renders'), 'Render library navigation is available')
  await until(() => evaluate(`Boolean(document.querySelector('.library-page')?.getClientRects().length)`), 'Render library')
  assert.ok(await evaluate(`document.querySelector('.library-page')?.innerText.includes('Your finished renders will live here')`), 'Empty render library explains its state')
  assert.ok(await clickText('Settings'), 'Settings navigation is available')
  await until(() => evaluate(`Boolean(document.querySelector('#settings-engine')?.getClientRects().length)`), 'Settings view')
  assert.ok(await evaluate(`document.querySelector('#settings-engine')?.innerText.includes('ComfyUI')`), 'Engine settings render')
  assert.ok(await evaluate(`Boolean(document.querySelector('#settings-h3')?.getClientRects().length)`), 'H3 model stack settings render')
  assert.deepEqual(browserErrors, [], 'No uncaught browser errors')
  console.log('UI E2E: PASS — in-app Continue navigation, source picker and compact layout; Create prompt commands, auto tags, inline suggestions and bottom toggle; H3 references and reset; Character, Queue, Renders, Settings')
}

main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  if (socket) socket.close()
  if (browser) {
    browser.kill()
    await delay(400)
  }
  const resolved = path.resolve(profile)
  const tempRoot = fs.realpathSync(os.tmpdir())
  if (path.dirname(resolved) === tempRoot && path.basename(resolved).startsWith('oyama-ui-e2e-')) {
    try { fs.rmSync(resolved, { recursive: true, force: true }) }
    catch { console.warn(`Browser profile could not be removed: ${resolved}`) }
  }
})
