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
  clampFocusListWidth,
  parseFocusListWidth,
  resolveFocusAfterRemoval,
  resolveFocusNavigationItemId,
  resolveInitialFocusItemId
} = require('../src/renderer/src/features/items/focus-view-state.ts')
const { parseLibraryView } = require('../src/renderer/src/features/items/item-view.ts')

test('parses Focus and disables persisted Table or legacy List views', () => {
  assert.equal(parseLibraryView('focus'), 'focus')
  assert.equal(parseLibraryView('table'), 'visual')
  assert.equal(parseLibraryView('list'), 'visual')
  assert.equal(parseLibraryView('unknown'), 'visual')
  assert.equal(parseLibraryView(null), 'visual')
})

test('uses a bounded persisted Focus list width', () => {
  assert.equal(parseFocusListWidth(null), 420)
  assert.equal(parseFocusListWidth('320'), 320)
  assert.equal(parseFocusListWidth('invalid'), 420)
  assert.equal(clampFocusListWidth(100), 320)
  assert.equal(clampFocusListWidth(500), 500)
  assert.equal(clampFocusListWidth(900), 720)
  assert.equal(clampFocusListWidth(420, 800), 360)
})

test('initial Focus activation uses the leading visible item but preserves an active item', () => {
  assert.equal(resolveInitialFocusItemId(['first', 'second'], null), 'first')
  assert.equal(resolveInitialFocusItemId(['first'], 'outside-results'), 'outside-results')
  assert.equal(resolveInitialFocusItemId([], null), null)
})

test('removing the active item chooses the nearest remaining neighbor', () => {
  const previous = ['a', 'b', 'c', 'd']
  assert.equal(resolveFocusAfterRemoval(previous, ['a', 'c', 'd'], 'b'), 'c')
  assert.equal(resolveFocusAfterRemoval(previous, ['a', 'b'], 'd'), 'b')
  assert.equal(resolveFocusAfterRemoval(previous, [], 'b'), null)
  assert.equal(resolveFocusAfterRemoval(previous, ['a', 'b'], 'a'), 'a')
})

test('Focus keyboard navigation remains bounded and supports endpoints', () => {
  const ids = ['a', 'b', 'c']
  assert.equal(resolveFocusNavigationItemId(ids, 'a', 'ArrowUp'), 'a')
  assert.equal(resolveFocusNavigationItemId(ids, 'a', 'ArrowDown'), 'b')
  assert.equal(resolveFocusNavigationItemId(ids, 'b', 'Home'), 'a')
  assert.equal(resolveFocusNavigationItemId(ids, 'b', 'End'), 'c')
  assert.equal(resolveFocusNavigationItemId(ids, 'c', 'ArrowDown'), 'c')
})
