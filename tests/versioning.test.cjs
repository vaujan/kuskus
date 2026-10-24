/* eslint-disable @typescript-eslint/explicit-function-return-type */
const assert = require('node:assert/strict')
const test = require('node:test')
const { spawnSync } = require('node:child_process')
const { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const {
  validateHistory,
  renderChangelog,
  prepareRelease
} = require('../scripts/lib/release-notes.cjs')

function history() {
  return {
    unreleased: { changes: { Fixed: ['Preserve notes after interrupted saves.'] } },
    releases: [
      { version: '0.0.3', date: '2026-08-17', notes: { changes: { Added: ['Local libraries.'] } } }
    ]
  }
}

test('prepares a beta without modifying the previous release or the input history', () => {
  const original = history()
  const before = structuredClone(original)
  const next = prepareRelease(original, '0.0.3', '0.1.0-beta.1', '2026-10-23')
  assert.deepEqual(original, before)
  assert.deepEqual(next.unreleased, { changes: {} })
  assert.deepEqual(next.releases[0], {
    version: '0.1.0-beta.1',
    date: '2026-10-23',
    notes: before.unreleased
  })
  assert.deepEqual(next.releases[1], before.releases[0])
  assert.doesNotThrow(() => validateHistory(next, '0.1.0-beta.1'))
})

test('allows numbered beta revisions, release candidates, and promotion to stable', () => {
  let current = history()
  let version = '0.0.3'
  for (const next of ['0.1.0-beta.1', '0.1.0-beta.2', '0.1.0-rc.1', '0.1.0']) {
    current.unreleased = { changes: { Fixed: ['A reviewed fix.'] } }
    current = prepareRelease(current, version, next, '2026-10-23')
    version = next
  }
  assert.equal(current.releases[0].version, '0.1.0')
})

test('rejects reused versions, downgrades, malformed versions and unsupported release labels', () => {
  for (const version of [
    '0.0.3',
    '0.0.2',
    'v0.1.0',
    '0.1',
    '01.1.0',
    '0.1.0+build',
    '0.1.0-beta',
    '0.1.0-beta.0',
    '0.1.0-beta.01',
    '0.1.0-preview.1',
    '0.1.0-beta.1.extra'
  ]) {
    assert.throws(() => prepareRelease(history(), '0.0.3', version, '2026-10-23'))
  }
})

test('rejects impossible or backward release dates and empty releases', () => {
  for (const date of ['2026-02-30', '2025-02-29', '2026-13-01', '2026-1-01', '2026-08-16']) {
    assert.throws(() => prepareRelease(history(), '0.0.3', '0.1.0-beta.1', date))
  }
  const empty = history()
  empty.unreleased = { changes: {} }
  assert.throws(() => prepareRelease(empty, '0.0.3', '0.1.0-beta.1', '2026-10-23'), /notes/)
})

test('rejects version drift, duplicate history, unknown categories, and invalid note entries', () => {
  assert.throws(() => validateHistory(history(), '0.1.0'), /match/)
  const duplicate = history()
  duplicate.releases.push(structuredClone(duplicate.releases[0]))
  assert.throws(() => validateHistory(duplicate, '0.0.3'), /unique/)
  for (const changes of [
    { Fixes: ['A fix'] },
    { Fixed: [] },
    { Fixed: [''] },
    { Fixed: ['One\n## Another heading'] },
    { Fixed: [42] }
  ]) {
    const invalid = history()
    invalid.unreleased.changes = changes
    assert.throws(() => validateHistory(invalid, '0.0.3'))
  }
})

test('renders deterministic Markdown for humans from the same notes a future page can consume', () => {
  const input = history()
  input.unreleased.changes.Added = ['A new feature.']
  const output = renderChangelog(input)
  assert.match(output, /Generated from releases\/notes.json/)
  assert.ok(output.indexOf('### Added') < output.indexOf('### Fixed'))
  assert.match(output, /## \[0.0.3\] - 2026-08-17/)
  assert.match(output, /- Preserve notes after interrupted saves\./)
  assert.equal(output, renderChangelog(input))
})

test('CLI prepares consistent files, rejects reused tags and requires committed release contents', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'kuskus-versioning-'))
  context.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'scripts'))
  mkdirSync(join(root, 'releases'))
  cpSync(resolve('scripts/versioning.cjs'), join(root, 'scripts/versioning.cjs'))
  cpSync(resolve('scripts/lib'), join(root, 'scripts/lib'), { recursive: true })
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.3' }))
  writeFileSync(join(root, 'releases/notes.json'), JSON.stringify(history()))
  writeFileSync(join(root, 'CHANGELOG.md'), renderChangelog(history()))
  const run = (...args) =>
    spawnSync(process.execPath, [join(root, 'scripts/versioning.cjs'), ...args], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: resolve('node_modules') }
    })
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
  }
  const commit = () => {
    git('add', '.')
    git(
      '-c',
      'user.name=Release test',
      '-c',
      'user.email=test@example.invalid',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-m',
      'Test release'
    )
  }
  git('init')
  commit()
  const unprepared = run('verify')
  assert.equal(unprepared.status, 1)
  assert.match(unprepared.stderr, /unreleased/)
  git('-c', 'tag.gpgsign=false', 'tag', 'v0.1.0-beta.1')
  const reused = run('prepare', '0.1.0-beta.1', '2026-10-23')
  assert.equal(reused.status, 1)
  assert.match(reused.stderr, /already exists/)
  assert.equal(JSON.parse(readFileSync(join(root, 'package.json'))).version, '0.0.3')
  const prepared = run('prepare', '0.1.0-beta.2', '2026-10-23')
  assert.equal(prepared.status, 0, prepared.stderr)
  assert.equal(JSON.parse(readFileSync(join(root, 'package.json'))).version, '0.1.0-beta.2')
  assert.equal(run('check').status, 0)
  assert.match(run('verify').stderr, /clean/)
  commit()
  assert.equal(run('verify').status, 0)
  writeFileSync(join(root, 'CHANGELOG.md'), 'Stale changelog')
  const stale = run('check')
  assert.equal(stale.status, 1)
  assert.match(stale.stderr, /stale/)
  assert.equal(run('generate').status, 0)
  assert.equal(run('check').status, 0)
})
