import { FileText, ImageOff } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { CardContent } from '@/components/ui/card'
import { ItemCard, ItemCardFooter, ItemCardPrimaryAction } from '@/features/items/item-card'
import { MarkdownPreview } from '@/features/items/markdown-preview'
import type { NoteItemDto } from '../../../../shared/library-contract'

export function NoteItemCard({
  item,
  onError,
  onOpen
}: {
  item: NoteItemDto
  onError: (error: string) => void
  onOpen: () => void
}): React.JSX.Element {
  return (
    <ItemCard>
      <ItemCardPrimaryAction
        aria-label={`Open note ${item.title}`}
        disabled={item.missingContent}
        onClick={onOpen}
      />
      <CardContent className="relative z-10 pt-4 pb-3">
        {item.missingContent ? (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <ImageOff aria-hidden="true" />
            <span>The note file is missing from the library.</span>
          </div>
        ) : (
          <MarkdownPreview
            value={item.body}
            onOpenLink={async (url) => {
              const result = await window.kuskus.openExternalUrl(url)
              if (!result.ok) onError(result.error)
            }}
          />
        )}
      </CardContent>
      <ItemCardFooter className="justify-between">
        <Badge variant="secondary">
          <FileText data-icon="inline-start" aria-hidden="true" />
          Note
        </Badge>
      </ItemCardFooter>
    </ItemCard>
  )
}
