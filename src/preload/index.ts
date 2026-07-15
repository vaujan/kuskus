import { contextBridge, ipcRenderer } from 'electron'
import { KUSKUS_CHANNELS, type KuskusLibraryApi } from '../shared/library-contract'
import { WINDOW_CHANNELS, type ElectronWindowApi } from '../shared/window-contract'

const windowApi: ElectronWindowApi = {
  platform: process.platform,
  minimize: (): void => ipcRenderer.send(WINDOW_CHANNELS.minimize),
  toggleMaximize: (): void => ipcRenderer.send(WINDOW_CHANNELS.toggleMaximize),
  close: (): void => ipcRenderer.send(WINDOW_CHANNELS.close),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke(WINDOW_CHANNELS.isMaximized),
  onMaximizedChange: (callback: (isMaximized: boolean) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isMaximized: boolean): void => {
      callback(isMaximized)
    }

    ipcRenderer.on(WINDOW_CHANNELS.maximizedChanged, listener)
    return () => ipcRenderer.removeListener(WINDOW_CHANNELS.maximizedChanged, listener)
  }
}

const libraryApi: KuskusLibraryApi = {
  getState: () => ipcRenderer.invoke(KUSKUS_CHANNELS.getLibraryState),
  create: (name) => ipcRenderer.invoke(KUSKUS_CHANNELS.createLibrary, name),
  open: () => ipcRenderer.invoke(KUSKUS_CHANNELS.openLibrary),
  createNote: (markdown) => ipcRenderer.invoke(KUSKUS_CHANNELS.createNote, markdown),
  createUrl: (url) => ipcRenderer.invoke(KUSKUS_CHANNELS.createUrl, url),
  enrichUrl: (itemId) => ipcRenderer.invoke(KUSKUS_CHANNELS.enrichUrl, itemId),
  importImage: (input) => ipcRenderer.invoke(KUSKUS_CHANNELS.importImage, input),
  createCollection: (name) => ipcRenderer.invoke(KUSKUS_CHANNELS.createCollection, name),
  renameCollection: (id, name) => ipcRenderer.invoke(KUSKUS_CHANNELS.renameCollection, id, name),
  deleteCollection: (id) => ipcRenderer.invoke(KUSKUS_CHANNELS.deleteCollection, id),
  getImagePreview: (itemId) => ipcRenderer.invoke(KUSKUS_CHANNELS.getImagePreview, itemId),
  openExternalUrl: (url) => ipcRenderer.invoke(KUSKUS_CHANNELS.openExternalUrl, url)
}

contextBridge.exposeInMainWorld('electron', { window: windowApi })
contextBridge.exposeInMainWorld('kuskus', libraryApi)
