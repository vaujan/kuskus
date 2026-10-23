import { trustedIpcMain as ipcMain } from '../security'
import {
  BrowserWindow,
  nativeTheme,
  session,
  type WebContents,
  type IpcMainEvent,
  type IpcMainInvokeEvent
} from 'electron'

import {
  APP_ZOOM_FACTORS,
  WINDOW_CHANNELS,
  parseNativeThemeSource,
  type GlobalCaptureShortcutStatus,
  type SpellingLanguagesStatus,
  type TextContextMenuAction
} from '../../shared/window-contract'
import {
  applyTranslucentBackground,
  parseTranslucentBackgroundRequest
} from '../window/window-material'

function windowFromEvent(event: IpcMainEvent | IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

function spellingLanguagesStatus(): SpellingLanguagesStatus {
  const spellcheck = session.defaultSession
  return {
    available: spellcheck.availableSpellCheckerLanguages,
    selected: spellcheck.getSpellCheckerLanguages(),
    managedBySystem: process.platform === 'darwin'
  }
}

export function registerWindowIpc(
  getGlobalCaptureShortcutStatus: () =>
    GlobalCaptureShortcutStatus | Promise<GlobalCaptureShortcutStatus>,
  setGlobalCaptureShortcut: (
    accelerator: string
  ) => GlobalCaptureShortcutStatus | Promise<GlobalCaptureShortcutStatus>,
  openSettingsWindow: () => void,
  openNoteWindow: (itemId: string) => Promise<void>,
  resolveNoteWindowClose: (sender: WebContents, approved: boolean) => void
): void {
  ipcMain.on(WINDOW_CHANNELS.minimize, (event) => windowFromEvent(event)?.minimize())
  ipcMain.on(WINDOW_CHANNELS.toggleMaximize, (event) => {
    const window = windowFromEvent(event)
    if (!window) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })
  ipcMain.on(WINDOW_CHANNELS.close, (event) => windowFromEvent(event)?.close())
  ipcMain.handle(
    WINDOW_CHANNELS.isMaximized,
    (event) => windowFromEvent(event)?.isMaximized() ?? false
  )
  ipcMain.on(WINDOW_CHANNELS.edit, (event, command: unknown) => {
    const contents = event.sender
    if (command === 'undo') contents.undo()
    else if (command === 'redo') contents.redo()
    else if (command === 'cut') contents.cut()
    else if (command === 'copy') contents.copy()
    else if (command === 'paste') contents.paste()
    else if (command === 'selectAll') contents.selectAll()
  })
  ipcMain.on(WINDOW_CHANNELS.textContextMenuAction, (event, action: TextContextMenuAction) => {
    if (!action || typeof action !== 'object') return
    const contents = event.sender
    if (action.kind === 'replace' && typeof action.text === 'string' && action.text.length < 128) {
      contents.replaceMisspelling(action.text)
    } else if (
      action.kind === 'addToDictionary' &&
      typeof action.text === 'string' &&
      action.text.length < 128
    ) {
      contents.session.addWordToSpellCheckerDictionary(action.text)
    } else if (action.kind === 'edit') {
      const command = action.command
      if (command === 'undo') contents.undo()
      else if (command === 'redo') contents.redo()
      else if (command === 'cut') contents.cut()
      else if (command === 'copy') contents.copy()
      else if (command === 'paste') contents.paste()
      else if (command === 'selectAll') contents.selectAll()
    }
  })
  ipcMain.handle(WINDOW_CHANNELS.getSpellingLanguages, spellingLanguagesStatus)
  ipcMain.handle(WINDOW_CHANNELS.setSpellingLanguages, (_event, value: unknown) => {
    if (process.platform === 'darwin') return spellingLanguagesStatus()
    const available = new Set(session.defaultSession.availableSpellCheckerLanguages)
    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      value.some((language) => typeof language !== 'string' || !available.has(language))
    ) {
      throw new Error('Select at least one supported spelling language.')
    }
    session.defaultSession.setSpellCheckerLanguages([...new Set(value)])
    const status = spellingLanguagesStatus()
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(WINDOW_CHANNELS.spellingLanguagesChanged, status)
      }
    }
    return status
  })
  ipcMain.handle(WINDOW_CHANNELS.setZoomFactor, (event, zoomFactor: unknown) => {
    if (
      typeof zoomFactor !== 'number' ||
      !APP_ZOOM_FACTORS.some((allowedFactor) => allowedFactor === zoomFactor)
    ) {
      throw new Error('Unsupported zoom factor.')
    }

    const window = windowFromEvent(event)
    if (!window) throw new Error('The app window is unavailable.')
    window.webContents.setZoomFactor(zoomFactor)
    return zoomFactor
  })
  ipcMain.on(WINDOW_CHANNELS.setNativeThemeSource, (_event, source: unknown) => {
    nativeTheme.themeSource = parseNativeThemeSource(source)
  })
  ipcMain.handle(WINDOW_CHANNELS.setTranslucentBackground, (event, enabled: unknown) => {
    const requested = parseTranslucentBackgroundRequest(enabled)
    const window = windowFromEvent(event)
    if (!window) throw new Error('The app window is unavailable.')
    return applyTranslucentBackground(
      window,
      process.platform,
      process.getSystemVersion(),
      requested,
      nativeTheme.prefersReducedTransparency
    )
  })
  ipcMain.handle(WINDOW_CHANNELS.getGlobalCaptureShortcutStatus, () =>
    getGlobalCaptureShortcutStatus()
  )
  ipcMain.handle(WINDOW_CHANNELS.setGlobalCaptureShortcut, (_event, accelerator: unknown) => {
    if (typeof accelerator !== 'string' || !accelerator) {
      throw new Error('The capture shortcut is invalid.')
    }
    return setGlobalCaptureShortcut(accelerator)
  })
  ipcMain.handle(WINDOW_CHANNELS.openSettingsWindow, () => openSettingsWindow())
  ipcMain.handle(WINDOW_CHANNELS.openNoteWindow, async (_event, itemId: unknown) => {
    if (typeof itemId !== 'string' || !itemId) throw new Error('The note identifier is invalid.')
    await openNoteWindow(itemId)
  })
  ipcMain.on(WINDOW_CHANNELS.resolveNoteWindowClose, (event, approved: unknown) => {
    if (typeof approved === 'boolean') resolveNoteWindowClose(event.sender, approved)
  })
}
