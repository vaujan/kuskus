const assert = require('node:assert/strict')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()
const { runDevReloadAction } = require('../src/renderer/src/features/shell/dev-menu-actions.ts')

for (const action of ['reset-onboarding', 'reset-preferences', 'reload']) {
  test(`${action} waits for pending note saves and cancels when saving fails`, async (context) => {
    const calls = []
    globalThis.window = {
      electron: {
        window: {
          devAction: async () => {
            calls.push('reset')
            return true
          }
        }
      },
      location: { reload: () => calls.push('reload') }
    }
    globalThis.localStorage = { clear: () => calls.push('preferences') }
    context.after(() => {
      delete globalThis.window
      delete globalThis.localStorage
    })
    let finishSave
    const saving = new Promise((resolve) => {
      finishSave = resolve
    })
    const pending = runDevReloadAction(action, () => saving)
    await Promise.resolve()
    assert.deepEqual(calls, [])
    finishSave(false)
    await pending
    assert.deepEqual(calls, [])
    await runDevReloadAction(action, async () => {
      throw new Error('save failed')
    }).catch((error) => {
      assert.equal(error.message, 'save failed')
    })
    assert.deepEqual(calls, [])
    await runDevReloadAction(action, async () => true)
    assert.deepEqual(
      calls,
      action === 'reset-onboarding'
        ? ['reset', 'reload']
        : action === 'reset-preferences'
          ? ['preferences', 'reload']
          : ['reload']
    )
  })
}

test('cancelled detached note closure prevents onboarding reload', async (context) => {
  let reloaded = false
  globalThis.window = {
    electron: { window: { devAction: async () => false } },
    location: {
      reload: () => {
        reloaded = true
      }
    }
  }
  context.after(() => {
    delete globalThis.window
  })
  await runDevReloadAction('reset-onboarding', async () => true)
  assert.equal(reloaded, false)
})
