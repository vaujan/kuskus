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
  assert.match(detailSource, /propertiesEditable=\{mode === 'live'\}/)
  assert.match(detailSource, /propertiesEditable=\{false\}/)
  assert.match(propertiesSource, /showIcon=\{false\}/)
  assert.match(propertiesSource, /editable \? \(/)
})

test('routes rendered note undo through the shared Markdown history', () => {
  assert.match(editorSource, /Transaction\.addToHistory\.of\(true\)/)
  assert.match(editorSource, /undo: \(\) =>/)
  assert.match(editorSource, /redo: \(\) =>/)
  assert.match(detailSource, /onKeyDownCapture=\{handleUndo\}/)
})
