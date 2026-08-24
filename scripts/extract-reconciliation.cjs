'use strict'
// Extract the reconciliation/perf/demo test block (lines 217-445) into
// tests/service-reconciliation.test.cjs.
const { readFileSync, writeFileSync } = require('node:fs')

const file = 'tests/library-service.test.cjs'
const lines = readFileSync(file, 'utf8').split('\n')

const [start, end] = [217, 445]
const body = lines.slice(start - 1, end).join('\n')

const header = `const assert = require('node:assert/strict')
const { existsSync } = require('node:fs')
const { mkdtemp, readFile, rm, stat, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join, relative, resolve } = require('node:path')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const { LibraryService } = require('../src/main/library/library-service.ts')
const { LIBRARY_NAME, seedDemoEnvironment } = require('../scripts/create-demo-library.cjs')

`

writeFileSync('tests/service-reconciliation.test.cjs', header + body + '\n')

const keep = []
for (let i = 1; i <= lines.length; i += 1) {
  if (i < start || i > end) keep.push(lines[i - 1])
}
writeFileSync(file, keep.join('\n'))
console.log('extracted', end - start + 1, 'lines; monolith now', keep.length, 'lines')