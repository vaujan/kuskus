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
const liveEditorSource = readFileSync(
  require.resolve('../src/renderer/src/features/items/live/live-markdown-editor.tsx'),
  'utf8'
)
const listFoldingSource = readFileSync(
  require.resolve('../src/renderer/src/features/items/live/content-folding.ts'),
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
  assert.doesNotMatch(presentationStyles, /task-optical-offset/)
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

test('read detail renders structural guides for nested lists only', () => {
  assert.match(
    presentationStyles,
    /\[data-typeset-presentation='detail'\][\s\S]*?\.kuskus-list-content[\s\S]*?> \.kuskus-rendered-list::before/
  )
  assert.doesNotMatch(
    presentationStyles,
    /\[data-typeset-presentation='(?:card|compact|snippet|snippet-compact)'\][\s\S]*?> \.kuskus-rendered-list::before/
  )
})

test('read and live detail modes fold nested lists without changing the text rail', () => {
  assert.match(readPreviewSource, /node\?\.children\.some/)
  assert.match(readPreviewSource, /data-list-folded=\{folded \|\| undefined\}/)
  assert.match(
    liveEditorSource,
    /foldingCompartmentRef\.current\.of\(foldingEnabledRef\.current \? contentFolding\(\) : \[\]\)/
  )
  assert.match(
    presentationStyles,
    /li\[data-list-folded\] > \.kuskus-list-content > \.kuskus-rendered-list/
  )
  assert.match(presentationStyles, /\.kuskus-list-fold-button \{[\s\S]*?position: absolute;/)
  assert.match(liveStyles, /\.cm-kuskus-list-fold-placeholder \{\s*display: none;/)
  assert.match(listFoldingSource, /if \(child\.name === 'Task'\) task = true/)
  assert.match(presentationStyles, /li\.task-list-item > \.kuskus-list-fold-button/)
  assert.match(liveStyles, /\.cm-kuskus-list-fold-button--task/)
})

test('live list guides use parsed list depth without changing editor indentation', () => {
  assert.match(liveEditorSource, /indentUnit\.of\(' {4}'\)/)
  assert.doesNotMatch(liveEditorSource, /indentationMarkers/)
  assert.match(previewSource, /function listLineStyle\([\s\S]*?depth: number/)
  assert.match(previewSource, /const activeGuideOwners = new Set<string>\(\)/)
  assert.match(
    previewSource,
    /const activeParent = nearestListItem\(activeItem\?\.parent \?\? null\)/
  )
  assert.match(previewSource, /var\(--typeset-list-guide-active\)/)
  assert.match(previewSource, /var\(--typeset-list-guide\)/)
  assert.match(previewSource, /var\(--typeset-list-marker-axis\)/)
  assert.match(previewSource, /contentOffset < 0 \? ownedLine\.from/)
  assert.match(
    presentationStyles,
    /\.kuskus-list-content > :first-child \{\s*margin-block-start: 0;/
  )
  assert.match(presentationStyles, /--typeset-list-guide:/)
  assert.match(presentationStyles, /--typeset-list-marker-axis:/)
  assert.match(previewSource, /const guidePosition = taskLine/)
  assert.match(previewSource, /background-position: \$\{guidePositions\}/)
  assert.match(
    presentationStyles,
    /inset-inline-start: calc\([\s\S]*?var\(--typeset-list-marker-axis\)[\s\S]*?- var\(--typeset-list-leading\)[\s\S]*?-\s+var\(--typeset-list-marker-column\)/
  )
  assert.match(presentationStyles, /--typeset-task-guide-nudge: 0\.1875em/)
  assert.match(previewSource, /var\(--typeset-task-guide-nudge\)/)
  assert.match(presentationStyles, /--typeset-list-guide-active:/)
})

test('read list markers stay single-line and task rows never regain bullet glyphs', () => {
  assert.match(
    presentationStyles,
    /\.kuskus-rendered-list > li::before,[\s\S]*?\.kuskus-list-marker[\s\S]*?white-space: nowrap;/
  )
  assert.match(
    presentationStyles,
    /\.kuskus-rendered-list--bullet > li:not\(\.task-list-item\)::before/
  )
  assert.match(
    presentationStyles,
    /\.kuskus-rendered-list--bullet[\s\S]*?> li:not\(\.task-list-item\)::before \{\s*content: '▪';/
  )
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
