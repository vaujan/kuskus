const assert = require('node:assert/strict')
const { existsSync, readFileSync } = require('node:fs')
const { cp, mkdir, mkdtemp, readFile, rename, rm, unlink, writeFile } = require('node:fs/promises')
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

const {
  LibraryService,
  NoteUpdateConflictError
} = require('../src/main/library/library-service.ts')
const {
  deriveImageTitle,
  detectImage,
  safeSourceFilename
} = require('../src/main/library/items/image-item.ts')
const { createNoteMetadata, deriveNoteTitle } = require('../src/main/library/items/note-item.ts')
const { createUrlMetadata, validateWebUrl } = require('../src/main/library/items/url-item.ts')
const { isPersistedItem } = require('../src/main/library/schemas.ts')
const { LibraryStore } = require('../src/main/library/storage/library-store.ts')
const { LIBRARY_NAME, seedDemoEnvironment } = require('../scripts/create-demo-library.cjs')
const { COLLECTION_ICON_KEYS } = require('../src/shared/library-contract.ts')
const { NoteAutosaveCoordinator } = require('../src/renderer/src/features/items/note-autosave.ts')
const { createMarkdownDiffRows } = require('../src/renderer/src/features/items/markdown-diff.ts')
const {
  EDITOR_COMMANDS,
  filterEditorCommands,
  flattenEditorCommandSections,
  moveEditorCommandIndex
} = require('../src/renderer/src/features/items/editor-command-model.ts')
const {
  getUnsupportedMarkdownReason
} = require('../src/renderer/src/features/items/markdown-preflight.ts')

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

test('recovers staged images and atomically commits a portable Markdown bundle', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-note-assets-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const settingsPath = join(root, 'settings.json')
  const service = new LibraryService(settingsPath)
  const created = await service.createIn(root, 'Attached Notes')
  assert.equal(created.status, 'ready')

  const first = await service.stageNoteDraftImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'Sketch.png'
  })
  const second = await service.stageNoteDraftImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'Sketch.png'
  })
  assert.equal(first.filename, 'Sketch.png')
  assert.equal(second.filename, 'Sketch-2.png')
  assert.equal(first.relativePath, './assets/Sketch.png')

  const reopened = new LibraryService(settingsPath)
  await reopened.initialize()
  const recovered = await reopened.listNoteDraftImages()
  assert.deepEqual(
    recovered.map((attachment) => attachment.id),
    [first.id, second.id]
  )
  const stagedPreview = await reopened.getNoteDraftImagePreview(first.id)
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
  assert.equal((await reopened.listNoteDraftImages()).length, 0)

  const libraryPath = created.library.path
  assert.equal(await readFile(join(libraryPath, 'inbox', note.id, 'note.md'), 'utf8'), markdown)
  assert.deepEqual(
    await readFile(join(libraryPath, 'inbox', note.id, 'assets', first.filename)),
    onePixelPng
  )
  const savedPreview = await reopened.getNoteAttachmentPreview(note.id, second.id)
  assert.deepEqual(Buffer.from(savedPreview.bytes), onePixelPng)

  await unlink(join(libraryPath, 'inbox', note.id, 'assets', first.filename))
  const state = await reopened.getState()
  assert.equal(state.status, 'ready')
  const savedNote = state.library.items.find((item) => item.id === note.id)
  assert.equal(savedNote.missingContent, false)
  assert.equal(
    savedNote.attachments.find((attachment) => attachment.id === first.id).missingContent,
    true
  )
})

