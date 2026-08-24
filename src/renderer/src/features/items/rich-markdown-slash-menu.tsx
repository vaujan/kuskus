import {
  IconCode,
  IconH1,
  IconH2,
  IconH3,
  IconList,
  IconListNumbers,
  IconPilcrow,
  IconQuote,
  IconSeparator,
  IconTable,
  type TablerIcon
} from '@tabler/icons-react'
import { createPortal } from 'react-dom'
import { useLayoutEffect, useRef } from 'react'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import {
  filteredRichMarkdownSlashCommands,
  type RichMarkdownSlashCommandId,
  type RichMarkdownSlashState
} from '@/features/items/rich-markdown-slash-menu-plugin'

const icons: Record<RichMarkdownSlashCommandId, TablerIcon> = {
  text: IconPilcrow,
  'heading-1': IconH1,
  'heading-2': IconH2,
  'heading-3': IconH3,
  'bullet-list': IconList,
  'numbered-list': IconListNumbers,
  quote: IconQuote,
  code: IconCode,
  divider: IconSeparator,
  table: IconTable
}

export function RichMarkdownSlashMenu({
  state,
  onSelect
}: {
  state: RichMarkdownSlashState
  onSelect: (id: RichMarkdownSlashCommandId) => void
}): React.JSX.Element {
  const items = filteredRichMarkdownSlashCommands(state.query)
  const containerRef = useRef<HTMLDivElement>(null)

  // The ProseMirror plugin owns arrow-key selection, so cmdk's own keyboard
  // navigation never gets a chance to scroll the selected item.
  useLayoutEffect(() => {
    containerRef.current
      ?.querySelectorAll<HTMLElement>('[data-slot="command-item"]')
      .item(state.selected)
      ?.scrollIntoView({ block: 'nearest' })
  }, [state.selected])

  return createPortal(
    <div ref={containerRef} className="fixed z-50" style={{ left: state.left, top: state.top }}>
      <Command
        aria-label="Formatting commands"
        className="h-auto w-72 origin-top-left overflow-hidden rounded-3xl shadow-lg ring-1 ring-foreground/5 duration-100 animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 animate-none! relative bg-popover/70 before:pointer-events-none before:absolute before:inset-0 before:-z-1 before:rounded-[inherit] before:backdrop-blur-2xl before:backdrop-saturate-150"
        shouldFilter={false}
        value={items[state.selected]?.id}
        onMouseDown={(event) => event.preventDefault()}
      >
        <CommandList className="max-h-80">
          <CommandEmpty>No formatting commands found.</CommandEmpty>
          <CommandGroup heading="Format">
            {items.map(({ id, label, syntax }) => {
              const Icon = icons[id]
              return (
                <CommandItem
                  key={id}
                  value={id}
                  onSelect={() => onSelect(id)}
                  className="rounded-[calc(var(--radius-3xl)-6px)] transition-transform active:scale-[0.96]"
                >
                  <Icon aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  {syntax && (
                    <span className="font-mono text-xs text-muted-foreground">{syntax}</span>
                  )}
                </CommandItem>
              )
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>,
    document.body
  )
}
