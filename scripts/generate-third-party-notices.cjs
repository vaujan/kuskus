/* eslint-disable @typescript-eslint/no-require-imports */
const { execFileSync } = require('node:child_process')
const { existsSync, readFileSync, readdirSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const groups = JSON.parse(
  execFileSync(pnpm, ['licenses', 'list', '--prod', '--json'], {
    encoding: 'utf8',
    shell: process.platform === 'win32'
  })
)
// Electron's executable and its notices are shipped separately by electron-builder.
// Its npm downloader subtree is tooling, not application code.
const runtimePaths = new Set()
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const visit = (name, pkg) => {
  if (name === 'electron' || runtimePaths.has(pkg.path)) return
  runtimePaths.add(pkg.path)
  for (const [childName, child] of Object.entries({
    ...pkg.dependencies,
    ...pkg.optionalDependencies
  })) {
    visit(childName, child)
  }
}
const trees = JSON.parse(
  execFileSync(pnpm, ['list', '--prod', '--depth', 'Infinity', '--json'], {
    encoding: 'utf8',
    shell: process.platform === 'win32'
  })
)
for (const tree of trees) {
  for (const [name, pkg] of Object.entries({ ...tree.dependencies, ...tree.optionalDependencies }))
    visit(name, pkg)
}
const packages = Object.values(groups)
  .flat()
  .filter((pkg) => pkg.paths.some((path) => runtimePaths.has(path)))
const sections = [
  'Kuskus third-party notices',
  'Generated from installed production dependencies. Electron also distributes LICENSE.electron.txt and LICENSES.chromium.html alongside the packaged executable.',
  'Vendored atomic editor\n' +
    readFileSync('src/renderer/src/features/items/live/atomic/LICENSE', 'utf8')
]
for (const pkg of packages.sort((a, b) => a.name.localeCompare(b.name))) {
  const notices = new Set()
  for (const path of pkg.paths) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.isFile() && /^(licen[sc]e|copying|notice|ofl)([.\-_]|$)/i.test(entry.name)) {
        notices.add(readFileSync(join(path, entry.name), 'utf8').trim())
      }
    }
  }
  if (!notices.size) {
    for (const path of pkg.paths) {
      for (const entry of readdirSync(path, { withFileTypes: true })) {
        if (!entry.isFile() || !/^readme(?:\.|$)/i.test(entry.name)) continue
        const section = readFileSync(join(path, entry.name), 'utf8').match(
          /(?:^|\n)#{1,6}\s+licen[sc]e[^\n]*\n([\s\S]*?)(?=\n#{1,6}\s|$)/i
        )?.[1]
        if (section && /copyright|permission is hereby granted/i.test(section))
          notices.add(section.trim())
      }
    }
  }
  if (!notices.size) {
    for (const version of pkg.versions) {
      const supplement = join('third-party', `${pkg.name.replaceAll('/', '__')}@${version}.txt`)
      if (existsSync(supplement)) notices.add(readFileSync(supplement, 'utf8').trim())
    }
  }
  if (!notices.size)
    throw new Error(`Missing license text for ${pkg.name}; review before packaging.`)
  sections.push(
    `${pkg.name} ${pkg.versions.join(', ')}\nLicense: ${pkg.license}\n${[...notices].join('\n\n')}`
  )
}
writeFileSync(
  'THIRD_PARTY_NOTICES.txt',
  sections.join('\n\n========================================\n\n') + '\n'
)
console.log(`Generated notices for ${packages.length} dependencies and the atomic editor.`)
