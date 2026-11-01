import { app, BrowserWindow, Notification, type WebContents } from 'electron'
import { autoUpdater } from 'electron-updater'
import { trustedIpcMain } from './security'
import { UPDATE_CHANNELS, type UpdateStatus } from '../shared/update-contract'

export function registerUpdates(
  mainContents: () => WebContents | undefined,
  closeNotes: () => Promise<boolean>,
  openSettings: () => void
): void {
  const supported = app.isPackaged && process.platform === 'win32'
  let status: UpdateStatus = supported
    ? { phase: 'idle' }
    : { phase: 'unavailable', message: 'In-app updates are available in installed Windows builds.' }
  const publish = (next: UpdateStatus): void => {
    status = next
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(UPDATE_CHANNELS.changed, status)
    }
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false
  autoUpdater.allowDowngrade = false
  autoUpdater.on('checking-for-update', () => publish({ phase: 'checking' }))
  autoUpdater.on('update-not-available', () => publish({ phase: 'current' }))
  autoUpdater.on('update-available', (info) => {
    publish({ phase: 'available', version: info.version })
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: 'Kuskus update available',
        body: `Version ${info.version} is available. Open Settings → About Kuskus to download it.`
      })
      notification.on('click', openSettings)
      notification.show()
    }
  })
  autoUpdater.on('download-progress', (progress) =>
    publish({ phase: 'downloading', version: status.version, percent: progress.percent })
  )
  autoUpdater.on('update-downloaded', (info) => publish({ phase: 'ready', version: info.version }))
  const failed = (): void =>
    publish({
      phase: 'error',
      message: 'Could not update Kuskus. Check your connection and try again.'
    })
  autoUpdater.on('error', failed)

  const check = async (): Promise<void> => {
    if (!supported || !['idle', 'current', 'error'].includes(status.phase)) return
    publish({ phase: 'checking' })
    try {
      await autoUpdater.checkForUpdates()
    } catch {
      failed()
    }
  }

  let prepared: { sender: WebContents; resolve: (approved: boolean) => void } | undefined
  trustedIpcMain.on(UPDATE_CHANNELS.prepared, (event, approved: unknown) => {
    if (prepared?.sender === event.sender) prepared.resolve(approved === true)
  })
  const prepareMain = async (): Promise<boolean> => {
    const sender = mainContents()
    if (!sender || sender.isDestroyed()) return true
    return new Promise((resolve) => {
      const timer = setTimeout(() => finish(false), 15_000)
      const finish = (approved: boolean): void => {
        clearTimeout(timer)
        prepared = undefined
        resolve(approved)
      }
      prepared = { sender, resolve: finish }
      sender.send(UPDATE_CHANNELS.prepare)
    })
  }

  trustedIpcMain.handle(UPDATE_CHANNELS.status, () => status)
  trustedIpcMain.handle(UPDATE_CHANNELS.check, check)
  trustedIpcMain.handle(UPDATE_CHANNELS.download, async () => {
    if (!supported || status.phase !== 'available') return
    publish({ phase: 'downloading', version: status.version, percent: 0 })
    try {
      await autoUpdater.downloadUpdate()
    } catch {
      failed()
    }
  })
  trustedIpcMain.handle(UPDATE_CHANNELS.install, async () => {
    if (!supported || status.phase !== 'ready') return
    const version = status.version
    publish({ phase: 'installing', version })
    try {
      if (!(await prepareMain()) || !(await closeNotes()) || !(await prepareMain())) {
        publish({
          phase: 'ready',
          version,
          message: 'Save or close your open notes before restarting.'
        })
        return
      }
      autoUpdater.quitAndInstall(false, true)
    } catch {
      publish({
        phase: 'ready',
        version,
        message: 'Could not restart to install. Please try again.'
      })
    }
  })

  if (supported) {
    const initialCheck = setTimeout(() => void check(), 30_000)
    const periodicCheck = setInterval(() => void check(), 4 * 60 * 60 * 1000)
    initialCheck.unref()
    periodicCheck.unref()
    app.once('will-quit', () => {
      clearTimeout(initialCheck)
      clearInterval(periodicCheck)
    })
  }
}
