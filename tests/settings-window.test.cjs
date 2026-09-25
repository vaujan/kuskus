const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const { resolveStoredZoomFactor } = require('../src/renderer/src/hooks/use-app-zoom.ts')

const controllerSource = readFileSync(
  require.resolve('../src/main/window/settings-window.ts'),
  'utf8'
)
const entrySource = readFileSync(require.resolve('../src/renderer/src/main.tsx'), 'utf8')
const workspaceSource = readFileSync(
  require.resolve('../src/renderer/src/features/library/workspace.tsx'),
  'utf8'
)
const settingsAppSource = readFileSync(
  require.resolve('../src/renderer/src/features/settings/settings-window-app.tsx'),
  'utf8'
)

test('opens one reusable settings window on its own renderer surface', () => {
  assert.match(controllerSource, /private window: BrowserWindow \| null = null/)
  assert.match(controllerSource, /if \(this\.window && !this\.window\.isDestroyed\(\)\)/)
  assert.match(controllerSource, /this\.window\.show\(\)[\s\S]*this\.window\.focus\(\)/)
  assert.match(controllerSource, /width: 840/)
  assert.match(controllerSource, /height: 640/)
  assert.match(controllerSource, /surface', 'settings-window'/)
  assert.match(entrySource, /surface === 'settings-window'/)
  assert.match(entrySource, /<SettingsWindowApp \/>/)
})

test('routes both settings entry points to the detached window', () => {
  assert.match(workspaceSource, /event\.key\.toLowerCase\(\) === ','[\s\S]*openSettingsWindow\(\)/)
  assert.match(
    workspaceSource,
    /onOpenSettings=\{\(\) => void window\.electron\.window\.openSettingsWindow\(\)\}/
  )
  assert.doesNotMatch(workspaceSource, /SettingsDialog/)
})

test('accepts only supported zoom factors when settings synchronize across windows', () => {
  assert.equal(resolveStoredZoomFactor('0.8'), 0.8)
  assert.equal(resolveStoredZoomFactor('1.25'), 1.25)
  assert.equal(resolveStoredZoomFactor('2'), 1)
  assert.equal(resolveStoredZoomFactor(null), 1)
})

test('shows the current keyboard shortcuts in settings without exposing unfinished editing', () => {
  assert.match(settingsAppSource, /<span>Keyboard shortcuts<\/span>/)
  assert.match(settingsAppSource, /getGlobalCaptureShortcutStatus\(\)/)
  assert.match(settingsAppSource, /isWindows \? \[\{ label: 'Quick capture'/)
  assert.match(settingsAppSource, /Custom shortcuts are coming later\./)
  assert.match(settingsAppSource, /\{ label: 'New note', keys: 'Ctrl\+N' \}/)
  assert.doesNotMatch(settingsAppSource, /window\.electron\.window\.setGlobalCaptureShortcut\(/)
})
