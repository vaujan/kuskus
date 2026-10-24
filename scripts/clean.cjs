/* eslint-disable @typescript-eslint/no-require-imports */
const { rmSync, readdirSync } = require('node:fs')
const { resolve } = require('node:path')

if (process.argv.length !== 2) throw new Error('Usage: pnpm clean (no arguments).')
const root = resolve(__dirname, '..')
const outputs = [
  'out',
  'dist',
  'landing-page/dist',
  'storybook-static',
  '.eslintcache',
  'THIRD_PARTY_NOTICES.txt',
  ...readdirSync(root).filter((name) => name.endsWith('.tsbuildinfo'))
]
for (const output of outputs) rmSync(resolve(root, output), { recursive: true, force: true })
console.log('Removed generated builds, notices, and compiler/lint caches.')
