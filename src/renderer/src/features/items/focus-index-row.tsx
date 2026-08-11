import { Badge } from '@/components/ui/badge'
import type { LibraryItemDto } from '../../../../shared/library-contract'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH = 30 * DAY
const YEAR = 365 * DAY

function relativeUpdatedTime(value: string, now = Date.now()): string {
  const updatedAt = Date.parse(value)
  if (!Number.isFinite(updatedAt)) return 'Recently'
  const elapsed = Math.max(0, now - updatedAt)
  if (elapsed < MINUTE) return 'Just now'
  if (elapsed < HOUR) {
    const minutes = Math.max(1, Math.round(elapsed / MINUTE))
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
  }
  if (elapsed < DAY) {
    const hours = Math.max(1, Math.round(elapsed / HOUR))
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  }
  if (elapsed < MONTH) {
    const days = Math.max(1, Math.round(elapsed / DAY))
    return `${days} ${days === 1 ? 'day' : 'days'}`
  }
  if (elapsed < YEAR) {
    const months = Math.max(1, Math.round(elapsed / MONTH))
    return `${months} ${months === 1 ? 'month' : 'months'}`
  }
  const years = Math.max(1, Math.round(elapsed / YEAR))
  return `${years} ${years === 1 ? 'year' : 'years'}`
}

function extensionFromFilename(filename: string): string {
  const extension = filename.split('.').pop()
  return extension && extension !== filename ? extension.toLocaleUpperCase() : 'FILE'
}

function itemTypeLabel(item: LibraryItemDto): 'Note' | 'URL' | 'Image' | 'File' {
  if (item.type === 'note') return 'Note'
  if (item.type === 'url') return 'URL'
  if (item.type === 'image') return 'Image'
  return 'File'
}

function itemDetail(item: LibraryItemDto): string | null {
  if (item.type === 'note') return null
  if (item.type === 'url') return item.domain || null
  if (item.type === 'image') {
    const format = item.mediaType.split('/').pop()?.toLocaleUpperCase() || 'Image'
    return `${item.width} \u00d7 ${item.height} \u00b7 ${format}`
  }
  return extensionFromFilename(item.contentFilename)
}

export function FocusIndexRow({
  item,
  active,
  selected,
  dragging,
  onActivate,
  onDragStart,
  onDragEnd,
  onNavigate,
  actions
}: {
  item: LibraryItemDto
  active: boolean
  selected: boolean
  dragging: boolean
  onActivate: (event: React.MouseEvent<HTMLButtonElement>) => void
  onDragStart: (event: React.DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  onNavigate: (key: 'ArrowUp' | 'ArrowDown' | 'Home' | 'End') => void
  actions: React.ReactNode
}): React.JSX.Element {
  const updatedTime = relativeUpdatedTime(item.updatedAt)
  const typeLabel = itemTypeLabel(item)
  const detail = itemDetail(item)
  const metadataTitle = ['Updated ' + new Date(item.updatedAt).toLocaleString(), typeLabel, detail]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      className="group/focus-index-row group/saved-item relative h-[52px] min-w-0 overflow-hidden bg-transparent outline-none [content-visibility:auto] [contain-intrinsic-size:52px] transition-[background-color,opacity] [transition-duration:var(--motion-duration-ui)] [transition-timing-function:var(--motion-ease-out)] before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:z-10 before:w-[3px] before:bg-primary before:opacity-0 hover:bg-muted/55 data-[active=true]:bg-primary/12 data-[active=true]:before:opacity-100 data-[dragging=true]:opacity-40 data-[selected=true]:bg-primary/12"
      data-item-id={item.id}
      data-active={active || undefined}
      data-selected={selected || undefined}
      data-dragging={dragging || undefined}
      aria-current={active ? 'true' : undefined}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <button
        type="button"
        data-slot="item-card-primary-action"
        className="absolute inset-0 z-20 cursor-pointer outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/70"
        aria-label={`Open ${item.type} ${item.title}`}
        aria-pressed={selected}
        onClick={onActivate}
        onKeyDown={(event) => {
          if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          onNavigate(event.key as 'ArrowUp' | 'ArrowDown' | 'Home' | 'End')
        }}
      />
      <div className="pointer-events-none flex h-full min-w-0 items-center py-1 pr-12 pl-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
          <span
            className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground group-data-[active=true]/focus-index-row:text-foreground/70"
            title={metadataTitle}
          >
            <span className="shrink-0 tabular-nums">{updatedTime}</span>
            <span aria-hidden="true">·</span>
            <Badge variant="secondary">{typeLabel}</Badge>
            {detail ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{detail}</span>
              </>
            ) : null}
          </span>
        </span>
      </div>
      <div
        data-drag-preview-hidden
        className="absolute top-1.5 right-2 z-30 opacity-0 transition-[opacity] [transition-duration:var(--motion-duration-ui)] group-hover/focus-index-row:opacity-100 group-focus-within/focus-index-row:opacity-100 group-data-[active=true]/focus-index-row:opacity-100 group-data-[active=true]/focus-index-row:[&_[data-slot=button]]:opacity-100 [&_[data-slot=button]]:size-10"
        onClick={(event) => event.stopPropagation()}
      >
        {actions}
      </div>
    </div>
  )
}
