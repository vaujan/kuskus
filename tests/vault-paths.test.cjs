const assert = require('node:assert/strict')
const { resolve } = require('node:path')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const { kuskusPath, resolveInsideVault } = require('../src/main/library/storage/vault-paths.ts')

test('resolves only paths contained by the selected vault', () => {
  const vault = resolve('C:/Vault')

  assert.equal(resolveInsideVault(vault, 'Notes/one.md'), resolve(vault, 'Notes/one.md'))
  assert.equal(kuskusPath(vault, 'trash', 'item'), resolve(vault, '.kuskus/trash/item'))
  assert.throws(() => resolveInsideVault(vault, '../Vault-copy/note.md'), /outside/)
  assert.throws(() => resolveInsideVault(vault, resolve(vault, '..', 'Other')), /outside/)
})
