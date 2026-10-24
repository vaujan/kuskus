const assert = require('node:assert/strict')
const { mkdtemp, readFile, rm, unlink } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()
const { LibraryService } = require('../src/main/library/library-service.ts')

test('PDF preview returns exact imported bytes and resolves files by library identity', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-pdf-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const settings = join(root, 'settings.json')
  const service = new LibraryService(settings)
  const created = await service.createIn(root, 'Vault')
  const bytes = await readFile(join(__dirname, 'fixtures/pdf-reader.pdf'))
  const item = await service.importFile({
    sourceFilename: 'Reader.PDF',
    mediaType: 'application/octet-stream',
    bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  })
  assert.deepEqual(Buffer.from(await service.getPdfPreview(item.id)), bytes)
  const reopened = new LibraryService(settings)
  await reopened.initialize()
  assert.deepEqual(Buffer.from(await reopened.getPdfPreview(item.id)), bytes)
  await assert.rejects(() => service.getPdfPreview('../outside.pdf'), /identifier is invalid/i)
  await unlink(join(created.library.path, item.relativePath))
  await assert.rejects(() => service.getPdfPreview(item.id))
})

test('PDF preview rejects other library item types', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-pdf-type-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  await service.createIn(root, 'Vault')
  const note = await service.createNote({ markdown: '# A note', attachmentIds: [] })
  await assert.rejects(() => service.getPdfPreview(note.id), /not a PDF/)
  const file = await service.importFile({
    sourceFilename: 'example.txt',
    mediaType: 'text/plain',
    bytes: new TextEncoder().encode('hello').buffer
  })
  await assert.rejects(() => service.getPdfPreview(file.id), /not a PDF/)
})

test('recognizes PDFs by media type even when the stored filename has no extension', () => {
  const { isPdfFile } = require('../src/shared/file-type.ts')
  assert.equal(isPdfFile({ contentFilename: 'document', mediaType: 'application/pdf' }), true)
  assert.equal(
    isPdfFile({ contentFilename: 'document', mediaType: 'Application/PDF; version=1.7' }),
    true
  )
  assert.equal(
    isPdfFile({ contentFilename: 'document.PDF', mediaType: 'application/octet-stream' }),
    true
  )
  assert.equal(isPdfFile({ contentFilename: 'pdf-notes.txt', mediaType: 'text/plain' }), false)
})
