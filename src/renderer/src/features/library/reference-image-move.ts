import type { LibraryItemDto } from '../../../../shared/library-contract'

export interface ReferenceImageChangeCounts {
  /** Referenced images whose relative path changed (moved with their note). */
  movedImages: number
  /** Referenced images that stayed put (retained in place while their note moved). */
  retainedImages: number
}

/**
 * Count how the sibling images referenced by the requested notes moved between a
 * before/after library snapshot. An image counts as moved when its relative path
 * changed, retained when it kept its path, and is skipped entirely when it was
 * itself part of the requested set (so the note's own image move is not double
 * counted as a dependency move).
 */
export function countReferencedImageChanges(
  requested: ReadonlySet<string>,
  before: readonly LibraryItemDto[],
  after: readonly LibraryItemDto[]
): ReferenceImageChangeCounts {
  const imageIdsBySourceNote = new Map<string, string[]>()
  for (const item of before) {
    if (item.type !== 'note') continue
    if (!requested.has(item.id)) continue
    imageIdsBySourceNote.set(
      item.id,
      item.attachments.map((attachment) => attachment.id)
    )
  }
  const referencedImageIds = new Set<string>()
  for (const imageIds of imageIdsBySourceNote.values()) {
    for (const imageId of imageIds) referencedImageIds.add(imageId)
  }

  let movedImages = 0
  let retainedImages = 0
  for (const imageId of referencedImageIds) {
    if (requested.has(imageId)) continue
    const beforePath = before.find((item) => item.id === imageId)?.relativePath
    const afterItem = after.find((item) => item.id === imageId)
    const afterPath = afterItem?.relativePath
    if (beforePath === afterPath) {
      if (afterItem) retainedImages += 1
    } else {
      movedImages += 1
    }
  }
  return { movedImages, retainedImages }
}
