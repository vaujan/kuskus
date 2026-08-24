import { useEffect, useState } from 'react'
import {
  IconBolt,
  IconChevronDown,
  IconKeyboard,
  IconLayoutGrid,
  IconLayoutDashboard,
  IconMoon,
  IconPalette,
  IconSun
} from '@tabler/icons-react'

import { Badge } from '@/components/ui/badge'
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
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ITEM_SORT_OPTIONS, type ItemSort } from '@/features/items/item-sort'
import type { LibraryView } from '@/features/items/item-view'
import type { NoteReadingWidth } from '@/features/items/note-reading-width'
import type { FocusRailDensity } from '@/features/items/focus-view-state'
import { useAppZoom } from '@/hooks/use-app-zoom'
import type { Theme } from '@/hooks/use-theme'
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

const surfaceClass =
  'rounded-2xl bg-muted/45 p-1.5 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.035)] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.05)]'
const rowClass = 'flex min-h-12 items-center gap-3 rounded-lg px-3'

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="space-y-2" aria-label={title}>
      <h3 className="px-1 text-xs font-medium tracking-wide text-muted-foreground">{title}</h3>
      <div className={surfaceClass}>{children}</div>
    </section>
  )
}

function LabeledRow({
  icon,
  label,
  description,
  children
}: {
  icon?: React.ReactNode
  label: string
  description?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className={rowClass}>
      {icon ? (
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/70 text-foreground shadow-sm">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs leading-5 text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

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
    <div className={`${rowClass} min-h-11 border-t border-foreground/5`}>
      <span className="flex-1 text-sm text-muted-foreground">Shortcut</span>
      {recording ? (
        <span className="rounded-md bg-background/70 px-2 py-1 text-sm text-foreground shadow-sm">
          Press keys…
        </span>
      ) : (
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-md bg-background/70 px-2 text-sm text-foreground shadow-sm transition-colors hover:bg-background"
          onClick={() => {
            setError(null)
            setRecording(true)
          }}
          disabled={pending}
          aria-label="Change global capture shortcut"
        >
          <Kbd>{accelerator}</Kbd>
          <IconChevronDown className="size-3 text-muted-foreground" />
        </button>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!registered ? <Badge variant="destructive">Unavailable</Badge> : null}
    </div>
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
      <DialogContent className="h-[min(38rem,calc(100vh-4rem))] w-[min(52rem,calc(100vw-2rem))] grid-rows-[auto_1fr] gap-0 overflow-hidden p-0 sm:max-w-none">
        <DialogHeader className="gap-1 px-6 pt-5">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configure how Kuskus looks, edits, and captures.</DialogDescription>
        </DialogHeader>
        <Tabs
          orientation="vertical"
          defaultValue="appearance"
          className="min-h-0 gap-6 px-6 pb-6 pt-4"
        >
          <TabsList className="h-fit w-40 shrink-0 items-stretch gap-1 rounded-xl p-1">
            <TabsTrigger value="appearance" className="justify-start rounded-lg px-3 text-left">
              Appearance
            </TabsTrigger>
            <TabsTrigger value="library" className="justify-start rounded-lg px-3 text-left">
              Library
            </TabsTrigger>
            <TabsTrigger value="editor" className="justify-start rounded-lg px-3 text-left">
              Editor
            </TabsTrigger>
            <TabsTrigger value="capture" className="justify-start rounded-lg px-3 text-left">
              Capture
            </TabsTrigger>
            <TabsTrigger value="advanced" className="justify-start rounded-lg px-3 text-left">
              Advanced
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="h-full min-h-0 overflow-y-auto">
            <div className="flex flex-col gap-6">
              <Section title="Appearance">
                <LabeledRow icon={<IconPalette className="size-4" />} label="Color mode">
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
                  </ToggleGroup>
                </LabeledRow>
                {window.electron.window.platform === 'win32' ? (
                  <LabeledRow
                    icon={<IconPalette className="size-4" />}
                    label="Translucent background"
                    description={
                      translucentBackground.supported === false
                        ? 'Requires Windows 11 22H2 or newer.'
                        : translucentBackground.reducedTransparency
                          ? 'Enable Windows Transparency effects to use this.'
                          : 'Let the desktop material show through the app shell.'
                    }
                  >
                    <Switch
                      aria-label="Translucent background"
                      checked={translucentBackground.enabled}
                      disabled={translucencyDisabled}
                      onCheckedChange={translucentBackground.setEnabled}
                    />
                  </LabeledRow>
                ) : null}
                <LabeledRow
                  icon={<IconKeyboard className="size-4" />}
                  label="Zoom"
                  description="Interface scale for the whole app."
                >
                  <Select
                    value={String(zoom.factor)}
                    onValueChange={(factor) => {
                      const parsed = Number(factor)
                      if (Number.isFinite(parsed)) zoom.setFactor(parsed)
                    }}
                  >
                    <SelectTrigger size="sm" aria-label="Zoom">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {APP_ZOOM_FACTORS.map((factor) => (
                        <SelectItem key={factor} value={String(factor)}>
                          {factor === 1 ? '100%' : `${Math.round(factor * 100)}%`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </LabeledRow>
              </Section>
            </div>
          </TabsContent>

          <TabsContent value="library" className="h-full min-h-0 overflow-y-auto">
            <div className="flex flex-col gap-6">
              <Section title="Library layout">
                <LabeledRow label="Default view">
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
                </LabeledRow>
                <LabeledRow label="Sort items by">
                  <Select value={sort} onValueChange={(value) => setSort(value as ItemSort)}>
                    <SelectTrigger size="sm" aria-label="Sort items by">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </LabeledRow>
              </Section>
            </div>
          </TabsContent>

          <TabsContent value="editor" className="h-full min-h-0 overflow-y-auto">
            <div className="flex flex-col gap-6">
              <Section title="Editing">
                <LabeledRow
                  icon={<IconKeyboard className="size-4" />}
                  label="Vim mode"
                  description="Use Vim keybindings when editing notes."
                >
                  <Switch
                    aria-label="Vim mode"
                    checked={vimEnabled}
                    onCheckedChange={setVimEnabled}
                  />
                </LabeledRow>
                <LabeledRow label="Note reading width">
                  <Select
                    value={readingWidth}
                    onValueChange={(value) => setReadingWidth(value as NoteReadingWidth)}
                  >
                    <SelectTrigger size="sm" aria-label="Note reading width">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comfortable">Comfortable</SelectItem>
                      <SelectItem value="wide">Wide</SelectItem>
                    </SelectContent>
                  </Select>
                </LabeledRow>
                <LabeledRow
                  label="Inline title"
                  description="Show the note title inline while editing."
                >
                  <Switch
                    aria-label="Inline title"
                    checked={inlineTitle}
                    onCheckedChange={setInlineTitle}
                  />
                </LabeledRow>
              </Section>
            </div>
          </TabsContent>

          <TabsContent value="capture" className="h-full min-h-0 overflow-y-auto">
            <div className="flex flex-col gap-6">
              <Section title="Global capture">
                <LabeledRow
                  icon={<IconBolt className="size-4" />}
                  label="Global capture"
                  description="Capture from any app while Kuskus is running."
                >
                  <Badge
                    aria-live="polite"
                    variant={
                      globalCaptureShortcutStatus?.registered === false
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {globalCaptureShortcutStatus === null
                      ? 'Checking…'
                      : globalCaptureShortcutStatus.registered
                        ? 'Ready'
                        : 'Unavailable'}
                  </Badge>
                </LabeledRow>
                <CaptureShortcutControl
                  status={globalCaptureShortcutStatus}
                  onStatusChange={onGlobalCaptureShortcutStatusChange}
                />
              </Section>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="h-full min-h-0 overflow-y-auto">
            <div className="flex flex-col gap-6">
              <Section title="Advanced">
                <LabeledRow
                  label="Focus rail density"
                  description="How items appear in the focus workspace rail."
                >
                  <Select
                    value={railDensity}
                    onValueChange={(value) => setRailDensity(value as FocusRailDensity)}
                  >
                    <SelectTrigger size="sm" aria-label="Focus rail density">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="visual">Visual</SelectItem>
                      <SelectItem value="index">Compact index</SelectItem>
                    </SelectContent>
                  </Select>
                </LabeledRow>
              </Section>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
