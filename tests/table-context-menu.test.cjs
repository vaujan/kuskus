const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')

const source = readFileSync(
  require.resolve('../src/renderer/src/features/items/live/atomic/table-context-menu.tsx'),
  'utf8'
)
const widgetSource = readFileSync(
  require.resolve('../src/renderer/src/features/items/live/atomic/table-widget.ts'),
  'utf8'
)
const styleSource = readFileSync(
  require.resolve('../src/renderer/src/features/items/live/atomic/inline-preview.css'),
  'utf8'
)
const presentationStyle = readFileSync(
  require.resolve('../src/renderer/src/assets/markdown-presentation.css'),
  'utf8'
)
const contextMenuSource = readFileSync(
  require.resolve('../src/renderer/src/components/ui/context-menu.tsx'),
  'utf8'
)

test('table context menu labels its first Base UI group', () => {
  assert.match(
    source,
    /<ContextMenuGroup>[\s\S]*groupIndex === 0 && label[\s\S]*<ContextMenuLabel>\{label\}<\/ContextMenuLabel>/
  )
  assert.match(source, /<MenuEntries entries=\{entries\} close=\{close\} label=\{label\} \/>/)
  assert.doesNotMatch(
    source,
    /<ContextMenuContent[^>]*>[\s\S]*?\n\s*<ContextMenuLabel>\{label\}<\/ContextMenuLabel>/
  )
})

test('table context menu opens only after React commits its trigger', () => {
  assert.match(source, /useEffect\(\(\) => \{[\s\S]*triggerRef\.current\?\.dispatchEvent/)
  assert.match(source, /ref=\{triggerRef\}/)
  assert.doesNotMatch(source, /requestAnimationFrame/)
})

test('right-clicking inside a selected range preserves that range', () => {
  assert.match(
    widgetSource,
    /function handleCellContextPointerDown[\s\S]*event\.button !== 2[\s\S]*selectionContains[\s\S]*event\.preventDefault\(\)/
  )
  assert.equal(widgetSource.match(/handleCellContextPointerDown\(event, cell\)/g)?.length, 2)
})

test('overflow uses an end-aware transparent fade instead of a shadow', () => {
  assert.match(
    styleSource,
    /\.cm-atomic-table\[data-overflow-right\][\s\S]*mask-image:[^;]*transparent/
  )
  assert.doesNotMatch(
    styleSource,
    /\.cm-atomic-table\[data-overflow-(?:left|right)\][^{]*\{[^}]*box-shadow/
  )
})

test('scrollable tables expose their scrollbar without requiring hover', () => {
  assert.match(
    presentationStyle,
    /\.kuskus-markdown-table-scroll\s*\{[^}]*scrollbar-color: var\(--typeset-table-scroll-thumb\)/
  )
  assert.doesNotMatch(
    presentationStyle,
    /\.kuskus-markdown-table-scroll:hover::?-webkit-scrollbar-thumb/
  )
})

test('table selection uses the primary color and rounded outer corners', () => {
  assert.match(styleSource, /\[data-selected\][^{]*\{[^}]*var\(--primary\)/)
  assert.match(styleSource, /\[data-selection-top\]\[data-selection-left\][^{]*\{[^}]*radius/)
  assert.match(styleSource, /\[data-selection-bottom\]\[data-selection-right\][^{]*\{[^}]*radius/)
})

test('submenu triggers give their icon and label the same spacing as menu items', () => {
  assert.match(
    contextMenuSource,
    /data-slot="context-menu-sub-trigger"[\s\S]*items-center gap-2\.5/
  )
})

test('range deletion uses the normalized multi-cell bounds', () => {
  assert.match(
    widgetSource,
    /deleteTableRows\(readModelFromDom\(wrap\), firstSelectedBodyRow, selectedBodyRowCount\)/
  )
  assert.match(
    widgetSource,
    /deleteTableColumns\(readModelFromDom\(wrap\), bounds\.left, selectedColumnCount\)/
  )
})

test('column move actions use horizontal direction icons', () => {
  assert.match(widgetSource, /label: 'Move column left',[\s\S]*?icon: 'move-left'/)
  assert.match(widgetSource, /label: 'Move column right',[\s\S]*?icon: 'move-right'/)
  assert.match(source, /'move-left': IconArrowLeft/)
  assert.match(source, /'move-right': IconArrowRight/)
})

test('table handles track pointer release across full row or column drag targets', () => {
  assert.match(widgetSource, /window\.addEventListener\('pointermove', move, true\)/)
  assert.match(widgetSource, /window\.addEventListener\('pointerup', up, true\)/)
  assert.match(
    widgetSource,
    /tableDragTarget\(wrap, axis, moveEvent\.clientX, moveEvent\.clientY\)/
  )
  assert.match(widgetSource, /moveTableColumn\(model, currentOrigin, target\)/)
  assert.match(widgetSource, /moveTableRow\(model, currentOrigin, target\)/)
})

test('row handles keep selection in place and table handles remain visible', () => {
  assert.match(widgetSource, /selectWholeRow\(wrap, currentOrigin \+ 1, false\)/)
  assert.match(styleSource, /\.cm-atomic-table-row-handle\s*\{[^}]*translate\(-50%, -50%\)/)
  assert.match(styleSource, /\.cm-atomic-table-handle\s*\{[^}]*opacity: 1/)
})

test('cross-cell dragging from editable text becomes a table selection', () => {
  assert.match(widgetSource, /if \(pendingSourceDrag\) \{[\s\S]*removeAllRanges\(\)/)
  assert.match(
    widgetSource,
    /selectTableCells\(wrap, \{ anchor: dragAnchor, head \}, true, false\)/
  )
})

test('same-size structural edits refresh the table and animate reordered positions', () => {
  assert.match(widgetSource, /if \(other\.revision !== this\.revision\) return false/)
  assert.match(widgetSource, /function animateTableMove\(/)
  assert.match(widgetSource, /prefers-reduced-motion: reduce/)
})
