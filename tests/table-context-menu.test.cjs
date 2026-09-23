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
const typesetStyle = readFileSync(require.resolve('../src/renderer/src/assets/typeset.css'), 'utf8')
const readPreviewSource = readFileSync(
  require.resolve('../src/renderer/src/features/items/markdown-preview.tsx'),
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
    presentationStyle,
    /\.kuskus-markdown-table-scroll\[data-overflow-right\][\s\S]*mask-image:[^;]*transparent/
  )
  assert.doesNotMatch(
    presentationStyle,
    /\.kuskus-markdown-table-scroll\[data-overflow-(?:left|right)\][^{]*\{[^}]*box-shadow/
  )
})

test('Read tables track overflow on mount, resize, and scroll', () => {
  assert.match(readPreviewSource, /function MarkdownReadTable\(/)
  assert.match(
    readPreviewSource,
    /wrap\.toggleAttribute\('data-overflow-left', wrap\.scrollLeft > 1\)/
  )
  assert.match(
    readPreviewSource,
    /wrap\.toggleAttribute\('data-overflow-right', wrap\.scrollLeft < max - 1\)/
  )
  assert.match(readPreviewSource, /observer\.observe\(table\)/)
  assert.match(readPreviewSource, /wrap\.addEventListener\('scroll', updateOverflowState/)
  assert.match(readPreviewSource, /return <MarkdownReadTable \{\.\.\.props\} \/>/)
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

test('Read and Live table cells both wrap long content before scrolling', () => {
  const sharedCells = presentationStyle.match(
    /\.kuskus-markdown-table :is\(th, td\)\s*\{([^}]+)\}/
  )?.[1]
  const readHeaders = typesetStyle.match(/&:where\(thead th\)\s*\{([^}]+)\}/)?.[1]
  const readTable = typesetStyle.match(/&:where\(\.typeset-scroll table\)\s*\{([^}]+)\}/)?.[1]
  assert.match(sharedCells, /white-space: normal/)
  assert.match(sharedCells, /overflow-wrap: anywhere/)
  assert.doesNotMatch(readHeaders, /white-space: nowrap/)
  assert.match(readTable, /width: 100%/)
  assert.doesNotMatch(readTable, /max-content/)
  assert.match(
    styleSource,
    /\.cm-atomic-table-cell-source\s*\{[^}]*white-space: pre-wrap;[^}]*overflow-wrap: anywhere/
  )
})

test('Read and Live tables honor each column alignment', () => {
  assert.match(widgetSource, /if \(align\) cell\.setAttribute\('align', align\)/)
  for (const align of ['left', 'center', 'right']) {
    assert.match(
      presentationStyle,
      new RegExp(
        `\\.kuskus-markdown-table :is\\(th, td\\)\\[align='${align}'\\]\\s*\\{\\s*text-align: ${align};`
      )
    )
  }
})

test('tables and their outer cells share the add buttons slight corner radius', () => {
  assert.match(presentationStyle, /--typeset-table-radius: 0\.25rem/)
  assert.match(
    presentationStyle,
    /\.kuskus-markdown-table\s*\{[^}]*border-radius: var\(--typeset-table-radius\)/
  )
  assert.match(presentationStyle, /thead th:first-child\s*\{[^}]*border-start-start-radius/)
  assert.match(
    presentationStyle,
    /tbody tr:last-child td:last-child\s*\{[^}]*border-end-end-radius/
  )
  assert.match(styleSource, /\.cm-atomic-table-add\s*\{[^}]*border-radius: 0\.25rem/)
})

