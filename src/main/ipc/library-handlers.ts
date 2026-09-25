import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, shell } from 'electron'
import { stat } from 'node:fs/promises'

import {
  KUSKUS_CHANNELS,
  type CollectionIconKey,
  type CreateNoteInput,
  type CreateCollectionInput,
  type ImageImportInput,
  type RenameCaptureDraftImageInput,
  type FileImportInput,
  type ItemMutationInput,
  type InspectItemDeletionInput,
  type MoveItemsInput,
  type MoveCollectionInput,
  type NoteImageImportInput,
  type RenameItemInput,
  type SetItemsPinnedInput,
  type UrlPreviewKind,
  type UpdateNoteInput
} from '../../shared/library-contract'
import { LibraryService, NoteUpdateConflictError } from '../library/library-service'
import { errorResult } from './api-result'

export function registerLibraryIpc(
  libraryService: LibraryService,
  beforeLibraryChange: () => Promise<boolean>
): void {
  libraryService.onVaultChanged(() => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(KUSKUS_CHANNELS.vaultChanged)
    }
  })
  ipcMain.handle(KUSKUS_CHANNELS.getLibraryState, async () => {
    try {
      return { ok: true, data: await libraryService.getState(true) }
    } catch (error) {
      return errorResult(error)
    }
  })
  ipcMain.handle(KUSKUS_CHANNELS.getLibraryOverview, async () => {
    try {
      return { ok: true, data: await libraryService.getOverviewState() }
    } catch (error) {
      return errorResult(error)
    }
  })
  ipcMain.handle(KUSKUS_CHANNELS.getItemDetail, async (_event, itemId: unknown) => {
    if (typeof itemId !== 'string') {
      return errorResult(new Error('The item identifier is invalid.'), 'invalid-input')
    }
    try {
      return { ok: true, data: await libraryService.getItemDetail(itemId) }
    } catch (error) {
      return errorResult(error, 'not-found')
    }
  })
  ipcMain.handle(KUSKUS_CHANNELS.queryItems, async (_event, input: unknown) => {
    try {
      return {
        ok: true,
        data: await libraryService.queryItems(input as { query: string })
      }
    } catch (error) {
      return errorResult(error, 'invalid-input')
    }
  })
  ipcMain.handle(KUSKUS_CHANNELS.reconcileLibrary, async () => {
    try {
      return { ok: true, data: await libraryService.reconcileState() }
    } catch (error) {
      return errorResult(error)
    }
  })
  ipcMain.handle(KUSKUS_CHANNELS.reconcileLibraryOverview, async () => {
    try {
      return { ok: true, data: await libraryService.reconcileOverviewState() }
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
      ...(process.env.KUSKUS_ONBOARDING_LIBRARIES_PATH && !app.isPackaged
        ? { defaultPath: process.env.KUSKUS_ONBOARDING_LIBRARIES_PATH }
        : {}),
      properties: ['openDirectory', 'createDirectory']
    }
    const selection = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options)

    if (selection.canceled || !selection.filePaths[0]) {
      return errorResult(new Error('Library creation was cancelled.'), 'cancelled')
    }

    try {
      if (!(await beforeLibraryChange())) {
        return errorResult(
          new Error('Save or resolve the open note before switching libraries.'),
          'busy'
        )
      }
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
      if (!(await beforeLibraryChange())) {
        return errorResult(
          new Error('Save or resolve the open note before switching libraries.'),
          'busy'
        )
      }
      return { ok: true, data: await libraryService.openAt(selection.filePaths[0]) }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.initializeVault, async () => {
    try {
      return { ok: true, data: await libraryService.initializePendingVault() }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.migrateLibrary, async () => {
    try {
      return { ok: true, data: await libraryService.migratePendingLibrary() }
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

  ipcMain.handle(KUSKUS_CHANNELS.duplicateNote, async (_event, itemId: unknown) => {
    if (typeof itemId !== 'string') {
      return errorResult(new Error('The note identifier is invalid.'), 'invalid-input')
    }
    try {
      return { ok: true, data: await libraryService.duplicateNote(itemId) }
    } catch (error) {
      return errorResult(error, 'invalid-input')
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.updateNote, async (_event, input: unknown) => {
    if (
      !input ||
      typeof input !== 'object' ||
      typeof (input as Record<string, unknown>).itemId !== 'string' ||
      typeof (input as Record<string, unknown>).markdown !== 'string' ||
      typeof (input as Record<string, unknown>).expectedMarkdown !== 'string'
    ) {
      return errorResult(new Error('The note update is invalid.'), 'invalid-input')
    }
    try {
      return { ok: true, data: await libraryService.updateNote(input as UpdateNoteInput) }
    } catch (error) {
      if (error instanceof NoteUpdateConflictError) {
        return {
          ok: false,
          error: error.message,
          code: 'conflict',
          conflict: { current: error.current }
        }
      }
      return errorResult(error, 'invalid-input')
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.importNoteImage, async (_event, input: unknown) => {
    if (
      !input ||
      typeof input !== 'object' ||
      typeof (input as Record<string, unknown>).itemId !== 'string'
    ) {
      return errorResult(new Error('The note image is invalid.'), 'invalid-input')
    }
    try {
      return { ok: true, data: await libraryService.importNoteImage(input as NoteImageImportInput) }
    } catch (error) {
      return errorResult(error, 'invalid-input')
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.listCaptureDraftImages, async () => {
    try {
      return { ok: true, data: await libraryService.listCaptureDraftImages() }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.stageCaptureDraftImage, async (_event, input: unknown) => {
    try {
      return {
        ok: true,
        data: await libraryService.stageCaptureDraftImage(input as ImageImportInput)
      }
    } catch (error) {
      return errorResult(error, 'invalid-input')
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.renameCaptureDraftImage, async (_event, input: unknown) => {
    try {
      return {
        ok: true,
        data: await libraryService.renameCaptureDraftImage(input as RenameCaptureDraftImageInput)
      }
    } catch (error) {
      return errorResult(error, 'invalid-input')
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.removeCaptureDraftImage, async (_event, id: unknown) => {
    if (typeof id !== 'string') {
      return errorResult(new Error('The attachment identifier is invalid.'), 'invalid-input')
    }
    try {
      await libraryService.removeCaptureDraftImage(id)
      return { ok: true, data: null }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.discardCaptureDraft, async () => {
    try {
      await libraryService.discardCaptureDraft()
      return { ok: true, data: null }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.getCaptureDraftImagePreview, async (_event, id: unknown) => {
    if (typeof id !== 'string') {
      return errorResult(new Error('The attachment identifier is invalid.'), 'invalid-input')
    }
    try {
      return { ok: true, data: await libraryService.getCaptureDraftImagePreview(id) }
    } catch (error) {
      return errorResult(error, 'not-found')
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.commitCaptureDraftImage, async (_event, id: unknown) => {
    if (typeof id !== 'string') {
      return errorResult(new Error('The attachment identifier is invalid.'), 'invalid-input')
    }
    try {
      return { ok: true, data: await libraryService.commitCaptureDraftImage(id) }
    } catch (error) {
      return errorResult(error, 'invalid-input')
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.getCaptureDraftFile, async () => {
    try {
      return { ok: true, data: await libraryService.getCaptureDraftFile() }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.stageCaptureDraftFile, async (_event, input: unknown) => {
    try {
      return {
        ok: true,
        data: await libraryService.stageCaptureDraftFile(input as FileImportInput)
      }
    } catch (error) {
      return errorResult(error, 'invalid-input')
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.removeCaptureDraftFile, async () => {
    try {
      await libraryService.removeCaptureDraftFile()
      return { ok: true, data: null }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.commitCaptureDraftFile, async (_event, id: unknown) => {
    if (typeof id !== 'string') {
      return errorResult(new Error('The staged file identifier is invalid.'), 'invalid-input')
    }
    try {
      return { ok: true, data: await libraryService.commitCaptureDraftFile(id) }
    } catch (error) {
      return errorResult(error, 'invalid-input')
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

  ipcMain.handle(KUSKUS_CHANNELS.getUrlPreview, async (_event, itemId: unknown, kind: unknown) => {
    if (
      typeof itemId !== 'string' ||
      typeof kind !== 'string' ||
      !['preview', 'favicon'].includes(kind)
    ) {
      return errorResult(new Error('The link preview request is invalid.'), 'invalid-input')
    }
    try {
      return {
        ok: true,
        data: await libraryService.getUrlPreview(itemId, kind as UrlPreviewKind)
      }
    } catch (error) {
      return errorResult(error, 'not-found')
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.createCollection, async (_event, input: unknown) => {
    if (
      !input ||
      typeof input !== 'object' ||
      typeof (input as Record<string, unknown>).name !== 'string' ||
      ((input as Record<string, unknown>).icon !== undefined &&
        typeof (input as Record<string, unknown>).icon !== 'string') ||
      ((input as Record<string, unknown>).parentId !== undefined &&
        (input as Record<string, unknown>).parentId !== null &&
        typeof (input as Record<string, unknown>).parentId !== 'string')
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

  ipcMain.handle(KUSKUS_CHANNELS.moveCollection, async (_event, input: unknown) => {
    if (
      !input ||
      typeof input !== 'object' ||
      typeof (input as Record<string, unknown>).collectionId !== 'string' ||
      ((input as Record<string, unknown>).parentId !== null &&
        typeof (input as Record<string, unknown>).parentId !== 'string')
    ) {
      return errorResult(new Error('The folder move request is invalid.'), 'invalid-input')
    }
    try {
      return {
        ok: true,
        data: await libraryService.moveCollection(input as MoveCollectionInput)
      }
    } catch (error) {
      return errorResult(error, 'invalid-input')
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
      return { ok: true, data: await libraryService.deleteCollection(id) }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.renameItem, async (_event, input: unknown) => {
    try {
      return { ok: true, data: await libraryService.renameItem(input as RenameItemInput) }
    } catch (error) {
      return errorResult(error, 'invalid-input')
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.moveItems, async (_event, input: unknown) => {
    try {
      return { ok: true, data: await libraryService.moveItems(input as MoveItemsInput) }
    } catch (error) {
      return errorResult(error, 'invalid-input')
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.setItemsPinned, async (_event, input: unknown) => {
    try {
      return { ok: true, data: await libraryService.setItemsPinned(input as SetItemsPinnedInput) }
    } catch (error) {
      return errorResult(error, 'invalid-input')
    }
  })

  const registerItemMutation = (
    channel: string,
    operation: (input: ItemMutationInput) => Promise<unknown>
  ): void => {
    ipcMain.handle(channel, async (_event, input: unknown) => {
      try {
        return { ok: true, data: await operation(input as ItemMutationInput) }
      } catch (error) {
        return errorResult(error, 'invalid-input')
      }
    })
  }
  registerItemMutation(KUSKUS_CHANNELS.archiveItems, (input) => libraryService.archiveItems(input))
  registerItemMutation(KUSKUS_CHANNELS.unarchiveItems, (input) =>
    libraryService.unarchiveItems(input)
  )
  registerItemMutation(KUSKUS_CHANNELS.trashItems, (input) => libraryService.trashItems(input))
  registerItemMutation(KUSKUS_CHANNELS.restoreItems, (input) => libraryService.restoreItems(input))
  registerItemMutation(KUSKUS_CHANNELS.permanentlyDeleteItems, (input) =>
    libraryService.permanentlyDeleteItems(input)
  )
  ipcMain.handle(KUSKUS_CHANNELS.inspectItemDeletion, async (_event, input: unknown) => {
    try {
      return {
        ok: true,
        data: await libraryService.inspectItemDeletion(input as InspectItemDeletionInput)
      }
    } catch (error) {
      return errorResult(error, 'invalid-input')
    }
  })

  const registerImagePreview = (
    channel: string,
    operation: (itemId: string) => Promise<unknown>
  ): void => {
    ipcMain.handle(channel, async (_event, itemId: unknown) => {
      if (typeof itemId !== 'string') {
        return errorResult(new Error('The item identifier is invalid.'), 'invalid-input')
      }
      try {
        return { ok: true, data: await operation(itemId) }
      } catch (error) {
        return errorResult(error, 'not-found')
      }
    })
  }
  registerImagePreview(KUSKUS_CHANNELS.getImageThumbnail, (itemId) =>
    libraryService.getImageThumbnail(itemId)
  )
  registerImagePreview(KUSKUS_CHANNELS.getImagePreview, (itemId) =>
    libraryService.getImagePreview(itemId)
  )

  ipcMain.handle(KUSKUS_CHANNELS.copyImage, async (_event, itemId: unknown) => {
    if (typeof itemId !== 'string') {
      return errorResult(new Error('The image identifier is invalid.'), 'invalid-input')
    }
    try {
      const preview = await libraryService.getImagePreview(itemId)
      const image = nativeImage.createFromBuffer(Buffer.from(preview.bytes))
      if (image.isEmpty()) throw new Error('The saved image could not be copied.')
      clipboard.writeImage(image)
      return { ok: true, data: null }
    } catch (error) {
      return errorResult(error, 'not-found')
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.importFile, async (_event, input: unknown) => {
    try {
      return { ok: true, data: await libraryService.importFile(input as FileImportInput) }
    } catch (error) {
      return errorResult(error, 'invalid-input')
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

  ipcMain.handle(KUSKUS_CHANNELS.copyItemPath, async (_event, itemId: unknown) => {
    if (typeof itemId !== 'string') {
      return errorResult(new Error('The item identifier is invalid.'), 'invalid-input')
    }
    try {
      clipboard.writeText(await libraryService.getItemRevealPath(itemId))
      return { ok: true, data: null }
    } catch (error) {
      return errorResult(error, 'not-found')
    }
  })

  ipcMain.handle(KUSKUS_CHANNELS.openItemInDefaultApp, async (_event, itemId: unknown) => {
    if (typeof itemId !== 'string') {
      return errorResult(new Error('The item identifier is invalid.'), 'invalid-input')
    }
    try {
      const item = await libraryService.getItemDetail(itemId)
      if (item.type !== 'image' || item.missingContent) {
        throw new Error('The image is unavailable.')
      }
      const path = await libraryService.getItemContentPath(itemId)
      if (!(await stat(path)).isFile()) throw new Error('The image is unavailable.')
      const error = await shell.openPath(path)
      if (error) throw new Error(error)
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
