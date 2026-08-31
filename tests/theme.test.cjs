const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const {
  applyTheme,
  resolveAppliedTheme,
  resolveTheme
} = require('../src/renderer/src/hooks/theme.ts')
test('resolves light, dark, and system themes and rejects stale values', () => {
  assert.equal(resolveTheme('light'), 'light')
  assert.equal(resolveTheme('dark'), 'dark')
  assert.equal(resolveTheme('system'), 'system')
  assert.equal(resolveTheme('solarized-light'), 'dark')
  assert.equal(resolveTheme(null), 'dark')
})

test('resolves the applied theme from stored preference and system preference', () => {
  // resolveAppliedTheme reads window.matchMedia; stub it for the test.
  const originalMatchMedia = global.window?.matchMedia
  global.window = { matchMedia: () => ({ matches: true }) }
  try {
    assert.equal(resolveAppliedTheme('dark'), 'dark')
    assert.equal(resolveAppliedTheme('light'), 'light')
    assert.equal(resolveAppliedTheme('system'), 'dark')
  } finally {
    if (originalMatchMedia) global.window = { matchMedia: originalMatchMedia }
    else delete global.window
  }
})

test('applies light and dark color modes', () => {
  const classes = new Set()
  const root = {
    classList: {
      toggle: (name, enabled) => (enabled ? classes.add(name) : classes.delete(name))
    },
    style: {}
  }

  applyTheme('dark', root)
  assert.deepEqual([...classes], ['dark'])
  assert.equal(root.style.colorScheme, 'dark')

  applyTheme('light', root)
  assert.deepEqual([...classes], [])
  assert.equal(root.style.colorScheme, 'light')
})

test('does not define obsolete Solarized tokens', () => {
  const css = readFileSync(require.resolve('../src/renderer/src/assets/main.css'), 'utf8')

  assert.doesNotMatch(css, /solarized/i)
})
