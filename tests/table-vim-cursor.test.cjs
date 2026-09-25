'use strict'

const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')

const widget = readFileSync(
  require.resolve('../src/renderer/src/features/items/live/atomic/table-widget.ts'),
  'utf8'
)
const style = readFileSync(
  require.resolve('../src/renderer/src/features/items/live/atomic/inline-preview.css'),
  'utf8'
)

test('Vim Normal mode renders a block cursor at the table cell caret', () => {
  assert.match(widget, /vimCursor\.className = 'cm-atomic-table-vim-cursor'/)
  assert.match(widget, /document\.createTreeWalker\(source, NodeFilter\.SHOW_TEXT\)/)
  assert.match(widget, /cursor\.style\.left = `\$\{rect\.left - cellRect\.left\}px`/)
  assert.match(widget, /source\.toggleAttribute\('data-vim-normal', Boolean\(visible\)\)/)
  assert.match(
    style,
    /\.cm-atomic-table-cell-source\[data-vim-normal\]\s*\{\s*caret-color: transparent;/
  )
  assert.match(
    style,
    /\.cm-atomic-table-vim-cursor\s*\{[^}]*background: var\(--primary\);[^}]*color: var\(--primary-foreground\);/
  )
})

test('table Vim cursor follows selections and mode changes without an extra document cursor', () => {
  assert.match(widget, /document\.addEventListener\('selectionchange', onSelectionChange\)/)
  assert.match(widget, /document\.removeEventListener\('selectionchange', onSelectionChange\)/)
  assert.match(
    widget,
    /Vim\.handleKey\(cm, key, 'user'\)[\s\S]*updateTableVimCursor\(view, source\)/
  )
  assert.match(
    style,
    /\.cm-editor:has\(\.cm-atomic-table-cell-source\[data-vim-normal\]:focus\) \.cm-vimCursorLayer\s*\{\s*visibility: hidden;/
  )
})
