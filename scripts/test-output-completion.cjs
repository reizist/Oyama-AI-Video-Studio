const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

// Execute the actual IPC registrations without starting Electron or a GPU job.
const source = ts.createSourceFile('main.ts', fs.readFileSync('electron/main.ts', 'utf8'), ts.ScriptTarget.Latest, true)
const registrations = []
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'ipcMain.handle' && ['outputs:resolve', 'outputs:latest', 'file:media-url'].includes(node.arguments[0]?.text)) registrations.push(node.getText(source))
  ts.forEachChild(node, visit)
}
visit(source)
assert.equal(registrations.length, 3)
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'oyama-completion-'))
const video = path.join(directory, 'Anime I2V 日本語.mp4')
fs.writeFileSync(video, '')
const handlers = new Map()
vm.runInNewContext(ts.transpileModule(registrations.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
  ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
  loadSettings: async () => ({ outputDirectory: directory }),
  normalize: path.normalize, extname: path.extname, existsSync: fs.existsSync,
  selectedMediaExtensions: new Set(['.mp4']),
  resolveComfyOutput: (_directory, file) => file.filename === path.basename(video) ? video : null,
  findLatestMedia: async (_directory, since) => since === 0 ? video : null,
})
async function main() {
  try {
    for (const resolved of [await handlers.get('outputs:resolve')(null, directory, { filename: path.basename(video) }), await handlers.get('outputs:latest')(null, directory, 0, 'video')]) {
      assert.equal(resolved, video, 'Completion must receive a filesystem path')
      const url = handlers.get('file:media-url')(null, resolved)
      assert.equal(new URL(url).searchParams.get('path'), video)
    }
    assert.equal(await handlers.get('outputs:resolve')(null, directory, { filename: 'missing.mp4' }), null)
    assert.equal(await handlers.get('outputs:latest')(null, directory, 1), null)
    assert.equal(await handlers.get('outputs:resolve')(null, path.join(directory, 'other'), { filename: path.basename(video) }), null)
    console.log('Output completion IPC regression tests passed')
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })

// SaveVideo-style `images` output must not replace a still preview with an MP4.
const socket = {}
let preview
const previewExports = {}
class FakeSocket {
  constructor() { return socket }
}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/useLivePreview.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  exports: previewExports,
  require: (name) => name === 'react' ? {
    useState: () => [null, (value) => { preview = value }],
    useEffect: (effect) => effect(),
  } : { createId: () => 'test-client' },
  URL, URLSearchParams, WebSocket: FakeSocket,
})
previewExports.useLivePreview('http://127.0.0.1:8188', true, () => {})
async function previewTest() {
  const send = (filename) => socket.onmessage({ data: JSON.stringify({ type: 'executed', data: { prompt_id: 'i2v', output: { images: [{ filename, type: 'output' }] } } }) })
  await send('preview.png')
  const still = preview
  assert.equal(still.mime, 'image/jpeg')
  await send('finished.mp4')
  assert.equal(preview, still)
  console.log('Live preview video-output regression test passed')
}
previewTest().catch((error) => { console.error(error); process.exitCode = 1 })
