import { useState } from 'react'
import { IconPhotoOff as ImageOff } from '@tabler/icons-react'

import { Skeleton } from '@/components/ui/skeleton'
import {
  ItemCard,
  ItemCardCaption,
  ItemCardPrimaryAction,
  ItemCardSelectionIndicator,
  ItemCardSurface
} from '@/features/items/item-card'
import type { LibraryView } from '@/features/items/item-view'
import { useImagePreview } from '@/features/items/use-image-preview'
import { useNearViewport } from '@/features/items/use-near-viewport'
import { cn } from '@/lib/utils'
import type { ImageItemDto } from '../../../../shared/library-contract'

export function ImageItemCard({
  item,
  onActivate,
  onOpen,
  selected,
  opensDialog,
  view,
  compact = false,
  showSelectionVisual = true
}: {
  item: ImageItemDto
  onActivate: (event: React.MouseEvent<HTMLButtonElement>) => void
  onOpen: () => void
  selected: boolean
  opensDialog: boolean
  view: LibraryView
  compact?: boolean
  showSelectionVisual?: boolean
}): React.JSX.Element {
  const { nearViewport, observe } = useNearViewport(!item.missingContent)
  const { preview, previewError } = useImagePreview(item.id, item.missingContent, {
    enabled: nearViewport,
    thumbnail: true
  })
  const [failedPreview, setFailedPreview] = useState<string | null>(null)
  const previewAvailable = preview !== null && failedPreview !== preview

  return (
    <ItemCard ref={observe} data-selected={selected && showSelectionVisual}>
      <ItemCardPrimaryAction
        aria-label={`Open image ${item.title}`}
        aria-haspopup={opensDialog ? 'dialog' : undefined}
        aria-pressed={selected}
        focusSurface
        onClick={onActivate}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          onOpen()
        }}
      />
      <ItemCardSelectionIndicator />
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
                : cn(
                    'pointer-events-none w-full object-contain outline -outline-offset-1 outline-black/10 dark:outline-white/10',
                    compact ? 'max-h-[16rem]' : 'max-h-[24rem]'
                  )
            }
          />
        ) : (
          <Skeleton
            className="pointer-events-none size-full min-h-44 rounded-none"
            aria-label="Loading image preview"
          />
        )}
      </ItemCardSurface>
      <ItemCardCaption compact={compact} className="justify-center text-center">
        <p className="min-w-0 truncate text-[0.6875rem] font-normal text-muted-foreground">
          {item.title}
        </p>
      </ItemCardCaption>
    </ItemCard>
  )
}
