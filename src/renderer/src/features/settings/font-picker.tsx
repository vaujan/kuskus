import { useState } from 'react'
import { IconCheck, IconChevronDown, IconDeviceDesktop, IconSearch } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import {
  createFontStack,
  createLocalFontPreference,
  getFontPreferenceLabel,
  type FontPreference
} from '@/hooks/theme'
import type { LocalFontsState } from '@/hooks/use-local-fonts'
import { cn } from '@/lib/utils'

type FontKind = 'ui' | 'code'

interface FontOption {
  value: FontPreference
  label: string
}

const UI_FONT_OPTIONS: readonly FontOption[] = [
  { value: 'inter', label: 'Inter' },
  { value: 'plex', label: 'IBM Plex Sans' },
  { value: 'system-ui', label: 'System default' }
]

const CODE_FONT_OPTIONS: readonly FontOption[] = [
  { value: 'system-mono', label: 'System monospace' }
]

function FontOptionRow({
  option,
  selected,
  kind,
  onSelect
}: {
  option: FontOption
  selected: boolean
  kind: FontKind
  onSelect: (value: FontPreference) => void
}): React.JSX.Element {
  const previewFamily = createFontStack(
    option.value,
    'none',
    kind === 'ui' ? 'sans-serif' : 'monospace'
  )

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => onSelect(option.value)}
      className="w-full justify-start rounded-xl px-2.5 transition-[background-color,scale] active:scale-[0.96]"
      style={{ fontFamily: previewFamily }}
    >
      <span className="truncate">{option.label}</span>
      <span className="ml-auto text-xs font-normal text-muted-foreground">Aa 123</span>
      <IconCheck
        data-icon="inline-end"
        className={cn('transition-opacity', selected ? 'opacity-100' : 'opacity-0')}
        aria-hidden="true"
      />
    </Button>
  )
}

export function FontPicker({
  value,
  onValueChange,
  kind,
  localFonts,
  allowGenericOnly = false,
  ariaLabel
}: {
  value: FontPreference
  onValueChange: (value: FontPreference) => void
  kind: FontKind
  localFonts: LocalFontsState
  allowGenericOnly?: boolean
  ariaLabel: string
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const bundledOptions = kind === 'ui' ? UI_FONT_OPTIONS : CODE_FONT_OPTIONS
  const localOptions = localFonts.families.flatMap((family): FontOption[] => {
    const preference = createLocalFontPreference(family)
    return preference ? [{ value: preference, label: family }] : []
  })
  const genericOptions: readonly FontOption[] = allowGenericOnly
    ? [{ value: 'none', label: 'Generic only' }]
    : []
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filterOptions = (options: readonly FontOption[]): readonly FontOption[] =>
    normalizedQuery
      ? options.filter((option) => option.label.toLocaleLowerCase().includes(normalizedQuery))
      : options
  const visibleBundled = filterOptions([...genericOptions, ...bundledOptions])
  const visibleLocal = filterOptions(localOptions)
  const noMatches = visibleBundled.length === 0 && visibleLocal.length === 0

  const select = (nextValue: FontPreference): void => {
    onValueChange(nextValue)
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-label={ariaLabel}
            className="min-w-0 justify-between px-2.5 transition-transform active:scale-[0.96]"
          />
        }
      >
        <span className="truncate">{getFontPreferenceLabel(value)}</span>
        <IconChevronDown data-icon="inline-end" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-2 p-2">
        <div className="relative">
          <IconSearch
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search fonts…"
            aria-label="Search fonts"
            className="pl-9"
            autoFocus
          />
        </div>

        <ScrollArea className="h-56 pr-2">
          <div className="flex flex-col gap-1">
            {visibleBundled.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                <p className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">Included</p>
                {visibleBundled.map((option) => (
                  <FontOptionRow
                    key={option.value}
                    option={option}
                    selected={option.value === value}
                    kind={kind}
                    onSelect={select}
                  />
                ))}
              </div>
            ) : null}

            {visibleLocal.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                <p className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
                  On this computer
                </p>
                {visibleLocal.map((option) => (
                  <FontOptionRow
                    key={option.value}
                    option={option}
                    selected={option.value === value}
                    kind={kind}
                    onSelect={select}
                  />
                ))}
              </div>
            ) : null}

            {noMatches ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No matching fonts.
              </p>
            ) : null}
          </div>
        </ScrollArea>

        {localFonts.status !== 'ready' ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void localFonts.request()}
            disabled={localFonts.status === 'loading' || localFonts.status === 'unsupported'}
            className="justify-start transition-transform active:scale-[0.96]"
          >
            {localFonts.status === 'loading' ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <IconDeviceDesktop data-icon="inline-start" />
            )}
            {localFonts.status === 'denied'
              ? 'Try computer fonts again'
              : localFonts.status === 'unsupported'
                ? 'Computer fonts unavailable'
                : 'Use fonts from this computer…'}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
