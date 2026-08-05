import { IconFile, IconFileText, IconLink, IconPhoto, type TablerIcon } from '@tabler/icons-react'

import {
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { ITEM_SORT_OPTIONS, type ItemSort } from '@/features/items/item-sort'
import { ITEM_TYPE_FILTERS, type ItemTypeFilter } from '@/features/items/item-view'

const TYPE_OPTIONS: Record<ItemTypeFilter, { label: string; icon: TablerIcon }> = {
  note: { label: 'Notes', icon: IconFileText },
  image: { label: 'Images', icon: IconPhoto },
  url: { label: 'Links', icon: IconLink },
  file: { label: 'Files', icon: IconFile }
}

export function ItemSortMenuGroup({
  sort,
  onSortChange
}: {
  sort: ItemSort
  onSortChange: (sort: ItemSort) => void
}): React.JSX.Element {
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Sort by</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={sort}
        onValueChange={(value) => onSortChange(value as ItemSort)}
      >
        {ITEM_SORT_OPTIONS.map((option) => (
          <DropdownMenuRadioItem key={option.value} value={option.value}>
            {option.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  )
}

export function ItemFilterMenuGroups({
  typeFilters,
  onTypeFilterChange,
  showReferencedAttachments,
  onShowReferencedAttachmentsChange,
  onClearFilters
}: {
  typeFilters: ItemTypeFilter[]
  onTypeFilterChange: (type: ItemTypeFilter, selected: boolean) => void
  showReferencedAttachments: boolean
  onShowReferencedAttachmentsChange: (show: boolean) => void
  onClearFilters: () => void
}): React.JSX.Element {
  const hasFilters = typeFilters.length > 0 || showReferencedAttachments

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>Item type</DropdownMenuLabel>
        {ITEM_TYPE_FILTERS.map((type) => {
          const option = TYPE_OPTIONS[type]
          const Icon = option.icon
          return (
            <DropdownMenuCheckboxItem
              key={type}
              checked={typeFilters.includes(type)}
              onCheckedChange={(checked) => onTypeFilterChange(type, checked)}
            >
              <Icon aria-hidden="true" />
              {option.label}
            </DropdownMenuCheckboxItem>
          )
        })}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Visibility</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={showReferencedAttachments}
          onCheckedChange={onShowReferencedAttachmentsChange}
        >
          Show referenced attachments
        </DropdownMenuCheckboxItem>
      </DropdownMenuGroup>
      {hasFilters ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={onClearFilters}>Clear filters</DropdownMenuItem>
          </DropdownMenuGroup>
        </>
      ) : null}
    </>
  )
}
