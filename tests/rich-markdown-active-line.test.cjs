const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')

test('source and live writing modes highlight the active line', () => {
  const source = readFileSync(
    require.resolve('../src/renderer/src/features/items/markdown-editor.tsx'),
    'utf8'
  )
  const rich = readFileSync(
    require.resolve('../src/renderer/src/features/items/rich-markdown-editor.tsx'),
    'utf8'
  )
  const plugin = readFileSync(
    require.resolve('../src/renderer/src/features/items/rich-markdown-active-line.ts'),
    'utf8'
  )

  assert.match(source, /highlightActiveLine\(\)/)
  assert.match(source, /cm-focused \.cm-activeLine/)
  assert.match(rich, /presentation === 'detail'\) editor\.use\(richMarkdownActiveLine\)/)
  assert.match(
    rich,
    /if \(activeRef\.current && editableRef\.current\) focusRichMarkdownEditor\(editor\)/
  )
  assert.match(source, /EditorSelection\.cursor\(head\)/)
  assert.match(plugin, /selection\.empty/)
  assert.match(plugin, /class: 'kuskus-rich-active-line'/)
})

test('slash formatting opens only for an active slash query', () => {
  const {
    findRichMarkdownSlashQuery
  } = require('../src/renderer/src/features/items/rich-markdown-slash.ts')

  assert.equal(findRichMarkdownSlashQuery('/'), '')
  assert.equal(findRichMarkdownSlashQuery('Start /head'), 'head')
  assert.equal(findRichMarkdownSlashQuery('https://example.com'), null)
  assert.equal(findRichMarkdownSlashQuery('/heading done'), null)

  const plugin = readFileSync(
    require.resolve('../src/renderer/src/features/items/rich-markdown-slash-menu-plugin.ts'),
    'utf8'
  )
  assert.match(plugin, /if \(!match\) \{\s+dismissed = ''/)
})

test('code blocks are syntax highlighted in previews and both note editors', () => {
  const { highlightedCodeRanges } = require('../src/renderer/src/features/items/markdown-code.ts')
  const richEditor = readFileSync(
    require.resolve('../src/renderer/src/features/items/rich-markdown-editor.tsx'),
    'utf8'
  )
  const preview = readFileSync(
    require.resolve('../src/renderer/src/features/items/markdown-preview.tsx'),
    'utf8'
  )
  const sourceEditor = readFileSync(
    require.resolve('../src/renderer/src/features/items/markdown-editor.tsx'),
    'utf8'
  )

  const ranges = highlightedCodeRanges("const answer: number = 'yes'", 'typescript')
  assert.ok(ranges.some((range) => range.classes.includes('tok-keyword')))
  assert.ok(ranges.some((range) => range.classes.includes('tok-string')))
  assert.deepEqual(highlightedCodeRanges('print(1)', 'python'), [])
  assert.match(richEditor, /\.use\(richMarkdownCode\)/)
  assert.match(preview, /<MarkdownCodeBlock/)
  assert.match(sourceEditor, /codeLanguages: markdownCodeLanguage/)
})
