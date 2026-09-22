const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const exportsObject = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/movieTimeline.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject })
const { adjacentEditFrame, preserveLockedClips, previewSourceFrame } = exportsObject
const editClips = [{ startFrame: 24, frameCount: 48 }, { startFrame: 96, frameCount: 24 }]
assert.equal(adjacentEditFrame(50, -1, 144, editClips), 24, 'Previous edit finds the nearest earlier boundary')
assert.equal(adjacentEditFrame(50, 1, 144, editClips), 72, 'Next edit finds the nearest later boundary')
assert.equal(adjacentEditFrame(0, -1, 144, editClips), 0, 'Previous edit clamps at sequence start')
assert.equal(adjacentEditFrame(144, 1, 144, editClips), 144, 'Next edit clamps at sequence end')
assert.equal(previewSourceFrame(48, 24, 100, 90), 48, 'Preview clamps before a trimmed clip')
assert.equal(previewSourceFrame(48, 24, 100, 110), 58, 'Preview follows the timeline within a trimmed clip')
assert.equal(previewSourceFrame(48, 24, 100, 999), 71, 'Preview clamps to the final included frame')
assert.equal(previewSourceFrame(48, 0, 100, 999), 48, 'Preview remains valid for malformed zero-frame media')
const locked = { id: 'locked', trackId: 'v1', startFrame: 24 }
const editable = { id: 'editable', trackId: 'v2', startFrame: 48 }
const before = { tracks: [{ id: 'v1', locked: true }, { id: 'v2' }], clips: [locked, editable] }
const result = (clips) => JSON.parse(JSON.stringify(preserveLockedClips(before, { ...before, clips })))
assert.deepEqual(result([]), [locked], 'Delete preserves clips on locked tracks')
assert.deepEqual(result([{ ...locked, trackId: 'v2', startFrame: 0 }, editable]), [editable, locked], 'Dragging out of a locked track cannot move its source')
assert.deepEqual(result([locked, { id: 'new', trackId: 'v1' }, editable]), [editable, locked], 'Paste cannot add clips to a locked track')
assert.deepEqual(result([locked, { ...editable, startFrame: 96 }]), [{ ...editable, startFrame: 96 }, locked], 'Unlocked tracks remain editable')
assert.equal(before.clips[0].startFrame, 24, 'History snapshots remain unchanged')
console.log('PASS: movie track locks protect delete, drag and paste while preserving editable tracks and history')
const handoffExports = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/movieHandoff.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: handoffExports })
const { movieSourceFrame, parseMovieHandoff, movieFrameTargets } = handoffExports
assert.equal(movieSourceFrame(100, 48, 24, 90, 'current'), 48, 'Playhead before selection clamps to trimmed in point')
assert.equal(movieSourceFrame(100, 48, 24, 999, 'current'), 71, 'Playhead after selection clamps to final included frame')
assert.equal(movieSourceFrame(100, 48, 24, 110, 'current'), 58)
assert.equal(movieSourceFrame(100, 48, 24, 110, 'first'), 48)
assert.equal(movieSourceFrame(100, 48, 24, 110, 'last'), 71)
assert.equal(movieSourceFrame(100, 48, 1, 110, 'last'), 48, 'Single-frame clips remain valid')
for (const [target] of movieFrameTargets) {
  const request = { id: 'test', file: { kind: 'image', path: 'C:/output/frame.png', name: 'frame.png' }, target, sourceName: 'Trimmed shot' }
  assert.equal(parseMovieHandoff(JSON.stringify(request)).target, target)
}
for (const raw of [null, '{', '{}', JSON.stringify({ id: 'test', target: 'unknown', file: { kind: 'image', path: 'x', name: 'x' }, sourceName: 'x' }), JSON.stringify({ id: 'test', target: 'h3-i2v', file: { kind: 'video', path: 'x', name: 'x' }, sourceName: 'x' })]) assert.equal(parseMovieHandoff(raw), null)
console.log('PASS: trimmed frame boundaries, all handoff destinations, malformed and non-image handoff rejection')