test('updates Markdown notes without changing their identity or attachments', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-note-update-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const settingsPath = join(root, 'settings.json')
  const service = new LibraryService(settingsPath)
  const created = await service.createIn(root, 'Editable Notes')
  const staged = await service.stageNoteDraftImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'Reference.png'
  })
  const note = await service.createNote({
    markdown: `# Original title\n\n![Reference](${staged.relativePath})`,
    attachmentIds: [staged.id]
  })

  const updated = await service.updateNote({
    itemId: note.id,
    markdown: `# Updated title\n\nA table:\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n![Reference](${staged.relativePath})`,
    expectedMarkdown: note.body
  })

  assert.equal(updated.id, note.id)
  assert.equal(updated.title, 'Updated title')
  assert.equal(updated.createdAt, note.createdAt)
  assert.notEqual(updated.updatedAt, note.updatedAt)
  assert.deepEqual(updated.attachments, note.attachments)
  assert.equal(
    await readFile(join(created.library.path, 'inbox', note.id, 'note.md'), 'utf8'),
    updated.body
  )
  assert.deepEqual(
    await readFile(join(created.library.path, 'inbox', note.id, 'assets', staged.filename)),
    onePixelPng
  )

  const reopened = new LibraryService(settingsPath)
  await reopened.initialize()
  const state = await reopened.getState()
  assert.equal(state.status, 'ready')
  assert.equal(state.library.items[0].body, updated.body)
  assert.equal(state.library.items[0].title, updated.title)
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
      assert.equal(error.current.body, 'Changed outside Kuskus')
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

test('pauses autosave for conflicts and resolves with either reviewed version', async (context) => {
  const disk = noteDto('Changed on disk', '2026-07-21T01:00:00.000Z')
  const replacements = []
  const calls = []
  const coordinator = new NoteAutosaveCoordinator({
    itemId: disk.id,
    initialMarkdown: 'Initial',
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
    onDraftReplaced: (markdown) => replacements.push(markdown)
  })
  context.after(() => coordinator.dispose())

  coordinator.updateDraft('My draft')
  assert.equal(await coordinator.flush(), false)
  assert.equal(coordinator.getSnapshot().status, 'conflict')
  assert.equal(coordinator.getSnapshot().draft, 'My draft')

  assert.equal(await coordinator.useLocalVersion(disk), true)
  assert.equal(calls[1].expectedMarkdown, disk.body)
  assert.equal(calls[1].markdown, 'My draft')

  coordinator.updateDraft('Another local change')
  coordinator.useDiskVersion(disk)
  assert.deepEqual(replacements, [disk.body])
  assert.equal(coordinator.getSnapshot().draft, disk.body)
  assert.equal(coordinator.getSnapshot().status, 'saved')
})

test('protects blank and raw-HTML notes and produces a side-by-side Markdown diff', () => {
  const coordinator = new NoteAutosaveCoordinator({
    itemId: noteDto('Initial').id,
    initialMarkdown: 'Initial',
    save: async (input) => ({ ok: true, data: noteDto(input.markdown) }),
    onSaved: () => undefined,
    onDraftReplaced: () => undefined
  })
  coordinator.updateDraft('   ')
  assert.equal(coordinator.getSnapshot().status, 'invalid')
  assert.match(coordinator.getSnapshot().error, /cannot be empty/i)
  coordinator.dispose()

  assert.match(getUnsupportedMarkdownReason('<script>alert(1)</script>'), /raw HTML/i)
  assert.equal(getUnsupportedMarkdownReason('<https://example.com>'), null)
  assert.equal(getUnsupportedMarkdownReason('# Safe\n\n**Markdown**'), null)

  const rows = createMarkdownDiffRows('Same\nMy line\nSame end', 'Same\nDisk line\nSame end')
  assert.equal(rows[0].kind, 'same')
  assert.equal(rows[1].kind, 'changed')
  assert.equal(rows[1].localText, 'My line')
  assert.equal(rows[1].diskText, 'Disk line')
  assert.equal(rows[2].kind, 'same')
})

