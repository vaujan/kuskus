import { FileText, FolderOpen, ImageOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ItemCard, ItemCardFooter, ItemCardPrimaryAction } from '@/features/items/item-card'
import { MarkdownPreview } from '@/features/items/markdown-preview'
import { useItemActions } from '@/features/items/use-item-actions'
import type { NoteItemDto } from '../../../../shared/library-contract'

export function NoteItemCard({
  item,
  onError
}: {
  item: NoteItemDto
  onError: (error: string) => void
}): React.JSX.Element {
  const { open, reveal } = useItemActions(item.id, onError)
  const lines = item.body.split(/\r?\n/)
  const firstLine = lines[0]
    ?.replace(/^#{1,3}\s+/, '')
    .trim()
    .toLocaleLowerCase()
  const previewBody =
    firstLine === item.title.trim().toLocaleLowerCase() ? lines.slice(1).join('\n') : item.body

  return (
    <ItemCard>
      <ItemCardPrimaryAction
        aria-label={`Open note ${item.title}`}
        disabled={item.missingContent}
        onClick={() => void open()}
      />
      <CardHeader className="pointer-events-none gap-2 pb-2 pt-4">
        <CardTitle className="text-balance text-base leading-snug">{item.title}</CardTitle>
      </CardHeader>
      <CardContent className="pointer-events-none pb-3">
        {item.missingContent ? (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <ImageOff aria-hidden="true" />
            <span>The note file is missing from the library.</span>
          </div>
        ) : (
          <MarkdownPreview value={previewBody || item.body} />
        )}
      </CardContent>
      <ItemCardFooter className="justify-between border-t">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <FileText data-item-type-icon aria-hidden="true" />
          Note
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={`Show ${item.title} in Explorer`}
                onClick={() => void reveal()}
              >
                <FolderOpen aria-hidden="true" />
              </Button>
            }
          />
          <TooltipContent>Show in Explorer</TooltipContent>
        </Tooltip>
      </ItemCardFooter>
    </ItemCard>
  )
}
