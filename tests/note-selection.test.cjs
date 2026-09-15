const assert = require('node:assert/strict')
const test = require('node:test')

const { clampNoteSelection } = require('../src/renderer/src/features/items/note-editor.ts')

test('preserves directional selections while clamping them to the current note', () => {
  assert.deepEqual(clampNoteSelection({ anchor: 9, head: 2 }, 6), { anchor: 6, head: 2 })
  assert.deepEqual(clampNoteSelection({ anchor: -2, head: 4 }, 6), { anchor: 0, head: 4 })
})
