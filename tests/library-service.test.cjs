const assert = require('node:assert/strict')
const { existsSync, readFileSync } = require('node:fs')
const {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  unlink,
  writeFile
} = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { dirname, join, relative, resolve } = require('node:path')
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
const {
  markdownPathForAttachment,
  resolveAttachmentPlacement
} = require('../src/main/library/attachment-placement.ts')
const {
  createInternetShortcut,
  parseInternetShortcut
} = require('../src/main/library/internet-shortcut.ts')
const { removeKuskusFrontmatter } = require('../src/main/library/vault-frontmatter.ts')
const {
  normalizeStagedAttachmentMarkdown,
  parseMarkdownImageReferences,
  removeStagedAttachmentMarkdown
} = require('../src/shared/markdown-image-references.ts')
const {
  prepareObsidianMarkdown
} = require('../src/renderer/src/features/items/obsidian-markdown.ts')
const { LIBRARY_NAME, seedDemoEnvironment } = require('../scripts/create-demo-library.cjs')
const { COLLECTION_ICON_KEYS } = require('../src/shared/library-contract.ts')
const { NoteAutosaveCoordinator } = require('../src/renderer/src/features/items/note-autosave.ts')
const { createMarkdownDiffRows } = require('../src/renderer/src/features/items/markdown-diff.ts')
const {
  getPublishedMarkdownChange
} = require('../src/renderer/src/features/items/markdown-editor-change.ts')
const {
  partitionRichMarkdownSource
} = require('../src/renderer/src/features/items/rich-markdown-source.ts')
const {
  prepareRichMarkdown,
  restoreRichMarkdown,
  supportsRichMarkdown
} = require('../src/renderer/src/features/items/rich-markdown-syntax.ts')
const {
  decodeMarkdownLinkTarget,
  toggleMarkdownMarker
} = require('../src/renderer/src/features/items/markdown-formatting.ts')
const {
  getScrollRatio,
  getScrollTopForRatio,
  hasMeaningfulScrollDelta
} = require('../src/renderer/src/features/items/markdown-scroll.ts')
const {
  getSplitToggleMode,
  toggleReadLive,
  toggleSourceMode
} = require('../src/renderer/src/features/items/note-view-mode.ts')
const {
  composeMarkdownCapture,
  detectCaptureKind,
  isSingleWebUrl
} = require('../src/renderer/src/features/capture/capture-detection.ts')
const {
  buildFolderSubtreeCounts,
  buildFolderTree,
  flattenFolderTree,
  getFolderAncestorIds,
  getFolderSubtreeIds,
  getVisibleFolderIds,
  sanitizeCollapsedFolderIds
} = require('../src/renderer/src/features/collections/folder-tree.ts')

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL88wAAAABJRU5ErkJggg==',
  'base64'
)
const lossyWebpHeader = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x16, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
  0x0a, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x9d, 0x01, 0x2a, 0x40, 0x01, 0xf0, 0x00
])

test('builds a sorted folder tree and keeps invalid ancestry visible at the root', () => {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const collection = (id, name, parentId = null) => ({
    schemaVersion: 2,
    id,
    name,
    icon: 'folder',
    createdAt: '2026-07-29T00:00:00.000Z',
    relativePath: parentId ? `Parent/${name}` : name,
    parentId
  })
  const folders = [
    collection('root-b', 'Writing'),
    collection('child-b', 'Zebra', 'root-a'),
    collection('orphan', 'Orphan', 'missing'),
    collection('root-a', 'Projects'),
    collection('child-a', 'Alpha', 'root-a'),
    collection('grandchild', 'Research', 'child-a'),
    collection('cycle-a', 'Cycle A', 'cycle-b'),
    collection('cycle-b', 'Cycle B', 'cycle-a')
  ]

  const tree = buildFolderTree(folders)
  assert.deepEqual(
    tree.map((node) => node.folder.name),
    ['Cycle A', 'Cycle B', 'Orphan', 'Projects', 'Writing']
  )
  const projects = tree.find((node) => node.folder.id === 'root-a')
  assert.deepEqual(
    projects.children.map((node) => node.folder.name),
    ['Alpha', 'Zebra']
  )
  assert.equal(projects.children[0].children[0].folder.id, 'grandchild')
  assert.deepEqual(getFolderAncestorIds(folders, 'grandchild'), ['child-a', 'root-a'])
  assert.equal(getVisibleFolderIds(tree, new Set(['root-a'])).includes('child-a'), false)
  assert.deepEqual([...sanitizeCollapsedFolderIds(folders, ['root-a', 'missing'])], ['root-a'])
})

test('builds recursive folder scopes and counts without looping on invalid ancestry', () => {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const collection = (id, parentId = null) => ({
    schemaVersion: 2,
    id,
    name: id,
    icon: 'folder',
    createdAt: '2026-07-29T00:00:00.000Z',
    relativePath: id,
    parentId
  })
  const folders = [
    collection('project'),
    collection('research', 'project'),
    collection('sources', 'research'),
    collection('other'),
    collection('cycle-a', 'cycle-b'),
    collection('cycle-b', 'cycle-a')
  ]

  assert.deepEqual([...getFolderSubtreeIds(folders, 'project')], ['project', 'research', 'sources'])
  const counts = buildFolderSubtreeCounts(folders, [
    'project',
    'research',
    'sources',
    'sources',
    'other',
    'cycle-a'
  ])
  assert.equal(counts.get('project'), 4)
  assert.equal(counts.get('research'), 3)
  assert.equal(counts.get('sources'), 2)
  assert.equal(counts.get('other'), 1)
  assert.equal(counts.get('cycle-a'), 1)
  assert.equal(counts.get('cycle-b'), 1)
  assert.deepEqual(
    flattenFolderTree(folders)
      .filter(({ folder }) => !folder.id.startsWith('cycle'))
      .map(({ folder, depth }) => [folder.id, depth]),
    [
      ['other', 0],
      ['project', 0],
      ['research', 1],
      ['sources', 2]
    ]
  )
})

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

