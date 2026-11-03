import { contextBridge, ipcRenderer } from 'electron'
import { UPDATE_CHANNELS, type UpdateApi, type UpdateStatus } from '../shared/update-contract'
import {
  CAPTURE_CHANNELS,
  type CaptureApi,
  type CaptureQueueDto,
  type CaptureSessionDto
} from '../shared/capture-contract'
import { KUSU_CHANNELS, type KusuLibraryApi } from '../shared/library-contract'
import {
  WINDOW_CHANNELS,
  type AppZoomShortcut,
  type EditCommand,
  type ElectronWindowApi,
  type GlobalCaptureShortcutStatus,
  type NativeThemeSource,
  type SpellingLanguagesStatus,
  type TextContextMenuAction,
  type TextContextMenuDetails,
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
  ...(import.meta.env.DEV
    ? {
        devAction: (action: 'reset-onboarding' | 'devtools'): Promise<boolean> =>
          ipcRenderer.invoke(WINDOW_CHANNELS.devAction, action)
      }
    : {}),
  platform: process.platform,
  minimize: (): void => ipcRenderer.send(WINDOW_CHANNELS.minimize),
  toggleMaximize: (): void => ipcRenderer.send(WINDOW_CHANNELS.toggleMaximize),
  close: (): void => ipcRenderer.send(WINDOW_CHANNELS.close),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke(WINDOW_CHANNELS.isMaximized),
  setZoomFactor: (zoomFactor): Promise<number> =>
    ipcRenderer.invoke(WINDOW_CHANNELS.setZoomFactor, zoomFactor),
  setNativeThemeSource: (source: NativeThemeSource): void =>
    ipcRenderer.send(WINDOW_CHANNELS.setNativeThemeSource, source),
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
  edit: (command: EditCommand): void => ipcRenderer.send(WINDOW_CHANNELS.edit, command),
  getSpellingLanguages: (): Promise<SpellingLanguagesStatus> =>
    ipcRenderer.invoke(WINDOW_CHANNELS.getSpellingLanguages),
  setSpellingLanguages: (languages): Promise<SpellingLanguagesStatus> =>
    ipcRenderer.invoke(WINDOW_CHANNELS.setSpellingLanguages, languages),
  onSpellingLanguagesChanged: (callback): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: SpellingLanguagesStatus): void => {
      callback(status)
    }
    ipcRenderer.on(WINDOW_CHANNELS.spellingLanguagesChanged, listener)
    return () => ipcRenderer.removeListener(WINDOW_CHANNELS.spellingLanguagesChanged, listener)
  },
  onTextContextMenu: (callback): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, details: TextContextMenuDetails): void => {
      callback(details)
    }
    ipcRenderer.on(WINDOW_CHANNELS.textContextMenu, listener)
    return () => ipcRenderer.removeListener(WINDOW_CHANNELS.textContextMenu, listener)
  },
  textContextMenuAction: (action: TextContextMenuAction): void =>
    ipcRenderer.send(WINDOW_CHANNELS.textContextMenuAction, action),
  getGlobalCaptureShortcutStatus: (): Promise<GlobalCaptureShortcutStatus> =>
    ipcRenderer.invoke(WINDOW_CHANNELS.getGlobalCaptureShortcutStatus),
  setGlobalCaptureShortcut: (accelerator): Promise<GlobalCaptureShortcutStatus> =>
    ipcRenderer.invoke(WINDOW_CHANNELS.setGlobalCaptureShortcut, accelerator),
  onGlobalCaptureRequested: (callback: () => void): (() => void) => {
    globalCaptureCallbacks.add(callback)
    if (globalCaptureRequestPending) {
      globalCaptureRequestPending = false
      queueMicrotask(callback)
    }
    return () => globalCaptureCallbacks.delete(callback)
  },
  openSettingsWindow: (): Promise<void> => ipcRenderer.invoke(WINDOW_CHANNELS.openSettingsWindow),
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

