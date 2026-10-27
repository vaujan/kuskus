const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()
const {
  runVaultTransaction,
  recoverVaultTransactions
} = require('../src/main/library/storage/vault-transaction.ts')
const { LibraryService } = require('../src/main/library/library-service.ts')

const child = `
require(process.argv[1])()
const fs = require('node:fs/promises')
const { LibraryService } = require(process.argv[2])
const input = JSON.parse(process.argv[3])
;(async () => {
 const service = new LibraryService(input.settings)
 await service.initialize()
 await service.getState()
 const { VaultTransaction } = require(process.argv[4])
 VaultTransaction.prototype.rollback = async () => { throw new Error('Operation failed before the intended interruption') }
 const rename = fs.rename
 let count = 0
 fs.rename = async (from, to) => {
   await rename(from, to)
   const journal = String(to).includes('/transactions/') || String(to).includes('\\\\transactions\\\\')
   if (input.stage === 'journal' && journal) process.exit(86)
   if (!journal && ++count === input.stage) process.exit(86)
 }
 if (input.operation === 'items' || input.operation === 'image-move') await service.moveItems({itemIds: input.ids, destination: {type:'collection', collectionId:input.destination}})
 if (input.operation === 'folder') await service.moveCollection({collectionId:input.folder, parentId:input.destination})
 if (input.operation === 'rename' || input.operation === 'image-rename') await service.renameItem({itemId:input.ids[0],title:'Renamed'})
 if (input.operation === 'rename-folder') await service.renameCollection(input.folder, 'Renamed folder')
})().catch(e => { console.error(e); process.exit(1) })
`

for (const operation of ['items', 'folder', 'rename', 'rename-folder']) {
  for (const stage of ['journal', 1, 2]) {
    test(`recovers ${operation} after process termination at ${stage}`, async (context) => {
      const root = await fs.mkdtemp(join(tmpdir(), 'kuskus-transaction-'))
      context.after(() => fs.rm(root, { recursive: true, force: true }))
      const settings = join(root, 'settings.json')
      const service = new LibraryService(settings)
      const state = await service.createIn(root, 'Vault')
      const folder = await service.createCollection({ name: 'Source' })
      const destination = await service.createCollection({ name: 'Destination' })
      const note = await service.createNote({
        markdown: '# Original\n\n![pixel](Original.assets/pixel.png)',
        attachmentIds: []
      })
      const other = await service.createNote({
        markdown: '# Other\n\nKeep this too.',
        attachmentIds: []
      })
      await service.moveItems({
        itemIds: [note.id, other.id],
        destination: { type: 'collection', collectionId: folder.id }
      })
      const before = (await service.getState()).library
      const original = before.items.find((i) => i.id === note.id)
      const assets = original.relativePath.replace(/\.md$/, '.assets')
      await fs.mkdir(join(state.library.path, assets), { recursive: true })
      await fs.writeFile(join(state.library.path, assets, 'pixel.png'), 'original-image-bytes')
      const result = spawnSync(
        process.execPath,
        [
          '-e',
          child,
          require.resolve('./helpers/install-ts-require.cjs'),
          require.resolve('../src/main/library/library-service.ts'),
          JSON.stringify({
            settings,
            operation,
            stage,
            ids: [note.id, other.id],
            folder: folder.id,
            destination: destination.id
          }),
          require.resolve('../src/main/library/storage/vault-transaction.ts')
        ],
        { encoding: 'utf8', timeout: 30000 }
      )
      assert.equal(result.status, 86, result.stderr || String(result.error))
      const reopened = new LibraryService(settings)
      await reopened.initialize()
      const recovered = await reopened.reconcileState()
      assert.equal(recovered.status, 'ready')
      for (const previous of before.items) {
        const item = recovered.library.items.find((i) => i.id === previous.id)
        assert.ok(item, `missing ${previous.id}`)
        assert.equal(item.relativePath, previous.relativePath)
        assert.equal(item.body, previous.body)
        assert.equal(item.missingContent, false)
      }
      assert.equal(
        recovered.library.collections.find((c) => c.id === folder.id).relativePath,
        'Source'
      )
      assert.equal(
        await fs.readFile(join(state.library.path, assets, 'pixel.png'), 'utf8'),
        'original-image-bytes'
      )
      await recoverVaultTransactions(state.library.path)
      assert.deepEqual(await fs.readdir(join(state.library.path, '.kuskus', 'transactions')), [])
    })
  }
}

