import { contextBridge, ipcRenderer } from 'electron'
import { KUSKUS_CHANNELS, type KuskusLibraryApi } from '../shared/kuskus'

const channels = {
  minimize: 'window:minimize',
  toggleMaximize: 'window:toggle-maximize',
  close: 'window:close',
  isMaximized: 'window:is-maximized',
  maximizedChanged: 'window:maximized-changed'
} as const

const windowApi = {
  platform: process.platform,
  minimize: (): void => ipcRenderer.send(channels.minimize),
  toggleMaximize: (): void => ipcRenderer.send(channels.toggleMaximize),
  close: (): void => ipcRenderer.send(channels.close),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke(channels.isMaximized),
  onMaximizedChange: (callback: (isMaximized: boolean) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isMaximized: boolean): void => {
      callback(isMaximized)
    }

    ipcRenderer.on(channels.maximizedChanged, listener)
    return () => ipcRenderer.removeListener(channels.maximizedChanged, listener)
  }
}

const libraryApi: KuskusLibraryApi = {
  getState: () => ipcRenderer.invoke(KUSKUS_CHANNELS.getLibraryState),
  create: (name) => ipcRenderer.invoke(KUSKUS_CHANNELS.createLibrary, name),
  open: () => ipcRenderer.invoke(KUSKUS_CHANNELS.openLibrary),
  createNote: (markdown) => ipcRenderer.invoke(KUSKUS_CHANNELS.createNote, markdown),
  showItemInExplorer: (itemId) => ipcRenderer.invoke(KUSKUS_CHANNELS.showItemInExplorer, itemId)
}

contextBridge.exposeInMainWorld('electron', { window: windowApi })
contextBridge.exposeInMainWorld('kuskus', libraryApi)
