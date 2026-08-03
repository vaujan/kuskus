const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
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
  hasBulkItemSelection,
  resolveItemMenuTargets,
  resolveItemShortcutTargets,
  resolveRenameShortcutTarget
} = require('../src/renderer/src/features/items/item-shortcuts.ts')
const {
  createInlineTitleEditState,
  reduceInlineTitleEdit,
  resolveInlineTitleSubmission
} = require('../src/renderer/src/features/items/item-title-edit.ts')

test('selection takes precedence over the focused item', () => {
  const targets = resolveItemShortcutTargets(
    new Set(['selected-a', 'selected-b']),
    'focused',
    new Set(['selected-a', 'selected-b', 'focused'])
  )

  assert.deepEqual(targets, ['selected-a', 'selected-b'])
})

test('uses the focused item when there is no selection', () => {
  const targets = resolveItemShortcutTargets(new Set(), 'focused', new Set(['focused']))

  assert.deepEqual(targets, ['focused'])
})

test('ignores targets that are not visible', () => {
  assert.deepEqual(
    resolveItemShortcutTargets(new Set(['hidden']), 'focused', new Set(['focused'])),
    []
  )
  assert.deepEqual(resolveItemShortcutTargets(new Set(), 'hidden', new Set(['visible'])), [])
})

test('returns no target when selection and focus are absent', () => {
  assert.deepEqual(resolveItemShortcutTargets(new Set(), null, new Set(['visible'])), [])
})

test('rename accepts exactly one resolved target', () => {
  assert.equal(resolveRenameShortcutTarget(['one']), 'one')
  assert.equal(resolveRenameShortcutTarget([]), null)
  assert.equal(resolveRenameShortcutTarget(['one', 'two']), null)
})

test('inline title editing resolves save and cancel decisions', () => {
  assert.deepEqual(resolveInlineTitleSubmission('Original', '  Renamed  '), {
    type: 'rename',
    title: 'Renamed'
  })
  assert.deepEqual(resolveInlineTitleSubmission('Original', 'Original'), { type: 'cancel' })
  assert.deepEqual(resolveInlineTitleSubmission('Original', '   '), { type: 'cancel' })
})

test('inline title editing keeps failed drafts recoverable and blocks duplicate submissions', () => {
  let state = createInlineTitleEditState('Original')
  state = reduceInlineTitleEdit(state, { type: 'start', title: 'Original' })
  state = reduceInlineTitleEdit(state, { type: 'change', value: 'Draft title' })
  state = reduceInlineTitleEdit(state, { type: 'submit' })
  assert.equal(state.pending, true)
  assert.equal(reduceInlineTitleEdit(state, { type: 'submit' }), state)
  assert.equal(reduceInlineTitleEdit(state, { type: 'change', value: 'Ignored' }), state)

  state = reduceInlineTitleEdit(state, { type: 'failure', error: 'Rename failed.' })
  assert.deepEqual(state, {
    editing: true,
    draft: 'Draft title',
    pending: false,
    error: 'Rename failed.'
  })
  state = reduceInlineTitleEdit(state, { type: 'cancel', title: 'Original' })
  assert.deepEqual(state, createInlineTitleEditState('Original'))
})

test('item menu preserves the visible selection when opened from a selected item', () => {
  assert.deepEqual(
    resolveItemMenuTargets(
      new Set(['selected-a', 'selected-b', 'stale']),
      'selected-b',
      new Set(['selected-a', 'selected-b'])
    ),
    ['selected-a', 'selected-b']
  )
})

test('item menu targets only an unselected clicked item', () => {
  assert.deepEqual(
    resolveItemMenuTargets(
      new Set(['selected-a', 'selected-b']),
      'clicked',
      new Set(['selected-a', 'selected-b', 'clicked'])
    ),
    ['clicked']
  )
})

test('item menu ignores a clicked item that is no longer visible', () => {
  assert.deepEqual(
    resolveItemMenuTargets(new Set(['selected']), 'hidden', new Set(['selected'])),
    []
  )
})

test('bulk action toolbar requires more than one selected item', () => {
  assert.equal(hasBulkItemSelection(0), false)
  assert.equal(hasBulkItemSelection(1), false)
  assert.equal(hasBulkItemSelection(2), true)
})
