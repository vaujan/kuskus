const assert = require('node:assert/strict')
const { existsSync, readFileSync } = require('node:fs')
const { mkdtemp, readFile, rm, unlink } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const test = require('node:test')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true
    },
    fileName: filename
  })
  module._compile(output.outputText, filename)
}

const { LibraryService } = require('../src/main/library/library-service.ts')
const {
  deriveImageTitle,
  detectImage,
  safeSourceFilename
} = require('../src/main/library/items/image-item.ts')
const { createNoteMetadata, deriveNoteTitle } = require('../src/main/library/items/note-item.ts')
const { createUrlMetadata, validateWebUrl } = require('../src/main/library/items/url-item.ts')
const { isPersistedItem } = require('../src/main/library/schemas.ts')
const { LibraryStore } = require('../src/main/library/storage/library-store.ts')

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL88wAAAABJRU5ErkJggg==',
  'base64'
)
const lossyWebpHeader = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x16, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
  0x0a, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x9d, 0x01, 0x2a, 0x40, 0x01, 0xf0, 0x00
])

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function arrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

test('creates, persists, reopens, and reveals a Markdown note path', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-library-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))

  const settingsPath = join(root, 'settings', 'kuskus-settings.json')
  const service = new LibraryService(settingsPath)
  const createdState = await service.createIn(root, 'Research Library')

  assert.equal(createdState.status, 'ready')
  assert.equal(createdState.library.name, 'Research Library')
  assert.equal(createdState.library.items.length, 0)

  const note = await service.createNote('# First reference\n\nA useful local note.')
  assert.equal(note.title, 'First reference')
  assert.equal(note.body, '# First reference\n\nA useful local note.')

  const notePath = await service.getItemContentPath(note.id)
  assert.equal(await readFile(notePath, 'utf8'), note.body)
  assert.equal(existsSync(join(root, 'Research Library', 'inbox', note.id, 'item.json')), true)

  const reopenedService = new LibraryService(settingsPath)
  await reopenedService.initialize()
  const reopenedState = await reopenedService.getState()

  assert.equal(reopenedState.status, 'ready')
  assert.equal(reopenedState.library.items.length, 1)
  assert.equal(reopenedState.library.items[0].body, note.body)
})

test('rejects unsafe library names and arbitrary item identifiers', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-safety-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))

  const service = new LibraryService(join(root, 'settings.json'))
  await assert.rejects(() => service.createIn(root, '../escape'), /cannot use|different/i)

  await service.createIn(root, 'Safe Library')
  await assert.rejects(() => service.getItemContentPath('..\\outside'), /identifier is invalid/i)
})

test('retains metadata when a note file is missing', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-missing-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))

  const service = new LibraryService(join(root, 'settings.json'))
  const createdState = await service.createIn(root, 'Missing Content Library')
  assert.equal(createdState.status, 'ready')

  const note = await service.createNote('Keep my metadata')
  const notePath = await service.getItemContentPath(note.id)
  await unlink(notePath)

  const state = await service.getState()
  assert.equal(state.status, 'ready')
  assert.equal(state.library.items.length, 1)
  assert.equal(state.library.items[0].missingContent, true)
})

test('imports, persists, previews, and detects a missing clipboard image', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-image-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const settingsPath = join(root, 'settings.json')
  const service = new LibraryService(settingsPath)
  await service.createIn(root, 'Image Library')

  const image = await service.importImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'Screenshot.png'
  })
  assert.equal(image.type, 'image')
  assert.equal(image.width, 1)
  assert.equal(image.height, 1)
  assert.equal(image.sourceFilename, 'Screenshot.png')
  const imagePath = await service.getItemContentPath(image.id)
  assert.deepEqual(await readFile(imagePath), onePixelPng)
  const preview = await service.getImagePreview(image.id)
  assert.equal(preview.mediaType, 'image/png')
  assert.deepEqual(Buffer.from(preview.bytes), onePixelPng)

  const reopened = new LibraryService(settingsPath)
  await reopened.initialize()
  const state = await reopened.getState()
  assert.equal(state.status, 'ready')
  assert.equal(state.library.items[0].type, 'image')

  await unlink(imagePath)
  const missing = await reopened.getState()
  assert.equal(missing.status, 'ready')
  assert.equal(missing.library.items[0].missingContent, true)
})

test('creates a durable URL item before metadata enrichment', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-url-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  await service.createIn(root, 'Link Library')

  const link = await service.createUrl('https://example.com/path?value=1')
  assert.equal(link.type, 'url')
  assert.equal(link.sourceUrl, 'https://example.com/path?value=1')
  assert.equal(link.domain, 'example.com')
  assert.equal(link.metadataStatus, 'pending')

  const reopened = new LibraryService(join(root, 'settings.json'))
  await reopened.initialize()
  const state = await reopened.getState()
  assert.equal(state.status, 'ready')
  assert.equal(state.library.items[0].type, 'url')
  assert.equal(state.library.items[0].sourceUrl, link.sourceUrl)
})

test('rejects non-web URLs and validates URL metadata shape', () => {
  assert.throws(() => validateWebUrl('file:///C:/secret.txt'), /http or https/i)
  assert.throws(() => validateWebUrl('not a url'))
  const metadata = createUrlMetadata(
    '00000000-0000-4000-8000-000000000001',
    'https://example.com',
    '2026-07-15T00:00:00.000Z'
  )
  assert.equal(isPersistedItem(metadata, metadata.id), true)
})

test('rejects invalid image content and unsafe preview identifiers', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-invalid-image-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  await service.createIn(root, 'Safe Images')
  await assert.rejects(
    () =>
      service.importImage({
        bytes: arrayBuffer(Buffer.from('not an image')),
        mediaType: 'image/png',
        sourceFilename: 'bad.png'
      }),
    /supports PNG/i
  )
  await assert.rejects(() => service.getImagePreview('..\\outside'), /identifier is invalid/i)
})

test('derives stable note and image display metadata', () => {
  assert.equal(deriveNoteTitle('# First reference\n\nBody'), 'First reference')
  assert.equal(deriveNoteTitle('***'), 'Untitled note')
  assert.equal(safeSourceFilename('folder\\screen:one.png'), 'folder_screen_one.png')
  assert.equal(deriveImageTitle('Screenshot.png'), 'Screenshot')
  assert.equal(detectImage(onePixelPng).mediaType, 'image/png')
  assert.deepEqual(
    { width: detectImage(onePixelPng).width, height: detectImage(onePixelPng).height },
    { width: 1, height: 1 }
  )
  assert.deepEqual(detectImage(lossyWebpHeader), {
    mediaType: 'image/webp',
    width: 320,
    height: 240
  })
})

test('validates metadata and atomically finalizes an Inbox item', async (context) => {
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
