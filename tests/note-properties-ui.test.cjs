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
const propertiesSource = readFileSync(
  require.resolve('../src/renderer/src/features/items/note-properties.tsx'),
  'utf8'
)

test('keeps rendered properties read-only outside Live mode', () => {
  // The read-mode blocks render read-only; live mode edits properties
  // through the in-editor top-content block (shorthand true).
  assert.match(detailSource, /propertiesEditable=\{false\}/)
  assert.match(detailSource, /\n\s+propertiesEditable\n/)
  assert.match(propertiesSource, /showIcon=\{false\}/)
  assert.match(propertiesSource, /editable \? \(/)
})

test('routes rendered note undo through the shared Markdown history', () => {
  assert.match(editorSource, /Transaction\.addToHistory\.of\(true\)/)
  assert.match(editorSource, /undo: \(\) =>/)
  assert.match(editorSource, /redo: \(\) =>/)
  assert.match(detailSource, /onKeyDownCapture=\{handleUndo\}/)
})
