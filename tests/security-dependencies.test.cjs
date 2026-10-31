const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const { parse } = require('yaml')
const { satisfies } = require('semver')

const root = join(__dirname, '..')
const lock = parse(readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8'))

test('the minimatch audit exception only covers legacy code without the affected optimizer', () => {
  const versions = Object.keys(lock.packages)
    .filter((key) => key.startsWith('minimatch@'))
    .map((key) => key.slice('minimatch@'.length))
  assert.ok(versions.length > 0)
  for (const version of versions) {
    if (version === '3.1.5' || version === '5.1.9') {
      const source = readFileSync(
        join(
          root,
          'node_modules',
          '.pnpm',
          `minimatch@${version}`,
          'node_modules',
          'minimatch',
          'minimatch.js'
        ),
        'utf8'
      )
      assert.doesNotMatch(source, /firstPhasePreProcess|optimizationLevel/)
    } else {
      assert.ok(satisfies(version, '>=11.0.1'), `Unpatched modern minimatch ${version}`)
    }
  }
})

test('the generator CLI and its unpatched dependencies are absent from the lockfile', () => {
  for (const key of Object.keys(lock.packages)) {
    assert.doesNotMatch(key, /^(shadcn|deepmerge|systeminformation)@/)
    if (key.startsWith('glob@')) {
      const version = key.slice('glob@'.length)
      assert.ok(satisfies(version, '<9 || >=14.0.2'), `Unpatched glob ${version}`)
    }
  }
})
