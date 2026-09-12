const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const vm = require('node:vm')
const ts = require('typescript')
const { readFileSync } = require('node:fs')
const exportsObject = {}
vm.runInNewContext(ts.transpileModule(readFileSync('electron/trashOutput.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject, require, URL })
const { trashOutput } = exportsObject

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'oyama-delete-'))
  try {
    const output = path.join(root, 'output')
    await fs.mkdir(output)
    const file = path.join(output, 'Anime 日本語.mp4')
    await fs.writeFile(file, 'test')
    const calls = []
    const trash = async (target) => { calls.push(target) }
    const run = (source) => trashOutput(source, output, 'http://127.0.0.1:8188', trash)
    for (const source of [file, `minimax-media://selected?path=${encodeURIComponent(file)}`, `minimax-media://local?path=${encodeURIComponent(file)}`, `minimax-media://comfy?url=${encodeURIComponent('http://127.0.0.1:8188/view?' + new URLSearchParams({ filename: path.basename(file), type: 'output' }))}`]) {
      assert.equal(await run(source), 'trashed')
      assert.equal(calls.at(-1), file)
    }
    const callCount = calls.length
    assert.equal(await run(path.join(output, 'missing.mp4')), 'missing')
    await assert.rejects(run(path.join(root, 'outside.mp4')), /configured output/)
    await assert.rejects(run(output), /configured output/)
    await assert.rejects(run(path.join(output, 'settings.json')), /supported generated media/)
    await assert.rejects(run('minimax-media://comfy?url=' + encodeURIComponent('http://evil.invalid/view?filename=test.mp4')), /configured ComfyUI/)
    await assert.rejects(run('minimax-media://comfy?url=' + encodeURIComponent('http://127.0.0.1:8188/view?filename=test.mp4&type=input')), /configured ComfyUI/)
    await assert.rejects(run('minimax-media://comfy?url=' + encodeURIComponent('http://127.0.0.1:8188/view?filename=../outside.mp4')), /configured output/)
    const folder = path.join(output, 'folder.mp4')
    await fs.mkdir(folder)
    await assert.rejects(run(folder), /regular media file/)
    if (process.platform !== 'win32') {
      await fs.symlink(file, path.join(output, 'link.mp4'))
      await assert.rejects(run(path.join(output, 'link.mp4')), /regular media file/)
      await fs.mkdir(path.join(root, 'external'))
      await fs.writeFile(path.join(root, 'external', 'video.mp4'), 'test')
      await fs.symlink(path.join(root, 'external'), path.join(output, 'linked-folder'))
      await assert.rejects(run(path.join(output, 'linked-folder', 'video.mp4')), /outside/)
    }
    assert.equal(calls.length, callCount, 'Rejected and missing files must not reach Trash')
    await assert.rejects(trashOutput(file, output, 'http://127.0.0.1:8188', async () => { throw new Error('Trash unavailable') }), /Trash unavailable/)
    assert.equal(await fs.readFile(file, 'utf8'), 'test', 'A Trash failure must never fall back to permanent deletion')
    console.log('Generated output Trash tests passed')
  } finally { await fs.rm(root, { recursive: true, force: true }) }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })

// Run the shared history deletion handler with mocked state/IPC.
const app = readFileSync('src/App.tsx', 'utf8')
const start = app.indexOf('  const deleteGeneration = async')
const end = app.indexOf('  const selectActiveJob', start)
assert.ok(start > 0 && end > start)
async function testHistory(status, trashFile, outputResult) {
  let jobs = [{ id: 'target', status, localOutputPath: '/output/video.mp4' }, { id: 'keep', status: 'completed' }]
  let active = 'target', calls = 0
  const context = {
    jobsRef: { current: jobs },
    window: { minimax: { trashOutput: async () => { calls++; if (outputResult instanceof Error) throw outputResult; return outputResult } } },
    setJobs: (update) => { jobs = update(jobs) },
    setActiveJobId: (update) => { active = update(active) },
    setNotice: () => {},
  }
  vm.createContext(context)
  vm.runInContext(ts.transpileModule(app.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + '\nglobalThis.remove = deleteGeneration', context)
  const error = await context.remove(jobs[0], trashFile).then(() => null, (error) => error)
  return { jobs, active, calls, error }
}
async function historyTests() {
  for (const result of ['trashed', 'missing']) {
    const state = await testHistory('completed', true, result)
    assert.equal(state.error, null)
    assert.equal(state.jobs.length, 1)
    assert.equal(state.jobs[0].id, 'keep')
    assert.equal(state.active, null)
  }
  const historyOnly = await testHistory('failed', false)
  assert.equal(historyOnly.jobs.length, 1)
  assert.equal(historyOnly.calls, 0)
  const failure = await testHistory('completed', true, new Error('Trash failed'))
  assert.equal(failure.jobs.length, 2)
  assert.equal(failure.active, 'target')
  assert.match(failure.error.message, /Trash failed/)
  for (const status of ['running', 'queued']) {
    const state = await testHistory(status, true, 'trashed')
    assert.equal(state.jobs.length, 2)
    assert.equal(state.calls, 0)
    assert.match(state.error.message, /Stop the generation/)
  }
  console.log('Shared Library/Queue history deletion tests passed')
}
historyTests().catch((error) => { console.error(error); process.exitCode = 1 })