test('groups, filters, and navigates accessible editor commands without image insertion', () => {
  assert.deepEqual(
    filterEditorCommands('').map((section) => section.group),
    ['Text', 'Lists', 'Advanced']
  )
  assert.equal(
    EDITOR_COMMANDS.some((command) => command.id === 'image'),
    false
  )

  const headingResults = flattenEditorCommandSections(filterEditorCommands('heading'))
  assert.deepEqual(
    headingResults.map((command) => command.id),
    ['heading-1', 'heading-2', 'heading-3', 'heading-4', 'heading-5', 'heading-6']
  )
  assert.deepEqual(
    flattenEditorCommandSections(filterEditorCommands('todo')).map((command) => command.id),
    ['task-list']
  )
  assert.equal(flattenEditorCommandSections(filterEditorCommands('not-a-command')).length, 0)

  assert.equal(moveEditorCommandIndex(0, 'previous', 3), 0)
  assert.equal(moveEditorCommandIndex(0, 'next', 3), 1)
  assert.equal(moveEditorCommandIndex(2, 'next', 3), 2)
  assert.equal(moveEditorCommandIndex(1, 'first', 3), 0)
  assert.equal(moveEditorCommandIndex(1, 'last', 3), 2)
  assert.equal(moveEditorCommandIndex(0, 'next', 0), -1)
})

test('keeps staged images recoverable when note commit validation fails', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-note-draft-failure-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  await service.createIn(root, 'Recoverable Draft')
  const staged = await service.stageNoteDraftImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: '../unsafe.png'
  })
  assert.equal(staged.filename.includes('..'), false)
  await assert.rejects(
    () => service.createNote({ markdown: 'Do not lose this', attachmentIds: ['..\\outside'] }),
    /attachment list is invalid/i
  )
  assert.equal((await service.listNoteDraftImages()).length, 1)
  await assert.rejects(() => service.removeNoteDraftImage('..\\outside'), /identifier is invalid/i)
  await service.removeNoteDraftImage(staged.id)
  assert.equal((await service.listNoteDraftImages()).length, 0)
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
  assert.equal(
    await service.getItemRevealPath(link.id),
    join(root, 'Link Library', 'inbox', link.id, 'item.json')
  )

  const reopened = new LibraryService(join(root, 'settings.json'))
  await reopened.initialize()
  const state = await reopened.getState()
  assert.equal(state.status, 'ready')
  assert.equal(state.library.items[0].type, 'url')
  assert.equal(state.library.items[0].sourceUrl, link.sourceUrl)
})

