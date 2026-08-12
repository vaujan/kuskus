import {
  IconLayoutDashboard,
  IconLayoutGrid,
  IconMoon,
  IconSun,
  type TablerIcon
} from '@tabler/icons-react'
import type { ReactElement } from 'react'

import { Badge } from '@/components/ui/badge'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLegend,
  FieldSet,
  FieldTitle
} from '@/components/ui/field'
import { Kbd } from '@/components/ui/kbd'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger
} from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { LibraryView } from '@/features/items/item-view'
import type { Theme } from '@/hooks/use-theme'
import type { GlobalCaptureShortcutStatus } from '../../../../shared/window-contract'

const VIEW_OPTIONS: Array<{ value: LibraryView; label: string; icon: TablerIcon }> = [
  { value: 'visual', label: 'Masonry', icon: IconLayoutDashboard },
  { value: 'grid', label: 'Grid', icon: IconLayoutGrid }
]

export function QuickSettingsPopover({
  open,
  onOpenChange,
  trigger,
  theme,
  onThemeChange,
  view,
  onViewChange,
  globalCaptureShortcutStatus,
  translucentBackgroundEnabled,
  translucentBackgroundSupported,
  translucentBackgroundReduced,
  onTranslucentBackgroundChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: ReactElement
  theme: Theme
  onThemeChange: (theme: Theme) => void
  view: LibraryView
  onViewChange: (view: LibraryView) => void
  globalCaptureShortcutStatus: GlobalCaptureShortcutStatus | null
  translucentBackgroundEnabled: boolean
  translucentBackgroundSupported: boolean | null
  translucentBackgroundReduced: boolean
  onTranslucentBackgroundChange: (enabled: boolean) => void
}): React.JSX.Element {
  const captureAvailable = globalCaptureShortcutStatus?.registered !== false
  const captureStatus =
    globalCaptureShortcutStatus === null
      ? 'Checking'
      : globalCaptureShortcutStatus.registered
        ? 'Available'
        : 'Unavailable'
  const captureDescription =
    globalCaptureShortcutStatus === null
      ? 'Checking the system-wide shortcut.'
      : globalCaptureShortcutStatus.registered
        ? 'Available from any app while Kuskus is running.'
        : 'The system-wide shortcut could not be registered.'

  const translucencyDisabled =
    translucentBackgroundSupported !== true || translucentBackgroundReduced
  const translucencyDescription =
    translucentBackgroundSupported === false
      ? 'Requires Windows 11 22H2 or newer.'
      : translucentBackgroundReduced
        ? 'Turn on Windows Transparency effects under Accessibility, Visual effects.'
        : 'Let the Windows desktop material show through the application shell.'

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        side="right"
        align="end"
        sideOffset={8}
        collisionPadding={8}
        collisionAvoidance={{ side: 'flip', align: 'shift', fallbackAxisSide: 'end' }}
        className="max-h-[calc(100vh-1rem)] w-[min(20rem,calc(100vw-1rem))] gap-5 overflow-y-auto p-4"
      >
        <PopoverHeader className="gap-0">
          <PopoverTitle className="font-heading text-lg text-balance">Quick settings</PopoverTitle>
          <PopoverDescription className="sr-only">
            Adjust the library view and appearance.
          </PopoverDescription>
        </PopoverHeader>

        <FieldSet className="gap-2">
          <FieldLegend variant="label" className="sr-only">
            Library view
          </FieldLegend>
          <Field className="gap-2">
            <FieldTitle>Layout</FieldTitle>
            <ToggleGroup
              value={[view]}
              onValueChange={(values) => {
                const nextView = values[0]
                if (nextView) onViewChange(nextView as LibraryView)
              }}
              variant="outline"
              spacing={0}
              aria-label="Library view"
              className="w-full"
            >
              {VIEW_OPTIONS.map((option) => {
                const Icon = option.icon
                return (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    aria-label={option.label}
                    title={option.label}
                    className="min-h-10 min-w-0 flex-1"
                  >
                    <Icon aria-hidden="true" />
                    <span>{option.label}</span>
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>
          </Field>
        </FieldSet>

        <FieldSet className="gap-3">
          <FieldLegend variant="label" className="sr-only">
            Appearance
          </FieldLegend>
          <Field orientation="horizontal" className="min-h-10 items-center gap-4">
            <FieldTitle>Theme</FieldTitle>
            <ToggleGroup
              value={[theme]}
              onValueChange={(values) => {
                const nextTheme = values[0]
                if (nextTheme) onThemeChange(nextTheme as Theme)
              }}
              variant="outline"
              spacing={0}
              aria-label="Theme"
              className="w-40 shrink-0"
            >
              <ToggleGroupItem value="light" className="min-h-10 min-w-0 flex-1">
                <IconSun aria-hidden="true" />
                Light
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" className="min-h-10 min-w-0 flex-1">
                <IconMoon aria-hidden="true" />
                Dark
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>
          {window.electron.window.platform === 'win32' && (
            <Field
              orientation="horizontal"
              data-disabled={translucencyDisabled || undefined}
              className="min-h-10 gap-4"
            >
              <FieldContent>
                <FieldTitle>Translucent background</FieldTitle>
                {translucencyDisabled && (
                  <FieldDescription className="text-pretty">
                    {translucencyDescription}
                  </FieldDescription>
                )}
              </FieldContent>
              <Switch
                aria-label="Translucent background"
                checked={translucentBackgroundEnabled}
                disabled={translucencyDisabled}
                onCheckedChange={onTranslucentBackgroundChange}
              />
            </Field>
          )}
        </FieldSet>

        <section className="flex flex-col gap-2" aria-labelledby="global-capture-title">
          <div className="flex min-h-8 items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 id="global-capture-title" className="font-medium text-foreground">
                Global capture
              </h3>
              {globalCaptureShortcutStatus?.registered !== true && (
                <p className="text-sm text-pretty text-muted-foreground">{captureDescription}</p>
              )}
            </div>
            <Badge variant={captureAvailable ? 'secondary' : 'destructive'}>{captureStatus}</Badge>
          </div>
          <div className="flex min-h-8 items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Shortcut</span>
            <Kbd className="shrink-0">
              {globalCaptureShortcutStatus?.accelerator ?? 'Ctrl+Shift+Space'}
            </Kbd>
          </div>
        </section>
      </PopoverContent>
    </Popover>
  )
}
