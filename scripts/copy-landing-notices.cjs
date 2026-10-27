/* eslint-disable @typescript-eslint/no-require-imports */
const { copyFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { execFileSync } = require('node:child_process')
const root = resolve(__dirname, '..')
const pnpm = 'pnpm'
execFileSync(pnpm, ['licenses:generate'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32'
})
for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.txt']) {
  copyFileSync(resolve(root, name), resolve(root, 'landing-page/dist', name))
}