test('keeps a committed transaction and rolls back failed writes without overwriting a conflicting move', async (context) => {
  const root = await fs.mkdtemp(join(tmpdir(), 'kuskus-journal-'))
  context.after(() => fs.rm(root, { recursive: true, force: true }))
  const original = join(root, 'original.md')
  const moved = join(root, 'moved.md')
  await fs.writeFile(original, 'Original')
  await runVaultTransaction(root, async (tx) => {
    await tx.rename(original, moved)
    await tx.writeText(moved, 'Committed')
  })
  await recoverVaultTransactions(root)
  assert.equal(await fs.readFile(moved, 'utf8'), 'Committed')
  await assert.rejects(
    runVaultTransaction(root, async (tx) => {
      await tx.writeText(moved, 'Partial')
      throw new Error('Failure')
    }),
    /Failure/
  )
  await recoverVaultTransactions(root)
  assert.equal(await fs.readFile(moved, 'utf8'), 'Committed')
  await assert.rejects(
    runVaultTransaction(root, async (tx) => {
      await tx.rename(moved, original)
      await fs.writeFile(moved, 'External edit')
      throw new Error('Failure')
    }),
    /needs vault recovery/
  )
  await assert.rejects(recoverVaultTransactions(root), /conflicting/)
  assert.equal(await fs.readFile(moved, 'utf8'), 'External edit')
  assert.equal(await fs.readFile(original, 'utf8'), 'Committed')
})

test('rejects a recovery journal that escapes the vault', async (context) => {
  const root = await fs.mkdtemp(join(tmpdir(), 'kuskus-journal-path-'))
  context.after(() => fs.rm(root, { recursive: true, force: true }))
  const vault = join(root, 'vault')
  const journals = join(vault, '.kuskus', 'transactions')
  await fs.mkdir(journals, { recursive: true })
  const outside = join(root, 'outside.md')
  await fs.writeFile(outside, 'Keep me')
  await fs.writeFile(
    join(journals, 'abcd.json'),
    JSON.stringify({
      committed: false,
      undo: [{ kind: 'write', path: '../outside.md', content: null }]
    })
  )
  await assert.rejects(recoverVaultTransactions(vault), /outside/)
  assert.equal(await fs.readFile(outside, 'utf8'), 'Keep me')
})

for (const operation of ['image-move', 'image-rename']) {
  test(`restores image references after interruption during ${operation}`, async (context) => {
    const root = await fs.mkdtemp(join(tmpdir(), 'kuskus-image-transaction-'))
    context.after(() => fs.rm(root, { recursive: true, force: true }))
    const settings = join(root, 'settings.json')
    const service = new LibraryService(settings)
    const state = await service.createIn(root, 'Vault')
    const destination = await service.createCollection({ name: 'Destination' })
    const pixels = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL88wAAAABJRU5ErkJggg==',
      'base64'
    )
    const staged = await service.stageCaptureDraftImage({
      bytes: pixels.buffer.slice(pixels.byteOffset, pixels.byteOffset + pixels.byteLength),
      mediaType: 'image/png',
      sourceFilename: 'Sketch.png'
    })
    const note = await service.createNote({
      markdown: `# Reference\n\n![Sketch](${staged.relativePath})`,
      attachmentIds: [staged.id]
    })
    const before = (await service.getState()).library
    const image = before.items.find((i) => i.id === staged.id)
    // The second mutation replaces the referencing note during rename; move stages the image first.
    const stage = operation === 'image-move' ? 3 : 2
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        child,
        require.resolve('./helpers/install-ts-require.cjs'),
        require.resolve('../src/main/library/library-service.ts'),
        JSON.stringify({
          settings,
          operation,
          stage,
          ids: [image.id],
          destination: destination.id
        }),
        require.resolve('../src/main/library/storage/vault-transaction.ts')
      ],
      { encoding: 'utf8', timeout: 30000 }
    )
    assert.equal(result.status, 86, result.stderr || String(result.error))
    const reopened = new LibraryService(settings)
    await reopened.initialize()
    const recovered = (await reopened.reconcileState()).library
    assert.equal(recovered.items.find((i) => i.id === note.id).body, note.body)
    assert.equal(recovered.items.find((i) => i.id === image.id).relativePath, image.relativePath)
    assert.deepEqual(await fs.readFile(join(state.library.path, image.relativePath)), pixels)
  })
}

