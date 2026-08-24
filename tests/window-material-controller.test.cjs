const assert = require('node:assert/strict')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const {
  createWindowMaterialController,
  readTranslucentBackgroundPreference
} = require('../src/renderer/src/lib/window-material-controller.ts')
const {
  LEGACY_TRANSLUCENT_BACKGROUND_STORAGE_KEY,
  TRANSLUCENT_BACKGROUND_STORAGE_KEY
} = require('../src/shared/window-contract.ts')

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createStorage(initialEntries = []) {
  const values = new Map(initialEntries)
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  }
}

test('defaults to enabled and migrates the legacy preference key', () => {
  assert.equal(readTranslucentBackgroundPreference(createStorage()), true)

  const storage = createStorage([[LEGACY_TRANSLUCENT_BACKGROUND_STORAGE_KEY, 'false']])
  assert.equal(readTranslucentBackgroundPreference(storage), false)
  assert.equal(storage.values.get(TRANSLUCENT_BACKGROUND_STORAGE_KEY), 'false')
  assert.equal(storage.values.has(LEGACY_TRANSLUCENT_BACKGROUND_STORAGE_KEY), false)
})

test('falls back to enabled when renderer preference storage is unavailable', () => {
  const storage = {
    getItem: () => {
      throw new Error('unavailable')
    },
    setItem: () => {
      throw new Error('unavailable')
    },
    removeItem: () => {
      throw new Error('unavailable')
    }
  }
  assert.equal(readTranslucentBackgroundPreference(storage), true)
})

test('initializes the document and native Acrylic state once', async () => {
  const documentStates = []
  const nativeRequests = []
  let reducedTransparencySubscriptions = 0
  const controller = createWindowMaterialController({
    platform: 'win32',
    storage: createStorage(),
    applyDocumentState: (enabled) => documentStates.push(enabled),
    setNativeState: async (enabled) => {
      nativeRequests.push(enabled)
      return { supported: true, enabled, reducedTransparency: false }
    },
    onReducedTransparencyChange: () => {
      reducedTransparencySubscriptions += 1
      return () => undefined
    }
  })

  const firstRequest = controller.initialize()
  const secondRequest = controller.initialize()
  assert.equal(firstRequest, secondRequest)
  assert.deepEqual(await firstRequest, {
    supported: true,
    enabled: true,
    reducedTransparency: false
  })
  assert.deepEqual(nativeRequests, [true])
  assert.equal(reducedTransparencySubscriptions, 1)
  assert.deepEqual(documentStates, [true, true])
  assert.deepEqual(controller.getSnapshot(), {
    preferenceEnabled: true,
    status: { supported: true, enabled: true, reducedTransparency: false }
  })

  const subscribedSnapshots = []
  const unsubscribe = controller.subscribe((snapshot) => subscribedSnapshots.push(snapshot))
  assert.deepEqual(subscribedSnapshots, [controller.getSnapshot()])
  unsubscribe()
})

test('rolls preference, document, and snapshot back when native activation fails', async () => {
  const storage = createStorage([[TRANSLUCENT_BACKGROUND_STORAGE_KEY, 'false']])
  const documentStates = []
  let failNextRequest = false
  const controller = createWindowMaterialController({
    platform: 'win32',
    storage,
    applyDocumentState: (enabled) => documentStates.push(enabled),
    setNativeState: async (enabled) => {
      if (failNextRequest) throw new Error('native failure')
      return { supported: true, enabled, reducedTransparency: false }
    },
    onReducedTransparencyChange: () => () => undefined
  })

  await controller.initialize()
  failNextRequest = true
  controller.setEnabled(true)
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(storage.values.get(TRANSLUCENT_BACKGROUND_STORAGE_KEY), 'false')
  assert.equal(documentStates.at(-1), false)
  assert.deepEqual(controller.getSnapshot(), {
    preferenceEnabled: false,
    status: { supported: true, enabled: false, reducedTransparency: false }
  })
})

test('keeps the latest preference when native responses arrive out of order', async () => {
  const pendingRequests = []
  const controller = createWindowMaterialController({
    platform: 'win32',
    storage: createStorage(),
    applyDocumentState: () => undefined,
    setNativeState: (enabled) =>
      new Promise((resolve) => pendingRequests.push({ enabled, resolve })),
    onReducedTransparencyChange: () => () => undefined
  })

  controller.setEnabled(false)
  controller.setEnabled(true)
  pendingRequests[1].resolve({
    supported: true,
    enabled: true,
    reducedTransparency: false
  })
  await new Promise((resolve) => setImmediate(resolve))
  pendingRequests[0].resolve({
    supported: true,
    enabled: false,
    reducedTransparency: false
  })
  await new Promise((resolve) => setImmediate(resolve))

  assert.deepEqual(controller.getSnapshot(), {
    preferenceEnabled: true,
    status: { supported: true, enabled: true, reducedTransparency: false }
  })
})

test('does not invoke native material APIs outside Windows', async () => {
  let nativeRequestCount = 0
  const controller = createWindowMaterialController({
    platform: 'linux',
    storage: createStorage(),
    applyDocumentState: () => undefined,
    setNativeState: async () => {
      nativeRequestCount += 1
      return { supported: true, enabled: true, reducedTransparency: false }
    },
    onReducedTransparencyChange: () => () => undefined
  })

  assert.deepEqual(await controller.initialize(), {
    supported: false,
    enabled: false,
    reducedTransparency: false
  })
  assert.equal(nativeRequestCount, 0)
})

test('preserves the preference while reduced transparency disables the material', async () => {
  const storage = createStorage()
  const documentStates = []
  let reducedTransparency = false
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  let notifyReducedTransparency = () => undefined
  const controller = createWindowMaterialController({
    platform: 'win32',
    storage,
    applyDocumentState: (enabled) => documentStates.push(enabled),
    setNativeState: async (enabled) => ({
      supported: true,
      enabled: enabled && !reducedTransparency,
      reducedTransparency
    }),
    onReducedTransparencyChange: (callback) => {
      notifyReducedTransparency = callback
      return () => undefined
    }
  })

  await controller.initialize()
  reducedTransparency = true
  notifyReducedTransparency()
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(storage.values.get(TRANSLUCENT_BACKGROUND_STORAGE_KEY), undefined)
  assert.equal(controller.getSnapshot().preferenceEnabled, true)
  assert.deepEqual(controller.getSnapshot().status, {
    supported: true,
    enabled: false,
    reducedTransparency: true
  })
  assert.equal(documentStates.at(-1), false)
})
