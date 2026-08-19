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
    /if \(activeRef\.current && editableRef\.current\) \{\s+const cursorOffset = preserveCursorOffsetRef\?\.current \?\? null/
  )
  assert.match(source, /EditorSelection\.cursor\(head\)/)
  assert.match(plugin, /selection\.empty/)
  assert.match(plugin, /class: 'kuskus-rich-active-line'/)
})

test('entering live editing restores the cursor to the visible region, not the document start', () => {
  const rich = readFileSync(
    require.resolve('../src/renderer/src/features/items/rich-markdown-editor.tsx'),
    'utf8'
  )

  assert.match(
    rich,
    /const restorePoint = restoreScrollPosition \? richMarkdownScrollRestorePoint\(view\) : null/
  )
  assert.match(rich, /const target = restorePoint \?\? view\.state\.selection\.head/)
  assert.match(rich, /richMarkdownScrollRestorePoint\(view\)/)
  assert.match(rich, /const candidates: Array<\[number, number\]>/)
  assert.match(rich, /for \(const verticalFraction of \[0\.5, 0\.25, 0\.75, 0\.15, 0\.85\]\)/)
  assert.match(rich, /for \(const horizontalFraction of \[0\.3, 0\.5, 0\.7\]\)/)
  assert.match(
    rich,
    /candidates\.push\(\[contentLeft, rect\.top \+ rect\.height \* verticalFraction\]\)/
  )
  assert.match(
    rich,
    /\[rect\.left \+ rect\.width \* horizontalFraction, rect\.top \+ rect\.height \/ 2\]/
  )
  assert.match(rich, /const at = view\.posAtCoords\(\{ left, top \}\)/)
  assert.match(rich, /if \(at\) return at\.pos/)
  assert.doesNotMatch(rich, /at\.inside >= 0/)
  assert.doesNotMatch(rich, /contentTop/)
  assert.doesNotMatch(rich, /targetScrollTop/)
})

test('live editing restores the preserved scroll offset before placing the cursor', () => {
  const rich = readFileSync(
    require.resolve('../src/renderer/src/features/items/rich-markdown-editor.tsx'),
    'utf8'
  )
  const dialog = readFileSync(
    require.resolve('../src/renderer/src/features/items/item-detail-dialog.tsx'),
    'utf8'
  )

  assert.match(rich, /preserveScrollTopRef\?: React\.RefObject<number> \| null/)
  assert.match(rich, /preserveCursorOffsetRef\?: React\.RefObject<number \| null> \| null/)
  assert.match(rich, /const publishedRef = useRef<string \| null>\(value\)/)
  assert.match(
    rich,
    /const cursorOffset = preserveCursorOffsetRef\?\.current \?\? null[\s\S]*?focusRichMarkdownEditor\(editor, false, null, cursorOffset, valueRef\.current\)/
  )
  assert.match(rich, /viewport\.scrollTop = Math\.min\(preserveScrollTop, maxScrollTop\)/)
  assert.match(dialog, /const noteScrollTopRef = useRef\(0\)/)
  assert.match(dialog, /const noteCursorOffsetRef = useRef<number \| null>\(null\)/)
  assert.match(dialog, /viewport\.addEventListener\('scroll', handleScroll, \{ passive: true \}\)/)
  assert.match(dialog, /preserveScrollTopRef=\{noteScrollTopRef\}/)
  assert.match(dialog, /preserveCursorOffsetRef=\{noteCursorOffsetRef\}/)
})

