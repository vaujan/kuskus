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
  listNoteDraftImages: () => ipcRenderer.invoke(KUSKUS_CHANNELS.listNoteDraftImages),
  stageNoteDraftImage: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.stageNoteDraftImage, input),
  removeNoteDraftImage: (attachmentId) =>
    ipcRenderer.invoke(KUSKUS_CHANNELS.removeNoteDraftImage, attachmentId),
  discardNoteDraft: () => ipcRenderer.invoke(KUSKUS_CHANNELS.discardNoteDraft),
  getNoteDraftImagePreview: (attachmentId) =>
    ipcRenderer.invoke(KUSKUS_CHANNELS.getNoteDraftImagePreview, attachmentId),
  getNoteAttachmentPreview: (itemId, attachmentId) =>
    ipcRenderer.invoke(KUSKUS_CHANNELS.getNoteAttachmentPreview, itemId, attachmentId),
  createUrl: (url) => ipcRenderer.invoke(KUSKUS_CHANNELS.createUrl, url),
  enrichUrl: (itemId) => ipcRenderer.invoke(KUSKUS_CHANNELS.enrichUrl, itemId),
  importImage: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.importImage, input),
  createCollection: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.createCollection, input),
  renameCollection: (id, name) => ipcRenderer.invoke(KUSKUS_CHANNELS.renameCollection, id, name),
  setCollectionIcon: (id, icon) => ipcRenderer.invoke(KUSKUS_CHANNELS.setCollectionIcon, id, icon),
  deleteCollection: (id) => ipcRenderer.invoke(KUSKUS_CHANNELS.deleteCollection, id),
  getImagePreview: (itemId) => ipcRenderer.invoke(KUSKUS_CHANNELS.getImagePreview, itemId),
  copyLibraryPath: () => ipcRenderer.invoke(KUSKUS_CHANNELS.copyLibraryPath),
  showItemInExplorer: (itemId) => ipcRenderer.invoke(KUSKUS_CHANNELS.showItemInExplorer, itemId),
  openExternalUrl: (url) => ipcRenderer.invoke(KUSKUS_CHANNELS.openExternalUrl, url)
}

contextBridge.exposeInMainWorld('electron', { window: windowApi })
contextBridge.exposeInMainWorld('kuskus', libraryApi)
