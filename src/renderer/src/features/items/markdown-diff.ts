export interface MarkdownDiffRow {
  kind: 'same' | 'changed' | 'local' | 'disk'
  localLine: number | null
  localText: string
  diskLine: number | null
  diskText: string
}

const LOOKAHEAD = 20

function findAhead(lines: string[], value: string, start: number): number {
  const end = Math.min(lines.length, start + LOOKAHEAD)
  for (let index = start; index < end; index += 1) {
    if (lines[index] === value) return index
  }
  return -1
}

export function createMarkdownDiffRows(local: string, disk: string): MarkdownDiffRow[] {
  const localLines = local.split('\n')
  const diskLines = disk.split('\n')
  const rows: MarkdownDiffRow[] = []
  let localIndex = 0
  let diskIndex = 0

  while (localIndex < localLines.length || diskIndex < diskLines.length) {
    const localText = localLines[localIndex]
    const diskText = diskLines[diskIndex]
    if (localText !== undefined && localText === diskText) {
      rows.push({
        kind: 'same',
        localLine: localIndex + 1,
        localText,
        diskLine: diskIndex + 1,
        diskText
      })
      localIndex += 1
      diskIndex += 1
      continue
    }

    if (localText === undefined) {
      rows.push({
        kind: 'disk',
        localLine: null,
        localText: '',
        diskLine: diskIndex + 1,
        diskText
      })
      diskIndex += 1
      continue
    }
    if (diskText === undefined) {
      rows.push({
        kind: 'local',
        localLine: localIndex + 1,
        localText,
        diskLine: null,
        diskText: ''
      })
      localIndex += 1
      continue
    }

    const nextLocalMatch = findAhead(localLines, diskText, localIndex + 1)
    const nextDiskMatch = findAhead(diskLines, localText, diskIndex + 1)
    if (
      nextLocalMatch !== -1 &&
      (nextDiskMatch === -1 || nextLocalMatch - localIndex <= nextDiskMatch - diskIndex)
    ) {
      rows.push({
        kind: 'local',
        localLine: localIndex + 1,
        localText,
        diskLine: null,
        diskText: ''
      })
      localIndex += 1
      continue
    }
    if (nextDiskMatch !== -1) {
      rows.push({
        kind: 'disk',
        localLine: null,
        localText: '',
        diskLine: diskIndex + 1,
        diskText
      })
      diskIndex += 1
      continue
    }

    rows.push({
      kind: 'changed',
      localLine: localIndex + 1,
      localText,
      diskLine: diskIndex + 1,
      diskText
    })
    localIndex += 1
    diskIndex += 1
  }

  return rows
}
