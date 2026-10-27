const assert = require('node:assert/strict')
const { existsSync } = require('node:fs')
const { mkdtemp, readFile, rm, unlink, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { dirname, join } = require('node:path')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const {
  LibraryService,
  NoteUpdateConflictError
} = require('../src/main/library/library-service.ts')
const { createNoteMetadata } = require('../src/main/library/items/note-item.ts')
const { isPersistedItem } = require('../src/main/library/schemas.ts')
const { NoteAutosaveCoordinator } = require('../src/renderer/src/features/items/note-autosave.ts')

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL88wAAAABJRU5ErkJggg==',
  'base64'
)

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function arrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function noteDto(body, updatedAt = '2026-07-21T00:00:00.000Z') {
  return {
    schemaVersion: 1,
    id: '90000000-0000-4000-8000-000000000001',
    type: 'note',
    title: body.split('\n')[0].replace(/^#+\s*/, ''),
    body,
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt,
    missingContent: false,
    attachments: []
  }
}

test('creates a new library with a tutorial note in its own folder', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-tutorial-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const settingsPath = join(root, 'settings', 'kuskus-settings.json')
  const service = new LibraryService(settingsPath)
  const state = await service.createWithTutorialIn(root, 'My library')

  assert.equal(state.status, 'ready')
  assert.equal(state.library.collections.length, 1)
  const folder = state.library.collections[0]
  assert.equal(folder.name, 'Getting started')
  assert.equal(state.library.items.length, 1)
  const note = state.library.items[0]
  assert.equal(note.title, 'Start here')
  assert.deepEqual(note.location, { type: 'collection', collectionId: folder.id })
  assert.match(
    await readFile(await service.getItemContentPath(note.id), 'utf8'),
    /## 1\. Save something/
  )

  const reopenedService = new LibraryService(settingsPath)
  await reopenedService.initialize()
  const reopened = await reopenedService.getState()
  assert.equal(reopened.status, 'ready')
  assert.equal(reopened.library.items.length, 1)
  assert.equal(reopened.library.collections.length, 1)
})

test('creates, persists, reopens, and reveals a Markdown note path', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-library-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))

  const settingsPath = join(root, 'settings', 'kuskus-settings.json')
  const service = new LibraryService(settingsPath)
  const createdState = await service.createIn(root, 'Research Library')

  assert.equal(createdState.status, 'ready')
  assert.equal(createdState.library.name, 'Research Library')
  assert.equal(createdState.library.items.length, 0)

  const note = await service.createNote({
    markdown: '# First reference\n\nA useful local note.',
    attachmentIds: []
  })
  assert.equal(note.title, 'First reference')
  assert.equal(note.body, '# First reference\n\nA useful local note.')

  const notePath = await service.getItemContentPath(note.id)
  assert.equal(await readFile(notePath, 'utf8'), note.body)
  assert.equal(await service.getItemRevealPath(note.id), notePath)
  assert.equal(notePath, join(root, 'Research Library', 'First reference.md'))
  assert.equal(
    existsSync(join(root, 'Research Library', '.kuskus', 'records', `${note.id}.json`)),
    true
  )

  const reopenedService = new LibraryService(settingsPath)
  await reopenedService.initialize()
  const reopenedState = await reopenedService.getState()

  assert.equal(reopenedState.status, 'ready')
  assert.equal(reopenedState.library.items.length, 1)
  assert.equal(reopenedState.library.items[0].body, note.body)
})

test('duplicates a note beside the original with the same Markdown', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-duplicate-note-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))

  const service = new LibraryService(join(root, 'settings.json'))
  await service.createIn(root, 'Duplicate note library')
  const original = await service.createNote({
    markdown: '# Source note\n\nKeep this body.',
    attachmentIds: []
  })
  await service.renameItem({ itemId: original.id, title: 'Custom title' })
  const library = await service.duplicateNote(original.id)
  const duplicate = library.items.find((item) => item.id !== original.id)

  assert.equal(duplicate.type, 'note')
  assert.equal(duplicate.title, 'Custom title (2)')
  assert.equal(duplicate.body, original.body)
  assert.equal(
    await readFile(await service.getItemContentPath(duplicate.id), 'utf8'),
    original.body
  )
  const updated = await service.updateNote({
    itemId: duplicate.id,
    markdown: `${duplicate.body}\n\nEdited copy.`,
    expectedMarkdown: duplicate.body
  })
  assert.equal(updated.title, 'Custom title (2)')
})

