import {
  IconBolt,
  IconKeyboard,
  IconLayoutDashboard,
  IconLayoutGrid,
  IconMoon,
  IconPalette,
  IconSettings,
  IconSun,
  type TablerIcon
} from '@tabler/icons-react'
import type { ReactElement } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import type { LiveEngine } from '@/features/items/live-engine'
import type { Theme } from '@/hooks/use-theme'
import type { GlobalCaptureShortcutStatus } from '../../../../shared/window-contract'

const VIEW_OPTIONS: Array<{ value: LibraryView; label: string; icon: TablerIcon }> = [
  { value: 'visual', label: 'Masonry', icon: IconLayoutDashboard },
  { value: 'grid', label: 'Grid', icon: IconLayoutGrid }
]

const surfaceClass =
  'rounded-2xl bg-muted/45 p-1.5 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.035)] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.05)]'
const rowClass = 'flex min-h-12 items-center gap-3 rounded-lg px-3'

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
  onTranslucentBackgroundChange,
  vimEnabled,
  onVimEnabledChange,
  liveEngine,
  onLiveEngineChange,
  onOpenFullSettings
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
  vimEnabled: boolean
  onVimEnabledChange: (enabled: boolean) => void
  liveEngine: LiveEngine
  onLiveEngineChange: (engine: LiveEngine) => void
  onOpenFullSettings: () => void
}): React.JSX.Element {
  const captureStatus =
    globalCaptureShortcutStatus === null
      ? 'Checking…'
      : globalCaptureShortcutStatus.registered
        ? 'Ready'
        : 'Unavailable'
  const captureDescription =
    globalCaptureShortcutStatus === null
      ? 'Checking the system-wide shortcut.'
      : globalCaptureShortcutStatus.registered
        ? 'Capture from any app while Kuskus is running.'
        : 'Another app may already be using this shortcut.'
  const translucencyDisabled =
    translucentBackgroundSupported !== true || translucentBackgroundReduced
  const translucencyDescription =
    translucentBackgroundSupported === false
      ? 'Requires Windows 11 22H2 or newer.'
      : translucentBackgroundReduced
        ? 'Enable Windows Transparency effects to use this.'
        : 'Let the desktop material show through the app shell.'

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        side="right"
        align="end"
        sideOffset={8}
        className="max-h-[calc(100vh-1rem)] w-[min(21rem,calc(100vw-1rem))] gap-5 overflow-y-auto rounded-xl p-4 shadow-xl"
      >
        <PopoverHeader className="gap-1 px-1">
          <div className="flex items-start justify-between gap-3">
            <PopoverTitle className="font-heading text-lg font-semibold text-balance">
              Quick settings
            </PopoverTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1.5 rounded-lg text-muted-foreground"
              onClick={() => {
                onOpenChange(false)
                onOpenFullSettings()
              }}
            >
              <IconSettings aria-hidden="true" className="size-3.5" />
              All settings
            </Button>
          </div>
          <PopoverDescription className="text-sm text-pretty">
            Personalize your workspace without leaving the library.
          </PopoverDescription>
        </PopoverHeader>

        <section className="space-y-2" aria-labelledby="layout-settings-title">
          <h3
            id="layout-settings-title"
            className="px-1 text-xs font-medium tracking-wide text-muted-foreground"
          >
            Library layout
          </h3>
          <ToggleGroup
            value={[view]}
            onValueChange={(values) => {
              const nextView = values[0]
              if (nextView) onViewChange(nextView as LibraryView)
            }}
            spacing={1}
            aria-label="Library layout"
            className={`${surfaceClass} w-full gap-1.5`}
          >
            {VIEW_OPTIONS.map((option) => {
              const Icon = option.icon
              return (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  aria-label={option.label}
                  className="min-h-11 min-w-0 flex-1 rounded-lg bg-transparent transition-[color,background-color,box-shadow] duration-150 ease-out data-[state=on]:bg-background data-[state=on]:shadow-sm"
                >
                  <Icon aria-hidden="true" />
                  <span>{option.label}</span>
                </ToggleGroupItem>
              )
            })}
          </ToggleGroup>
        </section>

        <section className="space-y-2" aria-labelledby="appearance-settings-title">
          <h3
            id="appearance-settings-title"
            className="px-1 text-xs font-medium tracking-wide text-muted-foreground"
          >
            Appearance
          </h3>
          <div className={surfaceClass}>
            <div className={rowClass}>
              <IconPalette className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-sm font-medium">Color mode</span>
              <ToggleGroup
                value={[theme]}
                onValueChange={(values) => {
                  const mode = values[0]
                  if (mode) onThemeChange(mode as Theme)
                }}
                spacing={1}
                aria-label="Color mode"
                className="shrink-0 gap-1 rounded-lg bg-background/55 p-1 shadow-inner"
              >
                <ToggleGroupItem
                  value="light"
                  aria-label="Light mode"
                  className="size-10 rounded-md p-0 data-[state=on]:bg-background data-[state=on]:shadow-sm"
                >
                  <IconSun aria-hidden="true" />
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="dark"
                  aria-label="Dark mode"
                  className="size-10 rounded-md p-0 data-[state=on]:bg-background data-[state=on]:shadow-sm"
                >
                  <IconMoon aria-hidden="true" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            {window.electron.window.platform === 'win32' ? (
              <div
                className={`${rowClass} group border-t border-foreground/5 py-2`}
                data-disabled={translucencyDisabled || undefined}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium group-data-[disabled=true]:opacity-50">
                    Translucent background
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-pretty text-muted-foreground">
                    {translucencyDescription}
                  </p>
                </div>
                <Switch
                  aria-label="Translucent background"
                  checked={translucentBackgroundEnabled}
                  disabled={translucencyDisabled}
                  onCheckedChange={onTranslucentBackgroundChange}
                />
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-2" aria-labelledby="editor-settings-title">
          <h3
            id="editor-settings-title"
            className="px-1 text-xs font-medium tracking-wide text-muted-foreground"
          >
            Editor
          </h3>
          <div className={surfaceClass}>
            <div className={rowClass}>
              <IconKeyboard className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Vim mode</p>
                <p className="mt-0.5 text-xs leading-5 text-pretty text-muted-foreground">
                  Use Vim keybindings when editing notes.
                </p>
              </div>
              <Switch
                aria-label="Vim mode"
                checked={vimEnabled}
                onCheckedChange={onVimEnabledChange}
              />
            </div>
            <div className={rowClass}>
              <IconKeyboard className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Live engine</p>
                <p className="mt-0.5 text-xs leading-5 text-pretty text-muted-foreground">
                  Use the CodeMirror live preview instead of Milkdown.
                </p>
              </div>
              <Switch
                aria-label="Live engine (CodeMirror)"
                checked={liveEngine === 'codemirror'}
                onCheckedChange={(checked) =>
                  onLiveEngineChange(checked ? 'codemirror' : 'milkdown')
                }
              />
            </div>
          </div>
        </section>

        <section className="space-y-2" aria-labelledby="capture-settings-title">
          <h3
            id="capture-settings-title"
            className="px-1 text-xs font-medium tracking-wide text-muted-foreground"
          >
            Capture
          </h3>
          <div className={surfaceClass}>
            <div className={`${rowClass} items-start py-2.5`}>
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/70 text-foreground shadow-sm">
                <IconBolt className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-h-6 items-center justify-between gap-3">
                  <p className="text-sm font-medium">Global capture</p>
                  <Badge
                    aria-live="polite"
                    variant={
                      globalCaptureShortcutStatus?.registered === false
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {captureStatus}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs leading-5 text-pretty text-muted-foreground">
                  {captureDescription}
                </p>
              </div>
            </div>
            <div className={`${rowClass} min-h-11 border-t border-foreground/5`}>
              <span className="flex-1 text-sm text-muted-foreground">Shortcut</span>
              <Kbd className="h-6 rounded-md bg-background/70 px-2 text-foreground shadow-sm">
                {globalCaptureShortcutStatus?.accelerator ?? 'Ctrl+Shift+Space'}
              </Kbd>
            </div>
          </div>
        </section>
      </PopoverContent>
    </Popover>
  )
}
