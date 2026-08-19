import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconColumnRemove,
  IconRowInsertBottom,
  IconRowInsertTop,
  IconRowRemove,
  IconTableOff,
  type TablerIcon
} from '@tabler/icons-react'
import { createPortal } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type {
  RichMarkdownTableAction,
  RichMarkdownTableToolbarState
} from '@/features/items/rich-markdown-table-toolbar-plugin'

function ToolbarButton({
  icon: Icon,
  label,
  action,
  onAction
}: {
  icon: TablerIcon
  label: string
  action: RichMarkdownTableAction
  onAction: (action: RichMarkdownTableAction) => void
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label={label}
            onClick={() => onAction(action)}
          />
        }
      >
        <Icon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function RichMarkdownTableToolbar({
  state,
  onAction
}: {
  state: RichMarkdownTableToolbarState
  onAction: (action: RichMarkdownTableAction) => void
}): React.JSX.Element {
  return createPortal(
    <div
      className="fixed z-50 flex items-center gap-0.5 rounded-md bg-popover px-1 py-0.5 text-popover-foreground shadow-md ring-1 ring-foreground/10"
      style={{ left: state.left, top: state.top }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <ToolbarButton
        icon={IconRowInsertTop}
        label="Insert row above"
        action="add-row-before"
        onAction={onAction}
      />
      <ToolbarButton
        icon={IconRowInsertBottom}
        label="Insert row below"
        action="add-row-after"
        onAction={onAction}
      />
      <ToolbarButton
        icon={IconColumnInsertLeft}
        label="Insert column left"
        action="add-col-before"
        onAction={onAction}
      />
      <ToolbarButton
        icon={IconColumnInsertRight}
        label="Insert column right"
        action="add-col-after"
        onAction={onAction}
      />
      <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-foreground/10" />
      <ToolbarButton
        icon={IconRowRemove}
        label="Delete row"
        action="delete-row"
        onAction={onAction}
      />
      <ToolbarButton
        icon={IconColumnRemove}
        label="Delete column"
        action="delete-col"
        onAction={onAction}
      />
      <ToolbarButton
        icon={IconTableOff}
        label="Delete table"
        action="delete-table"
        onAction={onAction}
      />
      <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-foreground/10" />
      <ToolbarButton
        icon={IconAlignLeft}
        label="Align left"
        action="align-left"
        onAction={onAction}
      />
      <ToolbarButton
        icon={IconAlignCenter}
        label="Align center"
        action="align-center"
        onAction={onAction}
      />
      <ToolbarButton
        icon={IconAlignRight}
        label="Align right"
        action="align-right"
        onAction={onAction}
      />
    </div>,
    document.body
  )
}
