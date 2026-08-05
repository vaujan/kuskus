import {
  IconAdjustmentsHorizontal,
  IconKeyboard,
  IconLayoutDashboard,
  IconLayoutGrid,
  IconLayoutSidebarRight,
  IconMoon,
  IconPalette,
  IconSun,
  type TablerIcon
} from '@tabler/icons-react'
import { useState, type RefObject } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { LibraryView } from '@/features/items/item-view'
import type { Theme } from '@/hooks/use-theme'
import type { GlobalCaptureShortcutStatus } from '../../../../shared/window-contract'

type SettingsCategory = 'general' | 'appearance'

const VIEW_OPTIONS: Array<{ value: LibraryView; label: string; icon: TablerIcon }> = [
  { value: 'visual', label: 'Masonry', icon: IconLayoutDashboard },
  { value: 'grid', label: 'Grid', icon: IconLayoutGrid },
  { value: 'focus', label: 'Focus', icon: IconLayoutSidebarRight }
]

const CATEGORY_OPTIONS: Array<{
  value: SettingsCategory
  label: string
  icon: TablerIcon
}> = [
  { value: 'general', label: 'General', icon: IconAdjustmentsHorizontal },
  { value: 'appearance', label: 'Appearance', icon: IconPalette }
]

function SettingsPanel({
  title,
  description,
  children
}: {
  title: string
  description: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <ScrollArea className="size-full" viewportClassName="px-6 py-7 sm:px-8 sm:py-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-2">
        <div className="flex flex-col gap-1.5 pr-8">
          <h2 className="font-heading text-xl font-medium text-balance">{title}</h2>
          <p className="text-sm text-pretty text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </ScrollArea>
  )
}

function SettingCopy({
  title,
  description
}: {
  title: string
  description: string
}): React.JSX.Element {
  return (
    <div className="min-w-0 flex-1">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-pretty text-muted-foreground">{description}</p>
    </div>
  )
}

export function SettingsDialog({
  open,
  onOpenChange,
  finalFocusRef,
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
  finalFocusRef: RefObject<HTMLButtonElement | null>
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
  const [category, setCategory] = useState<SettingsCategory>('general')

  const captureAvailable = globalCaptureShortcutStatus?.registered !== false
  const captureStatus =
    globalCaptureShortcutStatus === null
      ? 'Checking'
      : globalCaptureShortcutStatus.registered
        ? 'Available'
        : 'Unavailable'

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setCategory('general')
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent
        finalFocus={finalFocusRef}
        className="h-[min(38rem,calc(100vh-2rem))] overflow-hidden p-0 sm:max-w-[54rem]"
      >
        <Tabs
          value={category}
          onValueChange={(value) => setCategory(value as SettingsCategory)}
          orientation="vertical"
          className="grid size-full min-h-0 grid-cols-[11.5rem_minmax(0,1fr)] gap-0 sm:grid-cols-[12.5rem_minmax(0,1fr)]"
        >
          <aside className="flex min-h-0 flex-col bg-muted/35 px-3 py-6 shadow-[inset_-1px_0_0_var(--border)] sm:px-4">
            <DialogHeader className="px-2">
              <DialogTitle className="text-lg">Settings</DialogTitle>
              <DialogDescription className="sr-only">
                Customize Kuskus appearance, capture, and library preferences.
              </DialogDescription>
            </DialogHeader>
            <TabsList className="mt-6 flex w-full flex-col items-stretch bg-transparent p-0">
              {CATEGORY_OPTIONS.map((option) => {
                const Icon = option.icon
                return (
                  <TabsTrigger
                    key={option.value}
                    value={option.value}
                    className="flex-none justify-start"
                  >
                    <Icon aria-hidden="true" />
                    {option.label}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </aside>

          <div className="min-h-0 bg-popover">
            <TabsContent value="general" className="size-full">
              <SettingsPanel
                title="General"
                description="Capture from anywhere without interrupting your current task."
              >
                <Card>
                  <CardHeader>
                    <div className="flex min-h-10 items-center gap-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <IconKeyboard aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <CardTitle>Global capture</CardTitle>
                        <CardDescription>
                          Summon New item in Inbox from any application.
                        </CardDescription>
                      </div>
                      <Badge variant={captureAvailable ? 'secondary' : 'destructive'}>
                        {captureStatus}
                      </Badge>
                    </div>
                  </CardHeader>
                  <Separator />
                  <CardContent className="flex min-h-16 items-center justify-between gap-4 py-4">
                    <SettingCopy
                      title="Keyboard shortcut"
                      description="This shortcut is fixed in the current version."
                    />
                    <Kbd className="shrink-0">
                      {globalCaptureShortcutStatus?.accelerator ?? 'Ctrl+Shift+Space'}
                    </Kbd>
                  </CardContent>
                </Card>
              </SettingsPanel>
            </TabsContent>

            <TabsContent value="appearance" className="size-full">
              <SettingsPanel
                title="Appearance"
                description="Choose how your library and application surfaces are presented."
              >
                <Card className="gap-0 py-0">
                  <CardContent className="flex min-h-20 flex-wrap items-center gap-5 py-4">
                    <SettingCopy
                      title="Library view"
                      description="Use the same layout across the current library."
                    />
                    <ToggleGroup
                      value={[view]}
                      onValueChange={(values) => {
                        const nextView = values[0]
                        if (nextView) onViewChange(nextView as LibraryView)
                      }}
                      variant="outline"
                      spacing={0}
                      aria-label="Library view"
                    >
                      {VIEW_OPTIONS.map((option) => {
                        const Icon = option.icon
                        return (
                          <ToggleGroupItem
                            key={option.value}
                            value={option.value}
                            aria-label={option.label}
                            title={option.label}
                          >
                            <Icon aria-hidden="true" />
                            <span>{option.label}</span>
                          </ToggleGroupItem>
                        )
                      })}
                    </ToggleGroup>
                  </CardContent>
                  <Separator />
                  <CardContent className="flex min-h-20 flex-wrap items-center gap-5 py-4">
                    <SettingCopy title="Theme" description="Set the application color scheme." />
                    <ToggleGroup
                      value={[theme]}
                      onValueChange={(values) => {
                        const nextTheme = values[0]
                        if (nextTheme) onThemeChange(nextTheme as Theme)
                      }}
                      variant="outline"
                      spacing={0}
                      aria-label="Theme"
                    >
                      <ToggleGroupItem value="light">
                        <IconSun aria-hidden="true" />
                        Light
                      </ToggleGroupItem>
                      <ToggleGroupItem value="dark">
                        <IconMoon aria-hidden="true" />
                        Dark
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </CardContent>
                  {window.electron.window.platform === 'win32' && (
                    <>
                      <Separator />
                      <CardContent className="flex min-h-20 items-center gap-5 py-4">
                        <SettingCopy
                          title="Translucent background"
                          description={
                            translucentBackgroundSupported === false
                              ? 'Requires Windows 11 22H2 or newer.'
                              : translucentBackgroundReduced
                                ? 'Windows Transparency effects are off. Enable them in Accessibility → Visual effects to use Acrylic.'
                                : 'Let the Windows desktop material show through the application shell.'
                          }
                        />
                        <Switch
                          aria-label="Translucent background"
                          checked={translucentBackgroundEnabled}
                          disabled={
                            translucentBackgroundSupported !== true || translucentBackgroundReduced
                          }
                          onCheckedChange={onTranslucentBackgroundChange}
                        />
                      </CardContent>
                    </>
                  )}
                </Card>
              </SettingsPanel>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
