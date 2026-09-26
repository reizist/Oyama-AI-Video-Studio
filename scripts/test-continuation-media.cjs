const assert = require('node:assert/strict')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const vm = require('node:vm')
const { createHash, randomUUID } = require('node:crypto')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { Readable } = require('node:stream')
const ts = require('typescript')
const run = promisify(execFile)
const ffmpeg = process.env.FFMPEG_PATH || (fs.existsSync('C:/FFMPEG/bin/ffmpeg.exe') ? 'C:/FFMPEG/bin/ffmpeg.exe' : 'ffmpeg')
const ffprobe = ffmpeg.replace(/ffmpeg(?=\.exe$|$)/, 'ffprobe')

// Exercise the actual IPC callbacks with native media tools, without starting
// Electron or touching the user's profile, media, or generation server.
const source = ts.createSourceFile('main.ts', fs.readFileSync(path.resolve(__dirname, '../electron/main.ts'), 'utf8'), ts.ScriptTarget.Latest, true)
function handler(channel, dependencies) {
  let callback
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'ipcMain.handle' && node.arguments[0]?.text === channel) callback = node.arguments[1]
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(callback, channel)
  const module = { exports: {} }
  const js = ts.transpileModule(`module.exports = ${callback.getText(source)}`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(js, { module, ...dependencies })
  return module.exports
}
function namedFunction(name, dependencies) {
  let declaration
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) declaration = node
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(declaration, name)
  const module = { exports: {} }
  const js = ts.transpileModule(`module.exports = ${declaration.getText(source)}`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(js, { module, ...dependencies })
  return module.exports
}

