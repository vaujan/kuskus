import { BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'

import {
  KUSKUS_CHANNELS,
  type CollectionIconKey,
  type CreateNoteInput,
  type CreateCollectionInput,
  type ImageImportInput
} from '../../shared/library-contract'
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

  ipcMain.handle(KUSKUS_CHANNELS.createNote, async (_event, input: unknown) => {
    if (
      !input ||
      typeof input !== 'object' ||
      typeof (input as Record<string, unknown>).markdown !== 'string' ||
      !Array.isArray((input as Record<string, unknown>).attachmentIds)
    ) {
      return errorResult(new Error('The note content is invalid.'), 'invalid-input')
    }
    try {
      return { ok: true, data: await libraryService.createNote(input as CreateNoteInput) }
    } catch (error) {
      return errorResult(error, 'invalid-input')
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.listNoteDraftImages, async () => {
    try {
      return { ok: true, data: await libraryService.listNoteDraftImages() }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.stageNoteDraftImage, async (_event, input: unknown) => {
    try {
      return { ok: true, data: await libraryService.stageNoteDraftImage(input as ImageImportInput) }
    } catch (error) {
      return errorResult(error, 'invalid-input')
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.removeNoteDraftImage, async (_event, id: unknown) => {
    if (typeof id !== 'string') {
      return errorResult(new Error('The attachment identifier is invalid.'), 'invalid-input')
    }
    try {
      await libraryService.removeNoteDraftImage(id)
      return { ok: true, data: null }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.discardNoteDraft, async () => {
    try {
      await libraryService.discardNoteDraft()
      return { ok: true, data: null }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.getNoteDraftImagePreview, async (_event, id: unknown) => {
    if (typeof id !== 'string') {
      return errorResult(new Error('The attachment identifier is invalid.'), 'invalid-input')
    }
    try {
      return { ok: true, data: await libraryService.getNoteDraftImagePreview(id) }
    } catch (error) {
      return errorResult(error, 'not-found')
    }
  })

  ipcMain.handle(
    KUSKUS_CHANNELS.getNoteAttachmentPreview,
    async (_event, itemId: unknown, attachmentId: unknown) => {
      if (typeof itemId !== 'string' || typeof attachmentId !== 'string') {
        return errorResult(new Error('The item identifier is invalid.'), 'invalid-input')
      }
      try {
        return {
          ok: true,
          data: await libraryService.getNoteAttachmentPreview(itemId, attachmentId)
        }
      } catch (error) {
        return errorResult(error, 'not-found')
      }
    }
  )

  ipcMain.handle(KUSKUS_CHANNELS.createUrl, async (_event, url: unknown) => {
    if (typeof url !== 'string')
      return errorResult(new Error('The link is invalid.'), 'invalid-input')
    try {
      return { ok: true, data: await libraryService.createUrl(url) }
    } catch (error) {
      return errorResult(error, 'invalid-input')
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.enrichUrl, async (_event, itemId: unknown) => {
    if (typeof itemId !== 'string')
      return errorResult(new Error('The item identifier is invalid.'), 'invalid-input')
    try {
      return { ok: true, data: await libraryService.enrichUrl(itemId) }
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

  ipcMain.handle(KUSKUS_CHANNELS.createCollection, async (_event, input: unknown) => {
    if (
      !input ||
      typeof input !== 'object' ||
      typeof (input as Record<string, unknown>).name !== 'string' ||
      ((input as Record<string, unknown>).icon !== undefined &&
        typeof (input as Record<string, unknown>).icon !== 'string')
    ) {
      return errorResult(new Error('Enter a valid folder name.'), 'invalid-input')
    }
    try {
      return {
        ok: true,
        data: await libraryService.createCollection(input as CreateCollectionInput)
      }
    } catch (error) {
      return errorResult(error, 'invalid-input')
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.renameCollection, async (_event, id: unknown, name: unknown) => {
    if (typeof id !== 'string' || typeof name !== 'string')
      return errorResult(new Error('Enter a valid folder name.'), 'invalid-input')
    try {
      return { ok: true, data: await libraryService.renameCollection(id, name) }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.setCollectionIcon, async (_event, id: unknown, icon: unknown) => {
    if (typeof id !== 'string' || typeof icon !== 'string') {
      return errorResult(new Error('Choose a valid folder icon.'), 'invalid-input')
    }
    try {
      return {
        ok: true,
        data: await libraryService.setCollectionIcon(id, icon as CollectionIconKey)
      }
    } catch (error) {
      return errorResult(error, 'invalid-input')
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.deleteCollection, async (_event, id: unknown) => {
    if (typeof id !== 'string')
      return errorResult(new Error('The folder identifier is invalid.'), 'invalid-input')
    try {
      await libraryService.deleteCollection(id)
      return { ok: true, data: null }
    } catch (error) {
      return errorResult(error)
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

  ipcMain.handle(KUSKUS_CHANNELS.copyLibraryPath, async () => {
    try {
      const state = await libraryService.getState()
      if (state.status !== 'ready') throw new Error('Open a library before copying its path.')
      clipboard.writeText(state.library.path)
      return { ok: true, data: null }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.showItemInExplorer, async (_event, itemId: unknown) => {
    if (typeof itemId !== 'string') {
      return errorResult(new Error('The item identifier is invalid.'), 'invalid-input')
    }
    try {
      shell.showItemInFolder(await libraryService.getItemRevealPath(itemId))
      return { ok: true, data: null }
    } catch (error) {
      return errorResult(error, 'not-found')
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.openExternalUrl, async (_event, url: unknown) => {
    if (typeof url !== 'string')
      return errorResult(new Error('The link is invalid.'), 'invalid-input')
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol))
        throw new Error('Only web links can be opened.')
      await shell.openExternal(parsed.toString())
      return { ok: true, data: null }
    } catch (error) {
      return errorResult(error, 'invalid-input')
    }
  })
}
