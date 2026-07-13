import { contextBridge, ipcRenderer } from 'electron'

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

contextBridge.exposeInMainWorld('electron', { window: windowApi })