test('persists curated collection icons and safely normalizes legacy metadata', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-collection-icon-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const settingsPath = join(root, 'settings.json')
  const service = new LibraryService(settingsPath)
  const createdState = await service.createIn(root, 'Icon Library')
  assert.equal(createdState.status, 'ready')
  const libraryPath = createdState.library.path

  const legacy = await service.createCollection({ name: 'Legacy folder' })
  assert.equal(legacy.icon, 'folder')
  const legacyMetadataPath = join(libraryPath, 'collections', legacy.id, 'collection.json')
  const legacyMetadata = JSON.parse(await readFile(legacyMetadataPath, 'utf8'))
  assert.equal(Object.hasOwn(legacyMetadata, 'icon'), false)

  for (const icon of COLLECTION_ICON_KEYS) {
    const collection = await service.createCollection({ name: `Folder ${icon}`, icon })
    assert.equal(collection.icon, icon)
  }

  const custom = await service.createCollection({ name: 'Design', icon: 'palette' })
  const updated = await service.setCollectionIcon(custom.id, 'rocket')
  assert.equal(updated.icon, 'rocket')
  const reset = await service.setCollectionIcon(custom.id, 'folder')
  assert.equal(reset.icon, 'folder')
  await service.setCollectionIcon(custom.id, 'rocket')
  const renamed = await service.renameCollection(custom.id, 'Launch references')
  assert.equal(renamed.icon, 'rocket')

  const removable = await service.createCollection({ name: 'Temporary', icon: 'archive' })
  await service.deleteCollection(removable.id)
  const afterDelete = await service.getState()
  assert.equal(afterDelete.status, 'ready')
  assert.equal(
    afterDelete.library.collections.some((collection) => collection.id === removable.id),
    false
  )

  const reopened = new LibraryService(settingsPath)
  await reopened.initialize()
  const reopenedState = await reopened.getState()
  assert.equal(reopenedState.status, 'ready')
  assert.equal(
    reopenedState.library.collections.find((collection) => collection.id === custom.id).icon,
    'rocket'
  )

  await assert.rejects(() => service.setCollectionIcon('..\\outside', 'folder'), /identifier/i)
  await assert.rejects(() => service.setCollectionIcon(custom.id, 'not-an-icon'), /supported/i)

  const customMetadataPath = join(libraryPath, 'collections', custom.id, 'collection.json')
  const customMetadata = JSON.parse(await readFile(customMetadataPath, 'utf8'))
  customMetadata.icon = 'future-icon'
  await writeFile(customMetadataPath, `${JSON.stringify(customMetadata, null, 2)}\n`, 'utf8')

  const fallbackState = await service.getState()
  assert.equal(fallbackState.status, 'ready')
  assert.equal(
    fallbackState.library.collections.find((collection) => collection.id === custom.id).icon,
    'folder'
  )
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

test('recovers an interrupted note directory swap before reading library state', async (context) => {
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

test('seeds and resets a cultivated isolated demo profile', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-demo-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))

  const { libraryPath, userDataPath } = await seedDemoEnvironment({ root })
  const service = new LibraryService(join(userDataPath, 'kuskus-settings.json'))
  await service.initialize()
  const state = await service.getState()

  assert.equal(state.status, 'ready')
  assert.equal(state.library.path, libraryPath)
  assert.equal(state.library.name, LIBRARY_NAME)
  assert.equal(state.library.items.length, 12)
  assert.equal(state.library.collections.length, 4)
  assert.deepEqual(
    state.library.collections.map((collection) => collection.name),
    ['Interface references', 'Kuskus', 'Research', 'Writing']
  )
  assert.deepEqual(
    new Set(state.library.items.map((item) => item.type)),
    new Set(['note', 'image', 'url'])
  )
  assert.equal(state.library.items.filter((item) => item.missingContent).length, 0)
  assert.equal(
    state.library.items.every((item) => Number.isFinite(Date.parse(item.createdAt))),
    true
  )
  assert.equal(
    state.library.items.every((item) => Date.parse(item.createdAt) <= Date.now()),
    true
  )

  const attachedNote = state.library.items.find(
    (item) => item.type === 'note' && item.attachments.length > 0
  )
  assert.ok(attachedNote)
  assert.equal(attachedNote.title, 'This week \u2014 close the capture loop')
  assert.equal(attachedNote.attachments.length, 1)
  assert.equal(attachedNote.attachments[0].missingContent, false)
  assert.equal(
    existsSync(
      join(libraryPath, 'inbox', attachedNote.id, 'assets', attachedNote.attachments[0].filename)
    ),
    true
  )
  assert.equal(
    existsSync(
      join(
        libraryPath,
        'collections',
        '20000000-0000-4000-8000-000000000001',
        'items',
        '40000000-0000-4000-8000-000000000001',
        'note.md'
      )
    ),
    true
  )
  assert.equal(
    existsSync(join(libraryPath, 'trash', '50000000-0000-4000-8000-000000000001', 'note.md')),
    true
  )

  const librarySentinel = join(libraryPath, 'preserve-without-reset.txt')
  const profileSentinel = join(userDataPath, 'stale-profile-state')
  await writeFile(librarySentinel, 'keep')
  await writeFile(profileSentinel, 'stale')
  await seedDemoEnvironment({ root })
  assert.equal(existsSync(librarySentinel), true)
  assert.equal(existsSync(profileSentinel), true)

  const reset = await seedDemoEnvironment({ root, reset: true })
  assert.equal(reset.libraryPath, libraryPath)
  assert.equal(existsSync(librarySentinel), false)
  assert.equal(existsSync(profileSentinel), false)
  assert.equal(existsSync(join(reset.libraryPath, 'library.json')), true)
})