test('rejects unsafe library names and arbitrary item identifiers', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-safety-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))

  const service = new LibraryService(join(root, 'settings.json'))
  await assert.rejects(() => service.createIn(root, '../escape'), /cannot use|different/i)

  await service.createIn(root, 'Safe Library')
  await assert.rejects(() => service.getItemContentPath('..\\outside'), /identifier is invalid/i)
  await assert.rejects(() => service.getItemRevealPath('..\\outside'), /identifier is invalid/i)
})

test('retains metadata when a note file is missing', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-missing-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))

  const service = new LibraryService(join(root, 'settings.json'))
  const createdState = await service.createIn(root, 'Missing Content Library')
  assert.equal(createdState.status, 'ready')

  const note = await service.createNote({ markdown: 'Keep my metadata', attachmentIds: [] })
  const notePath = await service.getItemContentPath(note.id)
  await unlink(notePath)

  const state = await service.getState()
  assert.equal(state.status, 'ready')
  assert.equal(state.library.items.length, 1)
  assert.equal(state.library.items[0].missingContent, true)
})

test('lets a missing-content item move to Trash and be deleted forever', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-missing-trash-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  await service.createIn(root, 'Missing Trash Library')

  const note = await service.createNote({ markdown: 'Gone but not forgotten', attachmentIds: [] })
  const notePath = await service.getItemContentPath(note.id)
  await unlink(notePath)

  const missing = await service.getState()
  const missingItem = missing.library.items.find((item) => item.id === note.id)
  assert.equal(missingItem.missingContent, true)

  const collection = await service.createCollection({ name: 'Target' })
  await assert.rejects(
    () =>
      service.moveItems({
        itemIds: [note.id],
        destination: { type: 'collection', collectionId: collection.id }
      }),
    /file is missing/i
  )
  await assert.rejects(() => service.archiveItems({ itemIds: [note.id] }), /file is missing/i)

  const trashed = await service.trashItems({ itemIds: [note.id] })
  const trashedItem = trashed.items.find((item) => item.id === note.id)
  assert.equal(trashedItem.location.type, 'trash')
  assert.equal(trashedItem.missingContent, true)

  const deleted = await service.permanentlyDeleteItems({ itemIds: [note.id] })
  assert.equal(
    deleted.items.find((item) => item.id === note.id),
    undefined
  )
})

test('rewrites independent attachment references through note and image lifecycle changes', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-independent-lifecycle-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  await service.createIn(root, 'Independent lifecycle vault')
  const collection = await service.createCollection({ name: 'Design' })
  const staged = await service.stageCaptureDraftImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'Sketch.png'
  })
  const note = await service.createNote({
    markdown: `# Attachment lifecycle\n\n![Sketch](${staged.relativePath})`,
    attachmentIds: [staged.id]
  })
  await assert.rejects(
    () => service.trashItems({ itemIds: [staged.id], referenceRevision: '../unsafe' }),
    /deletion review is invalid/i
  )

  let library = await service.moveItems({
    itemIds: [note.id],
    destination: { type: 'collection', collectionId: collection.id }
  })
  let currentNote = library.items.find((item) => item.id === note.id)
  let currentImage = library.items.find((item) => item.id === staged.id)
  assert.equal(currentImage.relativePath, 'Design/Sketch.png')
  assert.match(currentNote.body, /\.\/Sketch\.png/)

  library = await service.renameItem({ itemId: staged.id, title: 'Renamed image' })
  currentNote = library.items.find((item) => item.id === note.id)
  currentImage = library.items.find((item) => item.id === staged.id)
  assert.equal(currentImage.relativePath, 'Design/Renamed image.png')
  assert.match(currentNote.body, /\.\/Renamed%20image\.png/)

  library = await service.archiveItems({ itemIds: [staged.id] })
  currentNote = library.items.find((item) => item.id === note.id)
  assert.match(currentNote.body, /\.\.\/Archive\/Renamed%20image\.png/)
  const inspection = await service.inspectItemDeletion({ itemIds: [staged.id], mode: 'trash' })
  assert.equal(inspection.referencedItems[0].noteTitles[0], 'Attachment lifecycle')
  await assert.rejects(() => service.trashItems({ itemIds: [staged.id] }), /review the notes/i)

  const edited = await service.updateNote({
    itemId: note.id,
    markdown: `${currentNote.body}\n\nExternal change`,
    expectedMarkdown: currentNote.body
  })
  await assert.rejects(
    () =>
      service.trashItems({
        itemIds: [staged.id],
        confirmedReferencedItemIds: [staged.id],
        referenceRevision: inspection.revision
      }),
    /references changed/i
  )
  const reviewed = await service.inspectItemDeletion({ itemIds: [staged.id], mode: 'trash' })
  library = await service.trashItems({
    itemIds: [staged.id],
    confirmedReferencedItemIds: [staged.id],
    referenceRevision: reviewed.revision
  })
  currentNote = library.items.find((item) => item.id === note.id)
  assert.equal(currentNote.body, edited.body)
  assert.equal(currentNote.attachments[0].missingContent, true)

  library = await service.restoreItems({ itemIds: [staged.id] })
  currentNote = library.items.find((item) => item.id === note.id)
  assert.equal(currentNote.attachments[0].missingContent, false)
  assert.match(currentNote.body, /\.\.\/Archive\/Renamed%20image\.png/)
})

