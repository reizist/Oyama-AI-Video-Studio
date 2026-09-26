const assert = require('node:assert/strict')
const { load } = require('./test-ts-loader.cjs')

const { playableOutputUrl, readSavedJobs } = load('src/lib/jobPersistence.ts')

assert.equal(readSavedJobs('{invalid').length, 0)
assert.equal(readSavedJobs('{}').length, 0)
const saved = readSavedJobs(JSON.stringify([
  null,
  { id: 'done', prompt: 'A finished shot', createdAt: 100, status: 'completed', mode: 'text', progress: 100, width: 864, height: 480, duration: 5, outputUrl: 'http://127.0.0.1:8188/view?filename=shot.mp4' },
  { id: 'broken', prompt: 'A pending shot', createdAt: 101, status: 'running', progress: 250, outputUrl: 42 },
  { id: '', prompt: 'Unusable', createdAt: 102, status: 'completed' },
  { id: 'invalid-date', prompt: 'Unusable', createdAt: 'yesterday', status: 'completed' },
  { id: 'out-of-range-date', prompt: 'Unusable', createdAt: 1e30, status: 'completed' },
]))
assert.equal(saved.length, 2, 'One bad entry must not hide good jobs')
assert.equal(saved[0].status, 'completed')
assert.match(saved[0].outputUrl, /^minimax-media:\/\/comfy\?url=/)
assert.equal(saved[1].status, 'failed', 'An interrupted local submission is recoverable in Queue')
assert.equal(saved[1].progress, 100)
assert.equal(saved[1].outputUrl, undefined)
assert.match(saved[1].error, /prompt ID/)
assert.equal(playableOutputUrl('minimax-media://comfy?url=stored'), 'minimax-media://comfy?url=stored')

console.log('PASS: saved job recovery, malformed entry isolation, and playback URL migration')
