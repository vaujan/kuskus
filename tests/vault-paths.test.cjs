const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
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

const { kuskusPath, resolveInsideVault } = require('../src/main/library/storage/vault-paths.ts')

test('resolves only paths contained by the selected vault', () => {
  const vault = resolve('C:/Vault')

  assert.equal(resolveInsideVault(vault, 'Notes/one.md'), resolve(vault, 'Notes/one.md'))
  assert.equal(kuskusPath(vault, 'trash', 'item'), resolve(vault, '.kuskus/trash/item'))
  assert.throws(() => resolveInsideVault(vault, '../Vault-copy/note.md'), /outside/)
  assert.throws(() => resolveInsideVault(vault, resolve(vault, '..', 'Other')), /outside/)
})
