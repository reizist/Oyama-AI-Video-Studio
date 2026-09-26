const assert = require('node:assert/strict')
const { spawn, execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createServer } = require('node:http')
const WebSocket = require('ws')

const port = 9700 + Math.floor(Math.random() * 200)
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'oyama-photo-edit-electron-'))
const environment = { ...process.env, APPDATA: profile, LOCALAPPDATA: profile, VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173' }
delete environment.ELECTRON_RUN_AS_NODE
const child = spawn(require('electron'), ['.', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`], { cwd: path.join(__dirname, '..'), env: environment, windowsHide: true, stdio: 'ignore' })
let socket
let nextId = 0
const pending = new Map()
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

async function until(fn, label, timeout = 25000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const value = await fn().catch(() => null)
    if (value) return value
    await delay(200)
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
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text)
  return response.result?.value
}

async function main() {
  const target = await until(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`)
    return (await response.json()).find(item => item.type === 'page' && item.url.startsWith('http://127.0.0.1:5173/'))
  }, 'Electron renderer')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject) })
  socket.on('message', data => {
    const message = JSON.parse(String(data))
    if (!message.id || !pending.has(message.id)) return
    const request = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) request.reject(new Error(message.error.message))
    else request.resolve(message.result)
  })
  await send('Runtime.enable')
  await until(() => evaluate(`Boolean(document.querySelector('.sidebar'))`), 'app sidebar')
  assert.ok(await evaluate(`Boolean(window.minimax)`), 'Electron preload bridge is available')
  assert.ok(await evaluate(`(() => { const button = [...document.querySelectorAll('.sidebar .nav-button')].find(item => item.textContent.trim() === 'Photo Edit'); button?.click(); return Boolean(button) })()`), 'Photo Edit navigation exists')
  await until(() => evaluate(`Boolean(document.querySelector('.photo-edit-workspace'))`), 'Photo Edit screen')
  assert.ok(await evaluate(`Boolean(document.querySelector('.photo-edit-engine')) && document.querySelector('.photo-edit-generate')?.disabled === true`), 'Engine state is visible and edit waits for a source and prompt')
  assert.ok(await evaluate(`document.querySelector('.photo-edit-workspace .frame-resolution select')?.value === 'balanced'`), 'Photo Edit exposes its default output resolution')
  await evaluate(`document.querySelector('.photo-edit-workspace .frame-resolution select').value = 'custom'; document.querySelector('.photo-edit-workspace .frame-resolution select').dispatchEvent(new Event('change', { bubbles: true }))`)
  assert.ok(await evaluate(`document.querySelectorAll('.photo-edit-workspace .frame-resolution-custom input').length === 2`), 'Photo Edit allows explicit width and height')
  await evaluate(`document.querySelectorAll('.photo-edit-mode label')[1].click()`)
  assert.ok(await evaluate(`document.querySelector('.photo-edit-mode input:checked')?.closest('label')?.textContent.includes('Quality')`), 'Quality mode is selectable')
  await evaluate(`document.querySelectorAll('.photo-edit-mode label')[0].click()`)
  assert.ok(await evaluate(`document.querySelector('.photo-edit-mode input:checked')?.closest('label')?.textContent.includes('Turbo')`), 'Turbo mode is selectable')
  for (const [width, height] of [[1379, 982], [860, 620]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth && Boolean(document.querySelector('.photo-edit-prompt textarea')?.getClientRects().length)`), `Photo Edit fits ${width} × ${height}`)
  }
  assert.ok(await evaluate(`(() => { const button = document.querySelector('.photo-edit-back'); button?.click(); return Boolean(button) })()`), 'Back to Ripple works')
  await until(() => evaluate(`Boolean(document.querySelector('.ripple-workspace'))`), 'Ripple screen')
  assert.ok(await evaluate(`document.querySelector('.ripple-workspace .frame-resolution select')?.value === 'balanced' && Boolean(document.querySelector('.ripple-preview-controls select'))`), 'Ripple exposes resolution and live preview controls')
  assert.ok(await evaluate(`document.querySelectorAll('.ripple-render-card select[aria-label="Ripple edit length"] option').length === 5`), 'Ripple has 5, 10, 15, 20 second and custom lengths')
  await evaluate(`document.querySelector('.ripple-long-toggle input').click()`)
  assert.ok(await evaluate(`Boolean(document.querySelector('.ripple-long-settings')) && document.querySelector('.ripple-generate')?.disabled === true`), 'Long video mode exposes chunk controls and waits for a source')
  await evaluate(`(() => { const overlap = document.querySelectorAll('.ripple-long-settings select')[1]; overlap.value = '0'; overlap.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  assert.ok(await evaluate(`(() => { const blend = document.querySelector('.ripple-long-settings input[type="checkbox"]'); return blend?.disabled && !blend.checked })()`), 'No overlap clears and disables blending instead of trapping the render controls')
  for (const [width, height] of [[1379, 982], [860, 620]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth && Boolean(document.querySelector('.ripple-long-settings')?.getClientRects().length)`), `Ripple long mode fits ${width} × ${height}`)
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 1379, height: 982, deviceScaleFactor: 1, mobile: false })
  const ffmpeg = 'C:/FFMPEG/bin/ffmpeg.exe'
  const ffprobe = 'C:/FFMPEG/bin/ffprobe.exe'
  const synthetic = path.join(profile, 'ripple-source.mp4')
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x256:rate=24:duration=13', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=13', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', '-y', synthetic])
  const invalidImage = path.join(profile, 'invalid-frame.png')
  fs.writeFileSync(invalidImage, 'not an image')
  await evaluate(`localStorage.setItem('ltx-ripple.workspace.v1', JSON.stringify({ source: { path: ${JSON.stringify(synthetic)}, name: 'ripple-source.mp4', kind: 'video' }, editedFrame: { path: ${JSON.stringify(invalidImage)}, name: 'invalid-frame.png', kind: 'image' } }))`)
  await evaluate(`[...document.querySelectorAll('.sidebar .nav-button')].find(item => item.textContent.trim() === 'Photo Edit').click()`)
  await until(() => evaluate(`Boolean(document.querySelector('.photo-edit-workspace'))`), 'Photo Edit before invalid-frame check')
  await evaluate(`document.querySelector('.photo-edit-back').click()`)
  await until(() => evaluate(`document.querySelector('.ripple-error')?.textContent.includes('could not be decoded')`), 'invalid Ripple replacement feedback')
  assert.ok(await evaluate(`document.querySelector('.ripple-generate')?.disabled`), 'Ripple render stays disabled for an image that cannot decode')
  console.log('Invalid replacement image rejected before render')
  const oversized = path.join(profile, 'oversized-source.mp4')
  fs.copyFileSync(synthetic, oversized)
  if (fs.statSync(oversized).size < 2 * 1024 * 1024) fs.truncateSync(oversized, 2 * 1024 * 1024)
  let uploadedBody
  const uploadServer = createServer((request, response) => {
    if (request.url === '/features') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ max_upload_size: 1024 * 1024 }))
      return
    }
    if (request.url !== '/upload/image') { response.writeHead(404); response.end(); return }
    const parts = []
    let size = 0
    request.on('data', part => { size += part.length; parts.push(part) })
    request.on('end', () => {
      if (size > 1024 * 1024) { response.writeHead(413); response.end('Upload exceeds server limit'); return }
      uploadedBody = Buffer.concat(parts)
      const uploadedName = /filename="([^"]+)"/.exec(uploadedBody.subarray(0, 300).toString())?.[1]
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ name: uploadedName, type: 'input', subfolder: 'minimax-desktop' }))
    })
  })
  await new Promise(resolve => uploadServer.listen(0, '127.0.0.1', resolve))
  try {
    const uploadUrl = `http://127.0.0.1:${uploadServer.address().port}`
    const uploaded = await evaluate(`window.minimax.uploadInput(${JSON.stringify(uploadUrl)}, ${JSON.stringify(oversized)})`)
    assert.match(uploaded.name, /^source-[0-9a-f-]+-24fps\.mp4$/, 'Oversized video is converted to a uniquely named MP4 before upload')
    assert.ok(uploadedBody.length <= 1024 * 1024, 'The complete multipart request fits within the advertised ComfyUI cap')
    const fileStart = uploadedBody.indexOf(Buffer.from('\r\n\r\n')) + 4
    const fileEnd = uploadedBody.indexOf(Buffer.from('\r\n--oyama-'), fileStart)
    assert.ok(fileStart > 3 && fileEnd > fileStart, 'The streamed multipart request contains a file')
    const converted = path.join(profile, 'converted-upload.mp4')
    fs.writeFileSync(converted, uploadedBody.subarray(fileStart, fileEnd))
    const convertedMetadata = await evaluate(`window.minimax.getVideoMetadata(${JSON.stringify(converted)}, ${JSON.stringify(ffmpeg)})`)
    assert.equal(convertedMetadata.frameCount, 312, 'Upload conversion preserves the 24 fps source frames')
    assert.deepEqual([convertedMetadata.width, convertedMetadata.height], [320, 256], 'Upload conversion preserves source resolution')
  } finally { await new Promise(resolve => uploadServer.close(resolve)) }
  console.log('Oversized ComfyUI upload normalized and streamed within server limit')
  const first = await evaluate(`window.minimax.prepareRippleChunkSource(${JSON.stringify(synthetic)}, 0, 120, ${JSON.stringify(profile)}, ${JSON.stringify(ffmpeg)})`)
  const second = await evaluate(`window.minimax.prepareRippleChunkSource(${JSON.stringify(synthetic)}, 96, 120, ${JSON.stringify(profile)}, ${JSON.stringify(ffmpeg)})`)
  assert.equal((await evaluate(`window.minimax.getVideoMetadata(${JSON.stringify(first)}, ${JSON.stringify(ffmpeg)})`)).frameCount, 120, 'First Ripple chunk has exactly 120 source frames')
  assert.equal((await evaluate(`window.minimax.getVideoMetadata(${JSON.stringify(second)}, ${JSON.stringify(ffmpeg)})`)).frameCount, 120, 'Overlapping Ripple chunk has exactly 120 source frames')
  const assembled = await evaluate(`window.minimax.assembleRippleChunks([{ source: ${JSON.stringify(first)}, sourceFrames: 120, overlapFrames: 0 }, { source: ${JSON.stringify(second)}, sourceFrames: 120, overlapFrames: 24 }], ${JSON.stringify(synthetic)}, 9, 320, 256, true, ${JSON.stringify(profile)}, ${JSON.stringify(ffmpeg)})`)
  assert.ok(fs.existsSync(assembled.path), 'Ripple assembler creates a local output')
  const assembledMetadata = await evaluate(`window.minimax.getVideoMetadata(${JSON.stringify(assembled.path)}, ${JSON.stringify(ffmpeg)})`)
  assert.equal(assembledMetadata.frameCount, 216, 'Blended output spans the complete nine-second source')
  const hardJoin = await evaluate(`window.minimax.assembleRippleChunks([{ source: ${JSON.stringify(first)}, sourceFrames: 120, overlapFrames: 0 }, { source: ${JSON.stringify(second)}, sourceFrames: 120, overlapFrames: 24 }], ${JSON.stringify(synthetic)}, 9, 320, 256, false, ${JSON.stringify(profile)}, ${JSON.stringify(ffmpeg)})`)
  assert.equal((await evaluate(`window.minimax.getVideoMetadata(${JSON.stringify(hardJoin.path)}, ${JSON.stringify(ffmpeg)})`)).frameCount, 216, 'Unblended output trims the overlap without changing duration')
  const third = await evaluate(`window.minimax.prepareRippleChunkSource(${JSON.stringify(synthetic)}, 192, 120, ${JSON.stringify(profile)}, ${JSON.stringify(ffmpeg)})`)
  const fullJoin = await evaluate(`window.minimax.assembleRippleChunks([{ source: ${JSON.stringify(first)}, sourceFrames: 120, overlapFrames: 0 }, { source: ${JSON.stringify(second)}, sourceFrames: 120, overlapFrames: 24 }, { source: ${JSON.stringify(third)}, sourceFrames: 120, overlapFrames: 24 }], ${JSON.stringify(synthetic)}, 13, 320, 256, true, ${JSON.stringify(profile)}, ${JSON.stringify(ffmpeg)})`)
  assert.equal((await evaluate(`window.minimax.getVideoMetadata(${JSON.stringify(fullJoin.path)}, ${JSON.stringify(ffmpeg)})`)).frameCount, 312, 'Three overlapping chunks preserve the full source duration')
  const shortSource = path.join(profile, 'short-tail-source.mp4')
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', synthetic, '-vf', 'trim=end_frame=264,setpts=PTS-STARTPTS', '-af', 'atrim=duration=11,asetpts=PTS-STARTPTS', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-y', shortSource])
  const shortFirst = await evaluate(`window.minimax.prepareRippleChunkSource(${JSON.stringify(shortSource)}, 0, 240, ${JSON.stringify(profile)}, ${JSON.stringify(ffmpeg)})`)
  const shortSecond = await evaluate(`window.minimax.prepareRippleChunkSource(${JSON.stringify(shortSource)}, 192, 104, ${JSON.stringify(profile)}, ${JSON.stringify(ffmpeg)})`)
  const shortJoin = await evaluate(`window.minimax.assembleRippleChunks([{ source: ${JSON.stringify(shortFirst)}, sourceFrames: 240, overlapFrames: 0 }, { source: ${JSON.stringify(shortSecond)}, sourceFrames: 104, overlapFrames: 48 }], ${JSON.stringify(shortSource)}, 11, 320, 256, true, ${JSON.stringify(profile)}, ${JSON.stringify(ffmpeg)})`)
  assert.equal((await evaluate(`window.minimax.getVideoMetadata(${JSON.stringify(shortJoin.path)}, ${JSON.stringify(ffmpeg)})`)).frameCount, 264, 'Two-second overlap and padded tail retain the entire eleven-second source')
  const streamKinds = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'json', assembled.path], { encoding: 'utf8' })).streams.map(stream => stream.codec_type)
  assert.ok(streamKinds.includes('video') && streamKinds.includes('audio'), 'Assembled Ripple video keeps original audio')
  console.log('Ripple FFmpeg assembly verified')
  const history = await fetch('http://127.0.0.1:8188/history?max_items=20').then(response => response.json()).catch(() => ({}))
  console.log('ComfyUI history checked')
  const priorRipple = Object.entries(history).find(([, entry]) => entry.outputs?.['9']?.images?.some(file => file.type === 'input' && /\.mp4$/i.test(file.filename)) && entry.outputs?.['29']?.images?.some(file => file.type === 'output' && /\.mp4$/i.test(file.filename)))
  if (priorRipple) {
    const [promptId, entry] = priorRipple
    const renderedFile = entry.outputs['29'].images[0]
    const fetched = await evaluate(`window.minimax.getHistory('http://127.0.0.1:8188', ${JSON.stringify(promptId)})`)
    assert.equal(fetched[promptId].outputs['29'].images[0].filename, renderedFile.filename, 'Electron bridge returns the rendered Ripple output from node 29')
    assert.notEqual(fetched[promptId].outputs['9'].images[0].filename, renderedFile.filename, 'Rendered output differs from the uploaded source')
  }
  const image = Object.values(history).flatMap(entry => entry.outputs?.['14']?.images ?? []).find(item => /^Photo_Edit_/.test(item.filename))
  if (image) {
    console.log('FireRed output handoff check')
    const saveDir = path.join(profile, 'saved-output')
    await evaluate(`(async () => { const current = await window.minimax.getSettings(); await window.minimax.saveSettings({ ...current, outputDirectory: ${JSON.stringify(saveDir)} }); return true })()`)
    console.log('Configured isolated output folder')
    const saved = await evaluate(`window.minimax.saveComfyOutputImage('http://127.0.0.1:8188', ${JSON.stringify(image)}, ${JSON.stringify(saveDir)}, 'photo-edit')`)
    console.log('Saved FireRed output')
    assert.ok(fs.existsSync(saved.path) && path.dirname(saved.path) === path.join(saveDir, 'FireRed Photo Edits'), 'Completed FireRed output saves in its configured folder')
    const rejection = await evaluate(`window.minimax.saveComfyOutputImage('http://127.0.0.1:8188', ${JSON.stringify(image)}, ${JSON.stringify(path.join(profile, 'wrong-output'))}, 'photo-edit').then(() => 'unexpected success', error => String(error))`)
    console.log('Rejected unexpected output folder')
    assert.match(rejection, /configured output folder/, 'Unexpected output paths remain blocked')
    await evaluate(`localStorage.setItem('oyama.photo-edit.workspace.v1', JSON.stringify({ source: null, result: { path: ${JSON.stringify(saved.path)}, name: ${JSON.stringify(saved.name)}, kind: 'image' }, prompt: 'Saved edit', seed: 1, mode: 'quality', job: null }))`)
    await evaluate(`[...document.querySelectorAll('.sidebar .nav-button')].find(item => item.textContent.trim() === 'Photo Edit').click()`)
    console.log('Opened saved FireRed result')
    await until(() => evaluate(`document.querySelector('.photo-edit-result-stage img')?.naturalWidth > 0`), 'saved FireRed image preview')
    await evaluate(`document.querySelector('.photo-edit-use').click()`)
    await until(() => evaluate(`document.querySelector('.ripple-frame-button img')?.naturalWidth > 0`), 'Ripple replacement frame preview')
  }
  const recoveryOutput = path.join(profile, 'recovery-output')
  const recoveryVideoFolder = path.join(recoveryOutput, 'video')
  fs.mkdirSync(recoveryVideoFolder, { recursive: true })
  fs.copyFileSync(synthetic, path.join(recoveryVideoFolder, 'offline-preview.mp4'))
  const recoveryImage = 'Photo_Edit_recovered.png'
  fs.writeFileSync(path.join(recoveryOutput, recoveryImage), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64'))
  const recoveryServer = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(request.url === '/system_stats'
      ? JSON.stringify({ system: { argv: ['python', 'main.py', '--output-directory', recoveryOutput] } })
      : request.url?.startsWith('/history/recover-photo')
      ? JSON.stringify({ 'recover-photo': { status: { status_str: 'success' }, outputs: { '14': { images: [{ filename: recoveryImage, type: 'output' }] } } } })
      : JSON.stringify({ queue_running: [], queue_pending: [] }))
  })
  await new Promise(resolve => recoveryServer.listen(0, '127.0.0.1', resolve))
  const recoveryPort = recoveryServer.address().port
  await new Promise(resolve => recoveryServer.close(resolve))
  const recoveryUrl = `http://127.0.0.1:${recoveryPort}`
  await evaluate(`(async () => { const current = await window.minimax.getSettings(); await window.minimax.saveSettings({ ...current, comfyUrl: ${JSON.stringify(recoveryUrl)}, outputDirectory: ${JSON.stringify(recoveryOutput)} }); return true })()`)
  await evaluate(`localStorage.setItem('oyama.photo-edit.workspace.v1', JSON.stringify({ source: null, result: null, prompt: 'Recovery edit', seed: 1, mode: 'quality', job: { id: 'recover-photo', url: ${JSON.stringify(recoveryUrl)} } }))`)
  await evaluate(`location.reload()`)
  await until(() => evaluate(`Boolean(document.querySelector('.sidebar .nav-button'))`), 'reloaded Electron app with recovery settings')
  await evaluate(`[...document.querySelectorAll('.sidebar .nav-button')].find(item => item.textContent.trim() === 'Photo Edit').click()`)
  await until(() => evaluate(`document.querySelector('.photo-edit-message')?.textContent.includes('Waiting to reconnect')`), 'Photo Edit disconnection guidance')
  assert.ok(await evaluate(`JSON.parse(localStorage.getItem('oyama.photo-edit.workspace.v1')).job?.id === 'recover-photo'`), 'A connection failure retains the edit job')
  assert.ok(await evaluate(`document.querySelector('.photo-edit-add-reference')?.disabled`), 'Reference picker is disabled while an edit is running')
  await new Promise(resolve => recoveryServer.listen(recoveryPort, '127.0.0.1', resolve))
  try {
    await until(() => evaluate(`document.querySelector('.photo-edit-result-stage img')?.naturalWidth > 0`), 'saved edit after ComfyUI reconnect').catch(async error => {
      console.error('Recovery state:', await evaluate(`({ message: document.querySelector('.photo-edit-message')?.textContent, draft: localStorage.getItem('oyama.photo-edit.workspace.v1'), image: document.querySelector('.photo-edit-result-stage img')?.currentSrc })`))
      throw error
    })
    assert.ok(await evaluate(`JSON.parse(localStorage.getItem('oyama.photo-edit.workspace.v1')).job === null`), 'Recovered edit clears the job only after saving')
    await evaluate(`document.querySelector('.photo-edit-back').click()`)
    await until(() => evaluate(`Boolean(document.querySelector('.ripple-workspace'))`), 'Ripple before reference draft check')
    await evaluate(`(() => { const draft = JSON.parse(localStorage.getItem('oyama.photo-edit.workspace.v1')); draft.references = [{ path: ${JSON.stringify(path.join(recoveryOutput, recoveryImage))}, name: 'jacket.png', kind: 'image' }, { path: ${JSON.stringify(path.join(recoveryOutput, recoveryImage))}, name: 'hat.png', kind: 'image' }]; localStorage.setItem('oyama.photo-edit.workspace.v1', JSON.stringify(draft)) })()`)
    await evaluate(`[...document.querySelectorAll('.sidebar .nav-button')].find(item => item.textContent.trim() === 'Photo Edit').click()`)
    await until(() => evaluate(`document.querySelectorAll('.photo-edit-reference-preview img').length === 2`), 'saved FireRed reference previews')
    for (const [width, height] of [[1379, 982], [860, 620]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
      assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth && document.querySelectorAll('.photo-edit-reference').length === 2`), `FireRed references fit ${width} × ${height}`)
    }
    await evaluate(`document.querySelector('[aria-label="Remove Image 2 reference"]').click()`)
    assert.ok(await evaluate(`document.querySelectorAll('.photo-edit-reference').length === 1 && document.querySelector('.photo-edit-reference-detail strong')?.textContent.includes('Image 2') && document.querySelector('.photo-edit-add-reference')?.textContent.includes('Image 3')`), 'Removing a reference renumbers the remaining image and exposes the free slot')
    const configuredElsewhere = path.join(profile, 'configured-elsewhere')
    await evaluate(`(async () => { const current = await window.minimax.getSettings(); await window.minimax.saveSettings({ ...current, outputDirectory: ${JSON.stringify(configuredElsewhere)} }); await window.minimax.getComfyStatus(${JSON.stringify(recoveryUrl)}); return true })()`)
    const detectedFile = await evaluate(`window.minimax.resolveOutput(${JSON.stringify(recoveryOutput)}, { filename: 'offline-preview.mp4', subfolder: 'video', type: 'output' })`)
    assert.equal(detectedFile, path.join(recoveryVideoFolder, 'offline-preview.mp4'), 'Continue resolves a completed beat from the actual ComfyUI output folder when the saved setting differs')
    assert.equal(await evaluate(`window.minimax.resolveOutput(${JSON.stringify(path.join(profile, 'unrelated'))}, { filename: 'offline-preview.mp4', subfolder: 'video', type: 'output' })`), null, 'Unrelated output folders remain blocked')
    await new Promise(resolve => recoveryServer.close(resolve))
    const offlineMedia = `minimax-media://comfy/?url=${encodeURIComponent(`${recoveryUrl}/view?filename=offline-preview.mp4&subfolder=video&type=output`)}`
    const range = await evaluate(`(async () => { const response = await fetch(${JSON.stringify(offlineMedia)}, { headers: { Range: 'bytes=0-31' } }); return { status: response.status, contentRange: response.headers.get('content-range'), bytes: (await response.arrayBuffer()).byteLength } })()`)
    assert.equal(range.status, 206, 'ComfyUI output video is served from disk with byte ranges')
    assert.equal(range.bytes, 32, 'ComfyUI local video range has the requested length')
    assert.match(range.contentRange, /^bytes 0-31\//, 'ComfyUI local video reports its range')
  } finally { if (recoveryServer.listening) await new Promise(resolve => recoveryServer.close(resolve)) }
  console.log('PASS: Electron Photo Edit bridge, Turbo and Quality, desktop and compact layouts, Ripple navigation, and available output save')
}

main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  socket?.close()
  child.kill()
  await delay(800)
  const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(profile))
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
})
