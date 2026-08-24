const assert = require('node:assert/strict')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const { CaptureShortcutStore } = require('../src/main/window/capture-shortcut-store.ts')

test('loads a persisted accelerator and saves a new one', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'capture-shortcut-store-'))
  const settingsPath = join(directory, 'capture-shortcut.json')
  try {
    const store = new CaptureShortcutStore(settingsPath)
    assert.equal(await store.load(), null)

    await store.save('Control+Alt+P')
    assert.equal(await store.load(), 'Control+Alt+P')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('returns null when the file does not exist', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'capture-shortcut-store-'))
  try {
    const store = new CaptureShortcutStore(join(directory, 'missing.json'))
    assert.equal(await store.load(), null)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
