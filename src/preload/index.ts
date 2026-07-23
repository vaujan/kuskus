import { contextBridge, ipcRenderer } from 'electron'
import { KUSKUS_CHANNELS, type KuskusLibraryApi } from '../shared/library-contract'
import {
  WINDOW_CHANNELS,
  type AppZoomShortcut,
  type ElectronWindowApi
} from '../shared/window-contract'

const windowApi: ElectronWindowApi = {
  platform: process.platform,
  minimize: (): void => ipcRenderer.send(WINDOW_CHANNELS.minimize),
  toggleMaximize: (): void => ipcRenderer.send(WINDOW_CHANNELS.toggleMaximize),
  close: (): void => ipcRenderer.send(WINDOW_CHANNELS.close),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke(WINDOW_CHANNELS.isMaximized),
  setZoomFactor: (zoomFactor): Promise<number> =>
    ipcRenderer.invoke(WINDOW_CHANNELS.setZoomFactor, zoomFactor),
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
  }
}

const libraryApi: KuskusLibraryApi = {
  getState: () => ipcRenderer.invoke(KUSKUS_CHANNELS.getLibraryState),
  create: (name) => ipcRenderer.invoke(KUSKUS_CHANNELS.createLibrary, name),
  open: () => ipcRenderer.invoke(KUSKUS_CHANNELS.openLibrary),
  createNote: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.createNote, input),
  updateNote: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.updateNote, input),
  listCaptureDraftImages: () => ipcRenderer.invoke(KUSKUS_CHANNELS.listCaptureDraftImages),
  stageCaptureDraftImage: (input) =>
    ipcRenderer.invoke(KUSKUS_CHANNELS.stageCaptureDraftImage, input),
  removeCaptureDraftImage: (attachmentId) =>
    ipcRenderer.invoke(KUSKUS_CHANNELS.removeCaptureDraftImage, attachmentId),
  discardCaptureDraft: () => ipcRenderer.invoke(KUSKUS_CHANNELS.discardCaptureDraft),
  getCaptureDraftImagePreview: (attachmentId) =>
    ipcRenderer.invoke(KUSKUS_CHANNELS.getCaptureDraftImagePreview, attachmentId),
  commitCaptureDraftImage: (attachmentId) =>
    ipcRenderer.invoke(KUSKUS_CHANNELS.commitCaptureDraftImage, attachmentId),
  getNoteAttachmentPreview: (itemId, attachmentId) =>
    ipcRenderer.invoke(KUSKUS_CHANNELS.getNoteAttachmentPreview, itemId, attachmentId),
  createUrl: (url) => ipcRenderer.invoke(KUSKUS_CHANNELS.createUrl, url),
  enrichUrl: (itemId) => ipcRenderer.invoke(KUSKUS_CHANNELS.enrichUrl, itemId),
  getUrlPreview: (itemId, kind) => ipcRenderer.invoke(KUSKUS_CHANNELS.getUrlPreview, itemId, kind),
  createCollection: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.createCollection, input),
  renameCollection: (id, name) => ipcRenderer.invoke(KUSKUS_CHANNELS.renameCollection, id, name),
  setCollectionIcon: (id, icon) => ipcRenderer.invoke(KUSKUS_CHANNELS.setCollectionIcon, id, icon),
  deleteCollection: (id) => ipcRenderer.invoke(KUSKUS_CHANNELS.deleteCollection, id),
  renameItem: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.renameItem, input),
  moveItems: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.moveItems, input),
  archiveItems: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.archiveItems, input),
  unarchiveItems: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.unarchiveItems, input),
  trashItems: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.trashItems, input),
  restoreItems: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.restoreItems, input),
  permanentlyDeleteItems: (input) =>
    ipcRenderer.invoke(KUSKUS_CHANNELS.permanentlyDeleteItems, input),
  getImagePreview: (itemId) => ipcRenderer.invoke(KUSKUS_CHANNELS.getImagePreview, itemId),
  copyLibraryPath: () => ipcRenderer.invoke(KUSKUS_CHANNELS.copyLibraryPath),
  showItemInExplorer: (itemId) => ipcRenderer.invoke(KUSKUS_CHANNELS.showItemInExplorer, itemId),
  openExternalUrl: (url) => ipcRenderer.invoke(KUSKUS_CHANNELS.openExternalUrl, url)
}

contextBridge.exposeInMainWorld('electron', { window: windowApi })
contextBridge.exposeInMainWorld('kuskus', libraryApi)
