import { FileImage, FolderOpen, ImageOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ItemCard, ItemCardFooter, ItemCardPrimaryAction } from '@/features/items/item-card'
import { useImagePreview } from '@/features/items/use-image-preview'
import { useItemActions } from '@/features/items/use-item-actions'
import type { ImageItemDto } from '../../../../shared/library-contract'

export function ImageItemCard({
  item,
  onError
}: {
  item: ImageItemDto
  onError: (error: string) => void
}): React.JSX.Element {
  const { preview, previewError } = useImagePreview(item.id, item.missingContent)
  const { open, reveal } = useItemActions(item.id, onError)

  return (
    <ItemCard className="image-card group">
      <ItemCardPrimaryAction
        aria-label={`Open image ${item.title}`}
        disabled={item.missingContent}
        onClick={() => void open()}
      />
      {item.missingContent || previewError ? (
        <div className="pointer-events-none flex aspect-video flex-col items-center justify-center gap-2 bg-muted text-sm text-destructive">
          <ImageOff aria-hidden="true" />
          <span className="px-4 text-center">
            {item.missingContent ? 'Image file missing' : 'Preview unavailable'}
          </span>
        </div>
      ) : preview ? (
        <img
          src={preview}
          alt={item.title}
          width={item.width}
          height={item.height}
          loading="lazy"
          className="item-image pointer-events-none max-h-96 w-full bg-muted object-contain"
        />
      ) : (
        <Skeleton
          className="pointer-events-none aspect-video w-full rounded-none"
          aria-label="Loading image preview"
        />
      )}
      <ItemCardFooter className="flex items-center gap-2">
        <FileImage data-item-type-icon className="shrink-0 text-primary" aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</p>
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
