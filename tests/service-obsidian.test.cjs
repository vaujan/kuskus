const assert = require('node:assert/strict')
const { existsSync } = require('node:fs')
const { mkdir, mkdtemp, readFile, rename, rm, unlink, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const { LibraryService } = require('../src/main/library/library-service.ts')
const { createNoteMetadata } = require('../src/main/library/items/note-item.ts')
const { createUrlMetadata } = require('../src/main/library/items/url-item.ts')
const { parseInternetShortcut } = require('../src/main/library/internet-shortcut.ts')
const {
  prepareObsidianMarkdown
} = require('../src/renderer/src/features/items/obsidian-markdown.ts')

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL88wAAAABJRU5ErkJggg==',
  'base64'
)

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