test('leaves shared sibling images in place when only one referencing note moves', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-shared-sibling-move-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  await service.createIn(root, 'Shared sibling vault')
  const collection = await service.createCollection({ name: 'Moved' })
  const staged = await service.stageCaptureDraftImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'Shared.png'
  })
  const first = await service.createNote({
    markdown: `# First\n\n![](${staged.relativePath})`,
    attachmentIds: [staged.id]
  })
  const second = await service.createNote({
    markdown: '# Second\n\n![](./Shared.png)',
    attachmentIds: []
  })

  const library = await service.moveItems({
    itemIds: [first.id],
    destination: { type: 'collection', collectionId: collection.id }
  })
  const image = library.items.find((item) => item.id === staged.id)
  const moved = library.items.find((item) => item.id === first.id)
  const retained = library.items.find((item) => item.id === second.id)
  assert.equal(image.relativePath, 'Shared.png')
  assert.match(moved.body, /\.\.\/Shared\.png/)
  assert.match(retained.body, /\.\/Shared\.png/)
})

test('prefers an active attachment over older Trash records sharing its Markdown path', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-active-attachment-identity-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  const created = await service.createIn(root, 'Attachment identity vault')
  const vault = created.library.path
  const firstImage = await service.stageCaptureDraftImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'image.png'
  })
  const note = await service.createNote({
    markdown: `# Stable attachment owner\n\n![image](${firstImage.relativePath})`,
    attachmentIds: [firstImage.id]
  })

  let inspection = await service.inspectItemDeletion({
    itemIds: [firstImage.id],
    mode: 'trash'
  })
  await service.trashItems({
    itemIds: [firstImage.id],
    confirmedReferencedItemIds: [firstImage.id],
    referenceRevision: inspection.revision
  })

  const noteRecordPath = join(vault, '.kuskus', 'records', `${note.id}.json`)
  let noteRecord = JSON.parse(await readFile(noteRecordPath, 'utf8'))
  noteRecord.metadata.attachments = []
  await writeFile(noteRecordPath, `${JSON.stringify(noteRecord, null, 2)}\n`, 'utf8')
  let state = await service.getState()
  let currentNote = state.library.items.find((item) => item.id === note.id)
  assert.equal(currentNote.attachments[0].id, firstImage.id)

  await writeFile(join(vault, 'image.png'), Buffer.concat([onePixelPng, Buffer.from([0])]))
  state = await service.getState()
  currentNote = state.library.items.find((item) => item.id === note.id)
  const activeImage = state.library.items.find(
    (item) => item.relativePath === 'image.png' && item.location.type !== 'trash'
  )
  assert.ok(activeImage)
  assert.notEqual(activeImage.id, firstImage.id)
  assert.equal(
    currentNote.attachments[0].id,
    activeImage.id,
    `expected active ${activeImage.id} to replace historical ${firstImage.id}`
  )
  assert.equal(activeImage.referencedAttachment, true)

  inspection = await service.inspectItemDeletion({ itemIds: [activeImage.id], mode: 'trash' })
  assert.equal(inspection.referencedItems[0].itemId, activeImage.id)
  assert.deepEqual(inspection.referencedItems[0].noteTitles, ['Stable attachment owner'])
  state = await service.trashItems({
    itemIds: [activeImage.id],
    confirmedReferencedItemIds: [activeImage.id],
    referenceRevision: inspection.revision
  })
  currentNote = state.items.find((item) => item.id === note.id)
  assert.equal(currentNote.attachments[0].id, activeImage.id)
  assert.equal(currentNote.attachments[0].missingContent, true)

  const permanentInspection = await service.inspectItemDeletion({
    itemIds: [activeImage.id],
    mode: 'permanent'
  })
  assert.equal(permanentInspection.referencedItems[0].itemId, activeImage.id)

  noteRecord = JSON.parse(await readFile(noteRecordPath, 'utf8'))
  noteRecord.metadata.attachments = []
  await writeFile(noteRecordPath, `${JSON.stringify(noteRecord, null, 2)}\n`, 'utf8')
  state = await service.getState()
  currentNote = state.library.items.find((item) => item.id === note.id)
  assert.notEqual(currentNote.attachments[0].id, firstImage.id)
  assert.notEqual(currentNote.attachments[0].id, activeImage.id)
  const ambiguousInspection = await service.inspectItemDeletion({
    itemIds: [firstImage.id, activeImage.id],
    mode: 'permanent'
  })
  assert.deepEqual(ambiguousInspection.referencedItems, [])
})

