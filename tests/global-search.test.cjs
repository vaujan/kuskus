const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { mkdtemp, rm } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const { LibraryService } = require('../src/main/library/library-service.ts')
const {
  addRecentSearchItem,
  resolveRecentSearchItems
} = require('../src/renderer/src/features/search/global-search-state.ts')

test('global search matches every query term and ranks title matches before body matches', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-global-search-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new LibraryService(join(root, 'settings.json'))
  await service.createIn(root, 'Vault')

  const bodyMatch = await service.createNote({
    markdown: '# References\n\nA blue comparison of every pricing page.',
    attachmentIds: []
  })
  const titleMatch = await service.createNote({
    markdown: '# Blue pricing\n\nFinal direction.',
    attachmentIds: []
  })
  await service.createNote({
    markdown: '# Blue homepage\n\nNo commercial details.',
    attachmentIds: []
  })

  const result = await service.queryItems({ query: 'blue pricing' })

  assert.deepEqual(result.itemIds, [titleMatch.id, bodyMatch.id])
})

test('recent search items are unique, bounded, ordered, and omit internal attachments', () => {
  let recent = []
  for (let index = 0; index < 10; index += 1) {
    recent = addRecentSearchItem(recent, `item-${index}`)
  }
  recent = addRecentSearchItem(recent, 'item-5')

  assert.deepEqual(recent, [
    'item-5',
    'item-9',
    'item-8',
    'item-7',
    'item-6',
    'item-4',
    'item-3',
    'item-2'
  ])

  const items = [
    { id: 'item-9', referencedAttachment: false },
    { id: 'item-5', referencedAttachment: false },
    { id: 'item-8', referencedAttachment: true }
  ]
  assert.deepEqual(
    resolveRecentSearchItems(items, recent).map((item) => item.id),
    ['item-5', 'item-9']
  )
})

test('global search uses a left-column input and a full content preview', () => {
  const dialog = readFileSync(
    require.resolve('../src/renderer/src/features/search/global-search-dialog.tsx'),
    'utf8'
  )
  const preview = readFileSync(
    require.resolve('../src/renderer/src/features/search/global-search-preview.tsx'),
    'utf8'
  )

  assert.match(dialog, /grid-rows-\[auto_minmax\(0,1fr\)\]/)
  assert.match(dialog, /<GlobalSearchPreview/)
  assert.match(dialog, /<ScrollArea/)
  assert.doesNotMatch(dialog, /SavedItemCard/)
  assert.match(preview, /getItemDetail\(item\.id\)/)
  assert.match(preview, /presentation="detail"/)
  assert.match(preview, /<ScrollArea/)
  assert.match(preview, /className="flex h-11/)
})

test('dialog surfaces open without animation and dim without backdrop blur', () => {
  const dialog = readFileSync(
    require.resolve('../src/renderer/src/components/ui/dialog.tsx'),
    'utf8'
  )
  const alertDialog = readFileSync(
    require.resolve('../src/renderer/src/components/ui/alert-dialog.tsx'),
    'utf8'
  )

  assert.doesNotMatch(dialog, /backdrop-blur|data-open:animate-in|zoom-in/)
  assert.doesNotMatch(alertDialog, /backdrop-blur/)
})
