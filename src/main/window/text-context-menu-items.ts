import type { ContextMenuParams, MenuItemConstructorOptions } from 'electron'

export interface TextContextMenuActions {
  replace: (suggestion: string) => void
  addToDictionary: (word: string) => void
  undo: () => void
  redo: () => void
  cut: () => void
  copy: () => void
  paste: () => void
  selectAll: () => void
}

export function createTextContextMenuItems(
  params: Pick<ContextMenuParams, 'misspelledWord' | 'dictionarySuggestions' | 'editFlags'>,
  actions: TextContextMenuActions
): MenuItemConstructorOptions[] {
  const items: MenuItemConstructorOptions[] = []

  if (params.misspelledWord) {
    items.push(
      ...params.dictionarySuggestions.map((suggestion) => ({
        label: suggestion,
        click: () => actions.replace(suggestion)
      }))
    )
    if (params.dictionarySuggestions.length > 0) items.push({ type: 'separator' })
    items.push({
      label: 'Add to dictionary',
      click: () => actions.addToDictionary(params.misspelledWord)
    })
    items.push({ type: 'separator' })
  }

  const { editFlags } = params
  items.push(
    { label: 'Undo', accelerator: 'CmdOrCtrl+Z', enabled: editFlags.canUndo, click: actions.undo },
    {
      label: 'Redo',
      accelerator: 'Shift+CmdOrCtrl+Z',
      enabled: editFlags.canRedo,
      click: actions.redo
    },
    { type: 'separator' },
    { label: 'Cut', accelerator: 'CmdOrCtrl+X', enabled: editFlags.canCut, click: actions.cut },
    { label: 'Copy', accelerator: 'CmdOrCtrl+C', enabled: editFlags.canCopy, click: actions.copy },
    {
      label: 'Paste',
      accelerator: 'CmdOrCtrl+V',
      enabled: editFlags.canPaste,
      click: actions.paste
    },
    { type: 'separator' },
    {
      label: 'Select all',
      accelerator: 'CmdOrCtrl+A',
      enabled: editFlags.canSelectAll,
      click: actions.selectAll
    }
  )

  return items
}
