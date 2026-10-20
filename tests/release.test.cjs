const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { runInNewContext } = require('node:vm')
const test = require('node:test')

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function runRelease({ platform = 'win32', args = [], failAt = -1 } = {}) {
  const calls = []
  const errors = []
  let failed = false
  try {
    runInNewContext(readFileSync('scripts/release.cjs', 'utf8'), {
      process: {
        platform,
        argv: ['node', 'release.cjs', ...args],
        exit: () => {
          throw new Error('exit')
        }
      },
      console: { error: (message) => errors.push(message) },
      require: () => ({
        execFileSync: (command, args) => {
          calls.push({ command, args: Array.from(args) })
          if (calls.length - 1 === failAt) throw new Error('check failed')
        }
      })
    })
  } catch {
    failed = true
  }
  return { calls, errors, failed }
}

test('release validates before requiring signed Windows packaging and never mutates versions or publishes', () => {
  const result = runRelease()
  assert.equal(result.failed, false)
  assert.deepEqual(
    result.calls.map((call) => call.args),
    [
      ['check'],
      ['audit', '--prod'],
      ['exec', 'electron-builder', '--win', '--publish', 'never', '--config.forceCodeSigning=true']
    ]
  )
})

test('failed validation prevents release packaging', () => {
  const result = runRelease({ failAt: 0 })
  assert.equal(result.failed, true)
  assert.equal(result.calls.length, 1)
})

test('release refuses unsupported hosts and obsolete version-bump arguments', () => {
  for (const options of [{ platform: 'linux' }, { args: ['patch'] }]) {
    const result = runRelease(options)
    assert.equal(result.failed, true)
    assert.equal(result.calls.length, 0)
    assert.equal(result.errors.length, 1)
  }
})
