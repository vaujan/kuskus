import { useState } from 'react'
import {
  IconLoader2 as LoaderCircle,
  IconPhotoOff as ImageOff,
  IconWorld as Globe2
} from '@tabler/icons-react'

import {
  ItemCard,
  ItemCardCaption,
  ItemCardPrimaryAction,
  ItemCardSurface
} from '@/features/items/item-card'
import type { LibraryView } from '@/features/items/item-view'
import type { UrlItemDto } from '../../../../shared/library-contract'

export function UrlItemCard({
  item,
  onOpen,
  view
}: {
  item: UrlItemDto
  onOpen: () => void
  view: Exclude<LibraryView, 'list'>
}): React.JSX.Element {
  const [failedPreviewUrl, setFailedPreviewUrl] = useState<string | null>(null)
  const [failedFaviconUrl, setFailedFaviconUrl] = useState<string | null>(null)
  const hasPreview = item.previewImageUrl !== null && failedPreviewUrl !== item.previewImageUrl
  const hasFavicon = item.faviconUrl !== null && failedFaviconUrl !== item.faviconUrl

  return (
    <ItemCard>
      <ItemCardPrimaryAction aria-label={`View link ${item.title}`} focusSurface onClick={onOpen} />
      <ItemCardSurface className={view === 'grid' ? 'h-64 bg-muted' : 'aspect-[16/9] bg-muted'}>
        {hasPreview ? (
          <img
            src={item.previewImageUrl ?? undefined}
            alt=""
            loading="lazy"
            onError={() => setFailedPreviewUrl(item.previewImageUrl)}
            className="size-full object-cover outline -outline-offset-1 outline-black/10 dark:outline-white/10"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 bg-linear-to-br from-muted/70 to-muted/30 text-muted-foreground">
            {item.metadataStatus === 'pending' ? (
              <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <ImageOff className="size-5" aria-hidden="true" />
            )}
            <span className="text-xs">
              {item.metadataStatus === 'pending' ? 'Loading preview' : 'No preview available'}
            </span>
          </div>
        )}
      </ItemCardSurface>
      <ItemCardCaption className="min-h-14 flex-col items-start justify-start gap-1.5">
        <p
          className={
            view === 'grid'
              ? 'w-full truncate text-xs font-normal text-foreground/80'
              : 'line-clamp-2 w-full text-pretty text-xs leading-4 font-normal text-foreground/80'
          }
        >
          {item.title}
        </p>
        <span className="flex min-w-0 max-w-full items-center gap-1.5">
          {hasFavicon ? (
            <img
              src={item.faviconUrl ?? undefined}
              alt=""
              onError={() => setFailedFaviconUrl(item.faviconUrl)}
              className="size-3.5 shrink-0 rounded-sm outline -outline-offset-1 outline-black/10 dark:outline-white/10"
            />
          ) : (
            <Globe2 className="size-3.5 shrink-0" aria-hidden="true" />
          )}
          <span className="truncate">{item.domain}</span>
        </span>
      </ItemCardCaption>
    </ItemCard>
  )
}
