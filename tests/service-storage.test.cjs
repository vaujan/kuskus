const assert = require('node:assert/strict')
const { existsSync } = require('node:fs')
const { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const { LibraryService } = require('../src/main/library/library-service.ts')
const { createNoteMetadata } = require('../src/main/library/items/note-item.ts')
const { isPersistedItem } = require('../src/main/library/schemas.ts')
const { LibraryStore } = require('../src/main/library/storage/library-store.ts')

test('leaves complex legacy bookmarks unchanged and reports a repair conflict', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-bookmark-conflict-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  const created = await service.createIn(root, 'Bookmark conflict vault')
  const link = await service.createUrl('https://example.com/complex')
  const shortcutPath = join(created.library.path, 'example.com.url')
  const markdownPath = join(created.library.path, 'example.com.md')
  await rm(shortcutPath)
  const legacy = `---\nkuskus-id: "${link.id}"\nkuskus-type: link\nurl: "${link.sourceUrl}"\ntags: [keep]\n---\nUser-authored annotation`
  await writeFile(markdownPath, legacy, 'utf8')
  const recordPath = join(created.library.path, '.kuskus', 'records', `${link.id}.json`)
  const record = JSON.parse(await readFile(recordPath, 'utf8'))
  record.relativePath = 'example.com.md'
  record.metadata.relativePath = 'example.com.md'
  await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
  await rm(join(created.library.path, '.kuskus', 'migrations', 'visible-metadata-cleanup.json'), {
    force: true
  })

  const state = await service.getState()
  assert.equal(state.status, 'ready')
  assert.equal(state.library.cleanup.status, 'conflicts')
  assert.equal(state.library.repairConflicts.length, 1)
  assert.equal(await readFile(markdownPath, 'utf8'), legacy)
  assert.equal(existsSync(shortcutPath), false)
})

test.skip('legacy v1: validates metadata and atomically finalizes an Inbox item', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-store-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))

  const store = new LibraryStore()
  await store.ensureLibraryDirectories(root)
  const id = '00000000-0000-4000-8000-000000000001'
  const metadata = createNoteMetadata(id, 'Atomic note', '2026-07-15T00:00:00.000Z')

  assert.equal(isPersistedItem(metadata, id), true)
  assert.equal(isPersistedItem({ ...metadata, id: '../escape' }, id), false)

  await store.finalizeInboxItem(root, metadata, [{ filename: 'note.md', data: 'Atomic note' }])
  assert.equal(await readFile(join(root, 'inbox', id, 'note.md'), 'utf8'), 'Atomic note')
  assert.equal(existsSync(join(root, 'inbox', id, 'item.json')), true)
  assert.equal(existsSync(join(root, '.kuskus', 'temp', `${id}.pending`)), false)
})

test.skip('legacy v1: recovers an interrupted note directory swap before reading library state', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-note-recovery-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  const created = await service.createIn(root, 'Recover Note Update')
  const note = await service.createNote({ markdown: 'Before interruption', attachmentIds: [] })
  const itemDirectory = join(created.library.path, 'inbox', note.id)
  const transactionDirectory = join(
    created.library.path,
    '.kuskus',
    'temp',
    `${note.id}.note-update`
  )
  const nextDirectory = join(transactionDirectory, 'next')
  const previousDirectory = join(transactionDirectory, 'previous')

  await mkdir(transactionDirectory, { recursive: false })
  await cp(itemDirectory, nextDirectory, { recursive: true })
  await writeFile(join(nextDirectory, 'note.md'), 'After interruption', 'utf8')
  const metadata = JSON.parse(await readFile(join(nextDirectory, 'item.json'), 'utf8'))
  metadata.title = 'After interruption'
  metadata.updatedAt = new Date(Date.now() + 1000).toISOString()
  await writeFile(
    join(nextDirectory, 'item.json'),
    `${JSON.stringify(metadata, null, 2)}\n`,
    'utf8'
  )
  await rename(itemDirectory, previousDirectory)

  const state = await service.getState()
  assert.equal(state.status, 'ready')
  assert.equal(state.library.items[0].body, 'After interruption')
  assert.equal(state.library.items[0].title, 'After interruption')
  assert.equal(existsSync(transactionDirectory), false)
})

