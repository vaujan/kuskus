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

const { fitThumbnailSize } = require('../src/main/library/image-thumbnail.ts')

test('bounds card thumbnails without enlarging small images', () => {
  assert.deepEqual(fitThumbnailSize(2680, 3400), { width: 404, height: 512 })
  assert.deepEqual(fitThumbnailSize(320, 200), { width: 320, height: 200 })
})
