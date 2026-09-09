const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')

const detailSource = readFileSync(
  require.resolve('../src/renderer/src/features/items/item-detail-dialog.tsx'),
  'utf8'
)
const editorSource = readFileSync(
  require.resolve('../src/renderer/src/features/items/markdown-editor.tsx'),
  'utf8'
)
const liveSource = readFileSync(
  require.resolve('../src/renderer/src/features/items/live/live-preview.ts'),
  'utf8'
)
const frontmatterSource = readFileSync(
  require.resolve('../src/renderer/src/features/items/markdown-frontmatter-block.tsx'),
  'utf8'
)
const previewSource = readFileSync(
  require.resolve('../src/renderer/src/features/items/markdown-preview.tsx'),
  'utf8'
)
const blocksSource = readFileSync(
  require.resolve('../src/renderer/src/features/items/markdown-editor-blocks.tsx'),
  'utf8'
)

test('frontmatter renders as a code block in read mode (no properties form)', () => {
  // The typed properties form is gone; read mode shows the YAML card.
  assert.doesNotMatch(detailSource, /<NoteProperties/)
  assert.match(detailSource, /<MarkdownFrontmatterBlock/)
  assert.match(frontmatterSource, /typeset kuskus-typeset/)
  assert.match(frontmatterSource, /data-typeset-presentation="detail"/)
})

test('block math uses the shared code card in read and live modes', () => {
  assert.match(previewSource, /<MarkdownCodeCardHeader code=\{source\} label="Math" \/>/)
  assert.match(previewSource, /className="kuskus-code-block not-typeset"/)
  assert.match(liveSource, /createCodeBlockHeader\(this\.tex, 'math'\)/)
  assert.match(liveSource, /'kuskus-code-block cm-kuskus-math-block'/)
})

test('frontmatter reveals as editable source in live mode (no hiddenRange overlay)', () => {
  // The live editor renders the frontmatter in-place with a header
  // widget instead of hiding it behind a React overlay.
  assert.match(liveSource, /node\.name === 'Frontmatter'/)
  assert.match(liveSource, /new CodeBlockHeaderWidget\(yaml, 'yaml'\)/)
  assert.doesNotMatch(detailSource, /hiddenRange/)
  assert.doesNotMatch(blocksSource, /hiddenRange/)
})

test('routes rendered note undo through the shared Markdown history', () => {
  assert.match(editorSource, /Transaction\.addToHistory\.of\(true\)/)
  assert.match(editorSource, /undo: \(\) =>/)
  assert.match(editorSource, /redo: \(\) =>/)
  assert.match(detailSource, /onKeyDownCapture=\{handleUndo\}/)
})
