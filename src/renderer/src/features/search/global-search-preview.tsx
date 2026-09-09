import { lazy, Suspense, useEffect, useState } from 'react'
import { IconFile, IconFileAlert, IconLoader2, IconPhotoOff, IconWorld } from '@tabler/icons-react'

import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useImagePreview } from '@/features/items/use-image-preview'
import { useUrlPreview } from '@/features/items/use-url-preview'
import type {
  FileItemDto,
  ImageItemDto,
  NoteItemDto,
  UrlItemDto
} from '../../../../shared/library-contract'

const MarkdownPreview = lazy(() =>
  import('@/features/items/markdown-preview').then((module) => ({
    default: module.MarkdownPreview
  }))
)

function PreviewHeader({
  title,
  locationLabel,
  typeLabel
}: {
  title: string
  locationLabel: string
  typeLabel: string
}): React.JSX.Element {
  return (
    <header className="flex h-11 min-w-0 shrink-0 items-center gap-3 border-b border-border/60 px-4">
      <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{title}</h2>
      <p className="flex max-w-[45%] min-w-0 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <span className="truncate">{locationLabel}</span>
        <span aria-hidden="true">·</span>
        <span className="shrink-0">{typeLabel}</span>
      </p>
    </header>
  )
}

function NotePreview({ item }: { item: NoteItemDto }): React.JSX.Element {
  const [detail, setDetail] = useState<{
    itemId: string
    item: NoteItemDto | null
    error: string
  }>({ itemId: '', item: null, error: '' })
  const needsDetail = item.bodyTruncated === true

  useEffect(() => {
    if (!needsDetail) return
    let active = true
    void window.kuskus.getItemDetail(item.id).then((result) => {
      if (!active) return
      setDetail({
        itemId: item.id,
        item: result.ok && result.data.type === 'note' ? result.data : null,
        error: result.ok ? '' : result.error
      })
    })
    return () => {
      active = false
    }
  }, [item.id, needsDetail])

  const resolvedItem = needsDetail ? (detail.itemId === item.id ? detail.item : null) : item
  const error = detail.itemId === item.id ? detail.error : ''

  if (item.missingContent) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 px-8 text-center text-muted-foreground">
        <IconFileAlert aria-hidden="true" />
        <p className="text-sm">The note file is missing from the library.</p>
      </div>
    )
  }
  if (!resolvedItem) {
    return error ? (
      <div className="flex min-h-full items-center justify-center px-8 text-center text-sm text-muted-foreground">
        {error}
      </div>
    ) : (
      <div className="flex flex-col gap-3 px-8 py-8" aria-label="Loading note">
        <Skeleton className="h-5 w-2/3 rounded-md" />
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-5/6 rounded-md" />
      </div>
    )
  }
  if (!resolvedItem.body.trim()) {
    return (
      <div className="flex min-h-full items-center justify-center px-8 text-sm text-muted-foreground">
        Empty note
      </div>
    )
  }

  return (
    <article className="mx-auto w-full max-w-3xl px-8 py-7">
      <Suspense
        fallback={
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-2/3 rounded-md" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-5/6 rounded-md" />
          </div>
        }
      >
        <MarkdownPreview
          value={resolvedItem.body}
          itemId={resolvedItem.id}
          attachments={resolvedItem.attachments}
          presentation="detail"
        />
      </Suspense>
    </article>
  )
}

function ImagePreview({ item }: { item: ImageItemDto }): React.JSX.Element {
  const { preview, previewError } = useImagePreview(item.id, item.missingContent)
  return (
    <div className="flex min-h-full items-center justify-center p-8">
      {preview ? (
        <img
          src={preview}
          alt={item.title}
          width={item.width}
          height={item.height}
          className="max-h-full max-w-full object-contain outline -outline-offset-1 outline-black/10 dark:outline-white/10"
        />
      ) : (
        <div className="flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
          {item.missingContent || previewError ? (
            <IconPhotoOff aria-hidden="true" />
          ) : (
            <IconLoader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          )}
          <p>
            {item.missingContent
              ? 'Image file missing'
              : previewError
                ? 'Preview unavailable'
                : 'Loading image'}
          </p>
        </div>
      )}
    </div>
  )
}

function UrlPreview({ item }: { item: UrlItemDto }): React.JSX.Element {
  const preview = useUrlPreview(item.id, 'preview', item.hasPreviewImage)
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex min-h-56 flex-1 items-center justify-center overflow-hidden bg-muted/20 p-8">
        {preview.preview ? (
          <img
            src={preview.preview}
            alt=""
            className="max-h-full max-w-full object-contain outline -outline-offset-1 outline-black/10 dark:outline-white/10"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
            {preview.loading ? (
              <IconLoader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <IconWorld aria-hidden="true" />
            )}
            <p>{preview.loading ? 'Loading link preview' : 'No preview available'}</p>
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-t border-border/60 px-6 py-5">
        {item.description ? (
          <p className="text-pretty text-sm leading-6 text-foreground/85">{item.description}</p>
        ) : null}
        <p className="break-all text-xs text-muted-foreground">{item.sourceUrl}</p>
      </div>
    </div>
  )
}

function FilePreview({ item }: { item: FileItemDto }): React.JSX.Element {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 px-8 text-center text-muted-foreground">
      {item.missingContent ? <IconFileAlert aria-hidden="true" /> : <IconFile aria-hidden="true" />}
      <p className="text-sm text-foreground">{item.sourceFilename}</p>
      <p className="text-xs">{item.missingContent ? 'File missing' : item.mediaType}</p>
    </div>
  )
}

export function GlobalSearchPreview({
  item,
  locationLabel,
  typeLabel
}: {
  item: NoteItemDto | ImageItemDto | UrlItemDto | FileItemDto
  locationLabel: string
  typeLabel: string
}): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PreviewHeader title={item.title} locationLabel={locationLabel} typeLabel={typeLabel} />
      <ScrollArea className="min-h-0 flex-1 bg-background/35 [&_[data-slot=scroll-area-viewport]]:focus-visible:ring-0 [&_[data-slot=scroll-area-viewport]]:focus-visible:outline-none">
        {item.type === 'note' ? (
          <NotePreview item={item} />
        ) : item.type === 'image' ? (
          <ImagePreview item={item} />
        ) : item.type === 'url' ? (
          <UrlPreview item={item} />
        ) : (
          <FilePreview item={item} />
        )}
      </ScrollArea>
    </div>
  )
}
