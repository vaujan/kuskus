const assert = require('node:assert/strict')
const { existsSync } = require('node:fs')
const { mkdir, mkdtemp, readFile, rm, unlink, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join, dirname } = require('node:path')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const { LibraryService } = require('../src/main/library/library-service.ts')
const { normalizeStagedAttachmentMarkdown } = require('../src/shared/markdown-image-references.ts')

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL88wAAAABJRU5ErkJggg==',
  'base64'
)

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function arrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

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

test('stages a recoverable image without creating an item and commits it explicitly', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-capture-draft-image-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const settingsPath = join(root, 'settings.json')
  const service = new LibraryService(settingsPath)
  await service.createIn(root, 'Explicit Image Capture')

  await assert.rejects(
    () =>
      service.stageCaptureDraftImage({
        bytes: arrayBuffer(onePixelPng),
        mediaType: 'image/png',
        sourceFilename: 'Invalid.png',
        origin: 'invalid'
      }),
    /image source is invalid/i
  )
  assert.deepEqual(await service.listCaptureDraftImages(), [])

  const staged = await service.stageCaptureDraftImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'Clipboard.png'
  })
  const beforeCommit = await service.getState()
  assert.equal(beforeCommit.status, 'ready')
  assert.equal(beforeCommit.library.items.length, 0)

  const reopened = new LibraryService(settingsPath)
  await reopened.initialize()
  assert.equal((await reopened.listCaptureDraftImages()).length, 1)
  const image = await reopened.commitCaptureDraftImage(staged.id)
  assert.equal(image.type, 'image')
  assert.equal(image.sourceFilename, 'Clipboard.png')
  assert.deepEqual(await readFile(await reopened.getItemContentPath(image.id)), onePixelPng)
  assert.equal((await reopened.listCaptureDraftImages()).length, 0)
})

test('rejects invalid or missing capture draft images without discarding recovery data', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-capture-draft-failure-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  const created = await service.createIn(root, 'Failed Image Capture')
  const staged = await service.stageCaptureDraftImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'Missing.png'
  })

  await assert.rejects(
    () => service.commitCaptureDraftImage('..\\outside'),
    /identifier is invalid/i
  )
  await unlink(join(created.library.path, '.kuskus', 'temp', 'note-draft', staged.filename))
  await assert.rejects(() => service.commitCaptureDraftImage(staged.id))
  const recovered = await service.listCaptureDraftImages()
  assert.equal(recovered.length, 1)
  assert.equal(recovered[0].missingContent, true)
})

test('stages a general file across restart and commits it without touching the source', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-capture-draft-file-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const settingsPath = join(root, 'settings.json')
  const service = new LibraryService(settingsPath)
  await service.createIn(root, 'Explicit File Capture')
  const source = Buffer.from('portable file content')
  const staged = await service.stageCaptureDraftFile({
    bytes: arrayBuffer(source),
    mediaType: 'text/plain',
    sourceFilename: 'Reference.txt'
  })
  assert.equal(staged.filename, 'Reference.txt')
  assert.equal((await service.getState()).library.items.length, 0)

  const reopened = new LibraryService(settingsPath)
  await reopened.initialize()
  assert.equal((await reopened.getCaptureDraftFile()).id, staged.id)
  const item = await reopened.commitCaptureDraftFile(staged.id)
  assert.equal(item.type, 'file')
  assert.deepEqual(await readFile(await reopened.getItemContentPath(item.id)), source)
  assert.equal(await reopened.getCaptureDraftFile(), null)
  assert.deepEqual(source, Buffer.from('portable file content'))
})

