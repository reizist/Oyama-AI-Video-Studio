const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const cache = new Map()
function load(filename) {
  const absolute = path.resolve(filename)
  if (cache.has(absolute)) return cache.get(absolute)
  const exports = {}
  cache.set(absolute, exports)
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const localRequire = request => request.startsWith('.') ? load(path.resolve(path.dirname(absolute), `${request}.ts`)) : require(request)
  vm.runInNewContext(code, { exports, require: localRequire, URLSearchParams, URL, console, localStorage: { getItem: () => null } }, { filename: absolute })
  return exports
}
module.exports = { load }
