const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const exposed = {}
const source = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.ts'), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const electron = {
  contextBridge: { exposeInMainWorld: (name, api) => { exposed[name] = api } },
  ipcRenderer: { invoke: async (channel) => channel, on: () => {}, removeListener: () => {} },
}

vm.runInNewContext(code, {
  exports: {},
  require: (name) => {
    if (name === 'electron') return electron
    throw new Error(`Electron sandbox preload cannot import ${name}`)
  },
  setTimeout,
  clearTimeout,
}, { filename: 'electron/preload.ts' })

assert.equal(typeof exposed.minimax?.getComfyStatus, 'function')
assert.equal(typeof exposed.minimax?.getSettings, 'function')
console.log('PASS: Electron sandbox preload exposes the desktop bridge without unsupported imports')