test('parses and repairs balanced Markdown image destinations without losing draft text', () => {
  const source = [
    'Before',
    '![Legacy](./Hello world (2).assets/image 100% \\(final\\).png)',
    '![Encoded](<./Shared/image%20%282%29.png>)',
    'After'
  ].join('\n')
  assert.deepEqual(
    parseMarkdownImageReferences(source).map((reference) => reference.destination),
    ['./Hello world (2).assets/image 100% \\(final\\).png', './Shared/image%20%282%29.png']
  )

  const attachment = { filename: 'image (2).png', relativePath: './image%20%282%29.png' }
  const stale = 'Before\n\n![image](./assets/image%20%282%29.png)\n\nAfter'
  assert.equal(
    normalizeStagedAttachmentMarkdown(stale, [attachment]),
    'Before\n\n![image](./image%20%282%29.png)\n\nAfter'
  )
  assert.equal(removeStagedAttachmentMarkdown(stale, attachment), 'Before\n\nAfter')
})

test('resolves same-folder attachment placement without coupling callers to its layout', () => {
  const libraryPath = join('C:', 'Vault')
  const notePath = join(libraryPath, 'Projects', 'Research note.md')
  const placement = resolveAttachmentPlacement({
    libraryPath,
    notePath,
    filename: 'Sketch (final).png'
  })
  assert.equal(placement.directory, join(libraryPath, 'Projects'))
  assert.equal(placement.candidatePath, join(libraryPath, 'Projects', 'Sketch (final).png'))
  assert.equal(
    markdownPathForAttachment(notePath, placement.candidatePath),
    './Sketch%20%28final%29.png'
  )
  assert.throws(
    () =>
      resolveAttachmentPlacement({
        libraryPath,
        notePath: join(libraryPath, '..', 'Outside.md'),
        filename: 'unsafe.png'
      }),
    /outside the library/i
  )
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
  assert.equal(updated.title, 'Original title')
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

test('keeps blank edits pending and produces a side-by-side Markdown diff', () => {
  const coordinator = new NoteAutosaveCoordinator({
    itemId: noteDto('Initial').id,
    initialMarkdown: 'Initial',
    save: async (input) => ({ ok: true, data: noteDto(input.markdown) }),
    onSaved: () => undefined,
    onDraftReplaced: () => undefined
  })
  coordinator.updateDraft('   ')
  assert.equal(coordinator.getSnapshot().status, 'dirty')
  assert.equal(coordinator.getSnapshot().error, null)
  coordinator.dispose()

  const rows = createMarkdownDiffRows('Same\nMy line\nSame end', 'Same\nDisk line\nSame end')
  assert.equal(rows[0].kind, 'same')
  assert.equal(rows[1].kind, 'changed')
  assert.equal(rows[1].localText, 'My line')
  assert.equal(rows[1].diskText, 'Disk line')
  assert.equal(rows[2].kind, 'same')
})

test('safely decodes Markdown vault-link targets', () => {
  assert.equal(decodeMarkdownLinkTarget('Folder%2FNote'), 'Folder/Note')
  assert.equal(decodeMarkdownLinkTarget('broken%link'), null)
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
  assert.equal(toggleReadLive('read'), 'live')
  assert.equal(toggleReadLive('live'), 'read')
  assert.equal(toggleReadLive('markdown'), 'live')
  assert.equal(toggleReadLive('split'), 'live')
  assert.equal(toggleSourceMode('read'), 'markdown')
  assert.equal(toggleSourceMode('live'), 'markdown')
  assert.equal(toggleSourceMode('markdown'), 'live')
  assert.equal(getSplitToggleMode('read', 'read'), 'split')
  assert.equal(getSplitToggleMode('live', 'live'), 'split')
  assert.equal(getSplitToggleMode('split', 'live'), 'live')
  assert.equal(getSplitToggleMode('markdown', 'markdown'), 'split')
  assert.equal(getSplitToggleMode('split', 'markdown'), 'markdown')
})

test('preserves Kuskus wikilinks through the rich Markdown interchange format', () => {
  const markdown = [
    '[[Plain note]]',
    '[[Target#Heading|Visible alias]]',
    '![[Image file (wide).png|Image alias]]'
  ].join('\n')

  assert.equal(restoreRichMarkdown(prepareRichMarkdown(markdown)), markdown)
  assert.equal(restoreRichMarkdown('<https://example.com>'), 'https://example.com')
  assert.equal(supportsRichMarkdown(markdown), true)
  assert.equal(supportsRichMarkdown('line<br />next'), true)
  assert.equal(prepareRichMarkdown('line<br />next'), 'line  \nnext')
  assert.equal(supportsRichMarkdown('<details>exact HTML</details>'), false)
})

test('keeps frontmatter outside rich editing and rejects malformed frontmatter', () => {
  const frontmatter = '---\r\ntags: [design]\r\n---\r\n'
  assert.deepEqual(partitionRichMarkdownSource(`${frontmatter}# Body\r\n`), {
    prefix: frontmatter,
    body: '# Body\r\n'
  })
  assert.deepEqual(partitionRichMarkdownSource('# Body'), { prefix: '', body: '# Body' })
  assert.equal(partitionRichMarkdownSource('---\ntags: [broken]\n# Body'), null)
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

test('creates nested folders from validated parents without escaping the vault', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-nested-folder-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  const created = await service.createIn(root, 'Nested folders')
  const libraryPath = created.library.path

  const project = await service.createCollection({ name: 'Project' })
  const research = await service.createCollection({ name: 'Research', parentId: project.id })
  const sources = await service.createCollection({ name: 'Sources', parentId: research.id })
  const duplicate = await service.createCollection({ name: 'Sources', parentId: research.id })

  assert.equal(project.parentId, null)
  assert.equal(project.relativePath, 'Project')
  assert.equal(research.parentId, project.id)
  assert.equal(research.relativePath, 'Project/Research')
  assert.equal(sources.parentId, research.id)
  assert.equal(sources.relativePath, 'Project/Research/Sources')
  assert.equal(duplicate.relativePath, 'Project/Research/Sources (2)')
  assert.equal(existsSync(join(libraryPath, 'Project', 'Research', 'Sources')), true)
  assert.equal(existsSync(join(libraryPath, 'Project', 'Research', 'Sources (2)')), true)

  await assert.rejects(
    () => service.createCollection({ name: 'Unsafe', parentId: '..\\outside' }),
    /identifier/i
  )
  await assert.rejects(
    () =>
      service.createCollection({
        name: 'Missing parent',
        parentId: '00000000-0000-4000-8000-000000000099'
      }),
    /parent folder no longer exists/i
  )
  assert.equal(existsSync(join(libraryPath, 'Unsafe')), false)
  assert.equal(existsSync(join(libraryPath, 'Missing parent')), false)

  const reopened = new LibraryService(join(root, 'settings.json'))
  await reopened.initialize()
  const state = await reopened.getState()
  assert.equal(state.status, 'ready')
  assert.equal(
    state.library.collections.find((folder) => folder.relativePath === 'Project/Research').parentId,
    project.id
  )
})

test('moves nested folders without changing identity and rejects ancestry cycles', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-folder-move-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const settingsPath = join(root, 'settings.json')
  const service = new LibraryService(settingsPath)
  const created = await service.createIn(root, 'Folder move library')
  const libraryPath = created.library.path
  const projectA = await service.createCollection({ name: 'Project A' })
  const projectB = await service.createCollection({ name: 'Project B' })
  const research = await service.createCollection({ name: 'Research', parentId: projectA.id })
  const sources = await service.createCollection({ name: 'Sources', parentId: research.id })
  await service.createCollection({ name: 'Research', parentId: projectB.id })
  const note = await service.createNote({ markdown: 'Nested source', attachmentIds: [] })
  await service.moveItems({
    itemIds: [note.id],
    destination: { type: 'collection', collectionId: sources.id }
  })

  let library = await service.moveCollection({
    collectionId: research.id,
    parentId: projectB.id
  })
  const movedResearch = library.collections.find((folder) => folder.id === research.id)
  const movedSources = library.collections.find((folder) => folder.id === sources.id)
  assert.equal(movedResearch.parentId, projectB.id)
  assert.equal(movedResearch.relativePath, 'Project B/Research (2)')
  assert.equal(movedSources.parentId, research.id)
  assert.equal(movedSources.relativePath, 'Project B/Research (2)/Sources')
  assert.match(
    library.items.find((item) => item.id === note.id).relativePath,
    /^Project B\/Research \(2\)\/Sources\//
  )
  assert.equal(existsSync(join(libraryPath, 'Project B', 'Research (2)', 'Sources')), true)
  assert.equal(existsSync(join(libraryPath, 'Project A', 'Research')), false)

  await assert.rejects(
    () => service.moveCollection({ collectionId: projectB.id, parentId: sources.id }),
    /inside itself or one of its subfolders/i
  )
  library = await service.moveCollection({ collectionId: research.id, parentId: null })
  assert.equal(library.collections.find((folder) => folder.id === research.id).parentId, null)
  assert.equal(library.collections.find((folder) => folder.id === sources.id).parentId, research.id)

  const reopened = new LibraryService(settingsPath)
  await reopened.initialize()
  const state = await reopened.getState()
  assert.equal(state.status, 'ready')
  assert.equal(state.library.collections.find((folder) => folder.id === research.id).parentId, null)
  assert.deepEqual(state.library.items.find((item) => item.id === note.id).location, {
    type: 'collection',
    collectionId: sources.id
  })
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
  const legacyMetadataPath = join(libraryPath, '.kuskus', 'collections', `${legacy.id}.json`)
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

  const customMetadataPath = join(libraryPath, '.kuskus', 'collections', `${custom.id}.json`)
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

test('derives note titles from readable Markdown instead of image syntax', () => {
  assert.equal(
    deriveNoteTitle(
      '**![](./dialog-problem.png)**\n\nDialog content is too cramped and looks very vibecoded.'
    ),
    'Dialog content is too cramped and looks very vibecoded.'
  )
  assert.equal(deriveNoteTitle('Before ![Screenshot](./dialog-problem.png) after'), 'Before after')
  assert.equal(deriveNoteTitle('![](./dialog%20problem.png)'), 'dialog problem')
  assert.equal(deriveNoteTitle('![[Screens/dialog-problem.png|Screenshot]]'), 'dialog-problem')
  assert.equal(
    deriveNoteTitle(
      '---\ntags: [design]\n---\n<!-- captured reference -->\n> - [x] **Readable** [reference](https://example.com)'
    ),
    'Readable reference'
  )
  assert.equal(deriveNoteTitle('```ts\nconst answer = 42\n```'), 'const answer = 42')
  assert.equal(deriveNoteTitle('| --- | --- |\n\nActual title'), 'Actual title')
  assert.equal(deriveNoteTitle('![Screenshot](data:image/png;base64,abc)'), 'Untitled note')
  assert.equal(deriveNoteTitle('![]('), 'Untitled note')
  assert.equal(deriveNoteTitle(`# ${'x'.repeat(140)}`), 'x'.repeat(120))
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

test('initializes an existing Obsidian vault without changing its organization or settings', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-obsidian-init-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const vault = join(root, 'Shared vault')
  await mkdir(join(vault, '.obsidian'), { recursive: true })
  await mkdir(join(vault, 'Projects', 'Research'), { recursive: true })
  await mkdir(join(vault, 'Archive'), { recursive: true })
  const source =
    '---\n# keep this comment\ntags: [alpha, beta]\n---\n# Existing note\n\n![[diagram.png]]\n'
  await writeFile(join(vault, 'Projects', 'Research', 'Existing note.md'), source, 'utf8')
  await writeFile(join(vault, 'Projects', 'Research', 'diagram.png'), onePixelPng)
  await writeFile(join(vault, 'reference.pdf'), Buffer.from('%PDF-1.4\n'))
  await writeFile(join(vault, '.obsidian', 'app.json'), '{"newFileLocation":"current"}', 'utf8')

  const service = new LibraryService(join(root, 'settings.json'))
  let state = await service.openAt(vault)
  assert.equal(state.status, 'needs-initialization')
  assert.equal(state.markdownFiles, 1)
  assert.equal(state.imageFiles, 1)
  assert.equal(state.otherFiles, 1)
  assert.equal(state.folders, 2)
  assert.equal(state.archiveFolderExists, true)

  state = await service.initializePendingVault()
  assert.equal(state.status, 'ready')
  assert.equal(state.library.items.length, 3)
  assert.equal(
    state.library.collections.some((entry) => entry.relativePath === 'Projects/Research'),
    true
  )
  const note = state.library.items.find((entry) => entry.type === 'note')
  const image = state.library.items.find((entry) => entry.type === 'image')
  const file = state.library.items.find((entry) => entry.type === 'file')
  assert.equal(note.relativePath, 'Projects/Research/Existing note.md')
  assert.equal(image.referencedAttachment, true)
  assert.equal(file.relativePath, 'reference.pdf')
  const updated = await readFile(join(vault, note.relativePath), 'utf8')
  assert.match(updated, /# keep this comment/)
  assert.match(updated, /tags: \[alpha, beta\]/)
  assert.equal(updated, source)
  assert.equal(
    await readFile(join(vault, '.obsidian', 'app.json'), 'utf8'),
    '{"newFileLocation":"current"}'
  )
})

test('renders a legacy assets embed with spaces and parentheses without rewriting its Markdown', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-legacy-assets-reference-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const vault = join(root, 'Legacy assets vault')
  const source = '# Hello world\n\nTesting\n![image](./Hello world (2).assets/image.png)\n'
  await mkdir(join(vault, 'Hello world (2).assets'), { recursive: true })
  await writeFile(join(vault, 'Hello world (2).md'), source, 'utf8')
  await writeFile(join(vault, 'Hello world (2).assets', 'image.png'), onePixelPng)

  const settingsPath = join(root, 'settings.json')
  const service = new LibraryService(settingsPath)
  await service.openAt(vault)
  const state = await service.initializePendingVault()
  const note = state.library.items.find((item) => item.type === 'note')
  const image = state.library.items.find((item) => item.type === 'image')
  assert.equal(note.attachments[0].id, image.id)
  assert.equal(image.referencedAttachment, true)
  assert.deepEqual(
    Buffer.from((await service.getNoteAttachmentPreview(note.id, image.id)).bytes),
    onePixelPng
  )
  assert.match(
    prepareObsidianMarkdown(note.body, note.attachments),
    /<\.\/Hello%20world%20%282%29\.assets\/image\.png>/
  )
  assert.equal(await readFile(join(vault, 'Hello world (2).md'), 'utf8'), source)

  const reopened = new LibraryService(settingsPath)
  await reopened.initialize()
  const reopenedState = await reopened.getState()
  assert.equal(reopenedState.library.items.find((item) => item.type === 'image').id, image.id)
  assert.equal(await readFile(join(vault, 'Hello world (2).md'), 'utf8'), source)
})

test('resolves Obsidian sibling, vault-root, and shared-folder image embeds', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-obsidian-attachments-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const vault = join(root, 'Attachment vault')
  await mkdir(join(vault, '.obsidian'), { recursive: true })
  await mkdir(join(vault, 'Notes'), { recursive: true })
  await mkdir(join(vault, 'Shared'), { recursive: true })
  await writeFile(join(vault, 'root.png'), onePixelPng)
  await writeFile(join(vault, 'Notes', 'local.png'), onePixelPng)
  await writeFile(join(vault, 'Shared', 'shared.png'), onePixelPng)
  const source = [
    '# Compatible embeds',
    '',
    '![[local.png]]',
    '![[root.png]]',
    '![[Shared/shared.png]]',
    '![Root again](/root.png)'
  ].join('\n')
  await writeFile(join(vault, 'Notes', 'Compatible.md'), source, 'utf8')
  await writeFile(join(vault, '.obsidian', 'app.json'), '{"attachmentFolderPath":"Shared"}')

  const service = new LibraryService(join(root, 'settings.json'))
  await service.openAt(vault)
  const state = await service.initializePendingVault()
  assert.equal(state.status, 'ready')
  const note = state.library.items.find((item) => item.type === 'note')
  assert.deepEqual(
    new Set(note.attachments.map((attachment) => attachment.filename)),
    new Set(['local.png', 'root.png', 'shared.png'])
  )
  assert.equal(
    state.library.items
      .filter((item) => item.type === 'image')
      .every((item) => item.referencedAttachment),
    true
  )
  assert.equal(await readFile(join(vault, 'Notes', 'Compatible.md'), 'utf8'), source)
  assert.equal(
    await readFile(join(vault, '.obsidian', 'app.json'), 'utf8'),
    '{"attachmentFolderPath":"Shared"}'
  )

  const rootImage = state.library.items.find((item) => item.relativePath === 'root.png')
  let library = await service.renameItem({ itemId: rootImage.id, title: 'Renamed root' })
  let currentNote = library.items.find((item) => item.id === note.id)
  assert.match(currentNote.body, /!\[\[Renamed root\.png\]\]/)
  assert.match(currentNote.body, /\.\.\/Renamed%20root\.png/)

  const sharedCollection = library.collections.find(
    (collection) => collection.relativePath === 'Shared'
  )
  library = await service.moveItems({
    itemIds: [note.id],
    destination: { type: 'collection', collectionId: sharedCollection.id }
  })
  currentNote = library.items.find((item) => item.id === note.id)
  assert.match(currentNote.body, /!\[\[Notes\/local\.png\]\]/)
  assert.match(currentNote.body, /!\[\[Shared\/shared\.png\]\]/)
  assert.equal(
    await readFile(join(vault, '.obsidian', 'app.json'), 'utf8'),
    '{"attachmentFolderPath":"Shared"}'
  )
})

test('indexes malformed user YAML as untouched Markdown instead of rewriting it', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-malformed-yaml-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const vault = join(root, 'Malformed vault')
  const source = '---\ntags: [unfinished\n---\n# Still readable\n'
  await mkdir(vault)
  await writeFile(join(vault, 'Malformed.md'), source, 'utf8')
  const service = new LibraryService(join(root, 'settings.json'))
  await service.openAt(vault)
  const state = await service.initializePendingVault()
  assert.equal(state.status, 'ready')
  assert.equal(state.library.items[0].type, 'note')
  assert.equal(state.library.items[0].body, source)
  assert.equal(await readFile(join(vault, 'Malformed.md'), 'utf8'), source)
})

test('migrates a schema-v1 library into readable files and retains a sibling backup', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-v1-migration-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const vault = join(root, 'Legacy library')
  const id = '00000000-0000-4000-8000-000000000001'
  const linkId = '00000000-0000-4000-8000-000000000002'
  const timestamp = '2026-07-15T00:00:00.000Z'
  await mkdir(join(vault, 'inbox', id), { recursive: true })
  await writeFile(
    join(vault, 'library.json'),
    `${JSON.stringify({ schemaVersion: 1, id, name: 'Legacy library', createdAt: timestamp })}\n`
  )
  const metadata = createNoteMetadata(id, '# Migrated note\n\nOriginal body', timestamp)
  await writeFile(join(vault, 'inbox', id, 'item.json'), `${JSON.stringify(metadata)}\n`)
  await writeFile(join(vault, 'inbox', id, 'note.md'), '# Migrated note\n\nOriginal body', 'utf8')
  await mkdir(join(vault, 'inbox', linkId), { recursive: true })
  await writeFile(
    join(vault, 'inbox', linkId, 'item.json'),
    `${JSON.stringify(createUrlMetadata(linkId, 'https://example.com/legacy', timestamp))}\n`
  )

  const service = new LibraryService(join(root, 'settings.json'))
  let state = await service.openAt(vault)
  assert.equal(state.status, 'needs-migration')
  const migrated = await service.migratePendingLibrary()
  state = migrated.state
  assert.equal(state.status, 'ready')
  assert.equal(state.library.items.length, 2)
  assert.equal(state.library.items.find((item) => item.id === id).relativePath, 'Migrated note.md')
  assert.equal(
    state.library.items.find((item) => item.id === linkId).relativePath,
    'example.com.url'
  )
  assert.equal(existsSync(join(vault, 'Migrated note.md')), true)
  assert.equal(existsSync(join(vault, 'example.com.url')), true)
  assert.equal(existsSync(join(vault, '.kuskus', 'records', `${id}.json`)), true)
  assert.equal(existsSync(migrated.backupPath), true)
  assert.equal(existsSync(join(migrated.backupPath, 'inbox', id, 'note.md')), true)
})

test('keeps note identity across an external filesystem rename without visible metadata', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-note-identity-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const settingsPath = join(root, 'settings.json')
  const service = new LibraryService(settingsPath)
  const created = await service.createIn(root, 'Identity vault')
  const note = await service.createNote({ markdown: '# Stable note\n\nBody', attachmentIds: [] })
  const original = join(created.library.path, 'Stable note.md')
  const moved = join(created.library.path, 'Renamed outside Kuskus.md')
  await rename(original, moved)
  await writeFile(moved, '# Stable note\n\nEdited outside Kuskus', 'utf8')

  const reopened = new LibraryService(settingsPath)
  await reopened.initialize()
  const state = await reopened.getState()
  assert.equal(state.status, 'ready')
  const resolved = state.library.items.find(
    (item) => item.relativePath === 'Renamed outside Kuskus.md'
  )
  assert.equal(resolved.id, note.id)
  assert.equal(resolved.body, '# Stable note\n\nEdited outside Kuskus')
})

test('does not guess identity when duplicate fingerprints make an external move ambiguous', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-note-duplicate-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  const created = await service.createIn(root, 'Duplicate vault')
  const note = await service.createNote({ markdown: 'Identical content', attachmentIds: [] })
  await writeFile(join(created.library.path, 'Copy one.md'), 'Identical content', 'utf8')
  await writeFile(join(created.library.path, 'Copy two.md'), 'Identical content', 'utf8')
  await unlink(join(created.library.path, 'Identical content.md'))

  const state = await service.getState()
  assert.equal(state.status, 'ready')
  const visibleCopies = state.library.items.filter((item) => !item.missingContent)
  assert.equal(visibleCopies.length, 2)
  assert.equal(
    visibleCopies.some((item) => item.id === note.id),
    false
  )
  assert.equal(state.library.items.find((item) => item.id === note.id).missingContent, true)
})

