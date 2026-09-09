const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')

const previewSource = readFileSync(
  require.resolve('../src/renderer/src/features/items/live/atomic/inline-preview.ts'),
  'utf8'
)
const readPreviewSource = readFileSync(
  require.resolve('../src/renderer/src/features/items/markdown-preview.tsx'),
  'utf8'
)
const presentationStyles = readFileSync(
  require.resolve('../src/renderer/src/assets/markdown-presentation.css'),
  'utf8'
)
const liveStyles = readFileSync(
  require.resolve('../src/renderer/src/assets/live-markdown-editor.css'),
  'utf8'
)

test('live list markers use read-mode geometry and rendered ordered numerals', () => {
  assert.match(previewSource, /var\(--typeset-list-leading\)/)
  assert.match(previewSource, /var\(--typeset-list-marker-column\)/)
  assert.match(previewSource, /var\(--typeset-list-nesting\)/)
  assert.match(previewSource, /widget: new OrderedListWidget\(markText\)/)
  assert.match(presentationStyles, /--typeset-list-marker-column: 1\.5em/)
  assert.match(readPreviewSource, /kuskus-rendered-list--ordered/)
  assert.match(readPreviewSource, /kuskus-rendered-list--bullet/)
  assert.match(readPreviewSource, /kuskus-task-marker/)
  assert.match(readPreviewSource, /className="kuskus-list-content"/)
  assert.match(readPreviewSource, /kuskus-list-content kuskus-rich-task-content/)
  assert.match(previewSource, /kuskus-task-marker/)
  assert.match(previewSource, /kuskus-task-checkbox/)
  assert.doesNotMatch(
    presentationStyles,
    /> li > :not\(\.kuskus-list-marker, \.kuskus-task-marker\)/
  )
  assert.match(presentationStyles, /\.kuskus-task-marker \{[\s\S]*?height: 1lh;/)
  assert.match(presentationStyles, /\.kuskus-task-marker \{[\s\S]*?align-items: center;/)
  assert.match(presentationStyles, /\.kuskus-task-checkbox \{[\s\S]*?margin: 0;/)
  assert.doesNotMatch(presentationStyles, /task-optical-offset|translateY/)
  assert.match(
    liveStyles,
    /\.cm-kuskus-live \.cm-atomic-task-checkbox \{\s*transform: translateY\(0\.\d+em\);\s*\}/
  )
  assert.match(
    presentationStyles,
    /\.kuskus-rendered-list > li::before,[\s\S]*?\.kuskus-list-marker[\s\S]*?font-variant-numeric: proportional-nums/
  )
  assert.match(presentationStyles, /\.kuskus-list-marker \{\s*display: inline-block;\s*\}/)
})

test('bullet glyph depth only counts nested bullet lists', () => {
  assert.match(previewSource, /function bulletListDepth/)
  assert.match(previewSource, /parent\.name === 'BulletList'/)
  assert.match(previewSource, /bulletDepth = bulletListDepth\(listItem\)/)
})

test('one presentation contract covers every rendered markdown family', () => {
  for (const token of [
    '--typeset-h1-size',
    '--typeset-inline-code-size',
    '--typeset-code-size',
    '--typeset-quote-rail',
    '--typeset-rule-flow',
    '--typeset-list-marker-column',
    '--typeset-task-size',
    '--typeset-media-radius',
    '--typeset-math-padding',
    '--typeset-table-cell-padding'
  ]) {
    assert.match(presentationStyles, new RegExp(token))
  }
})
