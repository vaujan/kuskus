import { contextBridge, ipcRenderer } from 'electron'
import {
  CAPTURE_CHANNELS,
  type CaptureApi,
  type CaptureQueueDto,
  type CaptureSessionDto
} from '../shared/capture-contract'
import { KUSKUS_CHANNELS, type KuskusLibraryApi } from '../shared/library-contract'
import {
  WINDOW_CHANNELS,
  type AppZoomShortcut,
  type ElectronWindowApi,
  type GlobalCaptureShortcutStatus,
  type TranslucentBackgroundStatus
} from '../shared/window-contract'

const globalCaptureCallbacks = new Set<() => void>()
let globalCaptureRequestPending = false
const quickCaptureCallbacks = new Set<() => void>()
let quickCaptureRequestPending = false
const mainItemCallbacks = new Set<(itemId: string) => void>()
let pendingMainItemId: string | null = null

ipcRenderer.on(WINDOW_CHANNELS.globalCaptureRequested, () => {
  if (globalCaptureCallbacks.size === 0) {
    globalCaptureRequestPending = true
    return
  }
  for (const callback of globalCaptureCallbacks) callback()
})

ipcRenderer.on(CAPTURE_CHANNELS.quickCaptureActivated, () => {
  if (quickCaptureCallbacks.size === 0) {
    quickCaptureRequestPending = true
    return
  }
  for (const callback of quickCaptureCallbacks) callback()
})

ipcRenderer.on(CAPTURE_CHANNELS.mainItemRequested, (_event, itemId: string) => {
  if (mainItemCallbacks.size === 0) {
    pendingMainItemId = itemId
    return
  }
  for (const callback of mainItemCallbacks) callback(itemId)
})

const windowApi: ElectronWindowApi = {
  platform: process.platform,
  minimize: (): void => ipcRenderer.send(WINDOW_CHANNELS.minimize),
  toggleMaximize: (): void => ipcRenderer.send(WINDOW_CHANNELS.toggleMaximize),
  close: (): void => ipcRenderer.send(WINDOW_CHANNELS.close),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke(WINDOW_CHANNELS.isMaximized),
  setZoomFactor: (zoomFactor): Promise<number> =>
    ipcRenderer.invoke(WINDOW_CHANNELS.setZoomFactor, zoomFactor),
  setTranslucentBackground: (enabled): Promise<TranslucentBackgroundStatus> =>
    ipcRenderer.invoke(WINDOW_CHANNELS.setTranslucentBackground, enabled),
  onReducedTransparencyChange: (callback: (reduced: boolean) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, reduced: boolean): void => {
      callback(reduced)
    }

    ipcRenderer.on(WINDOW_CHANNELS.reducedTransparencyChanged, listener)
    return () => ipcRenderer.removeListener(WINDOW_CHANNELS.reducedTransparencyChanged, listener)
  },
  onMaximizedChange: (callback: (isMaximized: boolean) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isMaximized: boolean): void => {
      callback(isMaximized)
    }

    ipcRenderer.on(WINDOW_CHANNELS.maximizedChanged, listener)
    return () => ipcRenderer.removeListener(WINDOW_CHANNELS.maximizedChanged, listener)
  },
  onZoomShortcut: (callback: (shortcut: AppZoomShortcut) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, shortcut: AppZoomShortcut): void => {
      callback(shortcut)
    }

    ipcRenderer.on(WINDOW_CHANNELS.zoomShortcut, listener)
    return () => ipcRenderer.removeListener(WINDOW_CHANNELS.zoomShortcut, listener)
  },
  getGlobalCaptureShortcutStatus: (): Promise<GlobalCaptureShortcutStatus> =>
    ipcRenderer.invoke(WINDOW_CHANNELS.getGlobalCaptureShortcutStatus),
  onGlobalCaptureRequested: (callback: () => void): (() => void) => {
    globalCaptureCallbacks.add(callback)
    if (globalCaptureRequestPending) {
      globalCaptureRequestPending = false
      queueMicrotask(callback)
    }
    return () => globalCaptureCallbacks.delete(callback)
  },
  openNoteWindow: (itemId): Promise<void> =>
    ipcRenderer.invoke(WINDOW_CHANNELS.openNoteWindow, itemId),
  onNoteWindowCloseRequested: (callback): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on(WINDOW_CHANNELS.noteWindowCloseRequested, listener)
    return () => ipcRenderer.removeListener(WINDOW_CHANNELS.noteWindowCloseRequested, listener)
  },
  resolveNoteWindowClose: (approved): void =>
    ipcRenderer.send(WINDOW_CHANNELS.resolveNoteWindowClose, approved)
}