test('requires review before trashing or permanently deleting an image referenced by a trashed note', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-trashed-note-reference-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  await service.createIn(root, 'Trashed note reference vault')
  const staged = await service.stageCaptureDraftImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'Still referenced.png'
  })
  const note = await service.createNote({
    markdown: `# Trashed reference\n\n![Still referenced](${staged.relativePath})`,
    attachmentIds: [staged.id]
  })

  await service.trashItems({ itemIds: [note.id] })
  const inspection = await service.inspectItemDeletion({ itemIds: [staged.id], mode: 'trash' })
  assert.equal(inspection.referencedItems.length, 1)
  assert.equal(inspection.referencedItems[0].itemId, staged.id)
  assert.deepEqual(inspection.referencedItems[0].noteTitles, ['Trashed reference'])
  await assert.rejects(
    () => service.trashItems({ itemIds: [staged.id], referenceRevision: inspection.revision }),
    /review the notes/i
  )
  await service.trashItems({
    itemIds: [staged.id],
    referenceRevision: inspection.revision,
    confirmedReferencedItemIds: [staged.id]
  })
  const permanentInspection = await service.inspectItemDeletion({
    itemIds: [staged.id],
    mode: 'permanent'
  })
  assert.equal(permanentInspection.referencedItems.length, 1)
  await assert.rejects(
    () =>
      service.permanentlyDeleteItems({
        itemIds: [staged.id],
        referenceRevision: permanentInspection.revision
      }),
    /review the notes/i
  )
  const library = await service.permanentlyDeleteItems({
    itemIds: [staged.id],
    referenceRevision: permanentInspection.revision,
    confirmedReferencedItemIds: [staged.id]
  })
  assert.equal(
    library.items.some((item) => item.id === staged.id),
    false
  )
})

