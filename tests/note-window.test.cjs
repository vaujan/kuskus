const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')

const controllerSource = readFileSync(require.resolve('../src/main/window/note-window.ts'), 'utf8')
const rendererSource = readFileSync(
  require.resolve('../src/renderer/src/features/items/note-window-app.tsx'),
  'utf8'
)
const menuSource = readFileSync(
  require.resolve('../src/renderer/src/features/items/item-action-menu.tsx'),
  'utf8'
)
const entrySource = readFileSync(require.resolve('../src/renderer/src/main.tsx'), 'utf8')

test('deduplicates note windows and rejects non-note items', () => {
  assert.match(controllerSource, /private readonly windows = new Map<string, BrowserWindow>\(\)/)
  assert.match(controllerSource, /const existing = this\.windows\.get\(itemId\)/)
  assert.match(controllerSource, /const pending = this\.opening\.get\(itemId\)/)
  assert.match(controllerSource, /existing\.show\(\)[\s\S]*existing\.focus\(\)/)
  assert.match(controllerSource, /if \(item\.type !== 'note'\) throw new Error/)
  assert.match(controllerSource, /this\.windows\.delete\(itemId\)/)
})

test('waits for note autosave before allowing a detached window to close', () => {
  assert.match(controllerSource, /noteWindowCloseRequested/)
  assert.match(controllerSource, /if \(approved && !window\.isDestroyed\(\)\)/)
  assert.match(rendererSource, /detailRef\.current\?\.flush\(\)/)
  assert.match(rendererSource, /resolveNoteWindowClose\(approved\)/)
  assert.match(rendererSource, /resolveNoteWindowClose\(false\)/)
})

test('routes note windows to the focused note surface and exposes a note-only action', () => {
  assert.match(entrySource, /surface === 'note-window'/)
  assert.match(entrySource, /<NoteWindowApp itemId=/)
  assert.match(rendererSource, /presentation="focus"/)
  assert.match(rendererSource, /expanded/)
  assert.match(rendererSource, /expandable=\{false\}/)
  assert.match(menuSource, /!bulk && item\.type === 'note'/)
  assert.match(menuSource, /Open in new window/)
})
