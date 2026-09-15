import type { Ref } from 'react'
import { IconSearch } from '@tabler/icons-react'

import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { cn } from '@/lib/utils'

export function LibrarySearchInput({
  inputRef,
  value,
  onValueChange,
  onEscapeEmpty,
  pending,
  className
}: {
  inputRef: Ref<HTMLInputElement>
  value: string
  onValueChange: (value: string) => void
  onEscapeEmpty?: () => void
  pending: boolean
  className?: string
}): React.JSX.Element {
  return (
    <InputGroup className={cn('h-8 rounded-lg bg-input/40', className)}>
      <InputGroupAddon>
        <IconSearch aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          event.preventDefault()
          if (value) onValueChange('')
          else if (onEscapeEmpty) onEscapeEmpty()
          else event.currentTarget.blur()
        }}
        placeholder="Search library"
        aria-label="Search library"
        aria-keyshortcuts="Control+Shift+F Meta+Shift+F"
        aria-busy={pending}
      />
    </InputGroup>
  )
}
