import { Menu, type BrowserWindow } from 'electron'

import { createTextContextMenuItems } from './text-context-menu-items'

export function installTextContextMenu(window: BrowserWindow): void {
  window.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable) return

    Menu.buildFromTemplate(
      createTextContextMenuItems(params, {
        replace: (suggestion) => window.webContents.replaceMisspelling(suggestion),
        addToDictionary: (word) => window.webContents.session.addWordToSpellCheckerDictionary(word),
        undo: () => window.webContents.undo(),
        redo: () => window.webContents.redo(),
        cut: () => window.webContents.cut(),
        copy: () => window.webContents.copy(),
        paste: () => window.webContents.paste(),
        selectAll: () => window.webContents.selectAll()
      })
    ).popup({ window })
  })
}
