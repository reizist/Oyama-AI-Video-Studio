import { lstat, realpath } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve } from 'node:path'

/** Trash only an exact, local generated media file inside the configured output. */
export async function trashOutput(source: string, outputDirectory: string, comfyUrl: string, trash: (path: string) => Promise<void>): Promise<'trashed' | 'missing'> {
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
  if (!isAbsolute(candidate) || !inside(resolve(outputDirectory), resolve(candidate))) throw new Error('Only files inside the configured output folder can be moved to Trash. You can still remove the history only.')
  if (!/\.(mp4|webm|mov|mkv|gif|png|jpe?g|webp|flac|wav|mp3|ogg|m4a|aac|opus)$/i.test(extname(candidate))) throw new Error('This is not a supported generated media file.')
  try {
    const details = await lstat(candidate)
    if (!details.isFile() || details.isSymbolicLink()) throw new Error('The output must be a regular media file.')
    if (!inside(await realpath(outputDirectory), await realpath(candidate))) throw new Error('The output resolves outside the configured output folder.')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'missing'
    throw error
  }
  await trash(candidate)
  return 'trashed'
}