test('recovers staged images and atomically commits independent sibling attachments', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-note-assets-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const settingsPath = join(root, 'settings.json')
  const service = new LibraryService(settingsPath)
  const created = await service.createIn(root, 'Attached Notes')
  assert.equal(created.status, 'ready')

  const first = await service.stageCaptureDraftImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'Sketch.png'
  })
  const second = await service.stageCaptureDraftImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'Sketch.png'
  })
  assert.equal(first.filename, 'Sketch.png')
  assert.equal(second.filename, 'Sketch-2.png')
  assert.equal(first.relativePath, './Sketch.png')
  await assert.rejects(
    () => service.commitCaptureDraftImage(first.id),
    /standalone image draft is no longer valid/i
  )

  const reopened = new LibraryService(settingsPath)
  await reopened.initialize()
  const recovered = await reopened.listCaptureDraftImages()
  assert.deepEqual(
    recovered.map((attachment) => attachment.id),
    [first.id, second.id]
  )
  const stagedPreview = await reopened.getCaptureDraftImagePreview(first.id)
  assert.deepEqual(Buffer.from(stagedPreview.bytes), onePixelPng)

  const markdown = [
    '# Visual note',
    '',
    `![Sketch](${first.relativePath})`,
    '',
    `![Second sketch](${second.relativePath})`
  ].join('\n')
  const note = await reopened.createNote({
    markdown,
    attachmentIds: recovered.map((attachment) => attachment.id)
  })
  assert.equal(note.attachments.length, 2)
  assert.equal(
    note.attachments.every((attachment) => !attachment.missingContent),
    true
  )
  assert.equal((await reopened.listCaptureDraftImages()).length, 0)

  const notePath = await reopened.getItemContentPath(note.id)
  const savedMarkdown = await readFile(notePath, 'utf8')
  assert.match(savedMarkdown, /# Visual note/)
  assert.match(savedMarkdown, /\.\/Sketch\.png/)
  assert.match(savedMarkdown, /\.\/Sketch-2\.png/)
  assert.deepEqual(await readFile(join(dirname(notePath), first.filename)), onePixelPng)
  const secondAttachment = note.attachments.find(
    (attachment) => attachment.filename === second.filename
  )
  const savedPreview = await reopened.getNoteAttachmentPreview(note.id, secondAttachment.id)
  assert.deepEqual(Buffer.from(savedPreview.bytes), onePixelPng)

  const attachmentItem = (await reopened.getState()).library.items.find(
    (item) => item.id === first.id
  )
  assert.equal(attachmentItem.type, 'image')
  assert.equal(attachmentItem.referencedAttachment, true)

  await unlink(join(dirname(notePath), first.filename))
  const state = await reopened.getState()
  assert.equal(state.status, 'ready')
  const savedNote = state.library.items.find((item) => item.id === note.id)
  assert.equal(savedNote.missingContent, false)
  assert.equal(
    savedNote.attachments.find((attachment) => attachment.filename === first.filename)
      .missingContent,
    true
  )
})

test('gives clipboard images timestamp names and safely renames staged files', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-clipboard-image-name-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  const created = await service.createIn(root, 'Clipboard image names')
  const staged = await service.stageCaptureDraftImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'image.png',
    origin: 'clipboard'
  })
  assert.match(staged.filename, /^image-\d{4}-\d{2}-\d{2}-\d{6}\.png$/)
  assert.equal(staged.sourceFilename, staged.filename)
  const renamed = await service.renameCaptureDraftImage({
    attachmentId: staged.id,
    name: 'checkout empty state'
  })
  assert.equal(renamed.filename, 'checkout-empty-state.png')
  assert.equal(renamed.relativePath, './checkout-empty-state.png')
  const draftDirectory = join(created.library.path, '.kuskus', 'temp', 'note-draft')
  assert.equal(existsSync(join(draftDirectory, staged.filename)), false)
  assert.equal(existsSync(join(draftDirectory, renamed.filename)), true)
  const recovered = await service.listCaptureDraftImages()
  assert.deepEqual(
    recovered.map((attachment) => attachment.filename),
    [renamed.filename]
  )
})

