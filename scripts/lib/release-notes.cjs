/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */
const semver = require('semver')

const categories = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security', 'Performance']

function assertVersion(version) {
  if (typeof version !== 'string' || semver.valid(version) !== version || version.includes('+')) {
    throw new Error('Use a canonical SemVer version without a v prefix or build metadata.')
  }
  const prerelease = semver.prerelease(version)
  if (
    prerelease &&
    (prerelease.length !== 2 ||
      !['alpha', 'beta', 'rc'].includes(prerelease[0]) ||
      !Number.isInteger(prerelease[1]) ||
      prerelease[1] < 1)
  )
    throw new Error('Prereleases must use alpha.N, beta.N, or rc.N with N starting at 1.')
}

function assertDate(date) {
  if (
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  ) {
    throw new Error('Release dates must be real calendar dates in YYYY-MM-DD format.')
  }
}

function assertNotes(notes) {
  if (
    !notes ||
    typeof notes !== 'object' ||
    Array.isArray(notes) ||
    Object.keys(notes).some((key) => !['summary', 'changes'].includes(key))
  ) {
    throw new Error('Notes must contain changes and an optional summary.')
  }
  if (
    notes.summary !== undefined &&
    (typeof notes.summary !== 'string' || !notes.summary.trim() || /[\r\n]/.test(notes.summary))
  ) {
    throw new Error('A release summary must be a nonempty single line.')
  }
  if (!notes.changes || typeof notes.changes !== 'object' || Array.isArray(notes.changes)) {
    throw new Error('Release changes must be grouped by category.')
  }
  for (const [category, entries] of Object.entries(notes.changes)) {
    if (
      !categories.includes(category) ||
      !Array.isArray(entries) ||
      !entries.length ||
      entries.some((entry) => typeof entry !== 'string' || !entry.trim() || /[\r\n]/.test(entry))
    ) {
      throw new Error(`Invalid release-note category or entries: ${category}`)
    }
  }
}

function hasNotes(notes) {
  return Boolean(notes.summary || Object.keys(notes.changes).length)
}

function validateHistory(history, version) {
  assertVersion(version)
  if (
    !history ||
    Object.keys(history).sort().join(',') !== 'releases,unreleased' ||
    !Array.isArray(history.releases) ||
    !history.releases.length
  ) {
    throw new Error('Release history must contain unreleased notes and a nonempty releases array.')
  }
  assertNotes(history.unreleased)
  let previous = null
  for (const release of history.releases) {
    if (!release || Object.keys(release).sort().join(',') !== 'date,notes,version') {
      throw new Error('Each release must contain version, date, and notes.')
    }
    assertVersion(release.version)
    assertDate(release.date)
    assertNotes(release.notes)
    if (!hasNotes(release.notes)) throw new Error('A release must contain notes.')
    if (
      previous &&
      (!semver.gt(previous.version, release.version) || previous.date < release.date)
    ) {
      throw new Error('Releases must have unique versions in descending version and date order.')
    }
    previous = release
  }
  if (history.releases[0].version !== version) {
    throw new Error('package.json version must match the newest release entry.')
  }
}

function renderNotes(notes) {
  const lines = []
  if (notes.summary) lines.push(notes.summary, '')
  for (const category of categories) {
    if (!notes.changes[category]) continue
    lines.push(`### ${category}`, '', ...notes.changes[category].map((entry) => `- ${entry}`), '')
  }
  return lines
}

function renderChangelog(history) {
  const lines = [
    '# Changelog',
    '',
    '<!-- Generated from releases/notes.json. Run pnpm changelog:generate; do not edit directly. -->',
    '',
    'All notable changes to Kuskus are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).',
    '',
    '## [Unreleased]',
    '',
    ...renderNotes(history.unreleased)
  ]
  for (const release of history.releases) {
    lines.push(`## [${release.version}] - ${release.date}`, '', ...renderNotes(release.notes))
  }
  return `${lines.join('\n').trimEnd()}\n`
}

function prepareRelease(history, currentVersion, version, date) {
  validateHistory(history, currentVersion)
  assertVersion(version)
  assertDate(date)
  if (!semver.gt(version, currentVersion)) throw new Error('The next version must increase.')
  if (date < history.releases[0].date) throw new Error('The release date cannot go backward.')
  if (!hasNotes(history.unreleased))
    throw new Error('Add unreleased notes before preparing a release.')
  const next = {
    unreleased: { changes: {} },
    releases: [{ version, date, notes: history.unreleased }, ...history.releases]
  }
  validateHistory(next, version)
  return next
}

module.exports = { validateHistory, renderChangelog, prepareRelease, hasNotes }
