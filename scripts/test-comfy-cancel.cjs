const assert = require('node:assert/strict')
const { createServer } = require('node:http')
const { once } = require('node:events')
const { load } = require('./test-ts-loader.cjs')

const { cancelComfyPrompt } = load('electron/comfyCancellation.ts')
const state = { modern: true, running: '', pending: [], history: {}, calls: [], queueReads: 0, moveOnSecondRead: false }
const send = (response, status, body) => {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname
  state.calls.push(`${request.method} ${path}`)
  if (request.method === 'GET' && path === '/queue') {
    state.queueReads += 1
    if (state.moveOnSecondRead && state.queueReads === 2) state.running = 'next-job'
    return send(response, 200, {
      queue_running: state.running ? [[0, state.running, {}, {}, []]] : [],
      queue_pending: state.pending.map((id, index) => [index + 1, id, {}, {}, []]),
    })
  }
  if (request.method === 'GET' && path.startsWith('/history/')) {
    const id = decodeURIComponent(path.slice('/history/'.length))
    return send(response, 200, state.history[id] ? { [id]: state.history[id] } : {})
  }
  if (request.method === 'POST' && path.startsWith('/api/jobs/') && path.endsWith('/cancel')) {
    if (!state.modern) return send(response, 404, { error: 'Unsupported' })
    const id = decodeURIComponent(path.slice('/api/jobs/'.length, -'/cancel'.length))
    const cancelled = state.running === id || state.pending.includes(id)
    if (state.running === id) state.running = ''
    state.pending = state.pending.filter(item => item !== id)
    return send(response, 200, { cancelled })
  }
  if (request.method === 'POST' && (path === '/interrupt' || path === '/queue')) {
    let body = ''
    for await (const chunk of request) body += chunk
    const payload = JSON.parse(body)
    if (path === '/interrupt' && state.running === payload.prompt_id) state.running = ''
    if (path === '/queue') state.pending = state.pending.filter(id => !payload.delete.includes(id))
    response.writeHead(200)
    return response.end()
  }
  if (request.method === 'POST' && path === '/prompt') {
    const id = `new-${state.calls.length}`
    state.pending.push(id)
    return send(response, 200, { prompt_id: id })
  }
  return send(response, 404, { error: 'Unknown route' })
})

async function main() {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  const request = (path, init) => fetch(`${base}${path}`, init)
  const reset = (modern, running = '', pending = []) => {
    Object.assign(state, { modern, running, pending: [...pending], history: {}, calls: [], queueReads: 0, moveOnSecondRead: false })
  }
  try {
    reset(true, 'active')
    assert.deepEqual(cancelShape(await cancelComfyPrompt('active', request)), { cancelled: true, state: 'running' })
    assert.equal(state.running, '')
    assert.equal(state.calls.some(call => call.includes('/interrupt')), false, 'Modern cancellation must not use global interrupt')

    const submitted = await (await request('/prompt', { method: 'POST' })).json()
    assert.ok(state.pending.includes(submitted.prompt_id), 'A new generation can queue after cancellation')
    assert.deepEqual(cancelShape(await cancelComfyPrompt(submitted.prompt_id, request)), { cancelled: true, state: 'pending' })
    assert.equal(state.pending.length, 0)

    reset(false, 'legacy-running')
    assert.deepEqual(cancelShape(await cancelComfyPrompt('legacy-running', request)), { cancelled: true, state: 'running' })
    assert.equal(state.running, '')
    assert.ok(state.calls.includes('POST /interrupt'))

    reset(false, '', ['legacy-pending'])
    assert.deepEqual(cancelShape(await cancelComfyPrompt('legacy-pending', request)), { cancelled: true, state: 'pending' })
    assert.equal(state.pending.length, 0)
    assert.ok(state.calls.includes('POST /queue'))

    reset(false, 'old-job')
    state.moveOnSecondRead = true
    assert.deepEqual(cancelShape(await cancelComfyPrompt('old-job', request)), { cancelled: false, state: 'unknown' })
    assert.equal(state.running, 'next-job', 'A newly started job must survive the legacy cancellation race')
    assert.equal(state.calls.includes('POST /interrupt'), false)

    reset(true)
    state.history.done = { status: { completed: true } }
    assert.deepEqual(cancelShape(await cancelComfyPrompt('done', request)), { cancelled: false, state: 'finished' })
    assert.deepEqual(cancelShape(await cancelComfyPrompt('missing', request)), { cancelled: false, state: 'unknown' })
    await assert.rejects(cancelComfyPrompt('', request), /prompt ID is required/)
    process.stdout.write('PASS: modern and legacy ComfyUI cancellation, race protection, terminal states, and resubmission\n')
  } finally {
    server.close()
    await once(server, 'close')
  }
}

function cancelShape(value) { return { cancelled: value.cancelled, state: value.state } }
main().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1 })
