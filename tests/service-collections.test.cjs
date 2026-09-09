const assert = require('node:assert/strict')
const { existsSync } = require('node:fs')
const { mkdir, mkdtemp, readFile, rm, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const { LibraryService } = require('../src/main/library/library-service.ts')
const { COLLECTION_ICON_KEYS } = require('../src/shared/library-contract.ts')

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL88wAAAABJRU5ErkJggg==',
  'base64'
)

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function arrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

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
  assert.equal(updated.titleSource, 'custom')

  library = await service.renameItem({ itemId: note.id, titleSource: 'derived' })
  const derivedAgain = library.items.find((item) => item.id === note.id)
  assert.equal(derivedAgain.title, 'A different derived title')
  assert.equal(derivedAgain.titleSource, 'derived')

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
    'A different derived title'
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
