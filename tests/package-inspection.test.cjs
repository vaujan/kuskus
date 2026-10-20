const assert = require('node:assert/strict')
const { mkdtemp, mkdir, writeFile, rm } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')
const { createPackage } = require('@electron/asar')
const test = require('node:test')

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function inspect(context, extraFile = null, atomicNotice = true, electronNotice = true) {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-package-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const input = join(root, 'input')
  const platform = process.platform === 'win32' ? 'win-unpacked' : 'linux-unpacked'
  const packaged = join(root, 'dist', platform)
  const resources = join(packaged, 'resources')
  await mkdir(resources, { recursive: true })
  const files = {
    'out/main/index.js': '',
    'out/preload/index.js': '',
    'out/renderer/index.html': '',
    LICENSE: 'Kuskus license',
    'THIRD_PARTY_NOTICES.txt': atomicNotice ? 'Kenny Bergquist' : 'missing notice',
    ...(extraFile ? { [extraFile]: 'unexpected data' } : {})
  }
  for (const [name, content] of Object.entries(files)) {
    await mkdir(join(input, name, '..'), { recursive: true })
    await writeFile(join(input, name), content)
  }
  await createPackage(input, join(resources, 'app.asar'))
  for (const name of electronNotice ? ['LICENSE.electron.txt', 'LICENSES.chromium.html'] : [])
    await writeFile(join(packaged, name), 'Electron notice')
  return spawnSync(process.execPath, [resolve('scripts/verify-package.cjs')], {
    cwd: root,
    encoding: 'utf8'
  })
}

test('package inspection accepts required app files and notices', async (context) => {
  const result = await inspect(context)
  assert.equal(result.status, 0, result.stderr)
})

test('package inspection rejects repository material, credential files, and missing attribution', async (context) => {
  for (const [file, attribution] of [
    ['.agents/internal.md', true],
    ['resources/signing.key', true],
    [null, false]
  ]) {
    const result = await inspect(context, file, attribution)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Unexpected package entry|Potential secret file|missing the atomic/)
  }
})

test('package inspection rejects a package missing Electron licensing', async (context) => {
  const result = await inspect(context, null, true, false)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Electron notice missing: LICENSE.electron.txt/)
})