const libraryApi: KusuLibraryApi = {
  getState: () => ipcRenderer.invoke(KUSU_CHANNELS.getLibraryState),
  getOverview: () => ipcRenderer.invoke(KUSU_CHANNELS.getLibraryOverview),
  getItemDetail: (itemId) => ipcRenderer.invoke(KUSU_CHANNELS.getItemDetail, itemId),
  queryItems: (input) => ipcRenderer.invoke(KUSU_CHANNELS.queryItems, input),
  reconcile: () => ipcRenderer.invoke(KUSU_CHANNELS.reconcileLibrary),
  reconcileOverview: () => ipcRenderer.invoke(KUSU_CHANNELS.reconcileLibraryOverview),
  create: (name) => ipcRenderer.invoke(KUSU_CHANNELS.createLibrary, name),
  open: () => ipcRenderer.invoke(KUSU_CHANNELS.openLibrary),
  initializeVault: () => ipcRenderer.invoke(KUSU_CHANNELS.initializeVault),
  createNote: (input) => ipcRenderer.invoke(KUSU_CHANNELS.createNote, input),
  duplicateNote: (itemId) => ipcRenderer.invoke(KUSU_CHANNELS.duplicateNote, itemId),
  updateNote: (input) => ipcRenderer.invoke(KUSU_CHANNELS.updateNote, input),
  importNoteImage: (input) => ipcRenderer.invoke(KUSU_CHANNELS.importNoteImage, input),
  listCaptureDraftImages: () => ipcRenderer.invoke(KUSU_CHANNELS.listCaptureDraftImages),
  stageCaptureDraftImage: (input) =>
    ipcRenderer.invoke(KUSU_CHANNELS.stageCaptureDraftImage, input),
  renameCaptureDraftImage: (input) =>
    ipcRenderer.invoke(KUSU_CHANNELS.renameCaptureDraftImage, input),
  removeCaptureDraftImage: (attachmentId) =>
    ipcRenderer.invoke(KUSU_CHANNELS.removeCaptureDraftImage, attachmentId),
  discardCaptureDraft: () => ipcRenderer.invoke(KUSU_CHANNELS.discardCaptureDraft),
  getCaptureDraftImagePreview: (attachmentId) =>
    ipcRenderer.invoke(KUSU_CHANNELS.getCaptureDraftImagePreview, attachmentId),
  commitCaptureDraftImage: (attachmentId) =>
    ipcRenderer.invoke(KUSU_CHANNELS.commitCaptureDraftImage, attachmentId),
  getCaptureDraftFile: () => ipcRenderer.invoke(KUSU_CHANNELS.getCaptureDraftFile),
  stageCaptureDraftFile: (input) => ipcRenderer.invoke(KUSU_CHANNELS.stageCaptureDraftFile, input),
  removeCaptureDraftFile: () => ipcRenderer.invoke(KUSU_CHANNELS.removeCaptureDraftFile),
  commitCaptureDraftFile: (fileId) =>
    ipcRenderer.invoke(KUSU_CHANNELS.commitCaptureDraftFile, fileId),
  getNoteAttachmentPreview: (itemId, attachmentId) =>
    ipcRenderer.invoke(KUSU_CHANNELS.getNoteAttachmentPreview, itemId, attachmentId),
  createUrl: (url) => ipcRenderer.invoke(KUSU_CHANNELS.createUrl, url),
  enrichUrl: (itemId) => ipcRenderer.invoke(KUSU_CHANNELS.enrichUrl, itemId),
  getUrlPreview: (itemId, kind) => ipcRenderer.invoke(KUSU_CHANNELS.getUrlPreview, itemId, kind),
  createCollection: (input) => ipcRenderer.invoke(KUSU_CHANNELS.createCollection, input),
  renameCollection: (id, name) => ipcRenderer.invoke(KUSU_CHANNELS.renameCollection, id, name),
  moveCollection: (input) => ipcRenderer.invoke(KUSU_CHANNELS.moveCollection, input),
  setCollectionIcon: (id, icon) => ipcRenderer.invoke(KUSU_CHANNELS.setCollectionIcon, id, icon),
  deleteCollection: (id) => ipcRenderer.invoke(KUSU_CHANNELS.deleteCollection, id),
  renameItem: (input) => ipcRenderer.invoke(KUSU_CHANNELS.renameItem, input),
  moveItems: (input) => ipcRenderer.invoke(KUSU_CHANNELS.moveItems, input),
  setItemsPinned: (input) => ipcRenderer.invoke(KUSU_CHANNELS.setItemsPinned, input),
  archiveItems: (input) => ipcRenderer.invoke(KUSU_CHANNELS.archiveItems, input),
  unarchiveItems: (input) => ipcRenderer.invoke(KUSU_CHANNELS.unarchiveItems, input),
  trashItems: (input) => ipcRenderer.invoke(KUSU_CHANNELS.trashItems, input),
  restoreItems: (input) => ipcRenderer.invoke(KUSU_CHANNELS.restoreItems, input),
  permanentlyDeleteItems: (input) =>
    ipcRenderer.invoke(KUSU_CHANNELS.permanentlyDeleteItems, input),
  inspectItemDeletion: (input) => ipcRenderer.invoke(KUSU_CHANNELS.inspectItemDeletion, input),
  getImageThumbnail: (itemId) => ipcRenderer.invoke(KUSU_CHANNELS.getImageThumbnail, itemId),
  getImagePreview: (itemId) => ipcRenderer.invoke(KUSU_CHANNELS.getImagePreview, itemId),
  getPdfPreview: (itemId) => ipcRenderer.invoke(KUSU_CHANNELS.getPdfPreview, itemId),
  copyImage: (itemId) => ipcRenderer.invoke(KUSU_CHANNELS.copyImage, itemId),
  importFile: (input) => ipcRenderer.invoke(KUSU_CHANNELS.importFile, input),
  copyLibraryPath: () => ipcRenderer.invoke(KUSU_CHANNELS.copyLibraryPath),
  copyItemPath: (itemId) => ipcRenderer.invoke(KUSU_CHANNELS.copyItemPath, itemId),
  openItemInDefaultApp: (itemId) => ipcRenderer.invoke(KUSU_CHANNELS.openItemInDefaultApp, itemId),
  showItemInExplorer: (itemId) => ipcRenderer.invoke(KUSU_CHANNELS.showItemInExplorer, itemId),
  openExternalUrl: (url) => ipcRenderer.invoke(KUSU_CHANNELS.openExternalUrl, url),
  onVaultChanged: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on(KUSU_CHANNELS.vaultChanged, listener)
    return () => ipcRenderer.removeListener(KUSU_CHANNELS.vaultChanged, listener)
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

const updateApi: UpdateApi = {
  getStatus: () => ipcRenderer.invoke(UPDATE_CHANNELS.status),
  check: () => ipcRenderer.invoke(UPDATE_CHANNELS.check),
  download: () => ipcRenderer.invoke(UPDATE_CHANNELS.download),
  install: () => ipcRenderer.invoke(UPDATE_CHANNELS.install),
  onStatus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus): void =>
      callback(status)
    ipcRenderer.on(UPDATE_CHANNELS.changed, listener)
    return () => ipcRenderer.removeListener(UPDATE_CHANNELS.changed, listener)
  },
  onPrepare: (callback) => {
    const listener = (): void => {
      void Promise.resolve()
        .then(callback)
        .then(
          (approved) => ipcRenderer.send(UPDATE_CHANNELS.prepared, approved),
          () => ipcRenderer.send(UPDATE_CHANNELS.prepared, false)
        )
    }
    ipcRenderer.on(UPDATE_CHANNELS.prepare, listener)
    return () => ipcRenderer.removeListener(UPDATE_CHANNELS.prepare, listener)
  }
}
contextBridge.exposeInMainWorld('electron', { window: windowApi, updates: updateApi })
contextBridge.exposeInMainWorld('kusu', libraryApi)
contextBridge.exposeInMainWorld('capture', captureApi)
