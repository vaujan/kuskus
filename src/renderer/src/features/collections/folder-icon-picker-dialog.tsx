import { IconSearch } from '@tabler/icons-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { cn } from '@/lib/utils'
import type { CollectionIconKey } from '../../../../shared/library-contract'
import { COLLECTION_ICON_OPTIONS } from './collection-icons'

export function FolderIconPickerDialog({
  open,
  value,
  disabled = false,
  onOpenChange,
  onSelect
}: {
  open: boolean
  value: CollectionIconKey
  disabled?: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (icon: CollectionIconKey) => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const options = useMemo(
    () =>
      normalizedQuery
        ? COLLECTION_ICON_OPTIONS.filter(({ label, keywords }) =>
            `${label} ${keywords}`.toLocaleLowerCase().includes(normalizedQuery)
          )
        : COLLECTION_ICON_OPTIONS,
    [normalizedQuery]
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setQuery('')
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose a folder icon</DialogTitle>
          <DialogDescription>
            Pick a symbol that makes this folder easy to recognize.
          </DialogDescription>
        </DialogHeader>
        <InputGroup className="h-8">
          <InputGroupAddon align="inline-start">
            <IconSearch aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            autoFocus
            type="search"
            aria-label="Search folder icons"
            placeholder="Search icons…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </InputGroup>
        {options.length > 0 ? (
          <div
            className="grid max-h-72 grid-cols-6 gap-1 overflow-y-auto p-0.5"
            role="group"
            aria-label="Folder icons"
          >
            {options.map((option) => {
              const Icon = option.icon
              const selected = option.key === value
              return (
                <Button
                  key={option.key}
                  type="button"
                  variant={selected ? 'secondary' : 'ghost'}
                  size="icon-lg"
                  className={cn(
                    'relative size-10 active:scale-[0.96]',
                    selected && 'ring-2 ring-ring/30'
                  )}
                  aria-label={option.label}
                  aria-pressed={selected}
                  title={option.label}
                  disabled={disabled}
                  onClick={() => onSelect(option.key)}
                >
                  <Icon aria-hidden="true" />
                </Button>
              )
            })}
          </div>
        ) : (
          <Empty className="min-h-40">
            <EmptyHeader>
              <EmptyTitle>No icons found</EmptyTitle>
              <EmptyDescription>
                Try a broader word such as work, travel, or notes.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </DialogContent>
    </Dialog>
  )
}