test.skip('legacy v1: recovers interrupted item move batches by phase before scanning the library', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-item-move-recovery-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  const created = await service.createIn(root, 'Move Recovery Library')
  const libraryPath = created.library.path
  const note = await service.createNote({ markdown: 'Recover my location', attachmentIds: [] })
  const source = join(libraryPath, 'inbox', note.id)
  const originalMetadata = JSON.parse(await readFile(join(source, 'item.json'), 'utf8'))

  const rollbackTransaction = join(libraryPath, '.kuskus', 'temp', 'rollback.item-move')
  const rollbackStaged = join(rollbackTransaction, 'items', note.id)
  await mkdir(join(rollbackTransaction, 'items'), { recursive: true })
  await rename(source, rollbackStaged)
  await writeFile(
    join(rollbackTransaction, 'manifest.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      phase: 'staging',
      entries: [
        {
          itemId: note.id,
          source: { type: 'inbox' },
          destination: { type: 'archive', originalCollectionId: null },
          originalMetadata,
          nextMetadata: originalMetadata
        }
      ]
    })}\n`
  )
  let state = await service.getState()
  assert.equal(state.status, 'ready')
  assert.deepEqual(state.library.items.find((item) => item.id === note.id).location, {
    type: 'inbox'
  })
  assert.equal(existsSync(rollbackTransaction), false)

  const commitTransaction = join(libraryPath, '.kuskus', 'temp', 'commit.item-move')
  const commitStaged = join(commitTransaction, 'items', note.id)
  await mkdir(join(commitTransaction, 'items'), { recursive: true })
  await rename(source, commitStaged)
  await writeFile(
    join(commitTransaction, 'manifest.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      phase: 'committing',
      entries: [
        {
          itemId: note.id,
          source: { type: 'inbox' },
          destination: { type: 'archive', originalCollectionId: null },
          originalMetadata,
          nextMetadata: originalMetadata
        }
      ]
    })}\n`
  )
  state = await service.getState()
  assert.equal(state.status, 'ready')
  assert.equal(state.library.items.find((item) => item.id === note.id).location.type, 'archive')
  assert.equal(existsSync(commitTransaction), false)
})

test.skip('legacy v1: rolls back every item when a live batch move fails during commit', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-item-move-rollback-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  const created = await service.createIn(root, 'Move Rollback Library')
  const first = await service.createNote({ markdown: 'First batch item', attachmentIds: [] })
  const second = await service.createNote({ markdown: 'Second batch item', attachmentIds: [] })

  class FailingCommitStore extends LibraryStore {
    constructor() {
      super()
      this.archiveMoves = 0
    }

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    async moveDirectory(source, destination) {
      if (destination.includes(`${join('archive', '')}`)) {
        this.archiveMoves += 1
        if (this.archiveMoves === 2) throw new Error('Injected destination failure')
      }
      return super.moveDirectory(source, destination)
    }
  }

  const store = new FailingCommitStore()
  const resolved = await Promise.all(
    [first.id, second.id].map((itemId) => store.resolveItem(created.library.path, itemId))
  )
  await assert.rejects(
    store.moveItems(
      created.library.path,
      resolved.map((item) => ({
        item,
        destination: { type: 'archive', originalCollectionId: null },
        metadata: { ...item.metadata, originalCollectionId: null }
      }))
    ),
    /Injected destination failure/
  )

  for (const item of resolved) {
    assert.equal(existsSync(join(created.library.path, 'inbox', item.metadata.id)), true)
    assert.equal(existsSync(join(created.library.path, 'archive', item.metadata.id)), false)
  }
})
