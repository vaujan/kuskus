import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer } from '@electron-toolkit/utils'

import { registerLibraryIpc } from './ipc/library-handlers'
import { registerWindowIpc } from './ipc/window-handlers'
import { LibraryService } from './library/library-service'
import { createMainWindow } from './window/create-main-window'

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('app.kuskus.desktop')

  const libraryService = new LibraryService(join(app.getPath('userData'), 'kuskus-settings.json'))
  await libraryService.initialize()
  registerWindowIpc()
  registerLibraryIpc(libraryService)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