test('offers only unshared images for cleanup when deleting a note forever', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-note-cleanup-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  await service.createIn(root, 'Cleanup eligibility vault')
  const unique = await service.stageCaptureDraftImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'Unique.png'
  })
  const uniqueNote = await service.createNote({
    markdown: `# Unique reference\n\n![Unique](${unique.relativePath})`,
    attachmentIds: [unique.id]
  })
  await service.trashItems({ itemIds: [uniqueNote.id] })
  const uniqueInspection = await service.inspectItemDeletion({
    itemIds: [uniqueNote.id],
    mode: 'permanent'
  })
  assert.deepEqual(
    uniqueInspection.cleanupCandidates.map((item) => item.itemId),
    [unique.id]
  )
  let library = await service.permanentlyDeleteItems({
    itemIds: [uniqueNote.id],
    cleanupImageIds: [unique.id],
    referenceRevision: uniqueInspection.revision
  })
  assert.equal(library.items.find((item) => item.id === unique.id).location.type, 'trash')

  const shared = await service.stageCaptureDraftImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'Shared.png'
  })
  const first = await service.createNote({
    markdown: `# First reference\n\n![Shared](${shared.relativePath})`,
    attachmentIds: [shared.id]
  })
  await service.createNote({
    markdown: '# Second reference\n\n![Shared](./Shared.png)',
    attachmentIds: []
  })
  await service.trashItems({ itemIds: [first.id] })
  const sharedInspection = await service.inspectItemDeletion({
    itemIds: [first.id],
    mode: 'permanent'
  })
  assert.deepEqual(sharedInspection.cleanupCandidates, [])
})

test('updates Markdown notes without changing their identity or attachments', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-note-update-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const settingsPath = join(root, 'settings.json')
  const service = new LibraryService(settingsPath)
  await service.createIn(root, 'Editable Notes')
  const staged = await service.stageCaptureDraftImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'Reference.png'
  })
  const note = await service.createNote({
    markdown: `# Original title\n\n![Reference](${staged.relativePath})`,
    attachmentIds: [staged.id]
  })

  const updatedSource = note.body.replace(
    '# Original title\n\n![Reference](./Reference.png)',
    '# Updated title\n\nA table:\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n![Reference](./Reference.png)'
  )
  const updated = await service.updateNote({
    itemId: note.id,
    markdown: updatedSource,
    expectedMarkdown: note.body
  })

  assert.equal(updated.id, note.id)
  assert.equal(updated.title, 'Updated title')
  assert.equal(updated.titleSource, 'derived')
  assert.equal(updated.createdAt, note.createdAt)
  assert.notEqual(updated.updatedAt, note.updatedAt)
  assert.deepEqual(updated.attachments, note.attachments)
  assert.equal(await readFile(await service.getItemContentPath(note.id), 'utf8'), updated.body)
  assert.deepEqual(
    await readFile(join(dirname(await service.getItemContentPath(note.id)), staged.filename)),
    onePixelPng
  )

  const reopened = new LibraryService(settingsPath)
  await reopened.initialize()
  const state = await reopened.getState()
  assert.equal(state.status, 'ready')
  const reopenedNote = state.library.items.find((item) => item.id === note.id)
  assert.equal(reopenedNote.body, updated.body)
  assert.equal(reopenedNote.title, updated.title)
})

test('creating a note consumes only the attachments used by that note', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-note-draft-isolation-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  await service.createIn(root, 'Draft Isolation')
  const used = await service.stageCaptureDraftImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'Used.png'
  })
  const retained = await service.stageCaptureDraftImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'Retained.png'
  })

  await service.createNote({
    markdown: `![](${used.relativePath})`,
    attachmentIds: [used.id]
  })

  const remaining = await service.listCaptureDraftImages()
  assert.deepEqual(
    remaining.map((attachment) => attachment.id),
    [retained.id]
  )
})

test('imports a clipboard image directly into an existing note', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-note-image-paste-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  await service.createIn(root, 'Pasted note images')
  const note = await service.createNote({ markdown: 'Before', attachmentIds: [] })

  const image = await service.importNoteImage({
    itemId: note.id,
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'image.png',
    origin: 'clipboard'
  })
  const markdown = `${note.body}\n\n![image](${image.relativePath})`
  const updated = await service.updateNote({
    itemId: note.id,
    markdown,
    expectedMarkdown: note.body
  })

  assert.equal(updated.attachments.length, 1)
  assert.equal(updated.attachments[0].id, image.id)
  assert.deepEqual(
    await readFile(join(dirname(await service.getItemContentPath(note.id)), image.filename)),
    onePixelPng
  )
})