test('automatically removes legacy Kuskus YAML with a retained recovery copy', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-metadata-cleanup-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  const created = await service.createIn(root, 'Cleanup vault')
  const note = await service.createNote({ markdown: '# Clean me', attachmentIds: [] })
  const notePath = join(created.library.path, 'Clean me.md')
  const legacy = `---\n# keep this\ntags: [one]\nurl: https://user.example/\nkuskus-id: "${note.id}"\n---\n# Clean me`
  await writeFile(notePath, legacy, 'utf8')
  await rm(join(created.library.path, '.kuskus', 'migrations', 'visible-metadata-cleanup.json'), {
    force: true
  })

  const state = await service.getState()
  assert.equal(state.status, 'ready', JSON.stringify(state))
  assert.equal(state.library.cleanup.status, 'completed')
  assert.equal(state.library.cleanup.affectedFiles, 1)
  assert.equal(
    await readFile(notePath, 'utf8'),
    '---\n# keep this\ntags: [one]\nurl: https://user.example/\n---\n# Clean me'
  )
  const recovered = join(
    created.library.path,
    state.library.cleanup.recoveryRelativePath,
    'originals',
    'Clean me.md'
  )
  assert.equal(await readFile(recovered, 'utf8'), legacy)
})

test('converts a blank legacy Markdown bookmark into a Windows Internet Shortcut', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-bookmark-cleanup-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  const created = await service.createIn(root, 'Bookmark cleanup vault')
  const link = await service.createUrl('https://example.com/reference')
  const shortcutPath = join(created.library.path, 'example.com.url')
  const markdownPath = join(created.library.path, 'example.com.md')
  await rm(shortcutPath)
  await writeFile(
    markdownPath,
    `---\nkuskus-id: "${link.id}"\nkuskus-type: link\nurl: "${link.sourceUrl}"\n---\n`,
    'utf8'
  )
  const recordPath = join(created.library.path, '.kuskus', 'records', `${link.id}.json`)
  const record = JSON.parse(await readFile(recordPath, 'utf8'))
  record.relativePath = 'example.com.md'
  record.metadata.relativePath = 'example.com.md'
  await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
  await rm(join(created.library.path, '.kuskus', 'migrations', 'visible-metadata-cleanup.json'), {
    force: true
  })

  const state = await service.getState()
  assert.equal(state.status, 'ready')
  assert.equal(existsSync(markdownPath), false)
  assert.equal(parseInternetShortcut(await readFile(shortcutPath, 'utf8')), link.sourceUrl)
  assert.equal(
    state.library.items.find((item) => item.id === link.id).relativePath,
    'example.com.url'
  )
})

