import { useEffect, useState } from 'react'
import {
  IconBolt,
  IconChevronDown,
  IconDeviceDesktop,
  IconKeyboard,
  IconLayoutGrid,
  IconLayoutDashboard,
  IconMoon,
  IconPalette,
  IconSun
} from '@tabler/icons-react'

import { Badge } from '@/components/ui/badge'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet
} from '@/components/ui/field'
import { Kbd } from '@/components/ui/kbd'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ITEM_SORT_OPTIONS, type ItemSort } from '@/features/items/item-sort'
import type { LibraryView } from '@/features/items/item-view'
import type { NoteReadingWidth } from '@/features/items/note-reading-width'
import type { FocusRailDensity } from '@/features/items/focus-view-state'
import { useAppZoom } from '@/hooks/use-app-zoom'
import type { Theme } from '@/hooks/theme'
import { useSetting } from '@/settings/settings-context'
import type { TranslucentBackgroundPreference } from '@/hooks/use-translucent-background'
import {
  APP_ZOOM_FACTORS,
  type GlobalCaptureShortcutStatus
} from '../../../../shared/window-contract'

const VIEW_OPTIONS: Array<{ value: LibraryView; label: string; icon: typeof IconLayoutGrid }> = [
  { value: 'visual', label: 'Masonry', icon: IconLayoutDashboard },
  { value: 'grid', label: 'Grid', icon: IconLayoutGrid }
]

const iconTileClass =
  'grid size-9 shrink-0 place-items-center rounded-[calc(var(--radius)-2px)] bg-background/60 text-foreground shadow-[inset_0_0_0_1px_rgb(0_0_0/0.04)] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]'
const controlClass = 'shrink-0'

function CaptureShortcutControl({
  status,
  onStatusChange
}: {
  status: GlobalCaptureShortcutStatus | null
  onStatusChange: (status: GlobalCaptureShortcutStatus) => void
}): React.JSX.Element {
  const [recording, setRecording] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!recording) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        setRecording(false)
        return
      }
      const modifiers = [
        event.ctrlKey ? 'Control' : null,
        event.altKey ? 'Alt' : null,
        event.shiftKey ? 'Shift' : null,
        event.metaKey ? 'Meta' : null
      ].filter((modifier): modifier is string => modifier !== null)
      const key = event.key.length === 1 ? event.key.toUpperCase() : event.key
      const accelerator = [...modifiers, key].join('+')
      if (
        modifiers.length === 0 ||
        !key ||
        key === 'Meta' ||
        key === 'Control' ||
        key === 'Alt' ||
        key === 'Shift'
      ) {
        return
      }
      setRecording(false)
      setPending(true)
      void window.electron.window
        .setGlobalCaptureShortcut(accelerator)
        .then((nextStatus) => {
          onStatusChange(nextStatus)
          setError(
            nextStatus.registered && nextStatus.accelerator !== accelerator
              ? 'That shortcut is taken by another app. Keeping your previous shortcut.'
              : null
          )
        })
        .catch(() => setError('Could not update the shortcut.'))
        .finally(() => setPending(false))
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [recording, onStatusChange])

  const accelerator = status?.accelerator ?? 'Ctrl+Shift+Space'
  const registered = status?.registered ?? false

  return (
    <Field orientation="horizontal">
      <FieldLabel>Shortcut</FieldLabel>
      <FieldContent className="items-end gap-1.5">
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <div className="flex items-center gap-2">
          {!registered ? <Badge variant="destructive">Unavailable</Badge> : null}
          {recording ? (
            <span className="inline-flex h-7 items-center rounded-md bg-background/70 px-2 text-sm text-foreground shadow-sm">
              Press keys…
            </span>
          ) : (
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1 rounded-md bg-background/70 px-2 text-sm text-foreground shadow-sm transition-[background-color,scale] hover:bg-background active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50"
              onClick={() => {
                setError(null)
                setRecording(true)
              }}
              disabled={pending}
              aria-label="Change global capture shortcut"
            >
              <Kbd>{accelerator}</Kbd>
              <IconChevronDown className="size-3 text-muted-foreground" aria-hidden="true" />
            </button>
          )}
        </div>
      </FieldContent>
    </Field>
  )
}

