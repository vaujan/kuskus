import {
  LEGACY_TRANSLUCENT_BACKGROUND_STORAGE_KEY,
  resolveTranslucentBackgroundPreference,
  TRANSLUCENT_BACKGROUND_STORAGE_KEY,
  type DesktopPlatform,
  type TranslucentBackgroundStatus
} from '../../../shared/window-contract'

const UNSUPPORTED_STATUS: TranslucentBackgroundStatus = {
  supported: false,
  enabled: false,
  reducedTransparency: false
}

export interface WindowMaterialStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export interface WindowMaterialEnvironment {
  platform: DesktopPlatform
  storage: WindowMaterialStorage
  applyDocumentState: (enabled: boolean) => void
  setNativeState: (enabled: boolean) => Promise<TranslucentBackgroundStatus>
  onReducedTransparencyChange: (callback: () => void) => () => void
}

export interface WindowMaterialSnapshot {
  preferenceEnabled: boolean
  status: TranslucentBackgroundStatus | null
}

type WindowMaterialListener = (snapshot: WindowMaterialSnapshot) => void

export interface WindowMaterialController {
  getSnapshot: () => WindowMaterialSnapshot
  initialize: () => Promise<TranslucentBackgroundStatus>
  setEnabled: (enabled: boolean) => void
  subscribe: (listener: WindowMaterialListener) => () => void
}

export function readTranslucentBackgroundPreference(storage: WindowMaterialStorage): boolean {
  try {
    const storedValue = storage.getItem(TRANSLUCENT_BACKGROUND_STORAGE_KEY)
    if (storedValue !== null) return resolveTranslucentBackgroundPreference(storedValue)

    const legacyValue = storage.getItem(LEGACY_TRANSLUCENT_BACKGROUND_STORAGE_KEY)
    const preference = resolveTranslucentBackgroundPreference(legacyValue)
    if (legacyValue !== null) {
      storage.setItem(TRANSLUCENT_BACKGROUND_STORAGE_KEY, String(preference))
      storage.removeItem(LEGACY_TRANSLUCENT_BACKGROUND_STORAGE_KEY)
    }
    return preference
  } catch {
    return true
  }
}

function writeTranslucentBackgroundPreference(
  storage: WindowMaterialStorage,
  enabled: boolean
): void {
  try {
    storage.setItem(TRANSLUCENT_BACKGROUND_STORAGE_KEY, String(enabled))
  } catch {
    // The native state can still be changed for this session when storage is unavailable.
  }
}

export function createWindowMaterialController(
  environment: WindowMaterialEnvironment
): WindowMaterialController {
  const listeners = new Set<WindowMaterialListener>()
  const isWindows = environment.platform === 'win32'
  let operationId = 0
  let initializationRequest: Promise<TranslucentBackgroundStatus> | null = null
  let reducedTransparencyUnsubscribe: (() => void) | null = null
  let snapshot: WindowMaterialSnapshot = {
    preferenceEnabled: readTranslucentBackgroundPreference(environment.storage),
    status: null
  }

  const publish = (nextSnapshot: WindowMaterialSnapshot): void => {
    snapshot = nextSnapshot
    for (const listener of listeners) listener(snapshot)
  }

  const requestNativeState = (enabled: boolean): Promise<TranslucentBackgroundStatus> =>
    isWindows ? environment.setNativeState(enabled) : Promise.resolve(UNSUPPORTED_STATUS)

  const applyStatus = (status: TranslucentBackgroundStatus): void => {
    environment.applyDocumentState(status.enabled)
    publish({ ...snapshot, status })
  }

  const refreshNativeState = (): void => {
    const requestId = ++operationId
    void requestNativeState(snapshot.preferenceEnabled)
      .then((status) => {
        if (requestId === operationId) applyStatus(status)
      })
      .catch(() => {
        if (requestId === operationId) applyStatus(UNSUPPORTED_STATUS)
      })
  }

  const initialize = (): Promise<TranslucentBackgroundStatus> => {
    if (initializationRequest) return initializationRequest

    reducedTransparencyUnsubscribe ??= environment.onReducedTransparencyChange(refreshNativeState)

    const requestId = operationId
    environment.applyDocumentState(isWindows && snapshot.preferenceEnabled)
    initializationRequest = requestNativeState(snapshot.preferenceEnabled)
      .then((status) => {
        if (requestId === operationId) applyStatus(status)
        return status
      })
      .catch(() => {
        if (requestId === operationId) applyStatus(UNSUPPORTED_STATUS)
        return UNSUPPORTED_STATUS
      })
    return initializationRequest
  }

  const setEnabled = (enabled: boolean): void => {
    const previousSnapshot = snapshot
    const previousDocumentState =
      previousSnapshot.status?.enabled ?? (isWindows && previousSnapshot.preferenceEnabled)
    const requestId = ++operationId

    writeTranslucentBackgroundPreference(environment.storage, enabled)
    environment.applyDocumentState(isWindows && enabled)
    publish({ ...snapshot, preferenceEnabled: enabled })

    void requestNativeState(enabled)
      .then((status) => {
        if (requestId !== operationId) return
        if (enabled && status.supported && !status.enabled && !status.reducedTransparency) {
          writeTranslucentBackgroundPreference(
            environment.storage,
            previousSnapshot.preferenceEnabled
          )
          environment.applyDocumentState(previousDocumentState)
          publish(previousSnapshot)
          return
        }
        applyStatus(status)
      })
      .catch(() => {
        if (requestId !== operationId) return
        writeTranslucentBackgroundPreference(
          environment.storage,
          previousSnapshot.preferenceEnabled
        )
        environment.applyDocumentState(previousDocumentState)
        publish(previousSnapshot)
      })
  }

  return {
    getSnapshot: () => snapshot,
    initialize,
    setEnabled,
    subscribe: (listener) => {
      listeners.add(listener)
      listener(snapshot)
      return () => listeners.delete(listener)
    }
  }
}

let browserController: WindowMaterialController | null = null

export function getWindowMaterialController(): WindowMaterialController {
  browserController ??= createWindowMaterialController({
    platform: window.electron.window.platform,
    storage: localStorage,
    applyDocumentState: (enabled) => {
      document.documentElement.dataset.windowMaterial = enabled ? 'acrylic' : 'opaque'
    },
    setNativeState: (enabled) => window.electron.window.setTranslucentBackground(enabled),
    onReducedTransparencyChange: (callback) =>
      window.electron.window.onReducedTransparencyChange(callback)
  })
  return browserController
}