async function main() {
  await run(ffmpeg, ['-version'])
  const folder = await fsp.mkdtemp(path.join(os.tmpdir(), 'oyama-continuation-test-'))
  try {
    const probe = async file => JSON.parse((await run(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file])).stdout)
    const dependencies = {
      ...path, ...fsp, randomUUID, constants: fs.constants,
      resolveVideoSource: async file => { await fsp.access(file); return file },
      probeClipVideoMetadata: async file => { const data = await probe(file); return { duration: Number(data.format.duration) } },
      runFfprobe: async (_tool, args) => (await run(ffprobe, args)).stdout,
      runFfmpeg: async (_tool, args) => { await run(ffmpeg, args) },
    }
    const prepare = handler('video:continuation-source', dependencies)
    for (const fps of [30, 60]) {
      const input = path.join(folder, `${fps}.mp4`)
      await run(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', `testsrc2=size=64x64:rate=${fps}:duration=2`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', input])
      const output = await prepare(null, [path.join(folder, 'missing.mp4'), input], null, folder, ffmpeg)
      const data = await probe(output)
      const video = data.streams.find(item => item.codec_type === 'video')
      const audio = data.streams.find(item => item.codec_type === 'audio')
      assert.equal(video.avg_frame_rate, '24/1')
      assert.equal(Number(video.nb_frames), 48, 'Imported cadence must preserve playback duration')
      assert.ok(audio, 'Silent sources need silence padding before the generated soundtrack')
      assert.ok(Math.abs(Number(audio.duration) - 2) < 0.03)
      const selected = await prepare(null, [input], 0.5, folder, ffmpeg)
      const cut = await probe(selected)
      assert.equal(Number(cut.streams.find(item => item.codec_type === 'video').nb_frames), 13, 'Retain source through the chosen frame, inclusive')
      assert.ok(Math.abs(Number(cut.streams.find(item => item.codec_type === 'audio').duration) - 13 / 24) < 0.03)
      await assert.rejects(prepare(null, [input], 8, folder, ffmpeg), /outside/)
      await assert.rejects(prepare(null, [input], -1, folder, ffmpeg), /valid source frame/)
    }
    const input = path.join(folder, '30.mp4')
    const configuredOutput = path.join(folder, 'configured-output')
    const detectedOutput = path.join(folder, 'detected-output')
    const renderedFolder = path.join(detectedOutput, 'continuations', 'scene')
    await fsp.mkdir(renderedFolder, { recursive: true })
    await fsp.copyFile(input, path.join(renderedFolder, 'beat-1.mp4'))
    const settings = { comfyUrl: 'http://127.0.0.1:8188', outputDirectory: configuredOutput }
    const trustedOutput = namedFunction('trustedComfyOutputDirectory', {
      normalize: path.normalize, cleanUrl: value => value.replace(/\/+$/, ''),
      observedComfyOutput: null, AbortSignal,
      comfyOutputFromStats: namedFunction('comfyOutputFromStats', {}),
      comfyFetch: async () => ({ system: { argv: ['python', 'main.py', '--output-directory', detectedOutput] } }),
    })
    assert.equal(await trustedOutput(settings, detectedOutput), true, 'The actual ComfyUI output folder is trusted')
    assert.equal(await trustedOutput(settings, path.join(folder, 'unrelated')), false, 'An unrelated folder is not trusted')
    const resolveOutput = handler('outputs:resolve', {
      loadSettings: async () => settings,
      trustedComfyOutputDirectory: trustedOutput,
      resolveComfyOutput: namedFunction('resolveComfyOutput', { ...path, existsSync: fs.existsSync }),
    })
    assert.equal(await resolveOutput(null, detectedOutput, { filename: 'beat-1.mp4', subfolder: 'continuations/scene', type: 'output' }), path.join(renderedFolder, 'beat-1.mp4'), 'The next beat receives the completed clip from ComfyUI’s detected output folder')
    assert.equal(await resolveOutput(null, path.join(folder, 'unrelated'), { filename: 'beat-1.mp4', type: 'output' }), null)
    assert.equal(await resolveOutput(null, detectedOutput, { filename: '../../beat-1.mp4', type: 'output' }), null)
    const localMediaResponse = namedFunction('localMediaResponse', {
      stat: fsp.stat, createReadStream: fs.createReadStream, extname: path.extname,
      Readable, Response, Headers,
      mediaMimeTypes: { '.mp4': 'video/mp4' },
    })
    const ranged = await localMediaResponse(input, new Request('http://localhost/video', { headers: { Range: 'bytes=0-15' } }))
    assert.equal(ranged.status, 206)
    assert.equal(ranged.headers.get('accept-ranges'), 'bytes')
    assert.equal((await ranged.arrayBuffer()).byteLength, 16)
    assert.match(ranged.headers.get('content-range'), /^bytes 0-15\//)
    const suffix = await localMediaResponse(input, new Request('http://localhost/video', { headers: { Range: 'bytes=-8' } }))
    assert.equal(suffix.status, 206)
    assert.equal((await suffix.arrayBuffer()).byteLength, 8)
    const thumbnail = handler('video:thumbnail', {
      ...dependencies, createHash, existsSync: fs.existsSync,
      app: { getPath: () => folder },
    })
    const posterUrl = await thumbnail(null, input, ffmpeg)
    assert.match(posterUrl, /^minimax-media:\/\/thumbnail\?path=.*&v=2$/)
    const posterPath = new URL(posterUrl).searchParams.get('path')
    assert.ok((await fsp.stat(posterPath)).size > 0, 'Thumbnail must contain a decoded video frame')
    assert.equal(await thumbnail(null, input, ffmpeg), posterUrl, 'Thumbnail extraction should reuse the cached frame')
    const remoteSource = 'minimax-media://comfy?url=http%3A%2F%2F127.0.0.1%3A8188%2Fview%3Ffilename%3D30.mp4'
    const temporaryRemote = path.join(folder, 'remote-source.mp4')
    const remotePrepare = handler('video:continuation-source', {
      ...dependencies, URL,
      resolveVideoSource: async () => { await fsp.copyFile(input, temporaryRemote); return temporaryRemote },
    })
    await remotePrepare(null, [remoteSource], null, folder, ffmpeg)
    assert.equal(fs.existsSync(temporaryRemote), false, 'Downloaded continuation source must be removed')
    const remoteThumbnail = handler('video:thumbnail', {
      ...dependencies, createHash, existsSync: fs.existsSync, URL,
      app: { getPath: () => folder },
      resolveVideoSource: async () => { await fsp.copyFile(input, temporaryRemote); return temporaryRemote },
    })
    const remotePoster = await remoteThumbnail(null, remoteSource, ffmpeg)
    assert.ok((await fsp.stat(new URL(remotePoster).searchParams.get('path'))).size > 0)
    assert.equal(fs.existsSync(temporaryRemote), false, 'Downloaded thumbnail source must be removed')
    const destination = path.join(folder, 'export.mp4')
    let result = { canceled: false, filePath: destination }
    const exportVideo = handler('video:export', { ...dependencies, BrowserWindow: { fromWebContents: () => null }, dialog: { showSaveDialog: async () => result } })
    assert.equal(await exportVideo({ sender: {} }, input, 'Sample.mp4'), destination)
    assert.deepEqual(await fsp.readFile(destination), await fsp.readFile(input))
    await assert.rejects(exportVideo({ sender: {} }, input, 'Sample.mp4'), /already exists/)
    result = { canceled: true }
    assert.equal(await exportVideo({ sender: {} }, input, 'Sample.mp4'), null)
    console.log('PASS: real FFmpeg continuation cadence, inclusive frame cut, silent audio alignment, source fallback, byte-range playback, local/remote thumbnail cache, and non-destructive exports')
  } finally { await fsp.rm(folder, { recursive: true, force: true }) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
