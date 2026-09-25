/* eslint-disable react-refresh/only-export-components -- Electron opens this React menu through an imperative bridge. */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { EditorView } from '@codemirror/view'
import { redo, redoDepth, undo, undoDepth } from '@codemirror/commands'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { closeTableContextMenu } from '@/features/items/live/atomic/table-context-menu'
import type { EditCommand, TextContextMenuDetails } from '../../../../shared/window-contract'

interface EditorWord {
  view: EditorView
  from: number
  to: number
  word: string
}

function editorViewAt(details: TextContextMenuDetails): EditorView | null {
  const element = document.elementFromPoint(details.x, details.y)
  const content = element?.closest<HTMLElement>('.cm-content')
  return content ? EditorView.findFromDOM(content) : null
}

function editorWordAt(view: EditorView | null, details: TextContextMenuDetails): EditorWord | null {
  if (!details.misspelledWord) return null
  const position = view?.posAtCoords({ x: details.x, y: details.y })
  if (!view || position === null || position === undefined) return null

  const line = view.state.doc.lineAt(position)
  const word = details.misspelledWord
  let best: EditorWord | null = null
  let bestDistance = Infinity
  let index = line.text.indexOf(word)
  while (index !== -1) {
    const from = line.from + index
    const to = from + word.length
    const distance = position < from ? from - position : position > to ? position - to : 0
    if (distance < bestDistance) {
      best = { view, from, to, word }
      bestDistance = distance
    }
    index = line.text.indexOf(word, index + word.length)
  }
  return bestDistance <= 1 ? best : null
}

function TextContextMenu({
  details,
  editorView,
  editorWord,
  dispose
}: {
  details: TextContextMenuDetails
  editorView: EditorView | null
  editorWord: EditorWord | null
  dispose: () => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const triggerId = useId()
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (!nextOpen) window.setTimeout(dispose, 150)
    },
    [dispose]
  )

  useEffect(() => {
    triggerRef.current?.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: 2,
        clientX: details.x,
        clientY: details.y
      })
    )
  }, [details.x, details.y])

  const replace = (suggestion: string): void => {
    if (
      editorWord &&
      editorWord.view.state.doc.sliceString(editorWord.from, editorWord.to) === editorWord.word
    ) {
      editorWord.view.dispatch({
        changes: { from: editorWord.from, to: editorWord.to, insert: suggestion },
        selection: { anchor: editorWord.from + suggestion.length }
      })
      editorWord.view.focus()
    } else {
      window.electron.window.textContextMenuAction({ kind: 'replace', text: suggestion })
    }
  }

  const edit = (command: EditCommand): void => {
    if (editorView) {
      if (command === 'undo') {
        undo(editorView)
        return
      }
      if (command === 'redo') {
        redo(editorView)
        return
      }
      if (command === 'selectAll') {
        editorView.dispatch({ selection: { anchor: 0, head: editorView.state.doc.length } })
        editorView.focus()
        return
      }
      editorView.focus()
    }
    window.electron.window.textContextMenuAction({ kind: 'edit', command })
  }

  const canUndo = editorView ? undoDepth(editorView.state) > 0 : details.editFlags.canUndo
  const canRedo = editorView ? redoDepth(editorView.state) > 0 : details.editFlags.canRedo
  const modifier = window.electron.window.platform === 'darwin' ? 'Cmd' : 'Ctrl'

  return (
    <ContextMenu
      open={open}
      triggerId={triggerId}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) dispose()
      }}
    >
      <ContextMenuTrigger
        render={
          <div
            ref={triggerRef}
            id={triggerId}
            style={{
              position: 'fixed',
              left: details.x,
              top: details.y,
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: 'none'
            }}
          />
        }
      />
      <ContextMenuContent finalFocus={false} className="w-56">
        {details.misspelledWord ? (
          <>
            <ContextMenuGroup>
              <ContextMenuLabel>{details.misspelledWord}</ContextMenuLabel>
              {details.suggestions.map((suggestion) => (
                <ContextMenuItem key={suggestion} onClick={() => replace(suggestion)}>
                  {suggestion}
                </ContextMenuItem>
              ))}
              <ContextMenuItem
                onClick={() =>
                  window.electron.window.textContextMenuAction({
                    kind: 'addToDictionary',
                    text: details.misspelledWord
                  })
                }
              >
                Add to dictionary
              </ContextMenuItem>
            </ContextMenuGroup>
            <ContextMenuSeparator />
          </>
        ) : null}
        <ContextMenuGroup>
          {(
            [
              ['undo', 'Undo', `${modifier}+Z`, canUndo],
              ['redo', 'Redo', `${modifier}+Shift+Z`, canRedo]
            ] as const
          ).map(([command, label, shortcut, enabled]) => (
            <ContextMenuItem key={command} disabled={!enabled} onClick={() => edit(command)}>
              {label}
              <ContextMenuShortcut>{shortcut}</ContextMenuShortcut>
            </ContextMenuItem>
          ))}
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          {(
            [
              ['cut', 'Cut', `${modifier}+X`, details.editFlags.canCut],
              ['copy', 'Copy', `${modifier}+C`, details.editFlags.canCopy],
              ['paste', 'Paste', `${modifier}+V`, details.editFlags.canPaste],
              [
                'selectAll',
                'Select all',
                `${modifier}+A`,
                editorView ? true : details.editFlags.canSelectAll
              ]
            ] as const
          ).map(([command, label, shortcut, enabled]) => (
            <ContextMenuItem key={command} disabled={!enabled} onClick={() => edit(command)}>
              {label}
              <ContextMenuShortcut>{shortcut}</ContextMenuShortcut>
            </ContextMenuItem>
          ))}
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  )
}

let activeMenuDispose: (() => void) | null = null

export function openTextContextMenu(details: TextContextMenuDetails): void {
  // Keep the structural table menu unless the clicked word needs spelling actions.
  if (document.elementFromPoint(details.x, details.y)?.closest('.cm-atomic-table')) {
    if (!details.misspelledWord) return
    closeTableContextMenu()
  }
  activeMenuDispose?.()
  const editorView = editorViewAt(details)
  const editorWord = editorWordAt(editorView, details)
  const host = document.createElement('div')
  host.dataset.textContextMenuHost = ''
  document.body.appendChild(host)
  const root: Root = createRoot(host)
  let disposed = false
  const dispose = (): void => {
    if (disposed) return
    disposed = true
    if (activeMenuDispose === dispose) activeMenuDispose = null
    queueMicrotask(() => {
      root.unmount()
      host.remove()
    })
  }
  activeMenuDispose = dispose
  root.render(
    <TextContextMenu
      details={details}
      editorView={editorView}
      editorWord={editorWord}
      dispose={dispose}
    />
  )
}
