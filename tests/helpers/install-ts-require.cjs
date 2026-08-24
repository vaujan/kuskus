'use strict'

// Registers the TypeScript transpile hook used by every node:test file that
// requires a `.ts` source module directly. Kept as one helper so the compiler
// options (and the hook) are defined once, not copy-pasted per test file.
const { readFileSync } = require('node:fs')
const ts = require('typescript')

module.exports = function installTypeScriptRequireHook() {
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
}
