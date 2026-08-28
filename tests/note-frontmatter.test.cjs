const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const { noteFrontmatterSource, parseNoteFrontmatter } = require('../src/shared/note-frontmatter.ts')
const {
  NOTE_INLINE_TITLE_STORAGE_KEY,
  parseNoteInlineTitle
} = require('../src/renderer/src/features/items/note-inline-title.ts')

test('distinguishes missing, empty, valid, and malformed frontmatter', () => {
  assert.deepEqual(parseNoteFrontmatter('# No properties'), { status: 'none' })
  assert.deepEqual(parseNoteFrontmatter('---\n---\nBody'), {
    status: 'valid',
    endOffset: 8,
    properties: []
  })

  const parsed = parseNoteFrontmatter(
    '---\ntitle: YAML title\npublished: 2026-08-12\nfeatured: true\nrating: 5\ntags: [one, two]\n---\nBody'
  )
  assert.equal(parsed.status, 'valid')
  assert.deepEqual(
    parsed.properties.map(({ key, type }) => [key, type]),
    [
      ['title', 'text'],
      ['published', 'date'],
      ['featured', 'boolean'],
      ['rating', 'number'],
      ['tags', 'list']
    ]
  )

  assert.equal(parseNoteFrontmatter('---\ntags: [unfinished\n---\nBody').status, 'invalid')
  assert.equal(parseNoteFrontmatter('---\n- not\n- a map\n---\nBody').status, 'invalid')
  assert.equal(parseNoteFrontmatter('---\ntitle: one\ntitle: two\n---\nBody').status, 'invalid')
})

test('exposes the raw YAML body for the frontmatter code block', () => {
  assert.equal(noteFrontmatterSource('# No properties'), null)
  assert.equal(noteFrontmatterSource('---\ntags: [broken\n---\nBody'), null)

  const source = noteFrontmatterSource('---\ntitle: YAML title\ntags: [one, two]\n---\nBody')
  assert.deepEqual(source, {
    yaml: 'title: YAML title\ntags: [one, two]\n',
    endOffset: 43
  })

  const empty = noteFrontmatterSource('---\n---\nBody')
  assert.deepEqual(empty, { yaml: '', endOffset: 8 })
})

test('inline title is a default-on persistent note preference', () => {
  assert.equal(NOTE_INLINE_TITLE_STORAGE_KEY, 'kuskus-note-inline-title')
  assert.equal(parseNoteInlineTitle(null), true)
  assert.equal(parseNoteInlineTitle('true'), true)
  assert.equal(parseNoteInlineTitle('false'), false)
})

test('note detail uses inline document blocks and detail-only view settings', () => {
  const detail = readFileSync(
    require.resolve('../src/renderer/src/features/items/item-detail-dialog.tsx'),
    'utf8'
  )
  const menu = readFileSync(
    require.resolve('../src/renderer/src/features/items/item-action-menu.tsx'),
    'utf8'
  )
  assert.doesNotMatch(detail, /NoteIdentityControls|NoteMetadataControls/)
  assert.doesNotMatch(detail, /Wide reading width/)
  assert.match(detail, /<NoteDocumentBlocks/)
  assert.match(detail, /<MarkdownFrontmatterBlock/)
  assert.match(detail, /<NoteLiveEditor/)
  assert.match(detail, /NOTE_INLINE_TITLE_STORAGE_KEY/)
  assert.match(menu, /Readable line length/)
  assert.match(menu, /Inline title/)
  assert.match(menu, /surface === 'dropdown' && props\.detailOptions/)
})
