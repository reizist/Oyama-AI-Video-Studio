const assert = require('node:assert/strict')
const { load } = require('./test-ts-loader.cjs')

const { comfyTerminalState, mayApplyHistoryUpdate, queuePromptPosition, queuePromptState } = load('src/lib/comfyJobState.ts')

const queue = {
  queue_running: [[0, 'render-a', {}, {}, []]],
  queue_pending: [[1, 'render-b', {}, {}, []], [2, 'render-c', {}, {}, []]],
}
assert.equal(queuePromptState(queue, 'render-a'), 'running')
assert.equal(queuePromptState(queue, 'render-c'), 'queued')
assert.equal(queuePromptPosition(queue, 'render-c'), 2)
assert.equal(queuePromptState(queue, 'missing'), null)
assert.equal(queuePromptPosition({}, 'missing'), undefined)

assert.equal(comfyTerminalState({ status: { status_str: 'success', completed: true } }), 'completed')
assert.equal(comfyTerminalState({ status: { status_str: 'error', completed: true } }), 'failed')
assert.equal(comfyTerminalState({ status: { status_str: 'interrupted' } }), 'failed')
assert.equal(comfyTerminalState(undefined), null)

const snapshot = { id: 'job-a', promptId: 'render-a', status: 'running' }
assert.equal(mayApplyHistoryUpdate(snapshot, snapshot, false), true)
assert.equal(mayApplyHistoryUpdate({ ...snapshot, status: 'queued' }, snapshot, false), true)
assert.equal(mayApplyHistoryUpdate(snapshot, snapshot, true), false, 'In-flight cancellation blocks stale history')
assert.equal(mayApplyHistoryUpdate({ ...snapshot, status: 'cancelled' }, snapshot, false), false)
assert.equal(mayApplyHistoryUpdate({ ...snapshot, status: 'completed' }, snapshot, false), false)
assert.equal(mayApplyHistoryUpdate({ ...snapshot, promptId: 'render-b' }, snapshot, false), false)
assert.equal(mayApplyHistoryUpdate({ ...snapshot, id: 'job-b' }, snapshot, false), false)

console.log('PASS: queue/history interpretation and cancellation-safe terminal updates')