test('parses Windows Internet Shortcuts case-insensitively and rejects unsafe URLs', () => {
  assert.equal(
    parseInternetShortcut('[internetshortcut]\nurl = https://example.com/path\n'),
    'https://example.com/path'
  )
  assert.equal(
    createInternetShortcut('https://example.com/'),
    '[InternetShortcut]\r\nURL=https://example.com/\r\n'
  )
  assert.throws(() => parseInternetShortcut('[InternetShortcut]\nURL=file:///C:/secret.txt'))
  assert.equal(removeKuskusFrontmatter('---\nkuskus-id: "id"\n---\nBody'), 'Body')
  assert.equal(
    removeKuskusFrontmatter('---\r\ntags: [keep]\r\nkuskus-id: "id"\r\n---\r\nBody'),
    '---\r\ntags: [keep]\r\n---\r\nBody'
  )
})

test('indexes an externally created Windows Internet Shortcut', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-external-shortcut-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const vault = join(root, 'Shortcut vault')
  await mkdir(vault)
  await writeFile(
    join(vault, 'OpenAI.url'),
    '[internetshortcut]\r\nurl=https://openai.com/\r\n',
    'utf8'
  )
  const service = new LibraryService(join(root, 'settings.json'))
  await service.openAt(vault)
  const state = await service.initializePendingVault()
  assert.equal(state.status, 'ready')
  assert.equal(state.library.items.length, 1)
  assert.equal(state.library.items[0].type, 'url')
  assert.equal(state.library.items[0].sourceUrl, 'https://openai.com/')
  assert.equal(state.library.items[0].relativePath, 'OpenAI.url')
})

