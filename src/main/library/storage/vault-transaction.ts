import { randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { kuskusPath, resolveInsideVault } from './vault-paths'

type Undo =
  | { kind: 'rename'; from: string; to: string }
  | { kind: 'write'; path: string; content: string | null }
interface Journal {
  committed: boolean
  undo: Undo[]
}
const queues = new Map<string, Promise<unknown>>()

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function replaceText(libraryPath: string, path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const directory = kuskusPath(libraryPath, 'transactions')
  await mkdir(directory, { recursive: true })
  const temporary = kuskusPath(libraryPath, 'transactions', `${randomUUID()}.write`)
  try {
    await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx', flush: true })
    await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true })
  }
}

function serialize<T>(libraryPath: string, task: () => Promise<T>): Promise<T> {
  const key = resolve(libraryPath)
  const previous = queues.get(key) ?? Promise.resolve()
  const next = previous.then(task, task)
  queues.set(key, next)
  void next.then(
    () => {
      if (queues.get(key) === next) queues.delete(key)
    },
    () => {
      if (queues.get(key) === next) queues.delete(key)
    }
  )
  return next
}

export class VaultTransaction {
  private journal: Journal = { committed: false, undo: [] }
  constructor(
    private libraryPath: string,
    private journalPath: string
  ) {}

  private path(value: string): string {
    const path = relative(this.libraryPath, value)
    if (
      !path ||
      path.startsWith('.kuskus/transactions') ||
      path.startsWith('.kuskus\\transactions')
    )
      throw new Error('Invalid transaction target.')
    resolveInsideVault(this.libraryPath, path)
    return path
  }

  private async save(): Promise<void> {
    await replaceText(this.libraryPath, this.journalPath, JSON.stringify(this.journal))
  }

  async rename(from: string, to: string): Promise<void> {
    if (!(await exists(from))) throw new Error('The move source no longer exists.')
    if (await exists(to)) throw new Error('The move destination already exists.')
    this.journal.undo.push({ kind: 'rename', from: this.path(to), to: this.path(from) })
    await this.save()
    await rename(from, to)
  }

  async writeText(path: string, content: string): Promise<void> {
    const relativePath = this.path(path)
    const previous = (await exists(path)) ? await readFile(path, 'utf8') : null
    this.journal.undo.push({ kind: 'write', path: relativePath, content: previous })
    await this.save()
    await replaceText(this.libraryPath, path, content)
  }

  async writeJson(path: string, value: unknown): Promise<void> {
    await this.writeText(path, `${JSON.stringify(value, null, 2)}\n`)
  }

  async commit(): Promise<void> {
    this.journal.committed = true
    try {
      await this.save()
    } catch (error) {
      this.journal.committed = false
      throw error
    }
  }

  async rollback(): Promise<void> {
    if (this.journal.committed) return
    while (this.journal.undo.length) {
      const action = this.journal.undo[this.journal.undo.length - 1]
      if (action.kind === 'rename') {
        const from = resolveInsideVault(this.libraryPath, action.from)
        const to = resolveInsideVault(this.libraryPath, action.to)
        const sourceExists = await exists(from)
        const targetExists = await exists(to)
        if (sourceExists && !targetExists) {
          await mkdir(dirname(to), { recursive: true })
          await rename(from, to)
        } else if (sourceExists || !targetExists) {
          throw new Error(
            'Transaction recovery found conflicting or missing files. Back up the vault before repairing it.'
          )
        }
      } else {
        const path = resolveInsideVault(this.libraryPath, action.path)
        if (action.content === null) await rm(path, { force: true })
        else await replaceText(this.libraryPath, path, action.content)
      }
      this.journal.undo.pop()
      await this.save()
    }
  }

  async recover(): Promise<void> {
    const value: unknown = JSON.parse(await readFile(this.journalPath, 'utf8'))
    if (!value || typeof value !== 'object') throw new Error('Invalid vault transaction journal.')
    const journal = value as Journal
    if (typeof journal.committed !== 'boolean' || !Array.isArray(journal.undo))
      throw new Error('Invalid vault transaction journal.')
    for (const action of journal.undo) {
      if (
        action?.kind === 'rename' &&
        typeof action.from === 'string' &&
        typeof action.to === 'string'
      ) {
        this.path(resolveInsideVault(this.libraryPath, action.from))
        this.path(resolveInsideVault(this.libraryPath, action.to))
      } else if (
        action?.kind === 'write' &&
        typeof action.path === 'string' &&
        (typeof action.content === 'string' || action.content === null)
      ) {
        this.path(resolveInsideVault(this.libraryPath, action.path))
      } else throw new Error('Invalid vault transaction journal.')
    }
    this.journal = journal
    await this.rollback()
  }
}

async function recover(libraryPath: string): Promise<void> {
  const directory = kuskusPath(libraryPath, 'transactions')
  await mkdir(directory, { recursive: true })
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isFile() && /^[\da-f-]+\.write$/.test(entry.name)) {
      await rm(kuskusPath(libraryPath, 'transactions', entry.name))
      continue
    }
    if (!entry.isFile() || !/^[\da-f-]+\.json$/.test(entry.name)) continue
    const path = kuskusPath(libraryPath, 'transactions', entry.name)
    await new VaultTransaction(libraryPath, path).recover()
    await rm(path)
  }
}

export async function recoverVaultTransactions(libraryPath: string): Promise<void> {
  await serialize(libraryPath, () => recover(libraryPath))
}

export async function runVaultTransaction<T>(
  libraryPath: string,
  task: (transaction: VaultTransaction) => Promise<T>
): Promise<T> {
  return serialize(libraryPath, async () => {
    await recover(libraryPath)
    const path = kuskusPath(libraryPath, 'transactions', `${randomUUID()}.json`)
    const transaction = new VaultTransaction(libraryPath, path)
    try {
      const result = await task(transaction)
      await transaction.commit()
      // Commit is persisted before cleanup; a leftover committed journal is safe to reopen.
      await rm(path, { force: true }).catch(() => undefined)
      return result
    } catch (error) {
      try {
        await transaction.rollback()
        await rm(path, { force: true })
      } catch (recoveryError) {
        throw new AggregateError(
          [error, recoveryError],
          'The operation failed and needs vault recovery before continuing.'
        )
      }
      throw error
    }
  })
}
