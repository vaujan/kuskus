/* eslint-disable @typescript-eslint/no-require-imports */

const { execSync } = require('node:child_process')
const { platform } = require('node:process')

const BUMP_TYPES = ['patch', 'minor', 'major']
const BUILD_SCRIPTS = { win32: 'build:win', darwin: 'build:mac', linux: 'build:linux' }

const bump = process.argv[2]
if (!BUMP_TYPES.includes(bump)) {
  console.error('usage: node scripts/release.cjs <patch|minor|major>')
  process.exit(1)
}

execSync(`pnpm version ${bump}`, { stdio: 'inherit' })
execSync(`pnpm ${BUILD_SCRIPTS[platform]}`, { stdio: 'inherit' })