test('table selection uses the primary color and rounded outer corners', () => {
  assert.match(styleSource, /\[data-selected\][^{]*\{[^}]*var\(--primary\)/)
  assert.match(
    styleSource,
    /\[data-selection-top\][\s\S]*\[data-selection-left\][^{]*\{[^}]*radius/
  )
  assert.match(
    styleSource,
    /\[data-selection-bottom\][\s\S]*\[data-selection-right\][^{]*\{[^}]*radius/
  )
})

test('selection and drop-target fills round inside their outlines', () => {
  assert.match(styleSource, /--cm-table-highlight-radius: 0\.375rem/)
  assert.equal(
    styleSource.match(
      /border-(?:start-start|start-end|end-start|end-end)-radius: calc\(var\(--cm-table-highlight-radius\) - 1px\)/g
    )?.length,
    4
  )
  assert.equal(
    styleSource.match(
      /border-(?:start-start|start-end|end-start|end-end)-radius: var\(--cm-table-highlight-radius\)/g
    )?.length,
    4
  )
})

test('the focused editing cell uses a rounded ring instead of a square outline', () => {
  assert.match(
    presentationStyle,
    /\.kuskus-markdown-table :is\(th, td\):focus-within\s*\{[^}]*border-radius: 0\.375rem;[^}]*box-shadow: inset 0 0 0 2px var\(--primary\);[^}]*outline: none/
  )
})

test('row and column drop targets get a full rounded perimeter', () => {
  assert.match(widgetSource, /delete cell\.dataset\.dragTop[\s\S]*delete cell\.dataset\.dragRight/)
  assert.match(widgetSource, /if \(axis === 'row' \|\| point\.row === 0\) cell\.dataset\.dragTop/)
  assert.match(
    widgetSource,
    /if \(axis === 'row' \|\| point\.row === lastRow\) cell\.dataset\.dragBottom/
  )
  assert.match(
    widgetSource,
    /if \(axis === 'column' \|\| point\.column === 0\) cell\.dataset\.dragLeft/
  )
  assert.match(
    widgetSource,
    /if \(axis === 'column' \|\| point\.column === lastColumn\) cell\.dataset\.dragRight/
  )
  assert.match(
    styleSource,
    /\[data-drag-target\]\)::before[^{]*\{[^}]*border: 2px solid transparent/
  )
  assert.match(
    styleSource,
    /\[data-drag-top\][^{]*\{[^}]*border-block-start-color: var\(--primary\)/
  )
  assert.match(
    styleSource,
    /\[data-drag-right\][^{]*\{[^}]*border-inline-end-color: var\(--primary\)/
  )
  assert.match(styleSource, /\[data-drag-bottom\][\s\S]*\[data-drag-right\][^{]*\{[^}]*radius/)
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
  assert.match(widgetSource, /moveTableVisualRow\(model, currentOrigin, target\)/)
  assert.match(
    widgetSource,
    /if \(!dragging\) \{\s*dragging = true[\s\S]*selectWholeColumn\(wrap, currentOrigin, false\)[\s\S]*selectWholeRow\(wrap, currentOrigin, false\)[\s\S]*tableDragTarget\(wrap, axis, moveEvent\.clientX, moveEvent\.clientY\)/
  )
})

test('row handles keep selection in place and reveal only on interaction', () => {
  assert.match(widgetSource, /selectWholeRow\(wrap, currentOrigin, false\)/)
  assert.match(styleSource, /\.cm-atomic-table-row-handle\s*\{[^}]*translate\(-50%, -50%\)/)
  assert.match(styleSource, /\.cm-atomic-table-handle\s*\{[^}]*opacity: 0/)
  assert.match(
    styleSource,
    /\.cm-atomic-table-handle:hover,[\s\S]*\.cm-atomic-table-handle:focus-visible,[\s\S]*\.cm-atomic-table-handle\[data-dragging\][\s\S]*opacity: 1/
  )
  assert.match(
    styleSource,
    /@media \(pointer: coarse\) \{[\s\S]*\.cm-atomic-table-handle \{\s*opacity: 1/
  )
})

test('the header row has its own row drag handle and is a valid drop target', () => {
  assert.match(widgetSource, /if \(tag === 'th'\) addDragHandle\('column'\)/)
  assert.match(widgetSource, /if \(column === 0\) addDragHandle\('row'\)/)
  assert.match(widgetSource, /axis === 'row' \? 'thead tr, tbody tr'/)
  assert.match(widgetSource, /\[data-row="\$\{index\}"\]/)
  assert.match(widgetSource, /moveTableVisualRow\(readModelFromDom\(wrap\), 0, 1\)/)
  assert.match(widgetSource, /moveTableVisualRow\(readModelFromDom\(wrap\), row \+ 1, row\)/)
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
