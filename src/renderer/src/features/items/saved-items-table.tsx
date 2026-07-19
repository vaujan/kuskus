import {
  IconFileText as FileText,
  IconPhoto as FileImage,
  IconWorld as Globe2,
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
  url: { label: 'Link', icon: Globe2 }
}

function hasMissingContent(item: LibraryItemDto): boolean {
  return item.type !== 'url' && item.missingContent
}

export function SavedItemsTable({
  items,
  onOpen
}: {
  items: LibraryItemDto[]
  onOpen: (itemId: string) => void
}): React.JSX.Element {
  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="w-28">Type</TableHead>
          <TableHead className="w-32 text-right">Added</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const itemType = ITEM_TYPES[item.type]
          const Icon = itemType.icon

          return (
            <TableRow
              key={item.id}
              tabIndex={0}
              aria-label={`Open ${itemType.label.toLocaleLowerCase()} ${item.title}`}
              className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
              onClick={() => onOpen(item.id)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                onOpen(item.id)
              }}
            >
              <TableCell className="overflow-hidden">
                <span className="flex min-w-0 items-center gap-2">
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
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
