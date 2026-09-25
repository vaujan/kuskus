import type { BrowserWindow } from 'electron'
import { WINDOW_CHANNELS, type TextContextMenuDetails } from '../../shared/window-contract'

export function installTextContextMenu(window: BrowserWindow): void {
  window.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable) return

    const details: TextContextMenuDetails = {
      x: params.x,
      y: params.y,
      misspelledWord: params.misspelledWord,
      suggestions: params.dictionarySuggestions,
      editFlags: {
        canUndo: params.editFlags.canUndo,
        canRedo: params.editFlags.canRedo,
        canCut: params.editFlags.canCut,
        canCopy: params.editFlags.canCopy,
        canPaste: params.editFlags.canPaste,
        canSelectAll: params.editFlags.canSelectAll
      }
    }
    window.webContents.send(WINDOW_CHANNELS.textContextMenu, details)
  })
}
