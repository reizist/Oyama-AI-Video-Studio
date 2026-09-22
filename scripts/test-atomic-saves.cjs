const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { tmpdir } = require('node:os')
const vm = require('node:vm')
const ts = require('typescript')
const exportsObject = {}
vm.runInNewContext(ts.transpileModule(readFileSync('electron/atomicFile.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject, require, process })

async function test() {
  const folder = await fs.mkdtemp(join(tmpdir(), 'oyama-atomic-test-'))
  try {
    const file = join(folder, 'settings.json')
    const { writeAtomicFile } = exportsObject
    await writeAtomicFile(file, JSON.stringify({ revision: -1 }))
    let reading = true
    const reader = (async () => {
      while (reading) assert.equal(typeof JSON.parse(await fs.readFile(file, 'utf8')).revision, 'number')
    })()
    try {
      const results = await Promise.allSettled(Array.from({ length: 40 }, (_, revision) => writeAtomicFile(file, JSON.stringify({ revision, payload: 'x'.repeat(32000) }))))
      assert.deepEqual(results.filter(result => result.status === 'rejected'), [])
    } finally { reading = false; await reader }
    assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).revision, 39)
    await assert.rejects(writeAtomicFile(folder, 'cannot replace a directory'))
    await writeAtomicFile(file, JSON.stringify({ revision: 40 }))
    assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).revision, 40)
    assert.deepEqual(await fs.readdir(folder), ['settings.json'])
    console.log('PASS: concurrent ordered saves, complete reads, failure recovery, temporary-file cleanup')
  } finally {
    // Only the unique directory created by this test is removed.
    await fs.rm(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}
test().catch(error => { console.error(error); process.exitCode = 1 })
