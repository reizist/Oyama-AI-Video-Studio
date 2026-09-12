import { lstat, realpath, unlink } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve } from 'node:path'

/** Remove only an exact generated media file inside the configured output. */
export async function trashOutput(source: string, outputDirectory: string, comfyUrl: string, trash: (path: string) => Promise<void>, mode: 'trash' | 'permanent' = 'trash'): Promise<'trashed' | 'deleted' | 'missing'> {
  if (mode !== 'trash' && mode !== 'permanent') throw new Error('Unsupported deletion mode.')
  let candidate = source
  if (source.startsWith('minimax-media:')) {
    const url = new URL(source)
    if (url.hostname === 'local' || url.hostname === 'selected') candidate = url.searchParams.get('path') ?? ''
    else if (url.hostname === 'comfy') {
      const target = new URL(url.searchParams.get('url') ?? '')
      if (target.origin !== new URL(comfyUrl).origin || target.pathname !== '/view' || (target.searchParams.get('type') ?? 'output') !== 'output') throw new Error('This file is outside the configured ComfyUI output.')
      const filename = target.searchParams.get('filename')
      if (!filename) throw new Error('The output filename is missing.')
      candidate = resolve(outputDirectory, target.searchParams.get('subfolder') ?? '', filename)
    } else throw new Error('Unsupported output address.')
  }
  const inside = (root: string, file: string) => {
    const path = relative(root, file)
    return path !== '' && path !== '..' && !path.startsWith('../') && !path.startsWith('..\\') && !isAbsolute(path)
  }
  if (!isAbsolute(candidate) || !inside(resolve(outputDirectory), resolve(candidate))) throw new Error('Only files inside the configured output folder can be deleted. You can still remove the history only.')
  if (!/\.(mp4|webm|mov|mkv|gif|png|jpe?g|webp|flac|wav|mp3|ogg|m4a|aac|opus)$/i.test(extname(candidate))) throw new Error('This is not a supported generated media file.')
  try {
    const details = await lstat(candidate)
    if (!details.isFile() || details.isSymbolicLink()) throw new Error('The output must be a regular media file.')
    if (!inside(await realpath(outputDirectory), await realpath(candidate))) throw new Error('The output resolves outside the configured output folder.')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'missing'
    throw error
  }
  candidate = resolve(candidate)
  if (mode === 'permanent') {
    try { await unlink(candidate) } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'missing'
      throw error
    }
    return 'deleted'
  }
  try { await trash(candidate) } catch (error) {
    throw new Error(`Could not move the output to Trash. WSL and network folders may not support the Windows Recycle Bin. Choose permanent deletion to remove the file without Trash, or keep the file and delete history only. ${error instanceof Error ? error.message : String(error)}`)
  }
  return 'trashed'
}
