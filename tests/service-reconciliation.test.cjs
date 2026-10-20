const assert = require('node:assert/strict')
const { existsSync } = require('node:fs')
const { mkdtemp, readFile, rm, stat, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join, relative, resolve } = require('node:path')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const { LibraryService } = require('../src/main/library/library-service.ts')
const { LIBRARY_NAME, seedDemoEnvironment } = require('../scripts/create-demo-library.cjs')

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

test('reconciles a dirty vault before applying a cached mutation', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-dirty-mutation-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  const created = await service.createIn(root, 'Vault')
  const note = await service.createNote({ markdown: '# Existing note', attachmentIds: [] })
  await service.getState()

  await writeFile(join(created.library.path, 'External note.md'), '# Added outside Kuskus')
  service.vaultDirty = true
  const library = await service.renameItem({ itemId: note.id, title: 'Renamed note' })

  assert.equal(
    library.items.some((item) => item.title === 'External note'),
    true
  )
  assert.equal(library.items.find((item) => item.id === note.id).title, 'Renamed note')
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
  assert.equal(state.library.items.length, 28)
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
  const indentationPath = join(markdownLabPath, '05 — Live indentation guides.md')
  const stressPath = join(markdownLabPath, '99 — Long mixed-content stress test.md')
  const expectedLabNotes = [
    guidePath,
    typographyPath,
    listsPath,
    linksPath,
    codePath,
    indentationPath,
    stressPath
  ]
  assert.equal(
    expectedLabNotes.every((path) => existsSync(path)),
    true
  )

  const guide = await readFile(guidePath, 'utf8')
  const typography = await readFile(typographyPath, 'utf8')
  const lists = await readFile(listsPath, 'utf8')
  const links = await readFile(linksPath, 'utf8')
  const code = await readFile(codePath, 'utf8')
  const indentation = await readFile(indentationPath, 'utf8')
  const stress = await readFile(stressPath, 'utf8')
  assert.match(guide, /^---\nfixture: markdown-lab/m)
  assert.match(typography, /###### Heading level six/)
  assert.match(lists, /\| :-- \| :--: \| --: \|/)
  assert.match(links, /!\[Intentionally missing image\]\(\.\/missing-image\.png\)/)
  assert.match(links, /!\[Detailed Markdown sample\]\(\.\/Markdown%20sample%20%28detail%29\.png\)/)
  assert.match(code, /\$\$\n\\int_\{-\\infty\}/)
  assert.match(indentation, /^fixture: live-indentation-guides$/m)
  assert.match(indentation, /The guide should continue through the blank line/)
  assert.match(indentation, /function collectGroups\(groups: string\[\]\[\]\)/)
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

  for (let index = 1; index <= 9; index += 1) {
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

test('note autosave does not expose its backup or trigger a full watched-vault rebuild', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-watched-autosave-'))
  let unsubscribe = () => {}
  context.after(async () => {
    unsubscribe()
    await rm(root, { recursive: true, force: true })
  })
  const service = new LibraryService(join(root, 'settings.json'))
  await service.createIn(root, 'Vault')
  const note = await service.createNote({ markdown: '# Note\n\nBefore', attachmentIds: [] })
  await service.getState()
  let fullRebuilds = 0
  const build = service.store.buildLibraryDto.bind(service.store)
  service.store.buildLibraryDto = async (...args) => {
    fullRebuilds += 1
    return build(...args)
  }
  unsubscribe = service.onVaultChanged(() => {})
  await service.updateNote({
    itemId: note.id,
    expectedMarkdown: '# Note\n\nBefore',
    markdown: '# Note\n\nAfter'
  })
  await new Promise((resolve) => setTimeout(resolve, 1000))
  const state = await service.getState(true)
  assert.equal(state.status, 'ready')
  assert.equal(state.library.items.length, 1)
  assert.equal(state.library.items[0].body, '# Note\n\nAfter')
  assert.equal(fullRebuilds, 0)
})
