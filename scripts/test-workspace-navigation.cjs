const assert = require('node:assert/strict')
const { load } = require('./test-ts-loader.cjs')
const { workspaceDestinations, findWorkspaces, workspaceProjectScope, workspaceStorageKey, workspaceProjectLabel } = load('src/lib/workspaceNavigation.ts')
const { writeLocalJson } = load('src/lib/localPersistence.ts')

for (const destination of workspaceDestinations) {
  const result = findWorkspaces(`  ${destination.label.toUpperCase()}  `)[0]
  assert.equal(result.view, destination.view, `${destination.label} must rank ahead of incidental description matches`)
  assert.equal(result.engine, destination.engine)
}
assert.equal(findWorkspaces('create image')[0].view, 'zimage')
assert.equal(findWorkspaces('trim')[0].view, 'clipmaster')
assert.equal(findWorkspaces('no-such-workspace').length, 0)
assert.equal(findWorkspaces('').length, 19)
assert.equal(findWorkspaces('anime')[0].view, 'anime')
assert.equal(workspaceProjectScope('anime'), 'anime')
assert.equal(workspaceStorageKey('anime'), 'anime.workspace')
assert.equal(workspaceProjectScope('music', 'acestep'), 'music', 'Preserve legacy ACE-Step project scope')
assert.equal(workspaceProjectScope('music', 'music3'), 'music3')
assert.equal(workspaceProjectScope('settings'), null)
assert.equal(workspaceStorageKey('music'), 'acestep.workspace')
assert.equal(workspaceStorageKey('music3'), 'minimax.music3-workspace')
assert.notEqual(workspaceProjectLabel('music'), workspaceProjectLabel('music3'))

const saved = new Map([['project', '{"prompt":"original"}']])
const storage = { setItem: (key, value) => saved.set(key, value) }
assert.equal(writeLocalJson('project', { prompt: 'new' }, { setItem() { throw new Error('Quota exceeded') } }), false)
assert.equal(saved.get('project'), '{"prompt":"original"}', 'Failed writes preserve the last saved snapshot')
assert.equal(writeLocalJson('project', { prompt: 'recovered' }, storage), true)
assert.equal(JSON.parse(saved.get('project')).prompt, 'recovered')
const circular = {}; circular.self = circular
assert.equal(writeLocalJson('project', circular, storage), false)
assert.equal(JSON.parse(saved.get('project')).prompt, 'recovered', 'Serialization failure must not overwrite existing data')
console.log('PASS: all workspace destinations, search ranking, separate music snapshots, failed-write preservation and recovery')
