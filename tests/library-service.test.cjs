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
const {
  createUrlMetadata,
  extractUrlMetadata,
  isYouTubeVideoUrl,
  validateWebUrl
} = require('../src/main/library/items/url-item.ts')
const { isPublicIpAddress, readHtmlHead } = require('../src/main/library/url-network.ts')
const { validateUrlPreview } = require('../src/main/library/url-preview.ts')
const { isPersistedItem } = require('../src/main/library/schemas.ts')
const { LibraryStore } = require('../src/main/library/storage/library-store.ts')
const { LIBRARY_NAME, seedDemoEnvironment } = require('../scripts/create-demo-library.cjs')
const { COLLECTION_ICON_KEYS } = require('../src/shared/library-contract.ts')
const { NoteAutosaveCoordinator } = require('../src/renderer/src/features/items/note-autosave.ts')
const { createMarkdownDiffRows } = require('../src/renderer/src/features/items/markdown-diff.ts')
const {
  getPublishedMarkdownChange
} = require('../src/renderer/src/features/items/markdown-editor-change.ts')
const {
  toggleMarkdownMarker
} = require('../src/renderer/src/features/items/markdown-formatting.ts')
const {
  getScrollRatio,
  getScrollTopForRatio,
  hasMeaningfulScrollDelta
} = require('../src/renderer/src/features/items/markdown-scroll.ts')
const {
  getSplitToggleMode,
  toggleReadMarkdown
} = require('../src/renderer/src/features/items/note-view-mode.ts')
const {
  composeMarkdownCapture,
  detectCaptureKind,
  isSingleWebUrl
} = require('../src/renderer/src/features/capture/capture-detection.ts')

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

