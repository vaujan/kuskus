export const COMMAND_PALETTE_LABEL = 'Command palette'
export const COMMAND_PALETTE_SHORTCUT = 'Shift+P'

export interface AppCommand {
  id: string
  label: string
  group: string
  keywords?: string[]
  shortcut?: string
  description?: string
  disabledReason?: string
  destructive?: boolean
  checked?: boolean
  children?: AppCommand[]
  run?: () => void
}

export function matchesCommand(command: AppCommand, query: string): boolean {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/)
  const fields = [command.label, command.description ?? '', ...(command.keywords ?? [])].map(
    (field) => field.toLocaleLowerCase()
  )
  return terms.every((term) => fields.some((field) => field.includes(term)))
}

export function findCommand(commands: readonly AppCommand[], id: string): AppCommand | undefined {
  for (const command of commands) {
    if (command.id === id) return command
    // A disabled parent also disables its destinations.
    if (!command.disabledReason && command.children) {
      const child = findCommand(command.children, id)
      if (child) return child
    }
  }
  return undefined
}

export function resolveCommandTargets({
  inDetail,
  inSidebar,
  activeItemId,
  focusedItemId,
  selectedIds,
  visibleIds
}: {
  inDetail: boolean
  inSidebar: boolean
  activeItemId: string | null
  focusedItemId: string | null
  selectedIds: ReadonlySet<string>
  visibleIds: ReadonlySet<string>
}): string[] {
  if (inSidebar) return []
  if (inDetail) return activeItemId ? [activeItemId] : []
  if (selectedIds.size) return [...selectedIds].filter((id) => visibleIds.has(id))
  const id = focusedItemId ?? activeItemId
  return id && visibleIds.has(id) ? [id] : []
}

export function isCommandPaletteShortcut(event: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
  isComposing: boolean
  repeat: boolean
}): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    event.shiftKey &&
    !event.altKey &&
    !event.isComposing &&
    !event.repeat &&
    event.key.toLowerCase() === 'p'
  )
}
