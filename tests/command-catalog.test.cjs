const assert = require('node:assert/strict')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()
const {
  resolveCommandTargets,
  findCommand,
  isCommandPaletteShortcut,
  matchesCommand
} = require('../src/renderer/src/features/commands/command-catalog.ts')

const context = {
  inDetail: false,
  inSidebar: false,
  activeItemId: 'note',
  focusedItemId: 'image',
  selectedIds: new Set(['selected', 'stale']),
  visibleIds: new Set(['note', 'image', 'selected'])
}
test('palette captures visible selection, but detail commands target the displayed note', () => {
  assert.deepEqual(resolveCommandTargets(context), ['selected'])
  assert.deepEqual(resolveCommandTargets({ ...context, inDetail: true }), ['note'])
  assert.deepEqual(resolveCommandTargets({ ...context, inDetail: true, activeItemId: null }), [])
  assert.deepEqual(resolveCommandTargets({ ...context, inSidebar: true }), [])
  assert.deepEqual(resolveCommandTargets({ ...context, selectedIds: new Set() }), ['image'])
})
test('closing a palette cannot execute a destination whose parent became disabled', () => {
  const child = {
    id: 'move:inbox',
    label: 'Inbox',
    group: 'Destinations',
    run() {
      return undefined
    }
  }
  const commands = [{ id: 'move', label: 'Move', group: 'Items', children: [child] }]
  assert.equal(findCommand(commands, child.id), child)
  commands[0].disabledReason = 'The selection has changed'
  assert.equal(findCommand(commands, child.id), undefined)
  assert.equal(findCommand([], child.id), undefined)
})
test('palette shortcut supports platform modifiers and ignores composition and repeats', () => {
  const event = {
    key: 'P',
    ctrlKey: true,
    metaKey: false,
    shiftKey: true,
    altKey: false,
    isComposing: false,
    repeat: false
  }
  assert.equal(isCommandPaletteShortcut(event), true)
  assert.equal(isCommandPaletteShortcut({ ...event, ctrlKey: false, metaKey: true }), true)
  for (const change of [
    { shiftKey: false },
    { altKey: true },
    { isComposing: true },
    { repeat: true },
    { key: 'o' },
    { ctrlKey: false }
  ]) {
    assert.equal(isCommandPaletteShortcut({ ...event, ...change }), false)
  }
})

const {
  createWorkspaceCommands
} = require('../src/renderer/src/features/commands/workspace-commands.ts')
const baseLibrary = {
  items: [{ id: 'note', title: 'A note', location: { type: 'inbox' } }],
  collections: [{ id: 'folder', relativePath: 'Projects/Design', name: 'Design' }],
  pinnedItemIds: []
}
// CommonJS test helper: return annotations are not valid JavaScript.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const catalog = (overrides = {}) => {
  return createWorkspaceCommands({
    library: baseLibrary,
    targetIds: ['note'],
    itemOperationBusy: false,
    commandModifier: 'Ctrl',
    noteCommandsEnabled: false,
    colorTheme: 'kuskus',
    colorMode: 'dark',
    actions: {},
    ...overrides
  }).commands
}
test('item commands disable stale and busy targets without silently shrinking a selection', () => {
  for (const overrides of [
    { targetIds: ['note', 'removed'] },
    { itemOperationBusy: true },
    { targetIds: [] }
  ]) {
    const commands = catalog(overrides)
    assert.ok(findCommand(commands, 'rename').disabledReason)
    assert.equal(findCommand(commands, 'move:folder'), undefined)
  }
})
test('move destinations retain full paths and disable the current destination', () => {
  const commands = catalog()
  assert.equal(findCommand(commands, 'move:folder').label, 'Projects/Design')
  assert.equal(findCommand(commands, 'move:inbox').disabledReason, 'Current destination')
})
test('trash targets can restore but cannot rename, pin or move until restored', () => {
  const commands = catalog({
    library: { ...baseLibrary, items: [{ ...baseLibrary.items[0], location: { type: 'trash' } }] }
  })
  assert.equal(findCommand(commands, 'restore').disabledReason, undefined)
  assert.ok(findCommand(commands, 'rename').disabledReason)
  assert.ok(findCommand(commands, 'pin').disabledReason)
  assert.equal(findCommand(commands, 'move:folder'), undefined)
})
test('building the catalog never executes actions', () => {
  let calls = 0
  const commands = catalog({
    actions: {
      newNote: () => {
        calls++
      }
    }
  })
  assert.equal(calls, 0)
  findCommand(commands, 'new-note').run()
  assert.equal(calls, 1)
})

test('theme commands use the current settings and send the selected values', () => {
  const applied = []
  const commands = catalog({
    actions: {
      colorTheme: (theme) => applied.push(['theme', theme]),
      colorMode: (mode) => applied.push(['mode', mode])
    }
  })
  assert.equal(findCommand(commands, 'color-theme:kuskus').checked, true)
  assert.equal(findCommand(commands, 'color-mode:dark').checked, true)
  assert.equal(findCommand(commands, 'color-theme:nord').checked, false)
  findCommand(commands, 'color-theme:nord').run()
  findCommand(commands, 'color-mode:system').run()
  assert.deepEqual(applied, [
    ['theme', 'nord'],
    ['mode', 'system']
  ])
  assert.equal(matchesCommand(findCommand(commands, 'color-theme'), 'nord'), true)
  assert.equal(matchesCommand(findCommand(commands, 'new-folder'), 'nord'), false)
  assert.equal(matchesCommand(findCommand(commands, 'color-mode:system'), 'system'), true)
})
