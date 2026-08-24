const assert = require('node:assert/strict')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const { createTextContextMenuItems } = require('../src/main/window/text-context-menu-items.ts')

const editFlags = {
  canUndo: false,
  canRedo: false,
  canCut: false,
  canCopy: true,
  canPaste: true,
  canDelete: false,
  canSelectAll: true,
  canEditRichly: false
}

test('offers replacements, dictionary storage, and available edit actions for misspellings', () => {
  const calls = []
  const items = createTextContextMenuItems(
    { misspelledWord: 'mispelled', dictionarySuggestions: ['misspelled'], editFlags },
    {
      replace: (word) => calls.push(['replace', word]),
      addToDictionary: (word) => calls.push(['add', word]),
      undo: () => calls.push(['undo']),
      redo: () => calls.push(['redo']),
      cut: () => calls.push(['cut']),
      copy: () => calls.push(['copy']),
      paste: () => calls.push(['paste']),
      selectAll: () => calls.push(['selectAll'])
    }
  )

  assert.deepEqual(
    items.filter((item) => item.label).map((item) => item.label),
    ['misspelled', 'Add to dictionary', 'Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'Select all']
  )
  items[0].click()
  items[2].click()
  assert.deepEqual(calls, [
    ['replace', 'misspelled'],
    ['add', 'mispelled']
  ])
})

test('offers edit actions for correctly spelled editable text', () => {
  const items = createTextContextMenuItems(
    { misspelledWord: '', dictionarySuggestions: [], editFlags },
    {
      replace: () => {},
      addToDictionary: () => {},
      undo: () => {},
      redo: () => {},
      cut: () => {},
      copy: () => {},
      paste: () => {},
      selectAll: () => {}
    }
  )

  assert.deepEqual(
    items.filter((item) => item.label).map((item) => item.label),
    ['Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'Select all']
  )
})