test('normalizes a schema-v1 quick-composer image manifest without losing staged bytes', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-stale-image-draft-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const settingsPath = join(root, 'settings.json')
  const service = new LibraryService(settingsPath)
  const created = await service.createIn(root, 'Stale image draft')
  const draftDirectory = join(created.library.path, '.kuskus', 'temp', 'note-draft')
  const attachment = {
    id: '6ad60eb7-f723-4b37-bb91-1554af179df1',
    filename: 'image (2).png',
    relativePath: './assets/image%20%282%29.png',
    sourceFilename: 'image (2).png',
    mediaType: 'image/png',
    width: 1,
    height: 1
  }
  await mkdir(draftDirectory, { recursive: true })
  await writeFile(join(draftDirectory, attachment.filename), onePixelPng)
  await writeFile(
    join(draftDirectory, 'draft.json'),
    `${JSON.stringify({ schemaVersion: 1, attachments: [attachment] }, null, 2)}\n`
  )

  const reopened = new LibraryService(settingsPath)
  await reopened.initialize()
  const [recovered] = await reopened.listCaptureDraftImages()
  assert.equal(recovered.relativePath, './image%20%282%29.png')
  assert.equal(recovered.missingContent, false)
  assert.deepEqual(
    Buffer.from((await reopened.getCaptureDraftImagePreview(recovered.id)).bytes),
    onePixelPng
  )
  assert.equal(
    normalizeStagedAttachmentMarkdown('Keep this text\n\n![image](./assets/image%20%282%29.png)', [
      recovered
    ]),
    'Keep this text\n\n![image](./image%20%282%29.png)'
  )
})

test('retains a queued note destination and attachment IDs across restart', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-capture-destination-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const settingsPath = join(root, 'settings.json')
  const service = new LibraryService(settingsPath)
  const state = await service.createIn(root, 'Queued destination vault')
  const collection = await service.createCollection({ name: 'Design' })
  const staged = await service.stageCaptureDraftImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'Queued sketch.png'
  })
  const record = {
    schemaVersion: 2,
    id: '9345fbac-23c9-45fc-bf1d-2c969178454b',
    libraryId: state.library.id,
    kind: 'note',
    markdown: `# Queued design\n\n![Sketch](./assets/${staged.filename})`,
    attachmentIds: [staged.id],
    fileId: null,
    destination: { type: 'collection', collectionId: collection.id },
    submittedAt: '2026-08-02T00:00:00.000Z',
    sourceRevision: 1,
    status: 'accepted',
    attempts: 0,
    error: null
  }
  await service.prepareCaptureSubmission(record)
  const queuedDraftManifest = join(
    state.library.path,
    '.kuskus',
    'temp',
    'capture-queue',
    record.id,
    'note-draft',
    'draft.json'
  )
  await writeFile(
    queuedDraftManifest,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        attachments: [{ ...staged, relativePath: `./assets/${staged.filename}` }]
      },
      null,
      2
    )}\n`
  )

  const reopened = new LibraryService(settingsPath)
  await reopened.initialize()
  const [recovered] = await reopened.listCaptureSubmissions()
  assert.deepEqual(recovered.destination, record.destination)
  const note = await reopened.commitCaptureSubmission(recovered)
  assert.deepEqual(note.location, record.destination)
  assert.equal(note.attachments[0].id, staged.id)
  assert.equal(note.relativePath, 'Design/Queued design.md')
  const image = (await reopened.getState()).library.items.find((item) => item.id === staged.id)
  assert.equal(image.relativePath, 'Design/Queued-sketch.png')
  assert.deepEqual(image.location, record.destination)
  assert.match(note.body, /\.\/Queued-sketch\.png/)
  assert.doesNotMatch(note.body, /\.\/assets\//)
  assert.equal(existsSync(join(state.library.path, 'Design', 'Queued design.assets')), false)
})

test('keeps staged images recoverable when note commit validation fails', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-note-draft-failure-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  await service.createIn(root, 'Recoverable Draft')
  const staged = await service.stageCaptureDraftImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: '../unsafe.png'
  })
  assert.equal(staged.filename.includes('..'), false)
  await assert.rejects(
    () => service.createNote({ markdown: 'Do not lose this', attachmentIds: ['..\\outside'] }),
    /attachment list is invalid/i
  )
  assert.equal((await service.listCaptureDraftImages()).length, 1)
  await assert.rejects(
    () => service.removeCaptureDraftImage('..\\outside'),
    /identifier is invalid/i
  )
  await service.removeCaptureDraftImage(staged.id)
  assert.equal((await service.listCaptureDraftImages()).length, 0)
})
