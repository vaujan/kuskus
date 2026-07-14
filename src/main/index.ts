import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { KUSKUS_CHANNELS, type ApiErrorCode, type ApiResult } from '../shared/kuskus'
import { LibraryService } from './library-service'

const channels = {
  minimize: 'window:minimize',
  toggleMaximize: 'window:toggle-maximize',
  close: 'window:close',
  isMaximized: 'window:is-maximized',
  maximizedChanged: 'window:maximized-changed'
} as const

function windowFromEvent(
  event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent
): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

function registerWindowIpc(): void {
  ipcMain.on(channels.minimize, (event) => windowFromEvent(event)?.minimize())
  ipcMain.on(channels.toggleMaximize, (event) => {
    const window = windowFromEvent(event)
    if (!window) return

    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }
  })
  ipcMain.on(channels.close, (event) => windowFromEvent(event)?.close())
  ipcMain.handle(channels.isMaximized, (event) => windowFromEvent(event)?.isMaximized() ?? false)
}

function errorResult(error: unknown, code: ApiErrorCode = 'io-error'): ApiResult<never> {
  return {
    ok: false,
    code,
    error:
      error instanceof Error && error.message
        ? error.message
        : 'The operation could not be completed.'
  }
}

function registerLibraryIpc(libraryService: LibraryService): void {
  ipcMain.handle(KUSKUS_CHANNELS.getLibraryState, async () => {
    try {
      return { ok: true, data: await libraryService.getState() }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.createLibrary, async (event, requestedName: unknown) => {
    if (typeof requestedName !== 'string') {
      return errorResult(new Error('Enter a valid library name.'), 'invalid-input')
    }

    const owner = windowFromEvent(event)
    const options: Electron.OpenDialogOptions = {
      title: 'Choose where to create your Kuskus library',
      buttonLabel: 'Choose folder',
      properties: ['openDirectory', 'createDirectory']
    }
    const selection = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options)

    if (selection.canceled || !selection.filePaths[0]) {
      return errorResult(new Error('Library creation was cancelled.'), 'cancelled')
    }

    try {
      return {
        ok: true,
        data: await libraryService.createIn(selection.filePaths[0], requestedName)
      }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.openLibrary, async (event) => {
    const owner = windowFromEvent(event)
    const options: Electron.OpenDialogOptions = {
      title: 'Open a Kuskus library',
      buttonLabel: 'Open library',
      properties: ['openDirectory']
    }
    const selection = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options)

    if (selection.canceled || !selection.filePaths[0]) {
      return errorResult(new Error('Opening a library was cancelled.'), 'cancelled')
    }

    try {
      return { ok: true, data: await libraryService.openAt(selection.filePaths[0]) }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.createNote, async (_event, markdown: unknown) => {
    if (typeof markdown !== 'string') {
      return errorResult(new Error('The note content is invalid.'), 'invalid-input')
    }

    try {
      return { ok: true, data: await libraryService.createNote(markdown) }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.showItemInExplorer, async (_event, itemId: unknown) => {
    if (typeof itemId !== 'string') {
      return errorResult(new Error('The item identifier is invalid.'), 'invalid-input')
    }

    try {
      const contentPath = await libraryService.getItemContentPath(itemId)
      shell.showItemInFolder(contentPath)
      return { ok: true, data: null }
    } catch (error) {
      return errorResult(error, 'not-found')
    }
  })
}

function createWindow(): void {
  const isMac = process.platform === 'darwin'
  const mainWindow = new BrowserWindow({
    width: 1120,
    height: 720,
    minWidth: 680,
    minHeight: 500,
    show: false,
    autoHideMenuBar: true,
    frame: isMac,
    ...(isMac ? { titleBarStyle: 'hiddenInset' as const } : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  const sendMaximizedState = (): void => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channels.maximizedChanged, mainWindow.isMaximized())
    }
  }

  mainWindow.on('maximize', sendMaximizedState)
  mainWindow.on('unmaximize', sendMaximizedState)
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    sendMaximizedState()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('app.kuskus.desktop')
  const libraryService = new LibraryService(join(app.getPath('userData'), 'kuskus-settings.json'))
  await libraryService.initialize()
  registerWindowIpc()
  registerLibraryIpc(libraryService)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