test('stages a recoverable image without creating an item and commits it explicitly', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-capture-draft-image-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const settingsPath = join(root, 'settings.json')
  const service = new LibraryService(settingsPath)
  await service.createIn(root, 'Explicit Image Capture')

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

test('detects explicit capture kinds without treating mixed content as a link or image', () => {
  assert.equal(isSingleWebUrl('https://example.com/path'), true)
  assert.equal(isSingleWebUrl('Read https://example.com'), false)
  assert.equal(detectCaptureKind('', 0), 'empty')
  assert.equal(detectCaptureKind('', 1), 'image')
  assert.equal(detectCaptureKind('https://example.com/', 0), 'link')
  assert.equal(detectCaptureKind('A note', 0), 'note')
  assert.equal(detectCaptureKind('Caption', 1), 'note')
  assert.equal(detectCaptureKind('', 2), 'note')
  assert.equal(
    composeMarkdownCapture(['![First](./assets/first.png)'], 'Caption'),
    '![First](./assets/first.png)\n\nCaption'
  )
  assert.equal(
    composeMarkdownCapture(['![First](./assets/first.png)', '![Second](./assets/second.png)']),
    '![First](./assets/first.png)\n\n![Second](./assets/second.png)'
  )
})

test('recovers staged images and atomically commits a portable Markdown bundle', async (context) => {
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
  assert.equal(first.relativePath, './assets/Sketch.png')
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
  const staged = await service.stageCaptureDraftImage({
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

test('persists an editor draft through autosave and reopens the exact Markdown', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-editor-autosave-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const settingsPath = join(root, 'settings.json')
  const service = new LibraryService(settingsPath)
  await service.createIn(root, 'Editor Autosave')
  const note = await service.createNote({ markdown: '# Initial', attachmentIds: [] })
  const updatedMarkdown = '# Updated\n\n- exact source\n- live preview'
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

test('protects blank notes and produces a side-by-side Markdown diff', () => {
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

  const rows = createMarkdownDiffRows('Same\nMy line\nSame end', 'Same\nDisk line\nSame end')
  assert.equal(rows[0].kind, 'same')
  assert.equal(rows[1].kind, 'changed')
  assert.equal(rows[1].localText, 'My line')
  assert.equal(rows[1].diskText, 'Disk line')
  assert.equal(rows[2].kind, 'same')
})

test('toggles Markdown emphasis markers while preserving the intended selection', () => {
  assert.deepEqual(toggleMarkdownMarker('Hello world', 6, 11, '**'), {
    value: 'Hello **world**',
    selectionStart: 8,
    selectionEnd: 13
  })
  assert.deepEqual(toggleMarkdownMarker('Hello **world**', 8, 13, '**'), {
    value: 'Hello world',
    selectionStart: 6,
    selectionEnd: 11
  })
  assert.deepEqual(toggleMarkdownMarker('Hello **world**', 6, 15, '**'), {
    value: 'Hello world',
    selectionStart: 6,
    selectionEnd: 11
  })
  assert.deepEqual(toggleMarkdownMarker('Hello ', 6, 6, '*'), {
    value: 'Hello **',
    selectionStart: 7,
    selectionEnd: 7
  })
  assert.deepEqual(toggleMarkdownMarker('**word**', 2, 6, '*'), {
    value: '***word***',
    selectionStart: 3,
    selectionEnd: 7
  })
  assert.deepEqual(toggleMarkdownMarker('***word***', 3, 7, '*'), {
    value: '**word**',
    selectionStart: 2,
    selectionEnd: 6
  })
})

test('uses predictable note-mode keyboard transitions', () => {
  assert.equal(toggleReadMarkdown('read'), 'markdown')
  assert.equal(toggleReadMarkdown('markdown'), 'read')
  assert.equal(toggleReadMarkdown('split'), 'read')
  assert.equal(getSplitToggleMode('read', 'read'), 'split')
  assert.equal(getSplitToggleMode('markdown', 'markdown'), 'split')
  assert.equal(getSplitToggleMode('split', 'markdown'), 'markdown')
})

test('publishes every CodeMirror document change, including empty Markdown', () => {
  assert.equal(getPublishedMarkdownChange(true, '# Updated'), '# Updated')
  assert.equal(getPublishedMarkdownChange(true, ''), '')
  assert.equal(getPublishedMarkdownChange(false, '# Unchanged'), null)
})

test('maps linked Markdown scrolling proportionally and handles non-overflowing panes', () => {
  assert.equal(getScrollRatio(300, 1000, 400), 0.5)
  assert.equal(getScrollTopForRatio(0.5, 1600, 600), 500)
  assert.equal(getScrollRatio(100, 300, 400), 0)
  assert.equal(getScrollTopForRatio(0.75, 300, 400), 0)
  assert.equal(getScrollRatio(-20, 1000, 400), 0)
  assert.equal(getScrollTopForRatio(2, 1000, 400), 600)
  assert.equal(hasMeaningfulScrollDelta(100, 100.5), false)
  assert.equal(hasMeaningfulScrollDelta(100, 101), true)
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
  assert.equal(link.metadataVersion, 2)
  assert.equal(link.hasPreviewImage, false)
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

test('extracts rich metadata from a bounded HTML head and classifies video links', async () => {
  const html = `${'<html><head>'}
    <meta content="Example &amp; Demo" property="og:title">
    <meta name="description" content="A useful page">
    <meta content="/preview.png" property="og:image">
    <meta content="Example Studio" property="og:site_name">
    <meta content="video.other" property="og:type">
    <link href="/favicon.ico" rel="shortcut icon">
    </head><body>${'x'.repeat(1_200_000)}</body></html>`
  const head = await readHtmlHead(
    new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  )
  assert.equal(head.includes('<body>'), false)
  const metadata = extractUrlMetadata(head, new URL('https://example.com/watch'))
  assert.equal(metadata.title, 'Example & Demo')
  assert.equal(metadata.description, 'A useful page')
  assert.equal(metadata.previewImageUrl, 'https://example.com/preview.png')
  assert.equal(metadata.faviconUrl, 'https://example.com/favicon.ico')
  assert.equal(metadata.siteName, 'Example Studio')
  assert.equal(metadata.contentKind, 'video')
  assert.equal(metadata.metadataVersion, 2)
  assert.equal(isYouTubeVideoUrl(new URL('https://youtu.be/M7lc1UVf-VE')), true)
  assert.equal(isYouTubeVideoUrl(new URL('https://www.youtube.com/shorts/M7lc1UVf-VE')), true)
  assert.equal(isYouTubeVideoUrl(new URL('https://www.youtube.com/')), false)
})

test('rejects private preview destinations and validates cached raster bytes', () => {
  for (const address of [
    '0.0.0.0',
    '10.0.0.1',
    '127.0.0.1',
    '169.254.1.1',
    '172.16.0.1',
    '192.168.0.1',
    '::',
    '::1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1'
  ]) {
    assert.equal(isPublicIpAddress(address), false, address)
  }
  assert.equal(isPublicIpAddress('93.184.216.34'), true)
  assert.equal(isPublicIpAddress('2606:4700:4700::1111'), true)
  assert.deepEqual(validateUrlPreview(onePixelPng, 'image/png', 'preview'), {
    mediaType: 'image/png',
    extension: 'png'
  })
  assert.throws(() => validateUrlPreview(onePixelPng, 'image/jpeg', 'preview'), /does not match/i)
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

test('recovers interrupted item move batches by phase before scanning the library', async (context) => {
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

test('rolls back every item when a live batch move fails during commit', async (context) => {
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

test('moves, archives, trashes, restores, renames, and permanently deletes items safely', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-lifecycle-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  const created = await service.createIn(root, 'Lifecycle Library')
  const libraryPath = created.library.path
  const collection = await service.createCollection({ name: 'Project' })
  const note = await service.createNote({ markdown: '# Original title\nBody', attachmentIds: [] })
  const image = await service.importImage({
    bytes: arrayBuffer(onePixelPng),
    mediaType: 'image/png',
    sourceFilename: 'external-source.png'
  })
  const externalSource = join(root, 'external-source.png')
  await writeFile(externalSource, onePixelPng)

  let library = await service.moveItems({
    itemIds: [note.id, image.id],
    destination: { type: 'collection', collectionId: collection.id }
  })
  assert.deepEqual(library.items.find((item) => item.id === note.id).location, {
    type: 'collection',
    collectionId: collection.id
  })
  assert.equal(existsSync(join(libraryPath, 'collections', collection.id, 'items', note.id)), true)

  library = await service.archiveItems({ itemIds: [note.id] })
  assert.deepEqual(library.items.find((item) => item.id === note.id).location, {
    type: 'archive',
    originalCollectionId: collection.id
  })
  library = await service.trashItems({ itemIds: [note.id] })
  assert.deepEqual(library.items.find((item) => item.id === note.id).location, {
    type: 'trash',
    trashedFrom: 'archive',
    originalCollectionId: collection.id
  })
  library = await service.restoreItems({ itemIds: [note.id] })
  assert.equal(library.items.find((item) => item.id === note.id).location.type, 'archive')
  library = await service.unarchiveItems({ itemIds: [note.id] })
  assert.deepEqual(library.items.find((item) => item.id === note.id).location, {
    type: 'collection',
    collectionId: collection.id
  })

  library = await service.renameItem({ itemId: note.id, title: 'Custom note title' })
  const renamed = library.items.find((item) => item.id === note.id)
  assert.equal(renamed.title, 'Custom note title')
  const updated = await service.updateNote({
    itemId: note.id,
    markdown: '# A different derived title\nChanged',
    expectedMarkdown: renamed.body
  })
  assert.equal(updated.title, 'Custom note title')

  await service.trashItems({ itemIds: [image.id] })
  library = await service.permanentlyDeleteItems({ itemIds: [image.id] })
  assert.equal(
    library.items.some((item) => item.id === image.id),
    false
  )
  assert.equal(existsSync(externalSource), true)
  assert.equal(existsSync(join(libraryPath, 'trash', image.id)), false)

  const reopened = new LibraryService(join(root, 'settings.json'))
  await reopened.initialize()
  const reopenedState = await reopened.getState()
  assert.equal(reopenedState.status, 'ready')
  assert.equal(
    reopenedState.library.items.find((item) => item.id === note.id).title,
    'Custom note title'
  )
})

test('removing a non-empty folder moves active items to Inbox and archived fallback returns to Inbox', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-folder-removal-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  await service.createIn(root, 'Folder Removal Library')
  const activeFolder = await service.createCollection({ name: 'Active folder' })
  const archivedFolder = await service.createCollection({ name: 'Archived folder' })
  const active = await service.createNote({ markdown: 'Active item', attachmentIds: [] })
  const archived = await service.createNote({ markdown: 'Archived item', attachmentIds: [] })
  await service.moveItems({
    itemIds: [active.id],
    destination: { type: 'collection', collectionId: activeFolder.id }
  })
  await service.moveItems({
    itemIds: [archived.id],
    destination: { type: 'collection', collectionId: archivedFolder.id }
  })
  await service.archiveItems({ itemIds: [archived.id] })

  let library = await service.deleteCollection(activeFolder.id)
  assert.equal(
    library.collections.some((entry) => entry.id === activeFolder.id),
    false
  )
  assert.deepEqual(library.items.find((item) => item.id === active.id).location, { type: 'inbox' })
  library = await service.deleteCollection(archivedFolder.id)
  library = await service.unarchiveItems({ itemIds: [archived.id] })
  assert.deepEqual(library.items.find((item) => item.id === archived.id).location, {
    type: 'inbox'
  })
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
  assert.equal(state.library.items.length, 18)
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
