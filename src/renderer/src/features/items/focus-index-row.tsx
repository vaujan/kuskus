import { focusIndexSupportingText } from '@/features/items/focus-index-row-text'
import type { LibraryItemDto } from '../../../../shared/library-contract'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH = 30 * DAY
const YEAR = 365 * DAY
const RELATIVE_TIME = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

function relativeUpdatedTime(value: string, now = Date.now()): string {
  const elapsed = Math.max(0, now - Date.parse(value))
  if (!Number.isFinite(elapsed)) return 'Recently'
  if (elapsed < MINUTE) return 'Just now'
  if (elapsed < HOUR)
    return RELATIVE_TIME.format(-Math.max(1, Math.round(elapsed / MINUTE)), 'minute')
  if (elapsed < DAY) return RELATIVE_TIME.format(-Math.max(1, Math.round(elapsed / HOUR)), 'hour')
  if (elapsed < MONTH) return RELATIVE_TIME.format(-Math.max(1, Math.round(elapsed / DAY)), 'day')
  if (elapsed < YEAR)
    return RELATIVE_TIME.format(-Math.max(1, Math.round(elapsed / MONTH)), 'month')
  return RELATIVE_TIME.format(-Math.max(1, Math.round(elapsed / YEAR)), 'year')
}

function extensionFromFilename(filename: string): string {
  const extension = filename.split('.').pop()
  return extension && extension !== filename ? extension.toLocaleUpperCase() : 'File'
}

function itemTypeLabel(item: LibraryItemDto): string {
  if (item.type === 'note') return 'Note'
  if (item.type === 'url') return 'Link'
  if (item.type === 'image') return item.mediaType.split('/').pop()?.toLocaleUpperCase() || 'Image'
  return extensionFromFilename(item.contentFilename)
}

function itemDetail(item: LibraryItemDto): string | null {
  if (item.type === 'url') return item.domain || null
  if (item.type === 'image') return `${item.width} × ${item.height}`
  return null
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
  actions,
  ...rest
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
} & React.ComponentProps<'div'>): React.JSX.Element {
  const updatedTime = relativeUpdatedTime(item.updatedAt)
  const typeLabel = itemTypeLabel(item)
  const detail = itemDetail(item)
  const supportingText = focusIndexSupportingText(item)

  return (
    <div
      {...rest}
      className="group/focus-index-row group/saved-item relative min-h-[88px] min-w-0 overflow-hidden border-b border-border/45 bg-transparent outline-none [content-visibility:auto] [contain-intrinsic-size:96px] transition-[background-color,opacity,box-shadow] [transition-duration:var(--motion-duration-ui)] [transition-timing-function:var(--motion-ease-out)] before:pointer-events-none before:absolute before:inset-y-2.5 before:left-0 before:z-10 before:w-0.5 before:rounded-r-full before:bg-primary before:opacity-0 hover:bg-muted/45 data-[active=true]:bg-primary/9 data-[active=true]:before:opacity-100 data-[dragging=true]:opacity-40 data-[selected=true]:shadow-[inset_0_0_0_1px_var(--primary)]"
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

      <div className="pointer-events-none flex min-w-0 flex-col py-2.5 pr-14 pl-4">
        <span className="line-clamp-2 text-sm leading-5 font-semibold text-pretty text-foreground">
          {item.title}
        </span>
        <span className="mt-1 flex min-w-0 items-center gap-2.5 text-[0.6875rem] leading-4 text-muted-foreground">
          <time className="shrink-0 tabular-nums" dateTime={item.updatedAt}>
            {updatedTime}
          </time>
          <span className="kuskus-type-badge" data-type={item.type}>
            {typeLabel}
          </span>
          {detail ? <span className="truncate text-foreground/55">{detail}</span> : null}
        </span>
        <span className="mt-0.5 truncate text-[0.8125rem] leading-[1.125rem] text-muted-foreground/85">
          {supportingText || 'No preview available'}
        </span>
      </div>

      <div
        data-drag-preview-hidden
        className="absolute top-2 right-2 z-30 opacity-0 transition-[opacity] [transition-duration:var(--motion-duration-ui)] group-hover/focus-index-row:opacity-100 group-focus-within/focus-index-row:opacity-100 [&_[data-slot=button]]:size-10 [&_[data-slot=button]]:rounded-md [&_[data-slot=button]]:bg-transparent [&_[data-slot=button]]:shadow-none [&_[data-slot=button]:hover]:bg-muted"
        onClick={(event) => event.stopPropagation()}
      >
        {actions}
      </div>
    </div>
  )
}
