import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const writeQueues = new Map<string, Promise<void>>()

function enqueueWrite(path: string, task: () => Promise<void>): Promise<void> {
  const previous = writeQueues.get(path) ?? Promise.resolve()
  const next = previous.then(task, task)
  writeQueues.set(path, next)
  void next.then(() => {
    if (writeQueues.get(path) === next) writeQueues.delete(path)
  })
  return next
}

export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  return enqueueWrite(path, async () => {
    const temporaryPath = `${path}.${randomUUID()}.tmp`
    try {
      await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
      await rename(temporaryPath, path)
    } catch (error) {
      await rm(temporaryPath, { force: true })
      throw error
    }
  })
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}
