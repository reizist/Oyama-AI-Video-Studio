import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { basename, join, resolve } from 'node:path'

export type BrowserStorageRestore = { restored: boolean; backupPath?: string }

/**
 * Chromium's Local Storage is a LevelDB directory. Replacing its files one by
 * one can leave a mixed database if a running process holds a Windows lock.
 * Call this before Electron opens a session, with all other app windows closed.
 */
export function restoreLegacyLocalStorage(sourceProfile: string, destinationProfile: string, move = renameSync): BrowserStorageRestore {
  if (resolve(sourceProfile).toLowerCase() === resolve(destinationProfile).toLowerCase()) throw new Error('The previous and current browser profiles must be different directories.')
  const source = join(sourceProfile, 'Local Storage')
  if (!existsSync(source)) return { restored: false }

  mkdirSync(destinationProfile, { recursive: true })
  const suffix = randomUUID()
  const staged = join(destinationProfile, `.legacy-local-storage-stage-${suffix}`)
  const destination = join(destinationProfile, 'Local Storage')
  const backup = join(destinationProfile, `Local Storage.oyama-before-restore-${suffix}`)
  let movedCurrent = false
  try {
    cpSync(source, staged, { recursive: true, filter: (path) => basename(path) !== 'LOCK' })
    if (existsSync(destination)) {
      move(destination, backup)
      movedCurrent = true
    }
    try {
      move(staged, destination)
    } catch (error) {
      if (movedCurrent) {
        try { move(backup, destination) }
        catch (rollbackError) {
          throw new Error(`Could not restore the original browser storage from ${backup}: ${String(rollbackError)}`, { cause: error })
        }
      }
      throw error
    }
    return { restored: true, backupPath: movedCurrent ? backup : undefined }
  } finally {
    if (existsSync(staged)) rmSync(staged, { recursive: true, force: true })
  }
}
