const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
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
  editNoteFrontmatter,
  parseNoteFrontmatter,
  valueForNotePropertyType
} = require('../src/shared/note-frontmatter.ts')
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

test('edits existing properties while preserving comments, order, and body', () => {
  const source = '---\n# keep this\ntitle: YAML title\ntags: [one, two]\n---\n# Body\n'
  const edited = editNoteFrontmatter(source, {
    type: 'set',
    key: 'title',
    value: 'Different from the file title'
  })
  assert.equal(edited.ok, true)
  assert.match(edited.value, /# keep this/)
  assert.match(edited.value, /title: Different from the file title/)
  assert.match(edited.value, /tags: \[ ?one, two ?\]/)
  assert.match(edited.value, /---\n# Body\n$/)

  const renamed = editNoteFrontmatter(edited.value, {
    type: 'rename',
    key: 'tags',
    nextKey: 'topics'
  })
  assert.equal(renamed.ok, true)
  assert.deepEqual(
    parseNoteFrontmatter(renamed.value).properties.map(({ key }) => key),
    ['title', 'topics']
  )

  const added = editNoteFrontmatter(renamed.value, { type: 'add' })
  assert.equal(added.ok, true)
  assert.equal(added.key, 'property')
  const removed = editNoteFrontmatter(added.value, { type: 'delete', key: 'property' })
  assert.equal(removed.ok, true)
  assert.doesNotMatch(removed.value, /^property:/m)
})

test('rejects UI edits without valid existing frontmatter', () => {
  assert.deepEqual(editNoteFrontmatter('Body', { type: 'add' }), {
    ok: false,
    value: 'Body',
    error: 'This note has no frontmatter.'
  })
  assert.equal(editNoteFrontmatter('---\ntags: [broken\n---\nBody', { type: 'add' }).ok, false)
})

test('converts values for supported property types', () => {
  assert.equal(valueForNotePropertyType('number', '4'), 4)
  assert.equal(valueForNotePropertyType('boolean', ''), false)
  assert.deepEqual(valueForNotePropertyType('list', 'one'), ['one'])
  assert.equal(valueForNotePropertyType('empty', 'ignored'), null)
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
  assert.match(detail, /<RichMarkdownEditor/)
  assert.match(detail, /NOTE_INLINE_TITLE_STORAGE_KEY/)
  assert.match(menu, /Readable line length/)
  assert.match(menu, /Inline title/)
  assert.match(menu, /surface === 'dropdown' && props\.detailOptions/)
})