export function SettingsDialog({
  open,
  onOpenChange,
  translucentBackground,
  globalCaptureShortcutStatus,
  onGlobalCaptureShortcutStatusChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  translucentBackground: TranslucentBackgroundPreference
  globalCaptureShortcutStatus: GlobalCaptureShortcutStatus | null
  onGlobalCaptureShortcutStatusChange: (status: GlobalCaptureShortcutStatus) => void
}): React.JSX.Element {
  const [theme, setTheme] = useSetting<Theme>('theme')
  const [view, setView] = useSetting<LibraryView>('libraryView')
  const [sort, setSort] = useSetting<ItemSort>('itemSort')
  const [vimEnabled, setVimEnabled] = useSetting<boolean>('vimEnabled')
  const [readingWidth, setReadingWidth] = useSetting<NoteReadingWidth>('readingWidth')
  const [inlineTitle, setInlineTitle] = useSetting<boolean>('inlineTitle')
  const [railDensity, setRailDensity] = useSetting<FocusRailDensity>('railDensity')
  const zoom = useAppZoom()

  const translucencyDisabled =
    translucentBackground.supported !== true || translucentBackground.reducedTransparency

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[min(38rem,calc(100vh-4rem))] w-[min(34rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0 sm:max-w-none">
        <DialogHeader className="gap-1 px-6 pt-5">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configure how Kuskus looks, edits, and captures.</DialogDescription>
        </DialogHeader>
        <div className="scroll-fade-y min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-6">
          <FieldGroup className="gap-6">
            <FieldSet>
              <FieldLegend variant="label" className="text-muted-foreground">
                Appearance
              </FieldLegend>
              <Field orientation="horizontal">
                <span className={iconTileClass} aria-hidden="true">
                  <IconPalette className="size-4" />
                </span>
                <FieldLabel>Color mode</FieldLabel>
                <ToggleGroup
                  value={[theme]}
                  onValueChange={(values) => {
                    const mode = values[0]
                    if (mode) setTheme(mode as Theme)
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
                    <IconSun />
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="dark"
                    aria-label="Dark mode"
                    className="size-10 rounded-md p-0 data-[state=on]:bg-background data-[state=on]:shadow-sm"
                  >
                    <IconMoon />
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="system"
                    aria-label="System mode"
                    className="size-10 rounded-md p-0 data-[state=on]:bg-background data-[state=on]:shadow-sm"
                  >
                    <IconDeviceDesktop />
                  </ToggleGroupItem>
                </ToggleGroup>
              </Field>
              {window.electron.window.platform === 'win32' ? (
                <Field orientation="horizontal">
                  <span className={iconTileClass} aria-hidden="true">
                    <IconPalette className="size-4" />
                  </span>
                  <FieldContent>
                    <FieldLabel htmlFor="settings-translucent">Translucent background</FieldLabel>
                    <FieldDescription>
                      {translucentBackground.supported === false
                        ? 'Requires Windows 11 22H2 or newer.'
                        : translucentBackground.reducedTransparency
                          ? 'Enable Windows Transparency effects to use this.'
                          : 'Let the desktop material show through the app shell.'}
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    id="settings-translucent"
                    checked={translucentBackground.enabled}
                    disabled={translucencyDisabled}
                    onCheckedChange={translucentBackground.setEnabled}
                    className={controlClass}
                  />
                </Field>
              ) : null}
              <Field orientation="horizontal">
                <span className={iconTileClass} aria-hidden="true">
                  <IconKeyboard className="size-4" />
                </span>
                <FieldContent>
                  <FieldLabel>Zoom</FieldLabel>
                  <FieldDescription>Interface scale for the whole app.</FieldDescription>
                </FieldContent>
                <Select
                  value={String(zoom.factor)}
                  onValueChange={(factor) => {
                    const parsed = Number(factor)
                    if (Number.isFinite(parsed)) zoom.setFactor(parsed)
                  }}
                >
                  <SelectTrigger size="sm" aria-label="Zoom" className="w-24 justify-between">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {APP_ZOOM_FACTORS.map((factor) => (
                        <SelectItem key={factor} value={String(factor)}>
                          {factor === 1 ? '100%' : `${Math.round(factor * 100)}%`}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldSet>

            <FieldSet>
              <FieldLegend variant="label" className="text-muted-foreground">
                Library
              </FieldLegend>
              <Field orientation="horizontal">
                <FieldLabel>Default view</FieldLabel>
                <ToggleGroup
                  value={[view]}
                  onValueChange={(values) => {
                    const nextView = values[0]
                    if (nextView) setView(nextView as LibraryView)
                  }}
                  spacing={1}
                  aria-label="Library layout"
                  className="shrink-0 gap-1 rounded-lg bg-background/55 p-1 shadow-inner"
                >
                  {VIEW_OPTIONS.map((option) => {
                    const Icon = option.icon
                    return (
                      <ToggleGroupItem
                        key={option.value}
                        value={option.value}
                        aria-label={option.label}
                        className="size-10 rounded-md p-0 data-[state=on]:bg-background data-[state=on]:shadow-sm"
                      >
                        <Icon />
                      </ToggleGroupItem>
                    )
                  })}
                </ToggleGroup>
              </Field>
              <Field orientation="horizontal">
                <FieldLabel>Sort items by</FieldLabel>
                <Select value={sort} onValueChange={(value) => setSort(value as ItemSort)}>
                  <SelectTrigger
                    size="sm"
                    aria-label="Sort items by"
                    className="w-32 justify-between"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {ITEM_SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field orientation="horizontal">
                <FieldLabel>Focus rail density</FieldLabel>
                <Select
                  value={railDensity}
                  onValueChange={(value) => setRailDensity(value as FocusRailDensity)}
                >
                  <SelectTrigger
                    size="sm"
                    aria-label="Focus rail density"
                    className="w-32 justify-between"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="visual">Visual</SelectItem>
                      <SelectItem value="index">Compact index</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldSet>

            <FieldSet>
              <FieldLegend variant="label" className="text-muted-foreground">
                Editor
              </FieldLegend>
              <Field orientation="horizontal">
                <span className={iconTileClass} aria-hidden="true">
                  <IconKeyboard className="size-4" />
                </span>
                <FieldContent>
                  <FieldLabel htmlFor="settings-vim-mode">Vim mode</FieldLabel>
                  <FieldDescription>Use Vim keybindings when editing notes.</FieldDescription>
                </FieldContent>
                <Switch
                  id="settings-vim-mode"
                  checked={vimEnabled}
                  onCheckedChange={setVimEnabled}
                  className={controlClass}
                />
              </Field>
              <Field orientation="horizontal">
                <FieldLabel>Note reading width</FieldLabel>
                <Select
                  value={readingWidth}
                  onValueChange={(value) => setReadingWidth(value as NoteReadingWidth)}
                >
                  <SelectTrigger
                    size="sm"
                    aria-label="Note reading width"
                    className="w-32 justify-between"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="comfortable">Comfortable</SelectItem>
                      <SelectItem value="wide">Wide</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="settings-inline-title">Inline title</FieldLabel>
                  <FieldDescription>Show the note title inline while editing.</FieldDescription>
                </FieldContent>
                <Switch
                  id="settings-inline-title"
                  checked={inlineTitle}
                  onCheckedChange={setInlineTitle}
                  className={controlClass}
                />
              </Field>
            </FieldSet>

            <FieldSet>
              <FieldLegend variant="label" className="text-muted-foreground">
                Capture
              </FieldLegend>
              <Field orientation="horizontal">
                <span className={iconTileClass} aria-hidden="true">
                  <IconBolt className="size-4" />
                </span>
                <FieldContent>
                  <FieldLabel>Global capture</FieldLabel>
                  <FieldDescription>Capture from any app while Kuskus is running.</FieldDescription>
                </FieldContent>
                <Badge
                  aria-live="polite"
                  variant={
                    globalCaptureShortcutStatus?.registered === false ? 'destructive' : 'secondary'
                  }
                  className={controlClass}
                >
                  {globalCaptureShortcutStatus === null
                    ? 'Checking…'
                    : globalCaptureShortcutStatus.registered
                      ? 'Ready'
                      : 'Unavailable'}
                </Badge>
              </Field>
              <Separator />
              <CaptureShortcutControl
                status={globalCaptureShortcutStatus}
                onStatusChange={onGlobalCaptureShortcutStatusChange}
              />
            </FieldSet>
          </FieldGroup>
        </div>
      </DialogContent>
    </Dialog>
  )
}
