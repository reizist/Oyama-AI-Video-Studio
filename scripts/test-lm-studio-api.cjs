const assert = require('node:assert/strict')
const { load } = require('./test-ts-loader.cjs')
const { lmStudioEndpoint, parseLmStudioModels } = load('electron/lmStudioApi.ts')

assert.equal(lmStudioEndpoint('http://127.0.0.1:1234/api/v1/', '/models'), 'http://127.0.0.1:1234/api/v1/models')
assert.equal(lmStudioEndpoint('http://127.0.0.1:1234/api/v1/', '/chat/completions'), 'http://127.0.0.1:1234/v1/chat/completions')
assert.equal(lmStudioEndpoint('http://127.0.0.1:1234/v1', '/models'), 'http://127.0.0.1:1234/v1/models')
assert.equal(lmStudioEndpoint('http://127.0.0.1:1234', '/models'), 'http://127.0.0.1:1234/v1/models')

const models = parseLmStudioModels({ models: [
  { key: 'unloaded/llm', type: 'llm', size_bytes: 10, params_string: '7B', architecture: 'llama', loaded_instances: [] },
  { key: 'embedding/model', type: 'embedding', size_bytes: 5, loaded_instances: [] },
  { key: 'loaded/llm', type: 'llm', size_bytes: 20, loaded_instances: [{ id: 'instance' }] },
] })
assert.deepEqual(models.map((model) => model.name), ['loaded/llm', 'unloaded/llm'])
assert.equal(models[0].size, 20)
assert.equal(models[1].parameterSize, '7B')
assert.deepEqual(parseLmStudioModels({ data: [{ id: 'qwen/model' }, { id: 'text-embedding-model' }] }).map((model) => model.name), ['qwen/model'])
process.stdout.write('PASS: LM Studio native and compatible endpoints, installed model parsing, and embedding exclusion\n')
