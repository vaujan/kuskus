import {
  IconAlignLeft,
  IconBraces,
  IconCalendar,
  IconCheckbox,
  IconChevronDown,
  IconCircleDashed,
  IconExternalLink,
  IconHash,
  IconLink,
  IconList,
  IconPlus,
  IconTrash
} from '@tabler/icons-react'
import { useState, type ComponentType } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { openExternalUrlWithFeedback } from '@/features/items/open-external-url'
import { cn } from '@/lib/utils'
import {
  editNoteFrontmatter,
  parseNoteFrontmatter,
  valueForNotePropertyType,
  type NoteProperty,
  type NotePropertyEdit,
  type NotePropertyType
} from '../../../../shared/note-frontmatter'

const PROPERTY_TYPES: Array<{
  value: Exclude<NotePropertyType, 'unsupported'>
  label: string
  icon: ComponentType<{ 'aria-hidden'?: boolean }>
}> = [
  { value: 'text', label: 'Text', icon: IconAlignLeft },
  { value: 'number', label: 'Number', icon: IconHash },
  { value: 'boolean', label: 'Checkbox', icon: IconCheckbox },
  { value: 'url', label: 'URL', icon: IconLink },
  { value: 'date', label: 'Date', icon: IconCalendar },
  { value: 'list', label: 'List', icon: IconList },
  { value: 'empty', label: 'Empty', icon: IconCircleDashed }
]

const TYPE_ICONS: Record<NotePropertyType, ComponentType<{ 'aria-hidden'?: boolean }>> = {
  text: IconAlignLeft,
  number: IconHash,
  boolean: IconCheckbox,
  url: IconLink,
  date: IconCalendar,
  list: IconList,
  empty: IconCircleDashed,
  unsupported: IconBraces
}

const EDITOR_CLASS =
  'rounded-none border-transparent bg-transparent px-0 shadow-none hover:bg-transparent focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent'

function EditableText({
  value,
  multiline = false,
  ariaLabel,
  className,
  readOnly = false,
  onCommit
}: {
  value: string
  multiline?: boolean
  ariaLabel: string
  className?: string
  readOnly?: boolean
  onCommit: (value: string) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState(value)
  const commit = (): void => {
    if (draft !== value) onCommit(draft)
  }
  return multiline ? (
    <Textarea
      value={draft}
      aria-label={ariaLabel}
      readOnly={readOnly}
      className={cn(EDITOR_CLASS, 'min-h-8 resize-none overflow-hidden py-1', className)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={readOnly ? undefined : commit}
      onKeyDown={
        readOnly
          ? undefined
          : (event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey))
                event.currentTarget.blur()
              if (event.key === 'Escape') {
                setDraft(value)
                event.currentTarget.blur()
              }
            }
      }
    />
  ) : (
    <Input
      value={draft}
      aria-label={ariaLabel}
      readOnly={readOnly}
      className={cn(EDITOR_CLASS, className)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={readOnly ? undefined : commit}
      onKeyDown={
        readOnly
          ? undefined
          : (event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                setDraft(value)
                event.currentTarget.blur()
              }
            }
      }
    />
  )
}

function PropertyValueEditor({
  property,
  editable,
  onChange,
  onOpenSource
}: {
  property: NoteProperty
  editable: boolean
  onChange: (value: unknown) => void
  onOpenSource: () => void
}): React.JSX.Element {
  if (property.type === 'boolean') {
    return (
      <div className="flex min-h-8 items-center">
        <Switch
          checked={Boolean(property.value)}
          aria-label={`Toggle ${property.key}`}
          disabled={!editable}
          onCheckedChange={onChange}
        />
      </div>
    )
  }
  if (property.type === 'number') {
    return (
      <EditableText
        value={String(property.value)}
        ariaLabel={`Value for ${property.key}`}
        readOnly={!editable}
        onCommit={(value) => {
          const number = Number(value)
          if (Number.isFinite(number)) onChange(number)
        }}
      />
    )
  }
  if (property.type === 'url') {
    const url = String(property.value ?? '')
    return (
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-8 min-w-0 max-w-full justify-start px-0 font-normal"
        title={url}
        onClick={() => void openExternalUrlWithFeedback(url)}
      >
        <span className="truncate">{url}</span>
        <IconExternalLink data-icon="inline-end" aria-hidden />
      </Button>
    )
  }
  if (property.type === 'date') {
    const source = String(property.value)
    const includesTime = source.includes('T')
    const date = new Date(source)
    const value =
      includesTime && Number.isFinite(date.getTime())
        ? date.toISOString().slice(0, 16)
        : source.slice(0, 10)
    return (
      <Input
        type={includesTime ? 'datetime-local' : 'date'}
        value={value}
        aria-label={`Date for ${property.key}`}
        readOnly={!editable}
        className={cn(EDITOR_CLASS, 'tabular-nums')}
        onChange={(event) => {
          const next = event.target.value
          onChange(includesTime && next ? new Date(next).toISOString() : next)
        }}
      />
    )
  }
  if (property.type === 'list') {
    return (
      <EditableText
        value={(property.value as unknown[]).map(String).join('\n')}
        multiline
        ariaLabel={`List values for ${property.key}`}
        readOnly={!editable}
        onCommit={(value) =>
          onChange(
            value
              .split(/\r?\n/)
              .map((entry) => entry.trim())
              .filter(Boolean)
          )
        }
      />
    )
  }
  if (property.type === 'empty') {
    return <span className="flex min-h-8 items-center text-sm text-muted-foreground">Empty</span>
  }
  if (property.type === 'unsupported') {
    return (
      <div className="flex min-h-8 min-w-0 items-center gap-2">
        <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {JSON.stringify(property.value)}
        </code>
        <Button type="button" variant="ghost" size="sm" onClick={onOpenSource}>
          <IconExternalLink data-icon="inline-start" aria-hidden />
          Edit in source
        </Button>
      </div>
    )
  }
  const text = String(property.value ?? '')
  return (
    <EditableText
      value={text}
      multiline={text.includes('\n') || text.length > 100}
      ariaLabel={`Value for ${property.key}`}
      readOnly={!editable}
      onCommit={onChange}
    />
  )
}

