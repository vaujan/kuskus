const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')

test('application menu reuses workspace, editor, capture, and zoom actions', () => {
  const menu = readFileSync(
    require.resolve('../src/renderer/src/features/shell/application-menu.tsx'),
    'utf8'
  )
  const workspace = readFileSync(
    require.resolve('../src/renderer/src/features/library/workspace.tsx'),
    'utf8'
  )
  const detail = readFileSync(
    require.resolve('../src/renderer/src/features/items/item-detail-dialog.tsx'),
    'utf8'
  )
  const composer = readFileSync(
    require.resolve('../src/renderer/src/features/capture/add-item-composer.tsx'),
    'utf8'
  )

  assert.match(menu, /Quick Open…/)
  assert.match(menu, /size="icon-sm"/)
  assert.match(menu, /<Menubar id="application-menubar"/)
  assert.match(menu, /onClick=\{\(\) => setVisible\(true\)\}/)
  assert.match(menu, /document\.addEventListener\('pointerdown', closeOutside\)/)
  assert.match(menu, /target\.closest\('\[data-slot="menubar-content"\]'\)/)
  assert.match(menu, /<Menubar id="application-menubar" className="h-8/)
  assert.match(menu, /<MenubarTrigger className="mx-1 px-3">Kuskus<\/MenubarTrigger>/)
  assert.match(menu, /Open Settings/)
  assert.match(menu, /<IconSettings aria-hidden="true" \/>/)
  assert.match(menu, /Add File or Image…/)
  assert.match(menu, /Find in Note/)
  assert.match(menu, /Replace in Note/)
  assert.doesNotMatch(menu, /Zen Mode/)
  assert.match(workspace, /menu=\{focusDetailOpen \? null : applicationMenu\}/)
  assert.match(workspace, /presentation="focus"\s+menu=\{applicationMenu\}/)
  assert.match(workspace, /onFind=\{\(\) => focusDetailRef\.current\?\.openFind\(false\)\}/)
  assert.match(workspace, /filePickerRequest=\{composerFilePickerRequest\}/)
  assert.match(detail, /openFind: \(replace = false\) => noteFindRef\.current\?\.open\(replace\)/)
  assert.match(composer, /fileInputRef\.current\?\.click\(\)/)
})

test('detail Zen mode lives in the More actions menu', () => {
  const actions = readFileSync(
    require.resolve('../src/renderer/src/features/items/item-action-menu.tsx'),
    'utf8'
  )

  assert.match(actions, /onZenChange\?: \(checked: boolean\) => void/)
  assert.match(actions, /Zen mode/)
  assert.match(actions, /Ctrl\+Shift\+\\/)
})

test('Windows and Linux use one visible renderer menu while macOS keeps its native menu', () => {
  const nativeMenu = readFileSync(require.resolve('../src/main/window/app-menu.ts'), 'utf8')

  assert.match(nativeMenu, /if \(!isMac\) \{\s*Menu\.setApplicationMenu\(null\)/)
})
