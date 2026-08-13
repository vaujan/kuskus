const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true
    },
    fileName: filename
  })
  module._compile(output.outputText, filename)
}

const { applyTheme, resolveTheme } = require('../src/renderer/src/hooks/use-theme.ts')

test('resolves supported themes and rejects stale values', () => {
  assert.equal(resolveTheme('solarized-light'), 'solarized-light')
  assert.equal(resolveTheme('solarized-dark'), 'solarized-dark')
  assert.equal(resolveTheme('light'), 'light')
  assert.equal(resolveTheme('system'), 'dark')
})

test('applies Solarized independently from light and dark mode', () => {
  const classes = new Set()
  const root = {
    classList: {
      toggle: (name, enabled) => (enabled ? classes.add(name) : classes.delete(name))
    },
    style: {}
  }

  applyTheme('solarized-light', root)
  assert.deepEqual([...classes], ['solarized'])
  assert.equal(root.style.colorScheme, 'light')

  applyTheme('solarized-dark', root)
  assert.deepEqual([...classes].sort(), ['dark', 'solarized'])
  assert.equal(root.style.colorScheme, 'dark')

  applyTheme('light', root)
  assert.deepEqual([...classes], [])
})

test('defines light and dark Solarized token sets', () => {
  const css = readFileSync(require.resolve('../src/renderer/src/assets/main.css'), 'utf8')

  assert.match(css, /\.solarized:not\(\.dark\)/)
  assert.match(css, /\.solarized\.dark/)
  assert.match(css, /--background: #fdf6e3/)
  assert.match(css, /--background: #002b36/)
})
