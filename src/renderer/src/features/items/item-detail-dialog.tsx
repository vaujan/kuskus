import { Dialog } from '@base-ui/react/dialog'
import {
  IconAlignLeft as AlignLeft,
  IconCalendar as Calendar,
  IconChevronLeft as ChevronLeft,
  IconChevronRight as ChevronRight,
  IconDimensions as Dimensions,
  IconExternalLink as ExternalLink,
  IconFile as File,
  IconFileAlert as FileWarning,
  IconFileTypography as FileTypography,
  IconFolderOpen as FolderOpen,
  IconLink as Link,
  IconLoader2 as LoaderCircle,
  IconPhotoOff as ImageOff,
  IconWorld as Globe2,
  IconX as X,
  type TablerIcon
} from '@tabler/icons-react'

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

function PropertyRow({
  icon: Icon,
  label,
  children,
  valueClassName
}: {
  icon: TablerIcon
  label: string
  children: React.ReactNode
  valueClassName?: string
}): React.JSX.Element {
  return (
    <div className="grid min-h-9 grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-3 rounded-md px-1.5 py-2">
      <dt className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-4 shrink-0" stroke={1.5} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </dt>
      <dd className={cn('min-w-0 text-xs leading-5 text-foreground/85', valueClassName)}>
        {children}
      </dd>
    </div>
  )
}

