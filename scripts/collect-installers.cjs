/* eslint-disable @typescript-eslint/no-require-imports */
const { createHash } = require('node:crypto')
const { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { name, version } = require('../package.json')

const input = 'dist'
const output = 'release-artifacts'
const filenames = readdirSync(input)
  .filter((filename) =>
    ['x64', 'arm64'].some((arch) =>
      [
        `${name}-${version}-${arch}-setup.exe`,
        `${name}-${version}-${arch}.dmg`,
        `${name}-${version}-${arch}.AppImage`
      ].includes(filename)
    )
  )
  .sort()
if (!filenames.length) throw new Error('No installers match the current package name and version.')
mkdirSync(output) // Refuse to mix a new build with stale artifacts.
const checksums = []
for (const filename of filenames) {
  const source = join(input, filename)
  const checksum = createHash('sha256').update(readFileSync(source)).digest('hex')
  copyFileSync(source, join(output, filename))
  checksums.push(`${checksum}  ${filename}`)
}
writeFileSync(join(output, 'SHA256SUMS.txt'), `${checksums.join('\n')}\n`)
writeFileSync(
  join(output, 'BUILD-INFO.txt'),
  [
    `Kuskus ${version}`,
    `Source commit: ${process.env.GITHUB_SHA || 'local build'}`,
    'Unsigned test build. macOS builds use ad-hoc signing and are not notarized.',
    'Installation and runtime behavior must be tested on the matching OS and architecture.',
    'These CI artifacts are not approved public releases.',
    ''
  ].join('\n')
)
console.log(`Collected ${filenames.length} installer(s) and SHA-256 checksums in ${output}.`)
