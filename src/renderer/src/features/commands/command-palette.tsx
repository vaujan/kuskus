import { createWorkspaceCommands } from './workspace-commands'
import { useEffect, useRef, useState } from 'react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut
} from '@/components/ui/command'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import {
  applyAppearance,
  COLOR_MODES,
  COLOR_THEMES,
  resolveAppliedTheme,
  type ColorMode,
  type ColorTheme
} from '@/hooks/theme'
import {
  COMMAND_PALETTE_LABEL,
  findCommand,
  matchesCommand,
  type AppCommand
} from './command-catalog'

export function CommandPalette({
  open,
  onOpenChange,
  commands,
  returnFocus,
  colorMode,
  colorTheme
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  commands: AppCommand[]
  returnFocus: HTMLElement | null
  colorMode: ColorMode
  colorTheme: ColorTheme
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [pageId, setPageId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const pendingId = useRef<string | null>(null)
  const executing = useRef(false)
  const previewed = useRef(false)
  useEffect(() => {
    if (open) executing.current = false
  }, [open])
  const page = pageId ? findCommand(commands, pageId) : undefined
  const entries = pageId ? (page?.disabledReason ? [] : (page?.children ?? [])) : commands
  const visible = entries.filter((command) =>
    query.trim() ? matchesCommand(command, query) : !command.destructive
  )
  const groups = [...new Set(visible.map((command) => command.group))]
  const appearancePage = pageId === 'color-theme' || pageId === 'color-mode'
  const searchLabel =
    pageId === 'color-theme'
      ? 'Search color themes'
      : pageId === 'color-mode'
        ? 'Search color modes'
        : page
          ? 'Search destinations'
          : 'Search commands'
  const activeAppearanceId = visible.some((command) => command.id === selectedId)
    ? selectedId
    : null
  const previewTheme =
    pageId === 'color-theme'
      ? COLOR_THEMES.find((theme) => `color-theme:${theme.value}` === activeAppearanceId)?.value
      : undefined
  const previewMode =
    pageId === 'color-mode'
      ? COLOR_MODES.find((mode) => `color-mode:${mode.value}` === activeAppearanceId)?.value
      : undefined

  useEffect(() => {
    if (open && appearancePage && (previewTheme || previewMode)) {
      applyAppearance(resolveAppliedTheme(previewMode ?? colorMode), previewTheme ?? colorTheme)
      previewed.current = true
      return
    }
    if (previewed.current && !pendingId.current?.startsWith('color-')) {
      applyAppearance(resolveAppliedTheme(colorMode), colorTheme)
      previewed.current = false
    }
  }, [open, appearancePage, previewTheme, previewMode, colorMode, colorTheme])

  const back = (): void => {
    setPageId(null)
    setQuery('')
    setSelectedId(null)
  }

  return (
    <CommandDialog
      open={open}
      title={COMMAND_PALETTE_LABEL}
      description="Search application actions. Use arrow keys to navigate and Enter to run."
      backdropClassName={appearancePage ? 'bg-transparent' : undefined}
      finalFocus={() =>
        executing.current ? false : returnFocus?.isConnected ? returnFocus : undefined
      }
      onOpenChange={(nextOpen, details) => {
        if (!nextOpen && pageId && details.reason === 'escape-key') {
          details.cancel()
          back()
          return
        }
        onOpenChange(nextOpen)
      }}
      onOpenChangeComplete={(nextOpen) => {
        if (nextOpen) return
        const id = pendingId.current
        pendingId.current = null
        back()
        // Resolve against current commands, not the snapshot selected before closing.
        const command = id ? findCommand(commands, id) : undefined
        if (previewed.current) {
          if (!command || command.disabledReason || !id?.startsWith('color-')) {
            applyAppearance(resolveAppliedTheme(colorMode), colorTheme)
          }
          previewed.current = false
        }
        if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
        if (command && !command.disabledReason) command.run?.()
      }}
      className="max-h-[min(28rem,calc(100vh-2rem))] max-w-[calc(100%-2rem)] sm:max-w-xl"
    >
      <Command
        key={pageId ?? 'root'}
        label={COMMAND_PALETTE_LABEL}
        shouldFilter={false}
        value={selectedId ?? ''}
        onValueChange={setSelectedId}
        className="rounded-4xl bg-popover/90"
      >
        <CommandInput
          autoFocus
          aria-label={searchLabel}
          placeholder={page ? `${searchLabel}…` : 'Type a command…'}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[min(22rem,calc(100vh-8rem))] p-1.5">
          <CommandEmpty>{page?.disabledReason ?? 'No matching commands'}</CommandEmpty>
          {groups.map((group) => (
            <CommandGroup key={group} heading={group}>
              {visible
                .filter((command) => command.group === group)
                .map((command) => (
                  <CommandItem
                    key={command.id}
                    value={command.id}
                    keywords={[
                      command.label,
                      command.description ?? '',
                      ...(command.keywords ?? [])
                    ]}
                    disabled={Boolean(command.disabledReason)}
                    data-checked={command.checked || undefined}
                    className="rounded-xl!"
                    onSelect={() => {
                      if (pendingId.current || !open || command.disabledReason) return
                      if (command.children) {
                        setSelectedId(null)
                        setPageId(command.id)
                        if (!command.children.some((child) => matchesCommand(child, query))) {
                          setQuery('')
                        }
                      } else {
                        pendingId.current = command.id
                        executing.current = true
                        onOpenChange(false)
                      }
                    }}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate">{command.label}</span>
                      {command.disabledReason || command.description ? (
                        <span className="truncate text-xs font-normal text-muted-foreground">
                          {command.disabledReason ?? command.description}
                        </span>
                      ) : null}
                    </span>
                    {command.shortcut ? (
                      <CommandShortcut>{command.shortcut}</CommandShortcut>
                    ) : null}
                  </CommandItem>
                ))}
            </CommandGroup>
          ))}
        </CommandList>
        <footer className="flex h-10 shrink-0 items-center justify-end gap-3 border-t border-border/60 px-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <KbdGroup role="group" aria-label="Up and down arrow keys">
              <Kbd aria-hidden="true">↑</Kbd>
              <Kbd aria-hidden="true">↓</Kbd>
            </KbdGroup>{' '}
            navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Enter</Kbd> select
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Esc</Kbd> {pageId ? 'back' : 'close'}
          </span>
        </footer>
      </Command>
    </CommandDialog>
  )
}

export function WorkspaceCommandPalette({
  open,
  onOpenChange,
  returnFocus,
  ...options
}: Parameters<typeof createWorkspaceCommands>[0] & {
  open: boolean
  onOpenChange: (open: boolean) => void
  returnFocus: HTMLElement | null
}): React.JSX.Element {
  const { commands } = createWorkspaceCommands(options)
  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      returnFocus={returnFocus}
      commands={commands}
      colorMode={options.colorMode}
      colorTheme={options.colorTheme}
    />
  )
}
