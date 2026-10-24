/* eslint-disable @typescript-eslint/no-require-imports */
const { readFileSync, writeFileSync } = require('node:fs')
const { execFileSync, spawnSync } = require('node:child_process')
const { resolve } = require('node:path')
const {
  validateHistory,
  renderChangelog,
  prepareRelease,
  hasNotes
} = require('./lib/release-notes.cjs')

const root = resolve(__dirname, '..')
const packagePath = resolve(root, 'package.json')
const notesPath = resolve(root, 'releases/notes.json')
const changelogPath = resolve(root, 'CHANGELOG.md')
const [command, ...args] = process.argv.slice(2)

try {
  const manifest = JSON.parse(readFileSync(packagePath, 'utf8'))
  const history = JSON.parse(readFileSync(notesPath, 'utf8'))
  validateHistory(history, manifest.version)
  if (command === 'prepare' && args.length === 2) {
    const [version, date] = args
    const next = prepareRelease(history, manifest.version, version, date)
    const tag = spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/tags/v${version}`], {
      cwd: root
    })
    if (tag.error || ![0, 1].includes(tag.status))
      throw new Error('Could not inspect local release tags.')
    if (tag.status === 0) throw new Error(`Tag v${version} already exists; choose a new version.`)
    writeFileSync(notesPath, `${JSON.stringify(next, null, 2)}\n`)
    writeFileSync(packagePath, `${JSON.stringify({ ...manifest, version }, null, 2)}\n`)
    writeFileSync(changelogPath, renderChangelog(next))
    console.log(
      `Prepared ${version}. Review and commit all three files; no tag or release was published.`
    )
  } else if (command === 'generate' && args.length === 0) {
    writeFileSync(changelogPath, renderChangelog(history))
    console.log('Generated CHANGELOG.md from releases/notes.json.')
  } else if (['check', 'verify'].includes(command) && args.length === 0) {
    if (readFileSync(changelogPath, 'utf8') !== renderChangelog(history)) {
      throw new Error('CHANGELOG.md is stale. Run pnpm changelog:generate.')
    }
    if (command === 'verify') {
      if (hasNotes(history.unreleased))
        throw new Error('Prepare the unreleased notes before packaging a release.')
      const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
        cwd: root,
        encoding: 'utf8'
      })
      if (status.trim())
        throw new Error('Release packaging requires a clean, committed working tree.')
    }
    console.log(`Version ${manifest.version} and release notes are consistent.`)
  } else {
    throw new Error('Usage: versioning.cjs check|generate|verify or prepare <version> <YYYY-MM-DD>')
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
