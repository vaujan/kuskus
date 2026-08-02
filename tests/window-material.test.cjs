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
  applyTranslucentBackground,
  isTranslucentBackgroundSupported,
  parseTranslucentBackgroundRequest,
  parseWindowsBuild,
  resolveTranslucentBackgroundStatus
} = require('../src/main/window/window-material.ts')
const { resolveTranslucentBackgroundPreference } = require('../src/shared/window-contract.ts')

test('enables translucency by default and preserves an explicit opt-out', () => {
  assert.equal(resolveTranslucentBackgroundPreference(null), true)
  assert.equal(resolveTranslucentBackgroundPreference('true'), true)
  assert.equal(resolveTranslucentBackgroundPreference('false'), false)
})

test('parses Windows build numbers and rejects malformed versions', () => {
  assert.equal(parseWindowsBuild('10.0.22621'), 22621)
  assert.equal(parseWindowsBuild('10.0.26200.1'), 26200)
  assert.equal(parseWindowsBuild('10.0'), null)
  assert.equal(parseWindowsBuild('10.0.invalid'), null)
})

test('supports Acrylic only on Windows 11 22H2 and newer', () => {
  assert.equal(isTranslucentBackgroundSupported('win32', '10.0.22621'), true)
  assert.equal(isTranslucentBackgroundSupported('win32', '10.0.22000'), false)
  assert.equal(isTranslucentBackgroundSupported('darwin', '23.0.0'), false)
})

test('resolves requested, reduced, and effective translucency independently', () => {
  assert.deepEqual(resolveTranslucentBackgroundStatus('win32', '10.0.22621', true, false), {
    supported: true,
    enabled: true,
    reducedTransparency: false
  })
  assert.deepEqual(resolveTranslucentBackgroundStatus('win32', '10.0.22621', true, true), {
    supported: true,
    enabled: false,
    reducedTransparency: true
  })
  assert.deepEqual(resolveTranslucentBackgroundStatus('win32', '10.0.22621', false, false), {
    supported: true,
    enabled: false,
    reducedTransparency: false
  })
  assert.deepEqual(resolveTranslucentBackgroundStatus('win32', '10.0.22000', true, true), {
    supported: false,
    enabled: false,
    reducedTransparency: false
  })
})

test('applies Acrylic or restores the safe opaque background', () => {
  const calls = []
  const target = {
    setBackgroundColor: (color) => calls.push(['color', color]),
    setBackgroundMaterial: (material) => calls.push(['material', material])
  }

  applyTranslucentBackground(target, 'win32', '10.0.22621', true, false)
  assert.deepEqual(calls, [
    ['color', '#00000000'],
    ['material', 'acrylic']
  ])

  calls.length = 0
  applyTranslucentBackground(target, 'win32', '10.0.22621', false, false)
  assert.deepEqual(calls, [
    ['material', 'none'],
    ['color', '#181c1d']
  ])

  calls.length = 0
  applyTranslucentBackground(target, 'win32', '10.0.22621', true, true)
  assert.deepEqual(calls, [
    ['material', 'none'],
    ['color', '#181c1d']
  ])
})

test('rejects invalid IPC preference values', () => {
  assert.equal(parseTranslucentBackgroundRequest(true), true)
  assert.throws(() => parseTranslucentBackgroundRequest('true'), /must be a boolean/)
  assert.throws(() => parseTranslucentBackgroundRequest(null), /must be a boolean/)
})
