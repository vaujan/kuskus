import {
  IconCheck as Check,
  IconFileText as FileText,
  IconPhoto as FileImage,
  IconWorld as Globe2,
  IconFile as File,
  type TablerIcon
} from '@tabler/icons-react'

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import type { LibraryItemDto } from '../../../../shared/library-contract'

const CREATED_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
})

const ITEM_TYPES: Record<LibraryItemDto['type'], { label: string; icon: TablerIcon }> = {
  note: { label: 'Note', icon: FileText },
  image: { label: 'Image', icon: FileImage },
  url: { label: 'Link', icon: Globe2 },
  file: { label: 'File', icon: File }
}

function hasMissingContent(item: LibraryItemDto): boolean {
  return item.type !== 'url' && item.missingContent
}

export function SavedItemsTable({
  items,
  selectedIds,
  onActivate,
  onOpen,
  onDragStart,
  renderActions,
  wrapRow
}: {
  items: LibraryItemDto[]
  selectedIds: ReadonlySet<string>
  onActivate: (itemId: string, event: React.MouseEvent<HTMLTableRowElement>) => void
  onOpen: (itemId: string) => void
  onDragStart?: (itemId: string, event: React.DragEvent<HTMLTableRowElement>) => void
  renderActions: (item: LibraryItemDto) => React.ReactNode
  wrapRow?: (item: LibraryItemDto, row: React.ReactElement) => React.ReactNode
}): React.JSX.Element {
  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="w-28">Type</TableHead>
          <TableHead className="w-32 text-right">Added</TableHead>
          <TableHead className="w-12">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const itemType = ITEM_TYPES[item.type]
          const Icon = itemType.icon
          const selected = selectedIds.has(item.id)

          const row = (
            <TableRow
              key={item.id}
              tabIndex={0}
              draggable={onDragStart !== undefined}
              data-item-id={item.id}
              aria-label={`Open ${itemType.label.toLocaleLowerCase()} ${item.title}`}
              aria-haspopup="dialog"
              aria-selected={selected}
              data-state={selected ? 'selected' : undefined}
              className="group/saved-item cursor-pointer transition-none active:bg-muted/70 focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring data-[state=selected]:bg-primary/10 data-[state=selected]:shadow-[inset_3px_0_0_var(--primary)] hover:data-[state=selected]:bg-primary/14"
              onClick={(event) => onActivate(item.id, event)}
              onDragStart={(event) => onDragStart?.(item.id, event)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                onOpen(item.id)
              }}
            >
              <TableCell className="overflow-hidden">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 ring-2 ring-background group-data-[state=selected]/saved-item:opacity-100"
                  >
                    <Check className="size-3.5 stroke-[2.5]" />
                  </span>
                  <span className="truncate font-medium">{item.title}</span>
                  {hasMissingContent(item) ? (
                    <Badge variant="destructive" className="shrink-0">
                      Missing
                    </Badge>
                  ) : null}
                </span>
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-2 text-muted-foreground [&_svg]:size-4">
                  <Icon aria-hidden="true" />
                  {itemType.label}
                </span>
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                <time className="tabular-nums" dateTime={item.createdAt}>
                  {CREATED_DATE_FORMATTER.format(new Date(item.createdAt))}
                </time>
              </TableCell>
              <TableCell className="p-1" onClick={(event) => event.stopPropagation()}>
                {renderActions(item)}
              </TableCell>
            </TableRow>
          )
          return wrapRow ? wrapRow(item, row) : row
        })}
      </TableBody>
    </Table>
  )
}