function PropertyRow({
  property,
  editable,
  onEdit,
  onOpenSource,
  onError
}: {
  property: NoteProperty
  editable: boolean
  onEdit: (edit: NotePropertyEdit) => void
  onOpenSource: () => void
  onError: (message: string) => void
}): React.JSX.Element {
  const TypeIcon = TYPE_ICONS[property.type]
  return (
    <div className="group/property relative grid min-w-0 grid-cols-[10rem_minmax(0,1fr)] items-start gap-3 rounded-xl px-2 py-0.5 transition-[background-color,box-shadow] duration-150 hover:bg-muted/80 hover:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_8%,transparent)] focus-within:bg-background/70 focus-within:shadow-sm">
      <div className="flex min-w-0 items-center gap-1">
        {editable ? (
          <Select
            value={property.type}
            onValueChange={(value) => {
              const type = value as NotePropertyType
              if (type === 'unsupported') return
              onEdit({
                type: 'set',
                key: property.key,
                value: valueForNotePropertyType(type, property.value)
              })
            }}
          >
            <SelectTrigger
              size="sm"
              showIcon={false}
              aria-label={`Type for ${property.key}`}
              className="size-8 shrink-0 justify-center rounded-none border-transparent bg-transparent px-0 text-muted-foreground shadow-none hover:bg-transparent focus-visible:border-transparent focus-visible:ring-0 dark:hover:bg-transparent"
            >
              <TypeIcon aria-hidden />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectGroup>
                {PROPERTY_TYPES.map(({ value, label, icon: Icon }) => (
                  <SelectItem key={value} value={value}>
                    <Icon aria-hidden />
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center text-muted-foreground">
            <TypeIcon aria-hidden />
          </span>
        )}
        <EditableText
          value={property.key}
          ariaLabel={`Property name ${property.key}`}
          className="text-muted-foreground"
          readOnly={!editable}
          onCommit={(nextKey) => {
            const trimmed = nextKey.trim()
            if (!trimmed) {
              onError('Property names cannot be empty.')
              return
            }
            onEdit({ type: 'rename', key: property.key, nextKey: trimmed })
          }}
        />
      </div>
      <PropertyValueEditor
        key={`${property.key}:${JSON.stringify(property.value)}`}
        property={property}
        editable={editable}
        onChange={(value) => onEdit({ type: 'set', key: property.key, value })}
        onOpenSource={onOpenSource}
      />
      {editable ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-0 right-1 size-8 bg-background/90 opacity-0 transition-[opacity,scale] group-hover/property:opacity-100 focus-visible:opacity-100 active:scale-[0.96]"
          aria-label={`Delete ${property.key}`}
          onClick={() => onEdit({ type: 'delete', key: property.key })}
        >
          <IconTrash aria-hidden />
        </Button>
      ) : null}
    </div>
  )
}

export function NoteProperties({
  value,
  editable,
  className,
  onChange,
  onOpenSource,
  onError
}: {
  value: string
  editable: boolean
  className?: string
  onChange: (value: string) => void
  onOpenSource: () => void
  onError: (message: string) => void
}): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(true)
  const frontmatter = parseNoteFrontmatter(value)
  if (frontmatter.status !== 'valid' || frontmatter.properties.length === 0) return null

  const edit = (propertyEdit: NotePropertyEdit): void => {
    const result = editNoteFrontmatter(value, propertyEdit)
    if (result.ok) onChange(result.value)
    else onError(result.error ?? 'The property could not be updated.')
  }

  return (
    <section
      className={cn('not-typeset flex min-w-0 flex-col gap-2 pt-2 font-sans', className)}
      data-not-typeset
    >
      <h2 className="w-fit">
        <Button
          type="button"
          variant="link"
          size="sm"
          className="justify-start px-2 text-base font-semibold"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          Properties
          <IconChevronDown
            data-icon="inline-end"
            className={cn(
              'transition-transform duration-150 motion-reduce:transition-none',
              expanded ? 'rotate-0' : '-rotate-90'
            )}
            aria-hidden
          />
        </Button>
      </h2>
      {expanded ? (
        <>
          <div className="flex min-w-0 flex-col gap-0.5">
            {frontmatter.properties.map((property) => (
              <PropertyRow
                key={property.key}
                property={property}
                editable={editable}
                onEdit={edit}
                onOpenSource={onOpenSource}
                onError={onError}
              />
            ))}
          </div>
          {editable ? (
            <Button
              type="button"
              variant="ghost"
              size="default"
              className="w-fit justify-start text-muted-foreground"
              onClick={() => edit({ type: 'add' })}
            >
              <IconPlus data-icon="inline-start" aria-hidden />
              Add property
            </Button>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