test('rejects invalid, missing, non-note, and externally changed note updates', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-note-update-safety-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  await service.createIn(root, 'Safe Updates')
  const note = await service.createNote({ markdown: 'Original body', attachmentIds: [] })

  await assert.rejects(
    () => service.updateNote({ itemId: '..\\outside', markdown: 'No', expectedMarkdown: '' }),
    /identifier is invalid/i
  )
  await assert.rejects(
    () => service.updateNote({ itemId: note.id, markdown: '   ', expectedMarkdown: note.body }),
    /write something/i
  )

  const image = await service.importImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'Not a note.png'
  })
  await assert.rejects(
    () => service.updateNote({ itemId: image.id, markdown: 'No', expectedMarkdown: '' }),
    /not a note/i
  )

  const notePath = await service.getItemContentPath(note.id)
  await writeFile(notePath, 'Changed outside Kuskus', 'utf8')
  await assert.rejects(
    () => service.updateNote({ itemId: note.id, markdown: 'My edit', expectedMarkdown: note.body }),
    (error) => {
      assert.equal(error instanceof NoteUpdateConflictError, true)
      assert.equal(error.current.id, note.id)
      assert.equal(error.current.body.endsWith('Changed outside Kuskus'), true)
      return true
    }
  )
  await unlink(notePath)
  await assert.rejects(
    () =>
      service.updateNote({
        itemId: note.id,
        markdown: 'My edit',
        expectedMarkdown: 'Changed outside Kuskus'
      }),
    /file is missing/i
  )
})

test('debounces note autosave and advances the authoritative baseline', async (context) => {
  const calls = []
  const saved = []
  const coordinator = new NoteAutosaveCoordinator({
    itemId: noteDto('Initial').id,
    initialMarkdown: 'Initial',
    delay: 10,
    save: async (input) => {
      calls.push(input)
      return { ok: true, data: noteDto(input.markdown) }
    },
    onSaved: (item) => saved.push(item.body),
    onDraftReplaced: () => undefined
  })
  context.after(() => coordinator.dispose())

  coordinator.updateDraft('One')
  coordinator.updateDraft('One two')
  await new Promise((resolve) => setTimeout(resolve, 40))

  assert.equal(calls.length, 1)
  assert.equal(calls[0].markdown, 'One two')
  assert.equal(calls[0].expectedMarkdown, 'Initial')
  assert.deepEqual(saved, ['One two'])
  assert.equal(coordinator.getSnapshot().status, 'saved')
})

test('persists an editor draft through autosave and reopens the exact Markdown', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-editor-autosave-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const settingsPath = join(root, 'settings.json')
  const service = new LibraryService(settingsPath)
  await service.createIn(root, 'Editor Autosave')
  const note = await service.createNote({ markdown: '# Initial', attachmentIds: [] })
  const updatedMarkdown = note.body.replace(
    '# Initial',
    '# Updated\n\n- exact source\n- live preview'
  )
  const coordinator = new NoteAutosaveCoordinator({
    itemId: note.id,
    initialMarkdown: note.body,
    delay: 10_000,
    save: async (input) => ({ ok: true, data: await service.updateNote(input) }),
    onSaved: () => undefined,
    onDraftReplaced: () => undefined
  })
  context.after(() => coordinator.dispose())

  coordinator.updateDraft(updatedMarkdown)
  assert.equal(coordinator.getSnapshot().draft, updatedMarkdown)
  assert.equal(coordinator.getSnapshot().status, 'dirty')
  assert.equal(await coordinator.flush(), true)

  const reopened = new LibraryService(settingsPath)
  await reopened.initialize()
  const state = await reopened.getState()
  const reopenedNote = state.library.items.find((item) => item.id === note.id)
  assert.equal(reopenedNote.body, updatedMarkdown)
})

