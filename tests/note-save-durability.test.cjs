const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const filesystem = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const { replaceNoteContent } = require('../src/main/library/storage/note-file.ts')
const { LibraryService } = require('../src/main/library/library-service.ts')

const interruptedSave = `
require(process.argv[1])()
const filesystem = require('node:fs/promises')
const { replaceNoteContent } = require(process.argv[2])
const [destination, temporaryDirectory, markdown, stage] = process.argv.slice(3)
const writeFile = filesystem.writeFile
const rename = filesystem.rename
filesystem.writeFile = async (...args) => {
  if (stage === 'writing') {
    await writeFile(args[0], 'partial write', args[2])
    process.exit(86)
  }
  await writeFile(...args)
  if (stage === 'staged') process.exit(86)
}
filesystem.rename = async (...args) => {
  await rename(...args)
  if (stage === 'replaced') process.exit(86)
}
replaceNoteContent(destination, temporaryDirectory, markdown).catch((error) => {
  console.error(error)
  process.exit(1)
})
`

for (const stage of ['writing', 'staged', 'replaced']) {
  test(`reopens a complete note after the save process exits during ${stage}`, async (context) => {
    const root = await filesystem.mkdtemp(join(tmpdir(), 'kuskus-note-interruption-'))
    context.after(() => filesystem.rm(root, { recursive: true, force: true }))
    const settingsPath = join(root, 'settings.json')
    const service = new LibraryService(settingsPath)
    const state = await service.createIn(root, 'Vault')
    const note = await service.createNote({ markdown: '# Original\n\nKeep me.', attachmentIds: [] })
    const destination = await service.getItemContentPath(note.id)
    const markdown = '# Original\n\nSaved completely.'
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        interruptedSave,
        require.resolve('./helpers/install-ts-require.cjs'),
        require.resolve('../src/main/library/storage/note-file.ts'),
        destination,
        join(state.library.path, '.kuskus', 'temp'),
        markdown,
        stage
      ],
      { encoding: 'utf8', timeout: 30_000 }
    )
    assert.equal(result.status, 86, result.stderr || String(result.error))
    const expected = stage === 'replaced' ? markdown : note.body
    assert.equal(await filesystem.readFile(destination, 'utf8'), expected)

    const reopened = new LibraryService(settingsPath)
    await reopened.initialize()
    const reconciled = await reopened.reconcileState()
    assert.equal(reconciled.status, 'ready')
    assert.equal(reconciled.library.items.length, 1)
    assert.equal(reconciled.library.items[0].id, note.id)
    assert.equal(reconciled.library.items[0].body, expected)
    assert.equal(reconciled.library.items[0].missingContent, false)
  })
}

for (const operation of ['writeFile', 'rename']) {
  test(`preserves the original note and cleans staging after ${operation} fails`, async (context) => {
    const root = await filesystem.mkdtemp(join(tmpdir(), 'kuskus-note-io-failure-'))
    context.after(() => filesystem.rm(root, { recursive: true, force: true }))
    const destination = join(root, 'note.md')
    const temporaryDirectory = join(root, 'temp')
    await filesystem.mkdir(temporaryDirectory)
    await filesystem.writeFile(destination, 'Original')
    const writeFile = filesystem.writeFile
    const failure = Object.assign(new Error('Simulated storage failure'), {
      code: operation === 'writeFile' ? 'ENOSPC' : 'EACCES'
    })
    const mocked = context.mock.method(filesystem, operation, async (...args) => {
      if (operation === 'writeFile') await writeFile(args[0], 'partial write', args[2])
      throw failure
    })
    await assert.rejects(replaceNoteContent(destination, temporaryDirectory, 'Updated'), failure)
    mocked.mock.restore()
    assert.equal(await filesystem.readFile(destination, 'utf8'), 'Original')
    assert.deepEqual(await filesystem.readdir(temporaryDirectory), [])
  })
}

test('replaces a note and removes its staged file after a successful save', async (context) => {
  const root = await filesystem.mkdtemp(join(tmpdir(), 'kuskus-note-save-'))
  context.after(() => filesystem.rm(root, { recursive: true, force: true }))
  const destination = join(root, 'note.md')
  const temporaryDirectory = join(root, 'temp')
  await filesystem.mkdir(temporaryDirectory)
  await filesystem.writeFile(destination, 'Original')
  await replaceNoteContent(destination, temporaryDirectory, 'Updated')
  assert.equal(await filesystem.readFile(destination, 'utf8'), 'Updated')
  assert.deepEqual(await filesystem.readdir(temporaryDirectory), [])
})
