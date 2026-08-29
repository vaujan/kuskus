const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const {
  clampFocusListWidth,
  parseFocusRailDensity,
  parseFocusListWidth,
  resolveFocusAfterRemoval,
  resolveFocusNavigationItemId,
  resolveInitialFocusItemId
} = require('../src/renderer/src/features/items/focus-view-state.ts')
const { parseLibraryView } = require('../src/renderer/src/features/items/item-view.ts')
const {
  focusIndexSupportingText
} = require('../src/renderer/src/features/items/focus-index-row-text.ts')
const { detectCaptureKind } = require('../src/renderer/src/features/capture/capture-detection.ts')
const {
  shouldYieldMainComposer
} = require('../src/renderer/src/features/capture/capture-draft-tracker.ts')

test('parses layouts and disables persisted Focus, Table, or legacy List views', () => {
  assert.equal(parseLibraryView('focus'), 'visual')
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

test('defaults the combined item rail to Visual', () => {
  assert.equal(parseFocusRailDensity(null), 'visual')
  assert.equal(parseFocusRailDensity('visual'), 'visual')
  assert.equal(parseFocusRailDensity('index'), 'index')
  assert.equal(parseFocusRailDensity('unknown'), 'visual')
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

test('medium windows use a narrow sidebar rail with a persistent detail trigger', () => {
  const sidebarSource = readFileSync(
    require.resolve('../src/renderer/src/features/shell/app-sidebar.tsx'),
    'utf8'
  )
  const focusWorkspaceSource = readFileSync(
    require.resolve('../src/renderer/src/features/library/focus-workspace.tsx'),
    'utf8'
  )

  assert.match(sidebarSource, /isNarrow \? 'narrow' : 'expanded'/)
  assert.match(focusWorkspaceSource, /detailOpen && !split && !expanded/)
  assert.match(focusWorkspaceSource, /<ShellSidebarTrigger \/>/)
  // The detail drag strip must not cover the sidebar trigger.
  assert.match(focusWorkspaceSource, /left-10 z-30 h-10 \[-webkit-app-region:drag\]/)
})

test('visual notes use the same compact title caption as other item types', () => {
  const source = readFileSync(
    require.resolve('../src/renderer/src/features/items/note-item-card.tsx'),
    'utf8'
  )
  assert.match(source, /<ItemCardCaption compact=\{compact\}>/)
  assert.match(source, /\{item\.title\}/)
})

test('Focus Index uses text-first rows with previews and distinct active and selected states', () => {
  const source = readFileSync(
    require.resolve('../src/renderer/src/features/items/focus-index-row.tsx'),
    'utf8'
  )
  assert.match(source, /min-h-\[88px\]/)
  assert.match(source, /contain-intrinsic-size:96px/)
  assert.doesNotMatch(source, /useImagePreview|useUrlPreview|IntersectionObserver/)
  assert.doesNotMatch(source, /<img|Thumbnail|<Badge/)
  assert.match(source, /content-visibility:auto/)
  assert.match(source, /line-clamp-2/)
  assert.match(source, /focusIndexSupportingText\(item\)/)
  assert.match(source, /pr-14 pl-4/)
  assert.match(source, /\[&_\[data-slot=button\]\]:bg-transparent/)
  assert.match(source, /data-\[active=true\].*before:opacity-100/)
  assert.match(source, /data-\[selected=true\]:bg-accent\/10/)
  assert.doesNotMatch(source, /aria-hidden="true">·/)
})

test('Focus Index derives quiet supporting text without repeating a note title', () => {
  assert.equal(
    focusIndexSupportingText({
      type: 'note',
      title: 'Release checklist',
      body: '# Release checklist\n\nShip the signed build with **release notes**.'
    }),
    'Ship the signed build with release notes.'
  )
  assert.equal(
    focusIndexSupportingText({
      type: 'url',
      description: 'A practical guide',
      sourceUrl: 'https://example.com'
    }),
    'A practical guide'
  )
})

test('Detail capture stays in the rail and can promote notes into the editor', () => {
  const workspaceSource = readFileSync(
    require.resolve('../src/renderer/src/features/library/workspace.tsx'),
    'utf8'
  )
  const listSource = readFileSync(
    require.resolve('../src/renderer/src/features/items/focus-item-list.tsx'),
    'utf8'
  )
  const composerSource = readFileSync(
    require.resolve('../src/renderer/src/features/capture/add-item-composer.tsx'),
    'utf8'
  )
  const composerEditorSource = readFileSync(
    require.resolve('../src/renderer/src/features/capture/composer-live-markdown-editor.tsx'),
    'utf8'
  )

  assert.match(workspaceSource, /presentation="card"/)
  assert.match(workspaceSource, /const focusDetail = focusItem \? \(/)
  assert.equal(
    detectCaptureKind('', 1),
    'image',
    'an empty draft with one image promotes a captured image'
  )
  assert.equal(
    detectCaptureKind('https://example.com', 0),
    'link',
    'a bare URL with no images promotes a captured link'
  )
  assert.equal(
    shouldYieldMainComposer('quick', true),
    false,
    'the main composer yields only to an actively editing quick surface'
  )
  assert.equal(shouldYieldMainComposer('quick', false), true)

  // The focus rail owns its capture slot as a plain React node; detail capture
  // never slips back into a full composer that overlays the rail.
  assert.match(listSource, /composer: React\.ReactNode/)
  assert.doesNotMatch(listSource, /Draft in progress/)
  assert.match(composerSource, /Continue in editor/)
  assert.match(composerSource, /openInEditor && kind === 'note'/)
  assert.match(composerSource, /onOpenChange\(false, !openInEditor\)/)
  assert.match(composerSource, /return \(\) => onTransientWorkChange\(false\)/)
  assert.match(composerSource, /Control\+Shift\+Enter Meta\+Shift\+Enter/)
  assert.match(composerEditorSource, /event\.shiftKey && onContinueInEditor/)
  assert.match(composerEditorSource, /event\.key === 'Enter'/)
  assert.match(listSource, /min-h-full pt-2/)
  assert.match(listSource, /<OrderedMasonry gap=\{8\}>/)
})
