const assert = require('node:assert/strict')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

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
