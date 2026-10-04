import { useEffect, useRef, useState } from 'react'
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconClipboard,
  IconCopy,
  IconCut,
  IconFileUpload,
  IconFocusCentered,
  IconFolderOpen,
  IconLayoutCards,
  IconLayoutGrid,
  IconLayoutSidebarLeftExpand,
  IconMenu2,
  IconNote,
  IconPlus,
  IconReplace,
  IconSearch,
  IconSelectAll,
  IconSettings,
  IconZoomIn,
  IconZoomOut,
  IconZoomReset
} from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger
} from '@/components/ui/menubar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSidebar } from '@/features/shell/app-sidebar'
import type { AppZoom } from '@/hooks/use-app-zoom'
import type { EditCommand } from '../../../../shared/window-contract'

export type AppLayout = 'visual' | 'grid' | 'focus'

export function ApplicationMenu({
  layout,
  noteCommandsEnabled,
  librarySwitchBlocked,
  zoom,
  onCommandPalette,
  commandPaletteLabel,
  commandPaletteShortcut,
  onQuickOpen,
  onNewNote,
  onAddItem,
  onAddFile,
  onOpenLibrary,
  onOpenSettings,
  onEdit,
  onFind,
  onReplace,
  onLayoutChange
}: {
  layout: AppLayout
  noteCommandsEnabled: boolean
  librarySwitchBlocked: boolean
  zoom: AppZoom
  onCommandPalette: () => void
  commandPaletteLabel: string
  commandPaletteShortcut: string
  onQuickOpen: () => void
  onNewNote: () => void
  onAddItem: () => void
  onAddFile: () => void
  onOpenLibrary: () => void
  onOpenSettings: () => void
  onEdit: (command: EditCommand, target: HTMLElement | null) => void
  onFind: () => void
  onReplace: () => void
  onLayoutChange: (layout: AppLayout) => void
}): React.JSX.Element {
  const [visible, setVisible] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const { state, flyoutOpen, toggleSidebar } = useSidebar()
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const sidebarOpen = state === 'expanded' || flyoutOpen

  const run = (action: (target: HTMLElement | null) => void): void => {
    const target = previousFocusRef.current
    queueMicrotask(() => {
      target?.focus({ preventScroll: true })
      action(target)
    })
  }

  const edit = (command: EditCommand): void => run((target) => onEdit(command, target))

  useEffect(() => {
    if (!visible) return

    const closeOutside = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (rootRef.current?.contains(target) || target.closest('[data-slot="menubar-content"]'))
        return
      setVisible(false)
    }

    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [visible])

  return (
    <div ref={rootRef} className="flex items-center [-webkit-app-region:no-drag]">
      {!visible ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Show application menu"
                aria-controls="application-menubar"
                aria-expanded={false}
                onPointerDown={() => {
                  previousFocusRef.current = document.activeElement as HTMLElement | null
                }}
                onClick={() => setVisible(true)}
              />
            }
          >
            <IconMenu2 data-icon="inline-start" aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent>Show application menu</TooltipContent>
        </Tooltip>
      ) : (
        <Menubar id="application-menubar" className="h-8 border-0 bg-transparent p-0">
          <MenubarMenu>
            <MenubarTrigger className="mx-1 px-3">Kuskus</MenubarTrigger>
            <MenubarContent align="start" className="w-max min-w-56 whitespace-nowrap">
              <MenubarGroup>
                <MenubarItem onClick={() => run(() => onCommandPalette())}>
                  <IconSearch aria-hidden="true" />
                  {commandPaletteLabel}
                  <MenubarShortcut>{commandPaletteShortcut}</MenubarShortcut>
                </MenubarItem>
                <MenubarItem onClick={() => run(() => onOpenSettings())}>
                  <IconSettings aria-hidden="true" />
                  Open Settings
                  <MenubarShortcut>Ctrl+,</MenubarShortcut>
                </MenubarItem>
              </MenubarGroup>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>File</MenubarTrigger>
            <MenubarContent align="start" className="w-64">
              <MenubarGroup>
                <MenubarItem onClick={() => run(() => onQuickOpen())}>
                  <IconSearch aria-hidden="true" />
                  Quick Open…
                  <MenubarShortcut>Ctrl+O</MenubarShortcut>
                </MenubarItem>
                <MenubarItem onClick={() => run(() => onNewNote())}>
                  <IconNote aria-hidden="true" />
                  New Note
                  <MenubarShortcut>Ctrl+N</MenubarShortcut>
                </MenubarItem>
                <MenubarItem onClick={() => run(() => onAddItem())}>
                  <IconPlus aria-hidden="true" />
                  Add Item
                  <MenubarShortcut>Ctrl+Shift+N</MenubarShortcut>
                </MenubarItem>
                <MenubarItem onClick={() => run(() => onAddFile())}>
                  <IconFileUpload aria-hidden="true" />
                  Add File or Image…
                </MenubarItem>
              </MenubarGroup>
              <MenubarSeparator />
              <MenubarGroup>
                <MenubarItem
                  disabled={librarySwitchBlocked}
                  onClick={() => run(() => onOpenLibrary())}
                >
                  <IconFolderOpen aria-hidden="true" />
                  Open Another Library…
                </MenubarItem>
              </MenubarGroup>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>Edit</MenubarTrigger>
            <MenubarContent className="w-max min-w-56 whitespace-nowrap">
              <MenubarGroup>
                <MenubarItem onClick={() => edit('undo')}>
                  <IconArrowBackUp aria-hidden="true" />
                  Undo
                  <MenubarShortcut>Ctrl+Z</MenubarShortcut>
                </MenubarItem>
                <MenubarItem onClick={() => edit('redo')}>
                  <IconArrowForwardUp aria-hidden="true" />
                  Redo
                  <MenubarShortcut>Ctrl+Shift+Z</MenubarShortcut>
                </MenubarItem>
              </MenubarGroup>
              <MenubarSeparator />
              <MenubarGroup>
                <MenubarItem onClick={() => edit('cut')}>
                  <IconCut aria-hidden="true" />
                  Cut
                  <MenubarShortcut>Ctrl+X</MenubarShortcut>
                </MenubarItem>
                <MenubarItem onClick={() => edit('copy')}>
                  <IconCopy aria-hidden="true" />
                  Copy
                  <MenubarShortcut>Ctrl+C</MenubarShortcut>
                </MenubarItem>
                <MenubarItem onClick={() => edit('paste')}>
                  <IconClipboard aria-hidden="true" />
                  Paste
                  <MenubarShortcut>Ctrl+V</MenubarShortcut>
                </MenubarItem>
                <MenubarItem onClick={() => edit('selectAll')}>
                  <IconSelectAll aria-hidden="true" />
                  Select All
                  <MenubarShortcut>Ctrl+A</MenubarShortcut>
                </MenubarItem>
              </MenubarGroup>
              <MenubarSeparator />
              <MenubarGroup>
                <MenubarItem disabled={!noteCommandsEnabled} onClick={() => run(() => onFind())}>
                  <IconSearch aria-hidden="true" />
                  Find in Note
                  <MenubarShortcut>Ctrl+F</MenubarShortcut>
                </MenubarItem>
                <MenubarItem disabled={!noteCommandsEnabled} onClick={() => run(() => onReplace())}>
                  <IconReplace aria-hidden="true" />
                  Replace in Note
                  <MenubarShortcut>Ctrl+H</MenubarShortcut>
                </MenubarItem>
              </MenubarGroup>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>View</MenubarTrigger>
            <MenubarContent className="w-max min-w-56 whitespace-nowrap">
              <MenubarGroup>
                <MenubarCheckboxItem checked={sidebarOpen} onCheckedChange={toggleSidebar}>
                  <IconLayoutSidebarLeftExpand aria-hidden="true" />
                  Show Sidebar
                  <MenubarShortcut>Ctrl+B</MenubarShortcut>
                </MenubarCheckboxItem>
              </MenubarGroup>
              <MenubarSeparator />
              <MenubarGroup>
                <MenubarRadioGroup
                  value={layout}
                  onValueChange={(value) => onLayoutChange(value as AppLayout)}
                >
                  <MenubarRadioItem value="visual">
                    <IconLayoutCards aria-hidden="true" />
                    Masonry
                  </MenubarRadioItem>
                  <MenubarRadioItem value="grid">
                    <IconLayoutGrid aria-hidden="true" />
                    Grid
                  </MenubarRadioItem>
                  <MenubarRadioItem value="focus">
                    <IconFocusCentered aria-hidden="true" />
                    Focus
                  </MenubarRadioItem>
                </MenubarRadioGroup>
              </MenubarGroup>
              <MenubarSeparator />
              <MenubarGroup>
                <MenubarItem disabled={!zoom.canZoomIn} onClick={zoom.zoomIn}>
                  <IconZoomIn aria-hidden="true" />
                  Zoom In
                  <MenubarShortcut>Ctrl++</MenubarShortcut>
                </MenubarItem>
                <MenubarItem disabled={!zoom.canZoomOut} onClick={zoom.zoomOut}>
                  <IconZoomOut aria-hidden="true" />
                  Zoom Out
                  <MenubarShortcut>Ctrl+-</MenubarShortcut>
                </MenubarItem>
                <MenubarItem onClick={zoom.resetZoom}>
                  <IconZoomReset aria-hidden="true" />
                  Reset Zoom
                  <MenubarShortcut>Ctrl+0</MenubarShortcut>
                </MenubarItem>
              </MenubarGroup>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      )}
    </div>
  )
}