const libraryApi: KuskusLibraryApi = {
  getState: () => ipcRenderer.invoke(KUSKUS_CHANNELS.getLibraryState),
  getOverview: () => ipcRenderer.invoke(KUSKUS_CHANNELS.getLibraryOverview),
  getItemDetail: (itemId) => ipcRenderer.invoke(KUSKUS_CHANNELS.getItemDetail, itemId),
  queryItems: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.queryItems, input),
  reconcile: () => ipcRenderer.invoke(KUSKUS_CHANNELS.reconcileLibrary),
  reconcileOverview: () => ipcRenderer.invoke(KUSKUS_CHANNELS.reconcileLibraryOverview),
  create: (name) => ipcRenderer.invoke(KUSKUS_CHANNELS.createLibrary, name),
  open: () => ipcRenderer.invoke(KUSKUS_CHANNELS.openLibrary),
  initializeVault: () => ipcRenderer.invoke(KUSKUS_CHANNELS.initializeVault),
  migrateLibrary: () => ipcRenderer.invoke(KUSKUS_CHANNELS.migrateLibrary),
  createNote: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.createNote, input),
  updateNote: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.updateNote, input),
  importNoteImage: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.importNoteImage, input),
  listCaptureDraftImages: () => ipcRenderer.invoke(KUSKUS_CHANNELS.listCaptureDraftImages),
  stageCaptureDraftImage: (input) =>
    ipcRenderer.invoke(KUSKUS_CHANNELS.stageCaptureDraftImage, input),
  renameCaptureDraftImage: (input) =>
    ipcRenderer.invoke(KUSKUS_CHANNELS.renameCaptureDraftImage, input),
  removeCaptureDraftImage: (attachmentId) =>
    ipcRenderer.invoke(KUSKUS_CHANNELS.removeCaptureDraftImage, attachmentId),
  discardCaptureDraft: () => ipcRenderer.invoke(KUSKUS_CHANNELS.discardCaptureDraft),
  getCaptureDraftImagePreview: (attachmentId) =>
    ipcRenderer.invoke(KUSKUS_CHANNELS.getCaptureDraftImagePreview, attachmentId),
  commitCaptureDraftImage: (attachmentId) =>
    ipcRenderer.invoke(KUSKUS_CHANNELS.commitCaptureDraftImage, attachmentId),
  getCaptureDraftFile: () => ipcRenderer.invoke(KUSKUS_CHANNELS.getCaptureDraftFile),
  stageCaptureDraftFile: (input) =>
    ipcRenderer.invoke(KUSKUS_CHANNELS.stageCaptureDraftFile, input),
  removeCaptureDraftFile: () => ipcRenderer.invoke(KUSKUS_CHANNELS.removeCaptureDraftFile),
  commitCaptureDraftFile: (fileId) =>
    ipcRenderer.invoke(KUSKUS_CHANNELS.commitCaptureDraftFile, fileId),
  getNoteAttachmentPreview: (itemId, attachmentId) =>
    ipcRenderer.invoke(KUSKUS_CHANNELS.getNoteAttachmentPreview, itemId, attachmentId),
  createUrl: (url) => ipcRenderer.invoke(KUSKUS_CHANNELS.createUrl, url),
  enrichUrl: (itemId) => ipcRenderer.invoke(KUSKUS_CHANNELS.enrichUrl, itemId),
  getUrlPreview: (itemId, kind) => ipcRenderer.invoke(KUSKUS_CHANNELS.getUrlPreview, itemId, kind),
  createCollection: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.createCollection, input),
  renameCollection: (id, name) => ipcRenderer.invoke(KUSKUS_CHANNELS.renameCollection, id, name),
  moveCollection: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.moveCollection, input),
  setCollectionIcon: (id, icon) => ipcRenderer.invoke(KUSKUS_CHANNELS.setCollectionIcon, id, icon),
  deleteCollection: (id) => ipcRenderer.invoke(KUSKUS_CHANNELS.deleteCollection, id),
  renameItem: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.renameItem, input),
  moveItems: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.moveItems, input),
  setItemsPinned: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.setItemsPinned, input),
  archiveItems: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.archiveItems, input),
  unarchiveItems: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.unarchiveItems, input),
  trashItems: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.trashItems, input),
  restoreItems: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.restoreItems, input),
  permanentlyDeleteItems: (input) =>
    ipcRenderer.invoke(KUSKUS_CHANNELS.permanentlyDeleteItems, input),
  inspectItemDeletion: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.inspectItemDeletion, input),
  getImageThumbnail: (itemId) => ipcRenderer.invoke(KUSKUS_CHANNELS.getImageThumbnail, itemId),
  getImagePreview: (itemId) => ipcRenderer.invoke(KUSKUS_CHANNELS.getImagePreview, itemId),
  importFile: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.importFile, input),
  copyLibraryPath: () => ipcRenderer.invoke(KUSKUS_CHANNELS.copyLibraryPath),
  showItemInExplorer: (itemId) => ipcRenderer.invoke(KUSKUS_CHANNELS.showItemInExplorer, itemId),
  openExternalUrl: (url) => ipcRenderer.invoke(KUSKUS_CHANNELS.openExternalUrl, url),
  onVaultChanged: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on(KUSKUS_CHANNELS.vaultChanged, listener)
    return () => ipcRenderer.removeListener(KUSKUS_CHANNELS.vaultChanged, listener)
  }
}

