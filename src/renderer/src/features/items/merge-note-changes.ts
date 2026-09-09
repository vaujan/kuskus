import { diff3Merge } from 'node-diff3'

export interface NoteMergeResult {
  markdown: string
  overlappingChanges: boolean
}

function mergeConflictingRegion(
  baseLines: string[],
  draftLines: string[],
  diskLines: string[]
): NoteMergeResult {
  const regions = diff3Merge(
    Array.from(draftLines.join('\n')),
    Array.from(baseLines.join('\n')),
    Array.from(diskLines.join('\n')),
    { excludeFalseConflicts: true }
  )
  const characters: string[] = []
  let overlappingChanges = false

  for (const region of regions) {
    if (region.ok) {
      characters.push(...region.ok)
      continue
    }
    if (!region.conflict) continue
    overlappingChanges = true
    characters.push(...region.conflict.a)
  }

  return { markdown: characters.join(''), overlappingChanges }
}

/**
 * Reconciles edits made from Kuskus and another filesystem writer against the
 * last version both writers shared. Non-overlapping edits from both versions
 * are retained. When the same lines changed, the active Kuskus draft wins.
 */
export function mergeNoteChanges(
  baseMarkdown: string,
  draftMarkdown: string,
  diskMarkdown: string
): NoteMergeResult {
  const regions = diff3Merge(
    draftMarkdown.split('\n'),
    baseMarkdown.split('\n'),
    diskMarkdown.split('\n'),
    { excludeFalseConflicts: true }
  )
  const lines: string[] = []
  let overlappingChanges = false

  for (const region of regions) {
    if (region.ok) {
      lines.push(...region.ok)
      continue
    }
    if (!region.conflict) continue
    const nested = mergeConflictingRegion(region.conflict.o, region.conflict.a, region.conflict.b)
    overlappingChanges ||= nested.overlappingChanges
    lines.push(...nested.markdown.split('\n'))
  }

  return { markdown: lines.join('\n'), overlappingChanges }
}
