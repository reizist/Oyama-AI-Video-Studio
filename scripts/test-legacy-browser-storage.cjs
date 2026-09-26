const assert = require('node:assert/strict')
const { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const { load } = require('./test-ts-loader.cjs')

const { restoreLegacyLocalStorage } = load('electron/legacyBrowserStorage.ts')
const root = mkdtempSync(join(tmpdir(), 'oyama-legacy-restore-'))
const source = join(root, 'old')
const destination = join(root, 'new')
const oldStorage = join(source, 'Local Storage', 'leveldb')
const currentStorage = join(destination, 'Local Storage', 'leveldb')

try {
  assert.throws(() => restoreLegacyLocalStorage(source, source), /different directories/)
  mkdirSync(oldStorage, { recursive: true })
  mkdirSync(currentStorage, { recursive: true })
  writeFileSync(join(oldStorage, 'CURRENT'), 'legacy characters')
  writeFileSync(join(oldStorage, 'LOCK'), 'locked source')
  writeFileSync(join(currentStorage, 'CURRENT'), 'current Oyama characters')

  const locked = Object.assign(new Error('resource busy'), { code: 'EBUSY' })
  assert.throws(() => restoreLegacyLocalStorage(source, destination, (from, to) => {
    if (from === join(destination, 'Local Storage')) throw locked
    renameSync(from, to)
  }), /resource busy/)
  assert.equal(readFileSync(join(currentStorage, 'CURRENT'), 'utf8'), 'current Oyama characters', 'A locked destination stays untouched')
  assert.equal(readdirSync(destination).some((name) => name.startsWith('.legacy-local-storage-stage-')), false, 'Failed staging is cleaned up')

  assert.throws(() => restoreLegacyLocalStorage(source, destination, (from, to) => {
    if (from.includes('.legacy-local-storage-stage-')) throw new Error('Staged move failed')
    renameSync(from, to)
  }), /Staged move failed/)
  assert.equal(readFileSync(join(currentStorage, 'CURRENT'), 'utf8'), 'current Oyama characters', 'A failed staged move rolls the current profile back')

  const restored = restoreLegacyLocalStorage(source, destination)
  assert.equal(restored.restored, true)
  assert.equal(readFileSync(join(currentStorage, 'CURRENT'), 'utf8'), 'legacy characters')
  assert.equal(existsSync(join(destination, 'Local Storage', 'leveldb', 'LOCK')), false, 'Chromium lock files are never copied')
  assert.equal(readFileSync(join(restored.backupPath, 'leveldb', 'CURRENT'), 'utf8'), 'current Oyama characters', 'Current data remains recoverable')
  assert.equal(restoreLegacyLocalStorage(join(root, 'missing'), destination).restored, false)
} finally {
  assert.equal(resolve(root).startsWith(resolve(tmpdir())), true)
  rmSync(root, { recursive: true, force: true })
}

console.log('PASS: staged browser storage restore, lock failure preservation, and local backup')
