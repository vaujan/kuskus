import { useState } from 'react'
import { IconPhotoOff as ImageOff } from '@tabler/icons-react'

import { Skeleton } from '@/components/ui/skeleton'
import {
  ItemCard,
  ItemCardCaption,
  ItemCardPrimaryAction,
  ItemCardSurface
} from '@/features/items/item-card'
import type { LibraryView } from '@/features/items/item-view'
import { useImagePreview } from '@/features/items/use-image-preview'
import type { ImageItemDto } from '../../../../shared/library-contract'

export function ImageItemCard({
  item,
  onOpen,
  view
}: {
  item: ImageItemDto
  onOpen: () => void
  view: Exclude<LibraryView, 'list'>
}): React.JSX.Element {
  const { preview, previewError } = useImagePreview(item.id, item.missingContent)
  const [failedPreview, setFailedPreview] = useState<string | null>(null)
  const previewAvailable = preview !== null && failedPreview !== preview

  return (
    <ItemCard>
      <ItemCardPrimaryAction
        aria-label={`Open image ${item.title}`}
        disabled={item.missingContent}
        focusSurface
        onClick={onOpen}
      />
      <ItemCardSurface className={view === 'grid' ? 'h-64 bg-muted/30' : 'bg-muted/30'}>
        {item.missingContent ||
        previewError ||
        (failedPreview !== null && failedPreview === preview) ? (
          <div className="pointer-events-none flex size-full min-h-44 flex-col items-center justify-center gap-2 bg-muted/70 px-5 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-background/70 text-muted-foreground shadow-sm">
              <ImageOff className="size-4" aria-hidden="true" />
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              {item.missingContent ? 'Image file missing' : 'Preview unavailable'}
            </span>
          </div>
        ) : previewAvailable ? (
          <img
            src={preview}
            alt={item.title}
            width={item.width}
            height={item.height}
            loading="lazy"
            onError={() => setFailedPreview(preview)}
            className={
              view === 'grid'
                ? 'pointer-events-none size-full object-contain outline -outline-offset-1 outline-black/10 dark:outline-white/10'
                : 'pointer-events-none max-h-[24rem] w-full object-contain outline -outline-offset-1 outline-black/10 dark:outline-white/10'
            }
          />
        ) : (
          <Skeleton
            className="pointer-events-none size-full min-h-44 rounded-none"
            aria-label="Loading image preview"
          />
        )}
      </ItemCardSurface>
      <ItemCardCaption>
        <p className="min-w-0 flex-1 truncate font-normal text-foreground/80">{item.title}</p>
      </ItemCardCaption>
    </ItemCard>
  )
}
