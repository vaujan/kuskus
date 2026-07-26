import {
  IconExternalLink as ExternalLink,
  IconLoader2 as LoaderCircle,
  IconPhotoOff as ImageOff,
  IconPlayerPlayFilled as Play,
  IconWorld as Globe2
} from '@tabler/icons-react'

import {
  ItemCard,
  ItemCardCaption,
  ItemCardPrimaryAction,
  ItemCardSelectionIndicator,
  ItemCardSurface
} from '@/features/items/item-card'
import type { LibraryView } from '@/features/items/item-view'
import { useUrlPreview } from '@/features/items/use-url-preview'
import type { UrlItemDto } from '../../../../shared/library-contract'

export function UrlItemCard({
  item,
  onActivate,
  onOpen,
  selected,
  view
}: {
  item: UrlItemDto
  onActivate: (event: React.MouseEvent<HTMLButtonElement>) => void
  onOpen: () => void
  selected: boolean
  view: Exclude<LibraryView, 'table'>
}): React.JSX.Element {
  const preview = useUrlPreview(item.id, 'preview', item.hasPreviewImage)
  const favicon = useUrlPreview(item.id, 'favicon', item.hasFavicon)
  const previewLoading = item.metadataStatus === 'pending' || preview.loading

  return (
    <ItemCard data-selected={selected}>
      <ItemCardPrimaryAction
        aria-label={`Open link ${item.title}`}
        aria-haspopup="dialog"
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
      <ItemCardSurface className={view === 'grid' ? 'h-64 bg-muted' : 'aspect-[16/9] bg-muted'}>
        {preview.preview ? (
          <img
            src={preview.preview}
            alt=""
            loading="lazy"
            className="size-full object-cover outline -outline-offset-1 outline-black/10 dark:outline-white/10"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 bg-linear-to-br from-muted/70 to-muted/30 text-muted-foreground">
            {previewLoading ? (
              <LoaderCircle
                className="size-5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <ImageOff className="size-5" aria-hidden="true" />
            )}
            <span className="text-xs">
              {previewLoading ? 'Loading preview' : 'No preview available'}
            </span>
          </div>
        )}
        {item.contentKind === 'video' && preview.preview ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-black/60 text-white shadow-sm backdrop-blur-sm">
              <Play className="ml-0.5 size-5" aria-hidden="true" />
            </span>
          </span>
        ) : null}
        <span className="pointer-events-none absolute right-2 bottom-2 flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-sm bg-background/55 p-1 text-xs border border-foreground/10 leading-none tracking-wide text-foreground shadow-sm backdrop-blur-xs">
          <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{item.siteName}</span>
        </span>
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
          {favicon.preview ? (
            <img
              src={favicon.preview}
              alt=""
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