test('flushes coalesced edits without allowing an older save to replace a newer draft', async (context) => {
  const calls = []
  const saved = []
  let resolveFirst
  const firstResult = new Promise((resolve) => {
    resolveFirst = resolve
  })
  const coordinator = new NoteAutosaveCoordinator({
    itemId: noteDto('Initial').id,
    initialMarkdown: 'Initial',
    delay: 10_000,
    save: (input) => {
      calls.push(input)
      if (calls.length === 1) return firstResult
      return Promise.resolve({ ok: true, data: noteDto(input.markdown) })
    },
    onSaved: (item) => saved.push(item.body),
    onDraftReplaced: () => undefined
  })
  context.after(() => coordinator.dispose())

  coordinator.updateDraft('First edit')
  const flushing = coordinator.flush()
  await new Promise((resolve) => setImmediate(resolve))
  coordinator.updateDraft('Newest edit')
  resolveFirst({ ok: true, data: noteDto('First edit') })

  assert.equal(await flushing, true)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].markdown, 'Newest edit')
  assert.equal(calls[1].expectedMarkdown, 'First edit')
  assert.deepEqual(saved, ['First edit', 'Newest edit'])
  assert.equal(coordinator.getSnapshot().draft, 'Newest edit')
  assert.equal(coordinator.getSnapshot().savedMarkdown, 'Newest edit')
})

test('automatically merges concurrent disk and editor changes before retrying autosave', async (context) => {
  const base = 'Title\nLocal base\nDisk base'
  const draft = 'Title\nLocal edit\nDisk base'
  const disk = noteDto('Title\nLocal base\nDisk edit', '2026-07-21T01:00:00.000Z')
  const calls = []
  const mergeNotices = []
  const coordinator = new NoteAutosaveCoordinator({
    itemId: disk.id,
    initialMarkdown: base,
    delay: 10_000,
    save: async (input) => {
      calls.push(input)
      if (calls.length === 1) {
        return {
          ok: false,
          code: 'conflict',
          error: 'Changed on disk',
          conflict: { current: disk }
        }
      }
      return { ok: true, data: noteDto(input.markdown, '2026-07-21T02:00:00.000Z') }
    },
    onSaved: () => undefined,
    onDraftReplaced: () => undefined,
    onExternalChangesMerged: (overlapping) => mergeNotices.push(overlapping)
  })
  context.after(() => coordinator.dispose())

  coordinator.updateDraft(draft)
  assert.equal(await coordinator.flush(), true)
  assert.equal(coordinator.getSnapshot().status, 'saved')
  assert.equal(coordinator.getSnapshot().draft, 'Title\nLocal edit\nDisk edit')
  assert.equal(calls[1].expectedMarkdown, disk.body)
  assert.equal(calls[1].markdown, 'Title\nLocal edit\nDisk edit')
  assert.deepEqual(mergeNotices, [])
})

test('alerts when concurrent note edits overlap', async (context) => {
  const disk = noteDto('Title\nDisk edit', '2026-07-21T01:00:00.000Z')
  const mergeNotices = []
  let attempt = 0
  const coordinator = new NoteAutosaveCoordinator({
    itemId: disk.id,
    initialMarkdown: 'Title\nBase',
    delay: 10_000,
    save: async (input) => {
      attempt += 1
      return attempt === 1
        ? { ok: false, code: 'conflict', error: 'Changed on disk', conflict: { current: disk } }
        : { ok: true, data: noteDto(input.markdown, '2026-07-21T02:00:00.000Z') }
    },
    onSaved: () => undefined,
    onDraftReplaced: () => undefined,
    onExternalChangesMerged: (overlapping) => mergeNotices.push(overlapping)
  })
  context.after(() => coordinator.dispose())

  coordinator.updateDraft('Title\nLocal edit')
  assert.equal(await coordinator.flush(), true)
  assert.deepEqual(mergeNotices, [true])
})

test('rejects unsafe persisted note attachment metadata', () => {
  const id = '70000000-0000-4000-8000-000000000001'
  const timestamp = new Date().toISOString()
  const metadata = createNoteMetadata(id, 'Attached note', timestamp, [
    {
      id: '70000000-0000-4000-8000-000000000002',
      filename: 'safe.png',
      relativePath: './assets/safe.png',
      sourceFilename: 'safe.png',
      mediaType: 'image/png',
      width: 1,
      height: 1
    }
  ])

  assert.equal(isPersistedItem(metadata, id), true)
  metadata.attachments[0].filename = 'unsafe:stream.png'
  metadata.attachments[0].relativePath = './assets/unsafe:stream.png'
  assert.equal(isPersistedItem(metadata, id), false)
})
