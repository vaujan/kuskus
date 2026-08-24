const assert = require('node:assert/strict')
const { existsSync } = require('node:fs')
const { mkdtemp, readFile, rm } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const { LibraryService } = require('../src/main/library/library-service.ts')

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL88wAAAABJRU5ErkJggg==',
  'base64'
)

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function arrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

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
  assert.equal(link.metadataVersion, 2)
  assert.equal(link.hasPreviewImage, false)
  assert.equal(
    await service.getItemRevealPath(link.id),
    join(root, 'Link Library', 'example.com.url')
  )
  assert.equal(
    await readFile(join(root, 'Link Library', 'example.com.url'), 'utf8'),
    '[InternetShortcut]\r\nURL=https://example.com/path?value=1\r\n'
  )

  const reopened = new LibraryService(join(root, 'settings.json'))
  await reopened.initialize()
  const state = await reopened.getState()
  assert.equal(state.status, 'ready')
  assert.equal(state.library.items[0].type, 'url')
  assert.equal(state.library.items[0].sourceUrl, link.sourceUrl)
})

test('enriches, caches, reopens, and serves URL previews without renderer hotlinks', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-url-preview-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const settingsPath = join(root, 'settings.json')
  const requests = []
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const lookup = async () => [{ address: '93.184.216.34', family: 4 }]
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const fetchPreview = async (input) => {
    const url = String(input)
    requests.push(url)
    if (url.endsWith('/preview.png')) {
      return new Response(onePixelPng, { headers: { 'content-type': 'image/png' } })
    }
    return new Response(
      '<head><meta property="og:title" content="Cached page"><meta property="og:image" content="/preview.png"><meta property="og:site_name" content="Example"></head>',
      { headers: { 'content-type': 'text/html' } }
    )
  }
  const service = new LibraryService(settingsPath, { fetch: fetchPreview, lookup })
  await service.createIn(root, 'Preview Library')
  const created = await service.createUrl('https://example.com/article')
  const enriched = await service.enrichUrl(created.id)
  assert.equal(enriched.title, 'Cached page')
  assert.equal(enriched.siteName, 'Example')
  assert.equal(enriched.hasPreviewImage, true)
  assert.equal(Object.hasOwn(enriched, 'previewImageUrl'), false)
  const first = await service.getUrlPreview(created.id, 'preview')
  assert.deepEqual(Buffer.from(first.bytes), onePixelPng)
  assert.equal(requests.filter((url) => url.endsWith('/preview.png')).length, 1)
  const second = await service.getUrlPreview(created.id, 'preview')
  assert.deepEqual(Buffer.from(second.bytes), onePixelPng)
  assert.equal(requests.filter((url) => url.endsWith('/preview.png')).length, 1)

  const reopened = new LibraryService(settingsPath, {
    fetch: async () => {
      throw new Error('offline')
    },
    lookup
  })
  await reopened.initialize()
  const cached = await reopened.getUrlPreview(created.id, 'preview')
  assert.deepEqual(Buffer.from(cached.bytes), onePixelPng)
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

test('uses readable text after a captured image for the new note filename', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-image-first-note-title-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  await service.createIn(root, 'Image first title')
  const staged = await service.stageCaptureDraftImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'dialog-problem.png'
  })
  const note = await service.createNote({
    markdown: `**![](${staged.relativePath})**\n\nDialog content is too cramped`,
    attachmentIds: [staged.id]
  })

  assert.equal(note.title, 'Dialog content is too cramped')
  assert.equal(note.relativePath, 'Dialog content is too cramped.md')
  assert.equal(existsSync(join(root, 'Image first title', note.relativePath)), true)
})
