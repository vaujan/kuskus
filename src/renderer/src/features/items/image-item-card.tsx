import { FileImage, ImageOff } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ItemCard, ItemCardFooter, ItemCardPrimaryAction } from '@/features/items/item-card'
import { useImagePreview } from '@/features/items/use-image-preview'
import type { ImageItemDto } from '../../../../shared/library-contract'

export function ImageItemCard({
  item,
  onOpen
}: {
  item: ImageItemDto
  onOpen: () => void
}): React.JSX.Element {
  const { preview, previewError } = useImagePreview(item.id, item.missingContent)

  return (
    <ItemCard>
      <ItemCardPrimaryAction
        aria-label={`Open image ${item.title}`}
        disabled={item.missingContent}
        onClick={onOpen}
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
          className="pointer-events-none max-h-[22rem] w-full bg-muted object-contain outline outline-1 outline-white/10"
        />
      ) : (
        <Skeleton
          className="pointer-events-none aspect-video w-full rounded-none"
          aria-label="Loading image preview"
        />
      )}
      <ItemCardFooter className="justify-between gap-2">
        <Badge variant="secondary">
          <FileImage data-icon="inline-start" aria-hidden="true" />
          Image
        </Badge>
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</p>
      </ItemCardFooter>
    </ItemCard>
  )
}
