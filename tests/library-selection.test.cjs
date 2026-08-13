const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true
    },
    fileName: filename
  })
  module._compile(output.outputText, filename)
}

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
