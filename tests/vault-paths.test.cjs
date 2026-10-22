const assert = require('node:assert/strict')
const { resolve } = require('node:path')
const { mkdtempSync, mkdirSync, symlinkSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
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

test('rejects linked files, directories, dangling links, and metadata junctions', (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'kuskus-path-security-'))
  context.after(() => rmSync(root, { recursive: true, force: true }))
  const vault = resolve(root, 'vault')
  const outside = resolve(root, 'outside')
  mkdirSync(vault)
  mkdirSync(outside)
  symlinkSync(outside, resolve(vault, 'linked'), 'junction')
  symlinkSync(resolve(outside, 'missing'), resolve(vault, 'dangling'), 'junction')
  symlinkSync(outside, resolve(vault, '.kuskus'), 'junction')
  for (const target of ['linked', 'linked/new/note.md', 'dangling/new.md']) {
    assert.throws(() => resolveInsideVault(vault, target), /symbolic link or junction/)
  }
  assert.throws(() => kuskusPath(vault, 'library.json'), /symbolic link or junction/)
  assert.equal(resolveInsideVault(vault, 'new/note.md'), resolve(vault, 'new/note.md'))
})