test('leaves complex legacy bookmarks unchanged and reports a repair conflict', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-bookmark-conflict-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  const created = await service.createIn(root, 'Bookmark conflict vault')
  const link = await service.createUrl('https://example.com/complex')
  const shortcutPath = join(created.library.path, 'example.com.url')
  const markdownPath = join(created.library.path, 'example.com.md')
  await rm(shortcutPath)
  const legacy = `---\nkuskus-id: "${link.id}"\nkuskus-type: link\nurl: "${link.sourceUrl}"\ntags: [keep]\n---\nUser-authored annotation`
  await writeFile(markdownPath, legacy, 'utf8')
  const recordPath = join(created.library.path, '.kuskus', 'records', `${link.id}.json`)
  const record = JSON.parse(await readFile(recordPath, 'utf8'))
  record.relativePath = 'example.com.md'
  record.metadata.relativePath = 'example.com.md'
  await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
  await rm(join(created.library.path, '.kuskus', 'migrations', 'visible-metadata-cleanup.json'), {
    force: true
  })

  const state = await service.getState()
  assert.equal(state.status, 'ready')
  assert.equal(state.library.cleanup.status, 'conflicts')
  assert.equal(state.library.repairConflicts.length, 1)
  assert.equal(await readFile(markdownPath, 'utf8'), legacy)
  assert.equal(existsSync(shortcutPath), false)
})

