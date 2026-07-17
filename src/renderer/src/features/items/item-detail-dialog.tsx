import { Dialog } from '@base-ui/react/dialog'
import {
  IconChevronLeft as ChevronLeft,
  IconChevronRight as ChevronRight,
  IconExternalLink as ExternalLink,
  IconFileAlert as FileWarning,
  IconFileText as FileText,
  IconLoader2 as LoaderCircle,
  IconPhoto as FileImage,
  IconPhotoOff as ImageOff,
  IconWorld as Globe2,
  IconX as X
} from '@tabler/icons-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { MarkdownPreview } from '@/features/items/markdown-preview'
import { useImagePreview } from '@/features/items/use-image-preview'
import { cn } from '@/lib/utils'
import type { LibraryItemDto } from '../../../../shared/library-contract'

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
})

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : DATE_FORMATTER.format(date)
}

function formatMediaType(value: string): string {
  return value.replace('image/', '').toLocaleUpperCase()
}

function DetailControl({
  label,
  disabled = false,
  onClick,
  children
}: {
  label: string
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <Button
          type="button"
          variant="ghost"
          className="size-10 active:scale-[0.96] transition-[scale,background-color,color]"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function MetadataRow({
  label,
  children,
  valueClassName
}: {
  label: string
  children: React.ReactNode
  valueClassName?: string
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 border-b py-3 last:border-b-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 text-xs text-foreground/85', valueClassName)}>{children}</dd>
    </div>
  )
}

function MissingContent({ type }: { type: 'image' | 'note' }): React.JSX.Element {
  return (
    <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <FileWarning className="size-5" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {type === 'image' ? 'Image file is missing' : 'Note file is missing'}
        </p>
        <p className="text-pretty text-xs leading-5 text-muted-foreground">
          Kuskus kept the item metadata, but its stored content is no longer available in the
          library.
        </p>
      </div>
    </div>
  )
}

function ImageCanvas({
  item
}: {
  item: Extract<LibraryItemDto, { type: 'image' }>
}): React.JSX.Element {
  const { preview, previewError } = useImagePreview(item.id, item.missingContent)

  return (
    <section className="flex min-h-64 min-w-0 items-center justify-center overflow-hidden bg-muted/35 p-6 min-[860px]:min-h-0 min-[860px]:p-10">
      {item.missingContent ? (
        <MissingContent type="image" />
      ) : preview ? (
        <img
          src={preview}
          alt={item.title}
          width={item.width}
          height={item.height}
          className="max-h-full max-w-full object-contain outline -outline-offset-1 outline-black/10 dark:outline-white/10"
        />
      ) : previewError ? (
        <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-background/70 text-muted-foreground shadow-sm">
            <ImageOff className="size-5" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">Preview unavailable</p>
            <p className="text-pretty text-xs leading-5 text-muted-foreground">
              Kuskus could not display this image preview, but the item metadata is still available.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Loading image
        </div>
      )}
    </section>
  )
}

function UrlCanvas({
  item
}: {
  item: Extract<LibraryItemDto, { type: 'url' }>
}): React.JSX.Element {
  return (
    <section className="flex min-h-64 min-w-0 items-center justify-center overflow-hidden bg-muted/35 p-6 min-[860px]:min-h-0 min-[860px]:p-10">
      {item.previewImageUrl ? (
        <img
          src={item.previewImageUrl}
          alt=""
          className="max-h-full max-w-full object-contain outline -outline-offset-1 outline-black/10 dark:outline-white/10"
        />
      ) : (
        <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-background/70 text-muted-foreground shadow-sm">
            {item.metadataStatus === 'pending' ? (
              <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <Globe2 className="size-5" aria-hidden="true" />
            )}
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {item.metadataStatus === 'pending' ? 'Loading link preview' : 'No preview available'}
            </p>
            <p className="text-pretty text-xs leading-5 text-muted-foreground">{item.domain}</p>
          </div>
        </div>
      )}
    </section>
  )
}

function NoteCanvas({
  item,
  onError
}: {
  item: Extract<LibraryItemDto, { type: 'note' }>
  onError: (message: string) => void
}): React.JSX.Element {
  return (
    <section className="min-w-0 bg-muted/25 min-[860px]:min-h-0 min-[860px]:overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-3xl items-start justify-center px-6 py-10 sm:px-10 min-[860px]:px-14 min-[860px]:py-16">
        {item.missingContent ? (
          <div className="my-auto">
            <MissingContent type="note" />
          </div>
        ) : (
          <article className="w-full rounded-xl bg-card p-6 shadow-sm ring-1 ring-foreground/6 sm:p-8">
            <MarkdownPreview
              value={item.body}
              presentation="detail"
              onOpenLink={async (url) => {
                const result = await window.kuskus.openExternalUrl(url)
                if (!result.ok) onError(result.error)
              }}
            />
          </article>
        )}
      </div>
    </section>
  )
}

function ItemCanvas({
  item,
  onError
}: {
  item: LibraryItemDto
  onError: (message: string) => void
}): React.JSX.Element {
  if (item.type === 'image') return <ImageCanvas item={item} />
  if (item.type === 'url') return <UrlCanvas item={item} />
  return <NoteCanvas item={item} onError={onError} />
}

function Inspector({
  item,
  onError
}: {
  item: LibraryItemDto
  onError: (message: string) => void
}): React.JSX.Element {
  const Icon = item.type === 'image' ? FileImage : item.type === 'url' ? Globe2 : FileText
  const itemType = item.type === 'image' ? 'Image' : item.type === 'url' ? 'Link' : 'Note'
  const isMissing = item.type !== 'url' && item.missingContent

  return (
    <aside className="min-w-0 border-t bg-popover min-[860px]:min-h-0 min-[860px]:overflow-y-auto min-[860px]:border-t-0 min-[860px]:border-l">
      <div className="space-y-6 p-5 sm:p-6">
        <div className="space-y-3 pr-2">
          <Badge variant="secondary">
            <Icon data-icon="inline-start" aria-hidden="true" />
            {item.type === 'url' ? item.domain : itemType}
          </Badge>
          <Dialog.Title className="text-balance text-xl leading-7 font-semibold text-popover-foreground">
            {item.title}
          </Dialog.Title>
          {item.type === 'url' && item.description ? (
            <p className="text-pretty text-sm leading-6 text-muted-foreground">
              {item.description}
            </p>
          ) : null}
        </div>

        {isMissing ? (
          <div className="flex gap-3 rounded-lg bg-destructive/8 p-3 text-destructive ring-1 ring-destructive/15">
            <FileWarning className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="text-pretty text-xs leading-5">
              Stored content is missing. Kuskus has preserved the available item metadata.
            </p>
          </div>
        ) : null}

        <dl>
          <MetadataRow label="Type">{itemType}</MetadataRow>
          {item.type === 'image' ? (
            <>
              <MetadataRow label="Source" valueClassName="break-words">
                {item.sourceFilename ?? 'Pasted image'}
              </MetadataRow>
              <MetadataRow label="Dimensions" valueClassName="tabular-nums">
                {item.width} × {item.height}
              </MetadataRow>
              <MetadataRow label="Format">{formatMediaType(item.mediaType)}</MetadataRow>
              <MetadataRow label="Status">
                <span className={item.missingContent ? 'text-destructive' : undefined}>
                  {item.missingContent ? 'Content missing' : 'Available'}
                </span>
              </MetadataRow>
            </>
          ) : item.type === 'url' ? (
            <>
              <MetadataRow label="Domain" valueClassName="break-words">
                {item.domain}
              </MetadataRow>
              <MetadataRow label="Source URL" valueClassName="break-all">
                {item.sourceUrl}
              </MetadataRow>
              <MetadataRow label="Metadata">
                {item.metadataStatus === 'pending'
                  ? 'Loading'
                  : item.metadataStatus === 'ready'
                    ? 'Available'
                    : 'Unavailable'}
              </MetadataRow>
            </>
          ) : (
            <MetadataRow label="Status">
              <span className={item.missingContent ? 'text-destructive' : undefined}>
                {item.missingContent ? 'Content missing' : 'Available'}
              </span>
            </MetadataRow>
          )}
          <MetadataRow label="Added" valueClassName="tabular-nums">
            <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
          </MetadataRow>
          <MetadataRow label="Updated" valueClassName="tabular-nums">
            <time dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time>
          </MetadataRow>
        </dl>

        {item.type === 'url' ? (
          <Button
            size="lg"
            className="w-full active:scale-[0.96] transition-[scale,background-color,color]"
            onClick={async () => {
              const result = await window.kuskus.openExternalUrl(item.sourceUrl)
              if (!result.ok) onError(result.error)
            }}
          >
            <ExternalLink data-icon="inline-start" aria-hidden="true" />
            Open link
          </Button>
        ) : null}
      </div>
    </aside>
  )
}

export function ItemDetailDialog({
  item,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onOpenChange,
  onError
}: {
  item: LibraryItemDto | null
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onOpenChange: (open: boolean) => void
  onError: (message: string) => void
}): React.JSX.Element {
  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return
    if (event.key === 'ArrowLeft' && hasPrevious) {
      event.preventDefault()
      onPrevious()
    } else if (event.key === 'ArrowRight' && hasNext) {
      event.preventDefault()
      onNext()
    }
  }

  return (
    <Dialog.Root open={item !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] transition-opacity duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          onKeyDown={handleKeyDown}
          className="fixed top-1/2 left-1/2 z-50 flex h-[calc(100vh-2rem)] max-h-[60rem] w-[calc(100vw-2rem)] max-w-[90rem] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-2xl ring-1 ring-white/10 outline-none transition-[opacity,translate] duration-200 ease-out data-ending-style:translate-y-[calc(-50%+0.75rem)] data-ending-style:opacity-0 data-starting-style:translate-y-[calc(-50%+0.75rem)] data-starting-style:opacity-0"
        >
          {item ? (
            <>
              <Dialog.Description className="sr-only">
                Read-only details and preview for {item.title}. Use the arrow keys to move between
                visible items.
              </Dialog.Description>
              <header className="flex h-13 shrink-0 items-center justify-between border-b bg-popover px-2 pl-4">
                <p className="truncate text-xs text-muted-foreground">Item details</p>
                <div className="flex items-center">
                  <DetailControl
                    label="Previous item (Left arrow)"
                    disabled={!hasPrevious}
                    onClick={onPrevious}
                  >
                    <ChevronLeft aria-hidden="true" />
                  </DetailControl>
                  <DetailControl
                    label="Next item (Right arrow)"
                    disabled={!hasNext}
                    onClick={onNext}
                  >
                    <ChevronRight aria-hidden="true" />
                  </DetailControl>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Dialog.Close
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              className="size-10 active:scale-[0.96] transition-[scale,background-color,color]"
                              aria-label="Close item details"
                            />
                          }
                        />
                      }
                    >
                      <X aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent>Close item details</TooltipContent>
                  </Tooltip>
                </div>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto min-[860px]:grid min-[860px]:grid-cols-[minmax(0,1fr)_22rem] min-[860px]:overflow-hidden">
                <ItemCanvas item={item} onError={onError} />
                <Inspector item={item} onError={onError} />
              </div>
            </>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
