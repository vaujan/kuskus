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
  type TablerIcon
} from '@tabler/icons-react'
import { createPortal } from 'react-dom'

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
  divider: IconSeparator
}

export function RichMarkdownSlashMenu({
  state,
  onSelect
}: {
  state: RichMarkdownSlashState
  onSelect: (id: RichMarkdownSlashCommandId) => void
}): React.JSX.Element {
  const items = filteredRichMarkdownSlashCommands(state.query)

  return createPortal(
    <Command
      aria-label="Formatting commands"
      className="fixed z-50 h-auto w-72 rounded-md shadow-md ring-1 ring-foreground/10"
      style={{ left: state.left, top: state.top }}
      shouldFilter={false}
      value={items[state.selected]?.id}
      onMouseDown={(event) => event.preventDefault()}
    >
      <CommandList className="max-h-80">
        <CommandEmpty>No formatting commands found.</CommandEmpty>
        <CommandGroup heading="Format">
          {items.map(({ id, label, description }) => {
            const Icon = icons[id]
            return (
              <CommandItem key={id} value={id} onSelect={() => onSelect(id)}>
                <Icon aria-hidden="true" />
                <span className="flex min-w-0 flex-col">
                  <span>{label}</span>
                  <span className="truncate text-xs text-muted-foreground">{description}</span>
                </span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </Command>,
    document.body
  )
}
