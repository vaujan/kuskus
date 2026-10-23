const assert = require('node:assert/strict')
const { mkdtemp, mkdir, writeFile, readFile, rm, access } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()
const { LibraryService } = require('../src/main/library/library-service.ts')

test('rejects obsolete library metadata without initializing or modifying it', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-obsolete-format-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const vault = join(root, 'Old vault')
  await mkdir(vault)
  const source = JSON.stringify({
    schemaVersion: 1,
    id: 'old-library',
    name: 'Old vault',
    createdAt: '2026-01-01T00:00:00Z'
  })
  await writeFile(join(vault, 'library.json'), source)
  const service = new LibraryService(join(root, 'settings.json'))
  await assert.rejects(service.openAt(vault), /unsupported/)
  assert.equal(await readFile(join(vault, 'library.json'), 'utf8'), source)
  await assert.rejects(access(join(vault, '.kuskus')))
})

test('opening current notes preserves user properties, including obsolete Kuskus keys', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-no-conversion-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  const state = await service.createIn(root, 'Vault')
  const note = await service.createNote({ markdown: '# Note', attachmentIds: [] })
  const path = join(state.library.path, note.relativePath)
  const source = '---\nkuskus-id: old-value\ntags: [keep]\n---\n# Note\n'
  await writeFile(path, source)
  await service.reconcileState()
  assert.equal(await readFile(path, 'utf8'), source)
  await assert.rejects(access(join(state.library.path, '.kuskus', 'migrations')))
})

test('an unrelated root library.json does not prevent ordinary folder initialization', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-library-json-file-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const vault = join(root, 'Notes')
  await mkdir(vault)
  const source = '{"books":["a reference"]}'
  await writeFile(join(vault, 'library.json'), source)
  const service = new LibraryService(join(root, 'settings.json'))
  assert.equal((await service.openAt(vault)).status, 'needs-initialization')
  assert.equal((await service.initializePendingVault()).status, 'ready')
  assert.equal((await service.openAt(vault)).status, 'ready')
  assert.equal(await readFile(join(vault, 'library.json'), 'utf8'), source)
})

test('current vault metadata takes precedence over any root library.json', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-current-vault-metadata-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  const state = await service.createIn(root, 'Vault')
  await writeFile(
    join(state.library.path, 'library.json'),
    JSON.stringify({ schemaVersion: 1, id: 'old', name: 'Old', createdAt: '2026-01-01' })
  )
  assert.equal((await service.openAt(state.library.path)).status, 'ready')
})