const journalChild = `
require(process.argv[1])()
const fs = require('node:fs/promises')
const { join } = require('node:path')
const { runVaultTransaction, recoverVaultTransactions } = require(process.argv[2])
const [root, mode] = process.argv.slice(3)
;(async () => {
 if (mode === 'recover') {
   const rename = fs.rename
   fs.rename = async (from, to) => { await rename(from,to); if (to === join(root,'original.md')) process.exit(86) }
   await recoverVaultTransactions(root)
 } else {
   if (mode === 'commit') {
     const rename = fs.rename
     fs.rename = async (from,to) => {
       await rename(from,to)
       if (String(to).endsWith('.json') && JSON.parse(await fs.readFile(to,'utf8')).committed) process.exit(86)
     }
   }
   await runVaultTransaction(root, async tx => {
     await tx.rename(join(root,'original.md'),join(root,'moved.md'))
     await tx.writeText(join(root,'moved.md'),'Updated')
     if (mode === 'start') process.exit(86)
   })
 }
})().catch(e => { console.error(e); process.exit(1) })
`

for (const committed of [false, true]) {
  test(
    committed
      ? 'preserves a committed operation after termination before journal cleanup'
      : 'resumes recovery after termination during rollback',
    async (context) => {
      const root = await fs.mkdtemp(join(tmpdir(), 'kuskus-journal-repeat-'))
      context.after(() => fs.rm(root, { recursive: true, force: true }))
      await fs.writeFile(join(root, 'original.md'), 'Original')
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      const run = (mode) =>
        spawnSync(
          process.execPath,
          [
            '-e',
            journalChild,
            require.resolve('./helpers/install-ts-require.cjs'),
            require.resolve('../src/main/library/storage/vault-transaction.ts'),
            root,
            mode
          ],
          { encoding: 'utf8', timeout: 30000 }
        )
      const interrupted = run(committed ? 'commit' : 'start')
      assert.equal(interrupted.status, 86, interrupted.stderr || String(interrupted.error))
      if (!committed) {
        const recovering = run('recover')
        assert.equal(recovering.status, 86, recovering.stderr || String(recovering.error))
      }
      await recoverVaultTransactions(root)
      await recoverVaultTransactions(root)
      assert.equal(
        await fs.readFile(join(root, committed ? 'moved.md' : 'original.md'), 'utf8'),
        committed ? 'Updated' : 'Original'
      )
      assert.deepEqual(await fs.readdir(join(root, '.kuskus', 'transactions')), [])
    }
  )
}

test('restores original content when a staged transaction write cannot replace its destination', async (context) => {
  const root = await fs.mkdtemp(join(tmpdir(), 'kuskus-journal-write-failure-'))
  context.after(() => fs.rm(root, { recursive: true, force: true }))
  const path = join(root, 'note.md')
  await fs.writeFile(path, 'Original')
  const rename = fs.rename
  let fail = true
  const mocked = context.mock.method(fs, 'rename', async (from, to) => {
    if (to === path && fail) {
      fail = false
      throw new Error('Simulated replacement failure')
    }
    return rename(from, to)
  })
  await assert.rejects(
    runVaultTransaction(root, (tx) => tx.writeText(path, 'Updated')),
    /Simulated replacement failure/
  )
  mocked.mock.restore()
  await recoverVaultTransactions(root)
  assert.equal(await fs.readFile(path, 'utf8'), 'Original')
})
