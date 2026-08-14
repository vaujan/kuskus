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
  assert.match(plugin, /const current = currentSlashState\(view\.state\)/)
  assert.match(plugin, /current\.query !== state\.query/)
})

test('async image paste never edits a stale selection', () => {
  const source = readFileSync(
    require.resolve('../src/renderer/src/features/items/markdown-editor.tsx'),
    'utf8'
  )
  const rich = readFileSync(
    require.resolve('../src/renderer/src/features/items/rich-markdown-editor.tsx'),
    'utf8'
  )

  assert.match(source, /editor\.state\.doc === pastedInto/)
  assert.match(source, /viewRef\.current !== editor/)
  assert.match(rich, /view\.state\.doc === pastedInto/)
  assert.match(rich, /view\.isDestroyed/)
  assert.match(rich, /replaceRangeWith\(from, to, image\)/)
  assert.match(rich, /imageRefreshersRef\.current\.forEach/)
  assert.match(rich, /image\.width = resolution\.width/)
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

test('Markdown media renders remote images and keeps block math visually distinct', () => {
  const richEditor = readFileSync(
    require.resolve('../src/renderer/src/features/items/rich-markdown-editor.tsx'),
    'utf8'
  )
  const preview = readFileSync(
    require.resolve('../src/renderer/src/features/items/markdown-preview.tsx'),
    'utf8'
  )
  const styles = readFileSync(require.resolve('../src/renderer/src/assets/markdown.css'), 'utf8')
  const html = readFileSync(require.resolve('../src/renderer/index.html'), 'utf8')

  assert.match(preview, /referrerPolicy="no-referrer"/)
  assert.match(preview, /className="kuskus-markdown-image"/)
  assert.match(richEditor, /image\.referrerPolicy = 'no-referrer'/)
  assert.match(richEditor, /image\.src = resolution\?\.src \?\? target/)
  assert.match(html, /img-src 'self' data: blob: https: http:/)
  assert.match(styles, /\.kuskus-typeset \.katex-display/)
  assert.match(styles, /\[data-rich-math='block'\]/)
  assert.match(styles, /\.kuskus-task-checkbox:checked::after/)
})
