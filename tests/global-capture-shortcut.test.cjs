const assert = require('node:assert/strict')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const {
  GLOBAL_CAPTURE_ACCELERATOR,
  GLOBAL_CAPTURE_SHORTCUT_LABEL,
  GlobalCaptureShortcutController,
  revealWindow
} = require('../src/main/window/global-capture-shortcut.ts')

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createRegistrar(result = true) {
  return {
    result,
    callback: null,
    registrations: [],
    unregistrations: [],
    register(accelerator, callback) {
      this.registrations.push(accelerator)
      this.callback = callback
      return this.result
    },
    unregister(accelerator) {
      this.unregistrations.push(accelerator)
    }
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createTarget(rendererReady = true) {
  return {
    rendererReady,
    revealCount: 0,
    requestCount: 0,
    readyCallbacks: [],
    reveal() {
      this.revealCount += 1
    },
    isRendererReady() {
      return this.rendererReady
    },
    sendCaptureRequest() {
      this.requestCount += 1
    },
    onceRendererReady(callback) {
      this.readyCallbacks.push(callback)
    }
  }
}

test('registers the fixed shortcut, reports status, and unregisters on stop', () => {
  const registrar = createRegistrar()
  const controller = new GlobalCaptureShortcutController(registrar, () => createTarget())

  assert.deepEqual(controller.start(), {
    accelerator: 'Ctrl+Shift+Space',
    registered: true
  })
  assert.deepEqual(registrar.registrations, [GLOBAL_CAPTURE_ACCELERATOR])
  controller.stop()
  assert.deepEqual(registrar.unregistrations, [GLOBAL_CAPTURE_ACCELERATOR])
  assert.equal(controller.getStatus().registered, false)
})

test('reports a registration collision without unregistering an unowned shortcut', () => {
  const registrar = createRegistrar(false)
  const controller = new GlobalCaptureShortcutController(registrar, () => createTarget())

  assert.equal(controller.start().registered, false)
  controller.stop()
  assert.deepEqual(registrar.unregistrations, [])
})

test('re-registers a new accelerator and persists it on success', () => {
  const registrar = createRegistrar()
  const persisted = []
  const controller = new GlobalCaptureShortcutController(
    registrar,
    () => createTarget(),
    (accelerator) => persisted.push(accelerator)
  )
  controller.start()

  const status = controller.setAccelerator('Control+Alt+P')

  assert.equal(status.accelerator, 'Control+Alt+P')
  assert.equal(status.registered, true)
  assert.deepEqual(registrar.registrations, [GLOBAL_CAPTURE_ACCELERATOR, 'Control+Alt+P'])
  assert.deepEqual(registrar.unregistrations, [GLOBAL_CAPTURE_ACCELERATOR])
  assert.deepEqual(persisted, ['Control+Alt+P'])
})

test('rolls back to the previous accelerator when the new one collides', () => {
  const registrar = createRegistrar()
  const controller = new GlobalCaptureShortcutController(registrar, () => createTarget())
  controller.start()

  // Second registration (the new accelerator) fails.
  registrar.result = false
  const status = controller.setAccelerator('Control+Alt+P')

  assert.equal(status.accelerator, GLOBAL_CAPTURE_SHORTCUT_LABEL)
  assert.equal(status.registered, true)
  // The previous shortcut is re-registered after the collision.
  assert.deepEqual(registrar.registrations, [
    GLOBAL_CAPTURE_ACCELERATOR,
    'Control+Alt+P',
    GLOBAL_CAPTURE_ACCELERATOR
  ])
  assert.deepEqual(registrar.unregistrations, [GLOBAL_CAPTURE_ACCELERATOR])
})

test('starts with a persisted accelerator when provided', () => {
  const registrar = createRegistrar()
  const controller = new GlobalCaptureShortcutController(registrar, () => createTarget())

  const status = controller.start('Control+Alt+K')

  assert.equal(status.accelerator, 'Control+Alt+K')
  assert.deepEqual(registrar.registrations, ['Control+Alt+K'])
  controller.stop()
  assert.deepEqual(registrar.unregistrations, ['Control+Alt+K'])
})

test('reveals the window and sends every request after the renderer is ready', () => {
  const registrar = createRegistrar()
  const target = createTarget()
  const controller = new GlobalCaptureShortcutController(registrar, () => target)
  controller.start()

  registrar.callback()
  registrar.callback()
  assert.equal(target.revealCount, 2)
  assert.equal(target.requestCount, 2)
})

test('coalesces requests until the renderer finishes loading', () => {
  const registrar = createRegistrar()
  const target = createTarget(false)
  const controller = new GlobalCaptureShortcutController(registrar, () => target)
  controller.start()

  registrar.callback()
  registrar.callback()
  assert.equal(target.revealCount, 2)
  assert.equal(target.requestCount, 0)
  assert.equal(target.readyCallbacks.length, 1)

  target.rendererReady = true
  target.readyCallbacks[0]()
  assert.equal(target.requestCount, 1)
  registrar.callback()
  assert.equal(target.requestCount, 2)
})

test('restores a minimized hidden window before focusing it', () => {
  const calls = []
  revealWindow({
    isDestroyed: () => false,
    isMinimized: () => true,
    isVisible: () => false,
    restore: () => calls.push('restore'),
    show: () => calls.push('show'),
    focus: () => calls.push('focus')
  })
  assert.deepEqual(calls, ['restore', 'show', 'focus'])
})

test('does nothing when the target window has been destroyed', () => {
  const calls = []
  revealWindow({
    isDestroyed: () => true,
    isMinimized: () => true,
    isVisible: () => false,
    restore: () => calls.push('restore'),
    show: () => calls.push('show'),
    focus: () => calls.push('focus')
  })
  assert.deepEqual(calls, [])
})
