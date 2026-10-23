import { randomUUID } from 'node:crypto'
import { rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function replaceNoteContent(
  destination: string,
  temporaryDirectory: string,
  markdown: string
): Promise<void> {
  const temporary = join(temporaryDirectory, `${randomUUID()}.note-update`)
  try {
    await writeFile(temporary, markdown, { encoding: 'utf8', flag: 'wx', flush: true })
    await rename(temporary, destination)
  } finally {
    await rm(temporary, { force: true })
  }
}
