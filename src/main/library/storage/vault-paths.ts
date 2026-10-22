import { lstatSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

const KUSKUS_DIRECTORY = '.kuskus'

export function kuskusPath(libraryPath: string, ...parts: string[]): string {
  return resolveInsideVault(libraryPath, join(KUSKUS_DIRECTORY, ...parts))
}

export function resolveInsideVault(libraryPath: string, relativePath: string): string {
  const root = resolve(libraryPath)
  const candidate = resolve(root, relativePath)
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
    throw new Error('A library path points outside the selected vault.')
  }
  // Scanning ignores links; storage must also reject links introduced after
  // indexing, including dangling links and Windows directory junctions.
  let current = root
  for (const part of relative(root, candidate).split(sep).filter(Boolean)) {
    current = join(current, part)
    try {
      if (lstatSync(current).isSymbolicLink()) {
        throw new Error('A library path contains a symbolic link or junction.')
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') break
      throw error
    }
  }
  return candidate
}
