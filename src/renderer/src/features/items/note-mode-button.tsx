import type { ComponentProps } from 'react'
import { IconCode, IconColumns2, IconEye, IconEyeEdit } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { NoteMode } from './note-view-mode'

const modes = {
  read: { label: 'Read', icon: IconEye },
  live: { label: 'Live', icon: IconEyeEdit },
  markdown: { label: 'Markdown', icon: IconCode },
  split: { label: 'Split', icon: IconColumns2 }
}

export function NoteModeButton({
  mode,
  className,
  ...props
}: ComponentProps<typeof Button> & { mode: NoteMode }): React.JSX.Element {
  const { label, icon: Icon } = modes[mode]
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className={cn('text-muted-foreground', className)}
      aria-label={`Note mode: ${label}`}
      {...props}
    >
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </Button>
  )
}
