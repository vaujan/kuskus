/* eslint-disable @typescript-eslint/no-require-imports */
const { createHash } = require('node:crypto')
const { copyFileSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { parse } = require('yaml')
const { name, version } = require('../package.json')

// Run only after the signed release build. Test previews deliberately omit update feeds.
const metadata = readFileSync('dist/latest.yml', 'utf8')
const info = parse(metadata)
if (info.version !== version)
  throw new Error('Update metadata version differs from package version.')
const files = ['latest.yml']
for (const arch of ['x64', 'arm64']) {
  const filename = `${name}-${version}-${arch}-setup.exe`
  const entry = info.files.find((file) => file.url === filename)
  if (!entry) throw new Error(`Update metadata is missing ${filename}.`)
  const actual = createHash('sha512')
    .update(readFileSync(join('dist', filename)))
    .digest('base64')
  if (actual !== entry.sha512) throw new Error(`Update checksum mismatch: ${filename}.`)
  files.push(filename, `${filename}.blockmap`)
}
// Read every file before creating output, and refuse stale output from an earlier release.
const checksums = files.map(
  (filename) =>
    `${createHash('sha256')
      .update(readFileSync(join('dist', filename)))
      .digest('hex')}  ${filename}`
)
mkdirSync('release-artifacts')
for (const filename of files)
  copyFileSync(join('dist', filename), join('release-artifacts', filename))
writeFileSync('release-artifacts/SHA256SUMS.txt', `${checksums.join('\n')}\n`)
console.log('Verified Windows installers, blockmaps, and latest.yml in release-artifacts/.')
