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

const {
  closeUnbalancedCodeFences
} = require('../src/renderer/src/features/items/markdown-fence-balance.ts')

test('leaves markdown without code fences unchanged', () => {
  const source = '# Heading\n\nSome **bold** text with `inline code`.'
  assert.equal(closeUnbalancedCodeFences(source), source)
})

test('leaves balanced fences unchanged', () => {
  const source = '```js\nconst a = 1\n```\n\nDone.'
  assert.equal(closeUnbalancedCodeFences(source), source)
})

test('closes an unterminated backtick fence', () => {
  assert.equal(closeUnbalancedCodeFences('```ts\nconst a = 1'), '```ts\nconst a = 1\n```')
})

test('closes an unterminated tilde fence', () => {
  assert.equal(
    closeUnbalancedCodeFences('~~~\nline\n~~~\n\n~~~ruby\nputs 1'),
    '~~~\nline\n~~~\n\n~~~ruby\nputs 1\n~~~'
  )
})

test('ignores a longer closing fence marker', () => {
  assert.equal(closeUnbalancedCodeFences('```\ncode\n````'), '```\ncode\n````')
})

test('does not treat prose lines starting with backticks as fences', () => {
  const source = 'A note about `important` things.\n\nNo fences here.'
  assert.equal(closeUnbalancedCodeFences(source), source)
})

test('closes only the final open fence across multiple blocks', () => {
  assert.equal(
    closeUnbalancedCodeFences('```python\nx = 1\n```\n\n```js\nconst y = 2'),
    '```python\nx = 1\n```\n\n```js\nconst y = 2\n```'
  )
})

test('returns empty input unchanged', () => {
  assert.equal(closeUnbalancedCodeFences(''), '')
})
