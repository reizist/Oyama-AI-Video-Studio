import { mkdir, open, rename, unlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'

const pending = new Map<string, Promise<void>>()

/** Serialize each destination, flush the staged file, then atomically replace.
 * Failed saves preserve the previous file and do not poison subsequent saves. */
export async function writeAtomicFile(path: string, content: string | Buffer): Promise<void> {
  const destination = resolve(path)
  const key = process.platform === 'win32' ? destination.toLowerCase() : destination
  const next = (pending.get(key) ?? Promise.resolve()).catch(() => undefined).then(async () => {
    await mkdir(dirname(destination), { recursive: true })
    const staged = `${destination}.${randomUUID()}.tmp`
    try {
      const handle = await open(staged, 'wx', 0o600)
      try { await handle.writeFile(content); await handle.sync() } finally { await handle.close() }
        for (let attempt = 0; ; attempt++) {
          try { await rename(staged, destination); break } catch (error) {
            const code = (error as NodeJS.ErrnoException).code
            if (process.platform !== 'win32' || !['EPERM', 'EBUSY', 'EACCES'].includes(code ?? '') || attempt >= 15) throw error
            // Windows readers and virus scanners can hold the destination for
            // longer than one scheduler tick. Keep the retry bounded, but give
            // the reader enough time to close before declaring the save failed.
            await delay(25 * (attempt + 1))
          }
        }
    } catch (error) {
      await unlink(staged).catch(() => undefined)
      throw error
    }
  })
  pending.set(key, next)
  try { await next } finally { if (pending.get(key) === next) pending.delete(key) }
}
