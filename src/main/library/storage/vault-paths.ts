import { join, resolve, sep } from 'node:path'

const KUSKUS_DIRECTORY = '.kuskus'

export function kuskusPath(libraryPath: string, ...parts: string[]): string {
  return join(libraryPath, KUSKUS_DIRECTORY, ...parts)
}

export function resolveInsideVault(libraryPath: string, relativePath: string): string {
  const root = resolve(libraryPath)
  const candidate = resolve(root, relativePath)
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
    throw new Error('A library path points outside the selected vault.')
  }
  return candidate
}
