const assert = require('node:assert/strict')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const {
  resolveSelection
} = require('../src/renderer/src/features/library/use-library-selection.ts')
const none = { shiftKey: false, ctrlKey: false, metaKey: false }

test('library selection replaces, toggles, and extends over visible item order', () => {
  const visible = ['a', 'b', 'c', 'd']

  const replaced = resolveSelection(new Set(['d']), null, visible, 'b', none)
  assert.deepEqual([...replaced.selectedIds], ['b'])
  assert.equal(replaced.anchorId, 'b')

  const toggled = resolveSelection(replaced.selectedIds, replaced.anchorId, visible, 'd', {
    ...none,
    ctrlKey: true
  })
  assert.deepEqual([...toggled.selectedIds], ['b', 'd'])
  assert.equal(toggled.anchorId, 'd')

  const range = resolveSelection(toggled.selectedIds, toggled.anchorId, visible, 'b', {
    ...none,
    shiftKey: true
  })
  assert.deepEqual([...range.selectedIds], ['b', 'c', 'd'])
  assert.equal(range.anchorId, 'd')
})

test('library selection falls back to one item when its range anchor is no longer visible', () => {
  const result = resolveSelection(new Set(['old']), 'old', ['a', 'b'], 'b', {
    ...none,
    shiftKey: true
  })

  assert.deepEqual([...result.selectedIds], ['b'])
  assert.equal(result.anchorId, 'b')
})
