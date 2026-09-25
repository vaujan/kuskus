import {
  IconBlockquote,
  IconCodeblock,
  IconH1,
  IconH2,
  IconH3,
  IconList,
  IconListNumbers,
  IconSeparator,
  IconTable,
  IconTextSize
} from '@tabler/icons-react'
import type { ReactElement } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { slashCommands } from './slash-menu'

type SlashCommand = (typeof slashCommands)[number]

const icons = {
  text: IconTextSize,
  'heading-1': IconH1,
  'heading-2': IconH2,
  'heading-3': IconH3,
  'bullet-list': IconList,
  'numbered-list': IconListNumbers,
  quote: IconBlockquote,
  code: IconCodeblock,
  divider: IconSeparator,
  table: IconTable
} satisfies Record<SlashCommand['id'], typeof IconTextSize>

export function SlashMenuView({
  commands,
  selected,
  onRun
}: {
  commands: readonly SlashCommand[]
  selected: number
  onRun: (command: SlashCommand) => void
}): ReactElement {
  return (
    <ScrollArea className="cm-kuskus-slash-scroll">
      {commands.length === 0 ? (
        <p className="cm-kuskus-slash-empty">No formatting commands found.</p>
      ) : (
        commands.map((command, index) => {
          const Icon = icons[command.id]
          return (
            <button
              key={command.id}
              type="button"
              className="cm-kuskus-slash-item"
              role="option"
              aria-selected={index === selected}
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onRun(command)}
            >
              <span className="cm-kuskus-slash-item-label">
                <Icon aria-hidden="true" />
                <span>{command.label}</span>
              </span>
              <kbd>{command.syntax}</kbd>
            </button>
          )
        })
      )}
    </ScrollArea>
  )
}
