const assert = require('node:assert/strict')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const {
  HYPRLAND_DEFAULT_ACCELERATOR,
  HyprlandGlobalCaptureController
} = require('../src/main/hyprland/hyprland-global-capture.ts')

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createFakeHyprctl() {
  return {
    evals: [],
    keywordCalls: [],
    failNext: false,
    keyword(name, value) {
      this.keywordCalls.push([name, value])
      if (this.failNext) {
        this.failNext = false
        throw new Error('hyprctl keyword failed')
      }
      return Promise.resolve('ok')
    },
    dispatch() {
      return Promise.resolve('ok')
    },
    eval(code) {
      this.evals.push(code)
      if (this.failNext) {
        this.failNext = false
        throw new Error('hyprctl eval failed')
      }
      return Promise.resolve('ok')
    }
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createFakeSocketServer() {
  return {
    started: false,
    stopped: false,
    trigger: null,
    path: '/tmp/fake-kuskus.sock',
    start() {
      this.started = true
      return Promise.resolve(this.path)
    },
    stop() {
      this.stopped = true
    },
    onTrigger(callback) {
      this.trigger = callback
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

test('registers a Hyprland bind via eval and reports registered', async () => {
  const hyprctl = createFakeHyprctl()
  const sockets = createFakeSocketServer()
  const controller = new HyprlandGlobalCaptureController(() => createTarget(), {
    hyprctl,
    socketServer: sockets
  })

  const status = await controller.start()

  assert.equal(status.registered, true)
  assert.equal(status.accelerator, 'Ctrl+Shift+Space')
  assert.equal(sockets.started, true)
  assert.equal(hyprctl.evals.length, 1)
  const lua = hyprctl.evals[0]
  assert.match(lua, /hl\.bind\(/)
  assert.match(lua, /'CONTROL\+SHIFT\+Space'/)
  assert.match(lua, /os\.execute\(/)
  assert.match(lua, /nc -U \/tmp\/fake-kuskus\.sock/)
  assert.match(lua, /description = 'kuskus-global-capture'/)
})

test('starts with a custom accelerator and normalizes the label', async () => {
  const hyprctl = createFakeHyprctl()
  const sockets = createFakeSocketServer()
  const controller = new HyprlandGlobalCaptureController(() => createTarget(), {
    hyprctl,
    socketServer: sockets,
    accelerator: 'Control+Alt+P'
  })

  const status = await controller.start()

  assert.equal(status.registered, true)
  assert.equal(status.accelerator, 'Ctrl+Alt+P')
  assert.match(hyprctl.evals[0], /'CONTROL\+ALT\+P'/)
})

test('reports unavailable when hyprctl fails', async () => {
  const hyprctl = createFakeHyprctl()
  const sockets = createFakeSocketServer()
  const controller = new HyprlandGlobalCaptureController(() => createTarget(), {
    hyprctl,
    socketServer: sockets
  })
  hyprctl.failNext = true

  const status = await controller.start()

  assert.equal(status.registered, false)
})

test('unregisters the bind and stops the socket on stop', async () => {
  const hyprctl = createFakeHyprctl()
  const sockets = createFakeSocketServer()
  const controller = new HyprlandGlobalCaptureController(() => createTarget(), {
    hyprctl,
    socketServer: sockets
  })
  await controller.start()

  await controller.stop()

  assert.equal(sockets.stopped, true)
  assert.equal(hyprctl.evals.length, 2)
  assert.match(hyprctl.evals[1], /hl\.unbind\(/)
})

test('routes socket triggers through the window target with coalescing', async () => {
  const hyprctl = createFakeHyprctl()
  const sockets = createFakeSocketServer()
  const target = createTarget(false)
  const controller = new HyprlandGlobalCaptureController(() => target, {
    hyprctl,
    socketServer: sockets
  })
  await controller.start()

  sockets.trigger()
  sockets.trigger()
  assert.equal(target.revealCount, 2)
  assert.equal(target.requestCount, 0)
  assert.equal(target.readyCallbacks.length, 1)

  target.rendererReady = true
  target.readyCallbacks[0]()
  assert.equal(target.requestCount, 1)
  sockets.trigger()
  assert.equal(target.requestCount, 2)
})

test('setAccelerator re-binds with the new accelerator and persists', async () => {
  const hyprctl = createFakeHyprctl()
  const sockets = createFakeSocketServer()
  const persisted = []
  const controller = new HyprlandGlobalCaptureController(() => createTarget(), {
    hyprctl,
    socketServer: sockets,
    persistAccelerator: (accelerator) => persisted.push(accelerator)
  })
  await controller.start()
  const initialEvals = hyprctl.evals.length

  const status = await controller.setAccelerator('Control+Alt+P')

  assert.equal(status.registered, true)
  assert.equal(status.accelerator, 'Ctrl+Alt+P')
  assert.deepEqual(persisted, ['Control+Alt+P'])
  // unbind + bind for the new accelerator
  assert.equal(hyprctl.evals.length, initialEvals + 2)
  assert.match(hyprctl.evals[initialEvals], /hl\.unbind\(/)
  assert.match(hyprctl.evals[initialEvals + 1], /'CONTROL\+ALT\+P'/)
})

test('embeds the socket path in the os.execute command', async () => {
  const hyprctl = createFakeHyprctl()
  const sockets = createFakeSocketServer()
  sockets.path = '/home/user/.config/kuskus/kuskus-capture.sock'
  const controller = new HyprlandGlobalCaptureController(() => createTarget(), {
    hyprctl,
    socketServer: sockets
  })

  await controller.start()

  const lua = hyprctl.evals[0]
  assert.match(lua, /os\.execute\('printf x \| nc -U \/home\/user\/\.config\/kuskus\/kuskus-capture\.sock'\)/)
})
