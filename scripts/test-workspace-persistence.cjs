const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync('src/lib/workspacePersistence.ts', 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
let saved = null
const moduleExports = {}
vm.runInNewContext(code, { exports: moduleExports, localStorage: { getItem: () => saved } }, { filename: 'workspacePersistence.ts' })

saved = JSON.stringify({
  seed: 42,
  livePreviewMode: 'standard',
  referenceImages: null,
  referenceVideos: [{ path: 'clip.mp4', name: 'Clip', kind: 'video' }, { path: 7, kind: 'video' }],
  referenceAudios: 'invalid',
  selectedReferenceCharacterIds: ['valid', null, 7],
  firstFrame: { path: 'opening.png', name: 'Opening', kind: 'image', preview: 'data:image/png;base64,abc' },
  lastFrame: { path: 'sound.wav', name: 'Sound', kind: 'audio' },
})
const restored = moduleExports.readWorkspace()
assert.equal(restored.ref2vaSeed, 42, 'legacy seed remains the Ref2VA seed')
assert.equal(restored.livePreviewMode, 'auto', 'old preview mode migrates')
assert.equal(restored.referenceImages.length, 0)
assert.equal(restored.referenceVideos.length, 1)
assert.equal(restored.referenceAudios.length, 0)
assert.deepEqual(Array.from(restored.selectedReferenceCharacterIds), ['valid'])
assert.equal(restored.firstFrame.path, 'opening.png')
assert.equal(restored.lastFrame, null, 'an invalid audio frame is ignored')
assert.equal(moduleExports.withoutPreview(restored.firstFrame).preview, undefined, 'media previews are not persisted twice')

saved = JSON.stringify({ experimentalSampling: false, sampler: 'euler', scheduler: 'beta' })
const optOut = moduleExports.readWorkspace()
assert.equal(optOut.experimentalSampling, false)
assert.equal(optOut.sampler, 'euler', 'an explicit sampling choice is preserved')
assert.equal(optOut.scheduler, 'beta')

saved = '{broken json'
assert.equal(moduleExports.readWorkspace().resolution, moduleExports.workspaceDefaults.resolution)
process.stdout.write('PASS: legacy workspace migration, malformed media recovery, saved opt-out, and corrupt JSON fallback\n')
