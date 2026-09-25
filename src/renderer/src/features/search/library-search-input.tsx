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
  scopeLabel,
  className
}: {
  inputRef: Ref<HTMLInputElement>
  value: string
  onValueChange: (value: string) => void
  onEscapeEmpty?: () => void
  pending: boolean
  scopeLabel?: string
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
        placeholder="Search"
        aria-label="Search"
        aria-keyshortcuts="Control+Shift+F Meta+Shift+F"
        aria-busy={pending}
      />
      {scopeLabel ? (
        <InputGroupAddon
          align="inline-end"
          className="min-w-0 py-0 pr-1.5 @max-[30rem]/toolbar:hidden"
        >
          <span
            className="max-w-24 min-w-0 truncate rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground/80"
            title={scopeLabel}
          >
            {scopeLabel}
          </span>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  )
}
