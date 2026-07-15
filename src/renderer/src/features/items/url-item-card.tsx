import { Globe2, ImageOff, LoaderCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { ItemCard, ItemCardFooter, ItemCardPrimaryAction } from '@/features/items/item-card'
import type { UrlItemDto } from '../../../../shared/library-contract'

export function UrlItemCard({
  item,
  onOpen
}: {
  item: UrlItemDto
  onOpen: () => void
}): React.JSX.Element {
  return (
    <ItemCard>
      <ItemCardPrimaryAction aria-label={`View link ${item.title}`} onClick={onOpen} />
      <div className="pointer-events-none relative aspect-[16/9] overflow-hidden bg-muted">
        {item.previewImageUrl ? (
          <img
            src={item.previewImageUrl}
            alt=""
            className="size-full object-cover outline outline-1 outline-white/10"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
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
      </div>
      <div className="relative z-10 px-3 pt-3">
        <p className="line-clamp-2 text-sm font-medium text-foreground">{item.title}</p>
        {item.description ? (
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {item.description}
          </p>
        ) : null}
      </div>
      <ItemCardFooter className="justify-between gap-2">
        <Badge variant="secondary">
          {item.faviconUrl ? (
            <img src={item.faviconUrl} alt="" className="size-3.5 rounded-sm" />
          ) : (
            <Globe2 data-icon="inline-start" aria-hidden="true" />
          )}
          {item.domain}
        </Badge>
      </ItemCardFooter>
    </ItemCard>
  )
}