function PropertyList({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <dl className="-mx-1.5 space-y-0.5">{children}</dl>
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

function FloatingControls({
  itemId,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onError
}: {
  itemId: string
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onError: (message: string) => void
}): React.JSX.Element {
  return (
    <div className="absolute top-3 right-3 z-20 flex rounded-lg bg-popover/85 p-0.5 shadow-md ring-1 ring-foreground/8 backdrop-blur-md">
      <DetailControl
        label="Previous item (Left arrow)"
        disabled={!hasPrevious}
        onClick={onPrevious}
      >
        <ChevronLeft aria-hidden="true" />
      </DetailControl>
      <DetailControl label="Next item (Right arrow)" disabled={!hasNext} onClick={onNext}>
        <ChevronRight aria-hidden="true" />
      </DetailControl>
      <DetailControl
        label="Show in Explorer"
        onClick={async () => {
          const result = await window.kuskus.showItemInExplorer(itemId)
          if (!result.ok) onError(result.error)
        }}
      >
        <FolderOpen aria-hidden="true" />
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
  )
}

function MissingContent({ type }: { type: 'image' | 'note' }): React.JSX.Element {
  return (
    <div className="flex max-w-xs flex-col items-center gap-3 px-6 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <FileWarning className="size-5" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {type === 'image' ? 'Image file is missing' : 'Note file is missing'}
        </p>
        <p className="text-pretty text-xs leading-5 text-muted-foreground">
          Kuskus kept the item, but its stored content is no longer in the library.
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
    <section className="flex min-h-64 min-w-0 items-center justify-center overflow-hidden bg-muted/35 p-5 min-[860px]:min-h-0 min-[860px]:p-8">
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
        <div className="flex max-w-xs flex-col items-center gap-3 px-6 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-background/70 text-muted-foreground shadow-sm">
            <ImageOff className="size-5" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">Preview unavailable</p>
            <p className="text-pretty text-xs leading-5 text-muted-foreground">
              The image could not be displayed.
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
    <section className="flex min-h-64 min-w-0 items-center justify-center overflow-hidden bg-muted/35 p-5 min-[860px]:min-h-0 min-[860px]:p-8">
      {item.previewImageUrl ? (
        <img
          src={item.previewImageUrl}
          alt=""
          className="max-h-full max-w-full object-contain outline -outline-offset-1 outline-black/10 dark:outline-white/10"
        />
      ) : (
        <div className="flex max-w-xs flex-col items-center gap-3 px-6 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-background/70 text-muted-foreground shadow-sm">
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
    <section className="size-full min-w-0 overflow-y-auto bg-popover">
      <div className="mx-auto flex min-h-full max-w-3xl items-start px-7 pt-20 pb-12 sm:px-12 min-[860px]:px-16 min-[860px]:pt-24">
        {item.missingContent ? (
          <div className="m-auto">
            <MissingContent type="note" />
          </div>
        ) : (
          <article className="w-full">
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

function ImageInspector({
  item
}: {
  item: Extract<LibraryItemDto, { type: 'image' }>
}): React.JSX.Element {
  return (
    <aside className="min-w-0 border-t bg-popover min-[860px]:min-h-0 min-[860px]:overflow-y-auto min-[860px]:border-t-0 min-[860px]:border-l">
      <div className="space-y-5 p-5 pt-18 sm:p-6 sm:pt-20">
        <Dialog.Title className="text-balance text-xl leading-7 font-semibold text-popover-foreground">
          {item.title}
        </Dialog.Title>
        <PropertyList>
          <PropertyRow icon={File} label="File name" valueClassName="break-words">
            {item.sourceFilename ?? 'Pasted image'}
          </PropertyRow>
          <PropertyRow icon={FileTypography} label="Format">
            {formatMediaType(item.mediaType)}
          </PropertyRow>
          <PropertyRow icon={Dimensions} label="Dimensions" valueClassName="tabular-nums">
            {item.width} × {item.height}
          </PropertyRow>
          <PropertyRow icon={Calendar} label="Added" valueClassName="tabular-nums">
            <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
          </PropertyRow>
        </PropertyList>
      </div>
    </aside>
  )
}

function UrlInspector({
  item,
  onError
}: {
  item: Extract<LibraryItemDto, { type: 'url' }>
  onError: (message: string) => void
}): React.JSX.Element {
  return (
    <aside className="min-w-0 border-t bg-popover min-[860px]:min-h-0 min-[860px]:overflow-y-auto min-[860px]:border-t-0 min-[860px]:border-l">
      <div className="space-y-5 p-5 pt-18 sm:p-6 sm:pt-20">
        <Dialog.Title className="text-balance text-xl leading-7 font-semibold text-popover-foreground">
          {item.title}
        </Dialog.Title>
        <PropertyList>
          <PropertyRow icon={Link} label="Source" valueClassName="break-all">
            {item.sourceUrl}
          </PropertyRow>
          {item.description ? (
            <PropertyRow icon={AlignLeft} label="Description" valueClassName="text-pretty">
              {item.description}
            </PropertyRow>
          ) : null}
          <PropertyRow icon={Calendar} label="Added" valueClassName="tabular-nums">
            <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
          </PropertyRow>
        </PropertyList>
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
          className="fixed top-1/2 left-1/2 z-50 flex h-[calc(100vh-2rem)] max-h-[60rem] w-[calc(100vw-2rem)] max-w-[90rem] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-2xl ring-1 ring-white/10 outline-none transition-[opacity,translate] duration-200 ease-out data-ending-style:translate-y-[calc(-50%+0.75rem)] data-ending-style:opacity-0 data-starting-style:translate-y-[calc(-50%+0.75rem)] data-starting-style:opacity-0"
        >
          {item ? (
            <>
              {item.type === 'note' ? (
                <Dialog.Title className="sr-only">{item.title}</Dialog.Title>
              ) : null}
              <Dialog.Description className="sr-only">
                Read-only details and preview for {item.title}. Use the arrow keys to move between
                visible items.
              </Dialog.Description>
              <FloatingControls
                itemId={item.id}
                hasPrevious={hasPrevious}
                hasNext={hasNext}
                onPrevious={onPrevious}
                onNext={onNext}
                onError={onError}
              />
              <div
                className={cn(
                  'min-h-0 min-w-0 flex-1 overflow-y-auto',
                  item.type !== 'note' &&
                    'min-[860px]:grid min-[860px]:grid-cols-[minmax(0,1fr)_20rem] min-[860px]:overflow-hidden'
                )}
              >
                {item.type === 'note' ? (
                  <NoteCanvas item={item} onError={onError} />
                ) : item.type === 'image' ? (
                  <>
                    <ImageCanvas item={item} />
                    <ImageInspector item={item} />
                  </>
                ) : (
                  <>
                    <UrlCanvas item={item} />
                    <UrlInspector item={item} onError={onError} />
                  </>
                )}
              </div>
            </>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
