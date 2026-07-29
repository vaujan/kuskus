const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true
    },
    fileName: filename
  })
  module._compile(output.outputText, filename)
}

const {
  GLOBAL_CAPTURE_ACCELERATOR,
  GlobalCaptureShortcutController,
  revealWindow
} = require('../src/main/window/global-capture-shortcut.ts')

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createRegistrar(result = true) {
  return {
    callback: null,
    registrations: [],
    unregistrations: [],
    register(accelerator, callback) {
      this.registrations.push(accelerator)
      this.callback = callback
      return result
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
