const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const { applyTheme, resolveTheme } = require('../src/renderer/src/hooks/theme.ts')

test('resolves light and dark themes and rejects stale values', () => {
  assert.equal(resolveTheme('light'), 'light')
  assert.equal(resolveTheme('dark'), 'dark')
  assert.equal(resolveTheme('solarized-light'), 'dark')
  assert.equal(resolveTheme('system'), 'dark')
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
