/* eslint-disable @typescript-eslint/no-require-imports */
const { existsSync } = require('node:fs')
const { join } = require('node:path')
const { listPackage, extractFile } = require('@electron/asar')
const platform = process.argv[2] ?? process.platform
if (!['win32', 'linux'].includes(platform)) throw new Error('Inspect a win32 or linux package.')
const root = join('dist', platform === 'win32' ? 'win-unpacked' : 'linux-unpacked')
const archive = join(root, 'resources', 'app.asar')
const files = listPackage(archive).map((name) => name.replaceAll('\\', '/').replace(/^\/+/, ''))
const allowedRoots = new Set([
  'out',
  'resources',
  'node_modules',
  'package.json',
  'LICENSE',
  'THIRD_PARTY_NOTICES.txt'
])
for (const file of files) {
  if (!allowedRoots.has(file.split('/')[0])) throw new Error(`Unexpected package entry: ${file}`)
  if (/(^|\/)\.env(?:\.|$)|\.(?:pfx|p12|pem|key)$/i.test(file)) {
    throw new Error(`Potential secret file in package: ${file}`)
  }
}
for (const required of [
  'out/main/index.js',
  'out/preload/index.js',
  'out/renderer/index.html',
  'LICENSE',
  'THIRD_PARTY_NOTICES.txt'
]) {
  if (!files.includes(required)) throw new Error(`Package is missing ${required}`)
}
if (!extractFile(archive, 'THIRD_PARTY_NOTICES.txt').includes(Buffer.from('Kenny Bergquist'))) {
  throw new Error('Package is missing the atomic editor attribution.')
}
for (const name of ['LICENSE.electron.txt', 'LICENSES.chromium.html']) {
  if (!existsSync(join(root, name))) throw new Error(`Electron notice missing: ${name}`)
}
console.log(`Verified ${files.length} archive entries and Electron notices in ${root}.`)
