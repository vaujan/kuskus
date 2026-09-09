const assert = require('node:assert/strict')
const test = require('node:test')
const ts = require('typescript')
const fs = require('node:fs')
const vm = require('node:vm')

const source = fs.readFileSync(
  require.resolve('../src/renderer/src/features/items/ordered-list-numbering.ts'),
  'utf8'
)
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const moduleValue = { exports: {} }
vm.runInNewContext(output, { module: moduleValue, exports: moduleValue.exports })
const { minimalTextChange, normalizeOrderedListNumbers } = moduleValue.exports

test('renumbers ordered items after an item is removed', () => {
  assert.equal(normalizeOrderedListNumbers('1. One\n3. Three'), '1. One\n2. Three')
})

test('preserves explicit starts and numbers nested lists independently', () => {
  assert.equal(
    normalizeOrderedListNumbers('4. Four\n   1. Child\n   8. Child\n9. Five'),
    '4. Four\n   1. Child\n   2. Child\n5. Five'
  )
})

test('does not renumber examples inside fenced code', () => {
  const markdown = '1. One\n```md\n1. Example\n3. Example\n```\n8. Two'
  assert.equal(
    normalizeOrderedListNumbers(markdown),
    '1. One\n```md\n1. Example\n3. Example\n```\n2. Two'
  )
})

test('limits an automatic renumber to the changed marker text', () => {
  assert.deepEqual(
    { ...minimalTextChange('1. One\n3. Three', '1. One\n2. Three') },
    { from: 7, to: 8, insert: '2' }
  )
})
