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
  parseFocusRailDensity,
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

test('defaults the Focus rail to Index and validates the persisted density', () => {
  assert.equal(parseFocusRailDensity(null), 'index')
  assert.equal(parseFocusRailDensity('index'), 'index')
  assert.equal(parseFocusRailDensity('visual'), 'visual')
  assert.equal(parseFocusRailDensity('unknown'), 'index')
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

test('Focus Index uses compact type badges and tint-only bulk selection', () => {
  const source = readFileSync(
    require.resolve('../src/renderer/src/features/items/focus-index-row.tsx'),
    'utf8'
  )
  assert.match(source, /relative h-\[52px\]/)
  assert.match(source, /contain-intrinsic-size:52px/)
  assert.doesNotMatch(source, /useImagePreview|useUrlPreview|IntersectionObserver/)
  assert.doesNotMatch(source, /<img|Thumbnail/)
  assert.match(source, /content-visibility:auto/)
  assert.match(source, /'Note' \| 'URL' \| 'Image' \| 'File'/)
  assert.match(source, /<Badge variant="secondary">\{typeLabel\}<\/Badge>/)
  assert.match(source, /data-\[active=true\].*before:opacity-100/)
  assert.match(source, /data-\[selected=true\]:bg-primary\/12/)
  assert.doesNotMatch(source, /IconCheck|data-\[selected=true\].*shadow-|selected=true.*pl-8/)
})

test('Focus Visual uses tint without shared card selection decorations', () => {
  const listSource = readFileSync(
    require.resolve('../src/renderer/src/features/items/focus-item-list.tsx'),
    'utf8'
  )
  const savedCardSource = readFileSync(
    require.resolve('../src/renderer/src/features/items/saved-item-card.tsx'),
    'utf8'
  )
  const typeCardSources = ['note', 'image', 'url', 'file'].map((type) =>
    readFileSync(
      require.resolve(`../src/renderer/src/features/items/${type}-item-card.tsx`),
      'utf8'
    )
  )

  assert.match(listSource, /data-\[active=true\]:bg-primary\/10/)
  assert.match(listSource, /data-\[selected=true\]:bg-primary\/10/)
  assert.match(listSource, /showSelectionVisual=\{false\}/)
  assert.doesNotMatch(listSource, /data-\[active=true\]:before:opacity-100/)
  assert.doesNotMatch(listSource, /data-\[selected=true\]:shadow-/)
  assert.match(savedCardSource, /showSelectionVisual = true/)
  for (const source of typeCardSources) {
    assert.match(source, /data-selected=\{selected && showSelectionVisual\}/)
    assert.match(source, /aria-pressed=\{selected\}/)
  }
})
