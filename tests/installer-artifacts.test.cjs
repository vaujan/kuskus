const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')
const test = require('node:test')
const { name, version } = require('../package.json')
const script = resolve('scripts/collect-installers.cjs')

test('installer collection includes only current artifacts and produces verifiable checksums', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'kuskus-installers-'))
  try {
    mkdirSync(join(cwd, 'dist'))
    const installers = [
      `${name}-${version}-x64-setup.exe`,
      `${name}-${version}-arm64.dmg`,
      `${name}-${version}-x86_64.AppImage`
    ]
    for (const filename of [...installers, `${name}-0.0.0-x64-setup.exe`, 'builder-debug.yml']) {
      writeFileSync(join(cwd, 'dist', filename), filename)
    }
    const result = spawnSync(process.execPath, [script], { cwd, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    const output = join(cwd, 'release-artifacts')
    assert.deepEqual(
      readdirSync(output).sort(),
      [...installers, 'SHA256SUMS.txt', 'BUILD-INFO.txt'].sort()
    )
    for (const filename of installers) {
      const hash = createHash('sha256')
        .update(readFileSync(join(output, filename)))
        .digest('hex')
      assert.ok(
        readFileSync(join(output, 'SHA256SUMS.txt'), 'utf8').includes(`${hash}  ${filename}\n`)
      )
    }
    assert.match(readFileSync(join(output, 'BUILD-INFO.txt'), 'utf8'), /Unsigned test build/)
    assert.notEqual(spawnSync(process.execPath, [script], { cwd }).status, 0)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('installer collection fails when packaging produced no matching installers', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'kuskus-installers-empty-'))
  try {
    mkdirSync(join(cwd, 'dist'))
    writeFileSync(join(cwd, 'dist', `${name}-0.0.0-x64-setup.exe`), 'stale')
    const result = spawnSync(process.execPath, [script], { cwd, encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /No installers match/)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
