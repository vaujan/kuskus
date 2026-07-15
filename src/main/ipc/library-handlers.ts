import { BrowserWindow, dialog, ipcMain, shell } from 'electron'

import { KUSKUS_CHANNELS, type ImageImportInput } from '../../shared/library-contract'
import { LibraryService } from '../library/library-service'
import { errorResult } from './api-result'

export function registerLibraryIpc(libraryService: LibraryService): void {
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

    const owner = BrowserWindow.fromWebContents(event.sender)
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
    const owner = BrowserWindow.fromWebContents(event.sender)
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

  ipcMain.handle(KUSKUS_CHANNELS.importImage, async (_event, input: unknown) => {
    try {
      return { ok: true, data: await libraryService.importImage(input as ImageImportInput) }
    } catch (error) {
      return errorResult(error, 'invalid-input')
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.getImagePreview, async (_event, itemId: unknown) => {
    if (typeof itemId !== 'string') {
      return errorResult(new Error('The item identifier is invalid.'), 'invalid-input')
    }
    try {
      return { ok: true, data: await libraryService.getImagePreview(itemId) }
    } catch (error) {
      return errorResult(error, 'not-found')
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.openItem, async (_event, itemId: unknown) => {
    if (typeof itemId !== 'string') {
      return errorResult(new Error('The item identifier is invalid.'), 'invalid-input')
    }
    try {
      const errorMessage = await shell.openPath(await libraryService.getItemContentPath(itemId))
      if (errorMessage) throw new Error(errorMessage)
      return { ok: true, data: null }
    } catch (error) {
      return errorResult(error, 'not-found')
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.showItemInExplorer, async (_event, itemId: unknown) => {
    if (typeof itemId !== 'string') {
      return errorResult(new Error('The item identifier is invalid.'), 'invalid-input')
    }
    try {
      shell.showItemInFolder(await libraryService.getItemContentPath(itemId))
      return { ok: true, data: null }
    } catch (error) {
      return errorResult(error, 'not-found')
    }
  })
}