test('cursor persistence maps the caret through a source-markdown sentinel round trip', () => {
  const {
    createCursorMarker,
    clampCursorOffset
  } = require('../src/renderer/src/features/items/note-cursor.ts')
  const rich = readFileSync(
    require.resolve('../src/renderer/src/features/items/rich-markdown-editor.tsx'),
    'utf8'
  )
  const dialog = readFileSync(
    require.resolve('../src/renderer/src/features/items/item-detail-dialog.tsx'),
    'utf8'
  )

  assert.match(rich, /richMarkdownCursorOffset\(/)
  assert.match(rich, /insertText\(marker, head, head\)/)
  assert.match(rich, /ctx\.get\(serializerCtx\)\(markerDoc\)/)
  assert.match(rich, /getCursorOffset: \(\) =>/)
  assert.match(rich, /setCursorOffset: \(offset\) =>/)
  assert.match(rich, /doc\.descendants\(\(node, nodePos\) => \{\s+if \(!node\.isText\) return true/)
  assert.match(
    dialog,
    /noteCursorCaptureRef\.current = \(\) => \{\s+if \(mode === 'live'\) return richEditorRef\.current\?\.getCursorOffset\(\) \?\? null\s+if \(mode === 'markdown' \|\| mode === 'split'\) \{\s+return editorRef\.current\?\.getCursorOffset\(\) \?\? null\s+\}\s+return null\s+\}/
  )
  assert.match(dialog, /const captured = noteCursorCaptureRef\.current\?\.\(\) \?\? null/)
  assert.match(dialog, /if \(captured != null\) noteCursorOffsetRef\.current = captured/)
  assert.match(dialog, /editorRef\.current\?\.setCursorOffset\(offset\)/)

  const marker = createCursorMarker()
  const source = 'line one\nline two\nline three\n'
  assert.equal(clampCursorOffset(source, 100), source.length)
  assert.equal(clampCursorOffset(source, -5), 0)
  assert.equal(clampCursorOffset(source, 9), 9)
  assert.ok(marker.length > 0)
  assert.ok(!marker.includes('\u0000'))
  assert.match(marker, /^KUSKUSCURSOR[a-z0-9]+$/)
})

test('a changed value reference must not reset the editor selection to the document start', () => {
  const rich = readFileSync(
    require.resolve('../src/renderer/src/features/items/rich-markdown-editor.tsx'),
    'utf8'
  )

  assert.match(rich, /const publishedRef = useRef<string \| null>\(value\)/)
  assert.match(
    rich,
    /useEffect\(\(\) => \{\s+const editor = editorRef\.current\s+if \(!editor\) return\s+if \(publishedRef\.current === value\) return\s+const source = partitionRichMarkdownSource\(value\)\s+if \(!source \|\| !supportsRichMarkdown\(source\.body\)\) return\s+editor\.action\(replaceAll\(prepareRichMarkdown\(source\.body\), true\)\)\s+publishedRef\.current = value\s+\}, \[value\]\)/
  )
  assert.match(
    rich,
    /editor\.action\(replaceAll\(prepareRichMarkdown\(current\.body\), true\)\)\s+publishedRef\.current = current\.prefix \+ current\.body/
  )
  assert.doesNotMatch(rich, /publishedRef\.current = null/)
  assert.doesNotMatch(rich, /restore-debug/)
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
  const {
    highlightedCodeRanges,
    isMermaidLanguage
  } = require('../src/renderer/src/features/items/markdown-code.ts')
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
  assert.equal(isMermaidLanguage('mermaid'), true)
  assert.equal(isMermaidLanguage('typescript'), false)
  assert.match(richEditor, /\.use\(richMarkdownCode\)/)
  assert.match(preview, /<MarkdownCodeBlock/)
  assert.match(sourceEditor, /codeLanguages: markdownCodeLanguage/)
})

test('Mermaid code blocks render diagrams lazily and safely', () => {
  const codeBlock = readFileSync(
    require.resolve('../src/renderer/src/features/items/markdown-code-block.tsx'),
    'utf8'
  )
  const mermaid = readFileSync(
    require.resolve('../src/renderer/src/features/items/markdown-mermaid.tsx'),
    'utf8'
  )

  assert.match(codeBlock, /diagrams && isMermaidLanguage\(language\)/)
  assert.match(codeBlock, /<MarkdownMermaid code=\{code\}/)
  assert.match(
    readFileSync(
      require.resolve('../src/renderer/src/features/items/markdown-preview.tsx'),
      'utf8'
    ),
    /diagrams=\{presentation === 'detail'\}/
  )
  assert.match(mermaid, /await import\('mermaid'\)/)
  assert.match(mermaid, /securityLevel: 'strict'/)
  assert.match(mermaid, /suppressErrorRendering: true/)
  assert.match(mermaid, /Mermaid · Invalid diagram/)
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

  assert.match(preview, /function MarkdownImage/)
  assert.match(preview, /className="not-typeset kuskus-markdown-image-button"/)
  assert.match(preview, /interactive=\{presentation === 'detail'\}/)
  assert.match(richEditor, /button\.className = 'kuskus-markdown-image-button'/)
  assert.match(richEditor, /image\.src = resolution\?\.src \?\? target/)
  assert.match(html, /img-src 'self' data: blob: https: http:/)
  assert.match(styles, /\.kuskus-typeset \.katex-display/)
  assert.match(styles, /\[data-rich-math='block'\]/)
  assert.match(styles, /\.kuskus-task-checkbox:checked::after/)
  assert.match(styles, /\.kuskus-markdown-image-caption[\s\S]*font-size: 0\.75rem/)
  assert.match(styles, /\.kuskus-markdown-image-caption[\s\S]*text-align: center/)
  assert.match(styles, /\.kuskus-markdown-image-button\[data-zoomed='true'\]/)
})