const captureApi: CaptureApi = {
  getSession: (libraryId) => ipcRenderer.invoke(CAPTURE_CHANNELS.getSession, libraryId),
  updateSession: (input) => ipcRenderer.invoke(CAPTURE_CHANNELS.updateSession, input),
  clearSession: (libraryId) => ipcRenderer.invoke(CAPTURE_CHANNELS.clearSession, libraryId),
  touchAssets: (libraryId) => ipcRenderer.invoke(CAPTURE_CHANNELS.touchAssets, libraryId),
  setBusy: (libraryId, busy) => ipcRenderer.invoke(CAPTURE_CHANNELS.setBusy, libraryId, busy),
  claimSurface: (libraryId, surface) =>
    ipcRenderer.invoke(CAPTURE_CHANNELS.claimSurface, libraryId, surface),
  submit: (input) => ipcRenderer.invoke(CAPTURE_CHANNELS.submit, input),
  waitForSubmission: (id) => ipcRenderer.invoke(CAPTURE_CHANNELS.waitForSubmission, id),
  getQueue: (libraryId) => ipcRenderer.invoke(CAPTURE_CHANNELS.getQueue, libraryId),
  retrySubmission: (id) => ipcRenderer.invoke(CAPTURE_CHANNELS.retrySubmission, id),
  restoreSubmission: (id) => ipcRenderer.invoke(CAPTURE_CHANNELS.restoreSubmission, id),
  discardSubmission: (id) => ipcRenderer.invoke(CAPTURE_CHANNELS.discardSubmission, id),
  hideQuickCapture: () => ipcRenderer.send(CAPTURE_CHANNELS.hideQuickCapture),
  openMainCapture: () => ipcRenderer.send(CAPTURE_CHANNELS.openMainCapture),
  openMainItem: (itemId) => ipcRenderer.send(CAPTURE_CHANNELS.openMainItem, itemId),
  openRecovery: () => ipcRenderer.send(CAPTURE_CHANNELS.openRecovery),
  setQuickCaptureHeight: (height) =>
    ipcRenderer.send(CAPTURE_CHANNELS.setQuickCaptureHeight, height),
  setQuickCaptureBlurSuppressed: (suppressed) =>
    ipcRenderer.send(CAPTURE_CHANNELS.setQuickCaptureBlurSuppressed, suppressed),
  onSessionChanged: (callback: (session: CaptureSessionDto) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, session: CaptureSessionDto): void => {
      callback(session)
    }
    ipcRenderer.on(CAPTURE_CHANNELS.sessionChanged, listener)
    return () => ipcRenderer.removeListener(CAPTURE_CHANNELS.sessionChanged, listener)
  },
  onQueueChanged: (callback: (queue: CaptureQueueDto) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, queue: CaptureQueueDto): void => {
      callback(queue)
    }
    ipcRenderer.on(CAPTURE_CHANNELS.queueChanged, listener)
    return () => ipcRenderer.removeListener(CAPTURE_CHANNELS.queueChanged, listener)
  },
  onRecoveryRequested: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on(CAPTURE_CHANNELS.recoveryRequested, listener)
    return () => ipcRenderer.removeListener(CAPTURE_CHANNELS.recoveryRequested, listener)
  },
  onQuickCaptureActivated: (callback: () => void): (() => void) => {
    quickCaptureCallbacks.add(callback)
    if (quickCaptureRequestPending) {
      quickCaptureRequestPending = false
      queueMicrotask(callback)
    }
    return () => quickCaptureCallbacks.delete(callback)
  },
  onMainItemRequested: (callback: (itemId: string) => void): (() => void) => {
    mainItemCallbacks.add(callback)
    if (pendingMainItemId) {
      const itemId = pendingMainItemId
      pendingMainItemId = null
      queueMicrotask(() => callback(itemId))
    }
    return () => mainItemCallbacks.delete(callback)
  }
}

contextBridge.exposeInMainWorld('electron', { window: windowApi })
contextBridge.exposeInMainWorld('kuskus', libraryApi)
contextBridge.exposeInMainWorld('capture', captureApi)