test.skip('legacy v1: validates metadata and atomically finalizes an Inbox item', async (context) => {
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

test.skip('legacy v1: recovers an interrupted note directory swap before reading library state', async (context) => {
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

test.skip('legacy v1: recovers interrupted item move batches by phase before scanning the library', async (context) => {
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

test.skip('legacy v1: rolls back every item when a live batch move fails during commit', async (context) => {
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
  assert.equal(existsSync(join(libraryPath, 'Project', 'Original title.md')), true)

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
  const editedMarkdown = renamed.body.replace(
    '# Original title\nBody',
    '# A different derived title\nChanged'
  )
  const updated = await service.updateNote({
    itemId: note.id,
    markdown: editedMarkdown,
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
  assert.equal(existsSync(join(libraryPath, '.kuskus', 'trash', image.id)), false)

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

test('refuses to remove a folder with subfolders or unmanaged files before moving its items', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-folder-removal-guard-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  const created = await service.createIn(root, 'Folder Removal Guard Library')
  const libraryPath = created.library.path

  // A folder with a subfolder keeps its items and stays on disk.
  const parent = await service.createCollection({ name: 'Parent' })
  await service.createCollection({ name: 'Child', parentId: parent.id })
  const guarded = await service.createNote({ markdown: 'Do not relocate me', attachmentIds: [] })
  await service.moveItems({
    itemIds: [guarded.id],
    destination: { type: 'collection', collectionId: parent.id }
  })

  await assert.rejects(() => service.deleteCollection(parent.id), /subfolders/i)
  let library = await service.getState().then((state) => state.library)
  assert.equal(
    library.collections.some((entry) => entry.id === parent.id),
    true
  )
  assert.deepEqual(library.items.find((item) => item.id === guarded.id).location, {
    type: 'collection',
    collectionId: parent.id
  })
  assert.equal(existsSync(join(libraryPath, 'Parent', 'Child')), true)

  // A folder with files Kuskus does not index keeps its items and stays on disk.
  const cluttered = await service.createCollection({ name: 'Cluttered' })
  const stranded = await service.createNote({ markdown: 'Keep me here too', attachmentIds: [] })
  await service.moveItems({
    itemIds: [stranded.id],
    destination: { type: 'collection', collectionId: cluttered.id }
  })
  await writeFile(join(libraryPath, 'Cluttered', '.DS_Store'), 'noise')

  await assert.rejects(() => service.deleteCollection(cluttered.id), /does not manage/i)
  library = await service.getState().then((state) => state.library)
  assert.equal(
    library.collections.some((entry) => entry.id === cluttered.id),
    true
  )
  assert.deepEqual(library.items.find((item) => item.id === stranded.id).location, {
    type: 'collection',
    collectionId: cluttered.id
  })

  // A note's companion assets directory travels with it and never blocks removal.
  const portable = await service.createCollection({ name: 'Portable' })
  const note = await service.createNote({ markdown: 'Note with assets', attachmentIds: [] })
  await service.moveItems({
    itemIds: [note.id],
    destination: { type: 'collection', collectionId: portable.id }
  })
  const noteRecord = (await service.getState().then((state) => state.library)).items.find(
    (item) => item.id === note.id
  )
  const assetsRelative = noteRecord.relativePath.replace(/\.md$/, '.assets')
  await mkdir(join(libraryPath, assetsRelative), { recursive: true })
  await writeFile(join(libraryPath, assetsRelative, 'pixel.png'), 'png-bytes')

  library = await service.deleteCollection(portable.id)
  assert.equal(
    library.collections.some((entry) => entry.id === portable.id),
    false
  )
  const relocated = library.items.find((item) => item.id === note.id)
  assert.deepEqual(relocated.location, { type: 'inbox' })
  const relocatedAssets = relocated.relativePath.replace(/\.md$/, '.assets')
  assert.equal(existsSync(join(libraryPath, relocatedAssets, 'pixel.png')), true)
})

test('serves a rebuildable cached snapshot and reconciles an edit made while closed', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-index-cache-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const settingsPath = join(root, 'settings.json')
  const service = new LibraryService(settingsPath)
  const created = await service.createIn(root, 'Vault')
  assert.equal(created.status, 'ready')
  const note = await service.createNote({
    markdown: '# Cached note\n\nOriginal body.',
    attachmentIds: []
  })
  await service.getState()

  const indexPath = join(created.library.path, '.kuskus', 'index', 'library-v1.json')
  assert.equal((await stat(indexPath)).isFile(), true)

  const reopened = new LibraryService(settingsPath)
  await reopened.initialize()
  await writeFile(
    join(created.library.path, note.relativePath),
    '# Cached note\n\nChanged outside Kuskus.'
  )

  const cached = await reopened.getState(true)
  assert.equal(cached.status, 'ready')
  assert.equal(
    cached.library.items.find((item) => item.id === note.id).body.includes('Original'),
    true
  )

  const reconciled = await reopened.reconcileState()
  assert.equal(reconciled.status, 'ready')
  assert.equal(
    reconciled.library.items.find((item) => item.id === note.id).body.includes('Changed outside'),
    true
  )
})

test('ignores and repairs a corrupt rebuildable library snapshot', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-index-repair-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const settingsPath = join(root, 'settings.json')
  const service = new LibraryService(settingsPath)
  const created = await service.createIn(root, 'Vault')
  assert.equal(created.status, 'ready')
  const note = await service.createNote({ markdown: '# Rebuild me', attachmentIds: [] })
  await service.getState()

  const indexPath = join(created.library.path, '.kuskus', 'index', 'library-v1.json')
  await writeFile(indexPath, '{not valid json')
  const reopened = new LibraryService(settingsPath)
  await reopened.initialize()
  const state = await reopened.getState(true)
  assert.equal(state.status, 'ready')
  assert.equal(
    state.library.items.some((item) => item.id === note.id),
    true
  )
  assert.equal(JSON.parse(await readFile(indexPath, 'utf8')).schemaVersion, 1)
})

test('keeps overview payloads bounded while querying and loading exact note detail', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-overview-query-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  await service.createIn(root, 'Vault')
  const markdown = `# Long note\n\n${'preview text '.repeat(300)}unique-tail-needle`
  const note = await service.createNote({ markdown, attachmentIds: [] })

  const overview = await service.getOverviewState()
  assert.equal(overview.status, 'ready')
  const summary = overview.library.items.find((item) => item.id === note.id)
  assert.equal(summary.type, 'note')
  assert.equal(summary.previewMarkdown.length, 2400)
  assert.equal(summary.previewMarkdown.includes('unique-tail-needle'), false)

  const query = await service.queryItems({ query: 'unique-tail-needle' })
  assert.deepEqual(query.itemIds, [note.id])
  assert.equal((await service.getItemDetail(note.id)).body, markdown)
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
  assert.equal(state.library.items.length, 27)
  assert.equal(state.library.collections.length, 5)
  assert.deepEqual(
    state.library.collections.map((collection) => collection.name),
    ['Kuskus', 'Interface references', 'Research', 'Writing', 'Markdown Lab']
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
    (item) => item.type === 'note' && item.title === 'This week — close the capture loop'
  )
  assert.ok(attachedNote)
  assert.equal(attachedNote.title, 'This week \u2014 close the capture loop')
  assert.equal(attachedNote.attachments.length, 1)
  assert.equal(attachedNote.attachments[0].missingContent, false)
  assert.equal(existsSync(join(libraryPath, attachedNote.attachments[0].filename)), true)
  assert.equal(
    existsSync(join(libraryPath, 'Kuskus', 'Product direction that still feels true.md')),
    true
  )
  assert.equal(
    existsSync(
      join(
        libraryPath,
        '.kuskus',
        'trash',
        '50000000-0000-4000-8000-000000000001',
        'Old tagline directions.md'
      )
    ),
    true
  )

  const markdownLabPath = join(libraryPath, 'Markdown Lab')
  const guidePath = join(markdownLabPath, '00 — Markdown Lab guide.md')
  const typographyPath = join(markdownLabPath, '01 — Typography and blocks.md')
  const listsPath = join(markdownLabPath, '02 — Lists, tasks, and tables.md')
  const linksPath = join(markdownLabPath, '03 — Links, wikilinks, and images.md')
  const codePath = join(markdownLabPath, '04 — Code and mathematics.md')
  const stressPath = join(markdownLabPath, '99 — Long mixed-content stress test.md')
  const expectedLabNotes = [guidePath, typographyPath, listsPath, linksPath, codePath, stressPath]
  assert.equal(
    expectedLabNotes.every((path) => existsSync(path)),
    true
  )

  const guide = await readFile(guidePath, 'utf8')
  const typography = await readFile(typographyPath, 'utf8')
  const lists = await readFile(listsPath, 'utf8')
  const links = await readFile(linksPath, 'utf8')
  const code = await readFile(codePath, 'utf8')
  const stress = await readFile(stressPath, 'utf8')
  assert.match(guide, /^---\nfixture: markdown-lab/m)
  assert.match(typography, /###### Heading level six/)
  assert.match(lists, /\| :-- \| :--: \| --: \|/)
  assert.match(links, /!\[Intentionally missing image\]\(\.\/missing-image\.png\)/)
  assert.match(links, /!\[Detailed Markdown sample\]\(\.\/Markdown%20sample%20%28detail%29\.png\)/)
  assert.match(code, /\$\$\n\\int_\{-\\infty\}/)
  assert.ok(stress.length > 12_000)
  assert.match(stress, /## Stress section 16/)

  const spacedAttachment = join(markdownLabPath, 'Markdown sample wide.png')
  const parenthesizedAttachment = join(markdownLabPath, 'Markdown sample (detail).png')
  assert.equal(existsSync(spacedAttachment), true)
  assert.equal(existsSync(parenthesizedAttachment), true)
  assert.equal(existsSync(join(markdownLabPath, 'missing-image.png')), false)

  const labCollection = JSON.parse(
    await readFile(
      join(libraryPath, '.kuskus', 'collections', '20000000-0000-4000-8000-000000000005.json'),
      'utf8'
    )
  )
  assert.equal(labCollection.name, 'Markdown Lab')
  assert.equal(labCollection.relativePath, 'Markdown Lab')

  for (let index = 1; index <= 8; index += 1) {
    const recordPath = join(
      libraryPath,
      '.kuskus',
      'records',
      `70000000-0000-4000-8000-${String(index).padStart(12, '0')}.json`
    )
    const record = JSON.parse(await readFile(recordPath, 'utf8'))
    const resolvedItemPath = resolve(libraryPath, record.relativePath)
    assert.equal(relative(libraryPath, resolvedItemPath).startsWith('..'), false)
    assert.equal(record.relativePath.startsWith('Markdown Lab/'), true)
  }
  const librarySentinel = join(libraryPath, 'preserve-without-reset.txt')
  const profileSentinel = join(userDataPath, 'stale-profile-state')
  await writeFile(librarySentinel, 'keep')
  await writeFile(profileSentinel, 'stale')
  await writeFile(typographyPath, `${typography}\nLOCAL MARKDOWN LAB EDIT\n`)
  await seedDemoEnvironment({ root })
  assert.equal(existsSync(librarySentinel), true)
  assert.equal(existsSync(profileSentinel), true)
  assert.match(await readFile(typographyPath, 'utf8'), /LOCAL MARKDOWN LAB EDIT/)

  const reset = await seedDemoEnvironment({ root, reset: true })
  assert.equal(reset.libraryPath, libraryPath)
  assert.equal(existsSync(librarySentinel), false)
  assert.equal(existsSync(profileSentinel), false)
  assert.equal(existsSync(join(reset.libraryPath, '.kuskus', 'library.json')), true)
  assert.doesNotMatch(await readFile(typographyPath, 'utf8'), /LOCAL MARKDOWN LAB EDIT/)
})
