import { dirname, join, relative, resolve, sep } from 'node:path'

import { encodeMarkdownPath } from '../../shared/markdown-image-references'

export type AttachmentPlacementPolicy = { kind: 'same-folder' }

export const DEFAULT_ATTACHMENT_PLACEMENT: AttachmentPlacementPolicy = { kind: 'same-folder' }

function slash(path: string): string {
  return path.replace(/\\/g, '/')
}

export interface ResolvedAttachmentPlacement {
  directory: string
  candidatePath: string
}

export function resolveAttachmentPlacement(input: {
  libraryPath: string
  notePath: string
  filename: string
  policy?: AttachmentPlacementPolicy
}): ResolvedAttachmentPlacement {
  const policy = input.policy ?? DEFAULT_ATTACHMENT_PLACEMENT
  if (policy.kind !== 'same-folder') throw new Error('The attachment placement policy is invalid.')
  const libraryRoot = resolve(input.libraryPath)
  const directory = resolve(dirname(input.notePath))
  if (directory !== libraryRoot && !directory.startsWith(`${libraryRoot}${sep}`)) {
    throw new Error('The attachment destination is outside the library.')
  }
  return { directory, candidatePath: join(directory, input.filename) }
}

export function markdownPathForAttachment(notePath: string, attachmentPath: string): string {
  const relativePath = slash(relative(dirname(notePath), attachmentPath))
  const portable = relativePath.startsWith('.') ? relativePath : `./${relativePath}`
  return encodeMarkdownPath(portable)
}
