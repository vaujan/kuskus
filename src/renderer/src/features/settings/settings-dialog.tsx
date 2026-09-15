import { useEffect, useState } from 'react'
import { IconChevronDown } from '@tabler/icons-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { FontPicker } from '@/features/settings/font-picker'
import { useAppZoom } from '@/hooks/use-app-zoom'
import {
  DEFAULT_TYPOGRAPHY,
  type ColorMode,
  type ColorTheme,
  type FontPreference
} from '@/hooks/theme'
import { useLocalFonts } from '@/hooks/use-local-fonts'
import type { TranslucentBackgroundPreference } from '@/hooks/use-translucent-background'
import { useSetting } from '@/settings/settings-context'
import {
  APP_ZOOM_FACTORS,
  type GlobalCaptureShortcutStatus
} from '../../../../shared/window-contract'

const COLOR_THEMES: ReadonlyArray<{
  value: ColorTheme
  label: string
}> = [
  { value: 'kuskus', label: 'Kuskus' },
  { value: 'graphite', label: 'Graphite' },
  { value: 'moss', label: 'Moss' },
  { value: 'clay', label: 'Clay' },
  { value: 'solarized', label: 'Solarized' },
  { value: 'catppuccin', label: 'Catppuccin' },
  { value: 'tokyo-storm', label: 'Tokyo Storm' },
  { value: 'monokai', label: 'Monokai' },
  { value: 'one', label: 'One Dark' },
  { value: 'one-pro-flat', label: 'One Dark Pro Flat' },
  { value: 'one-pro-darker', label: 'One Dark Pro Darker' },
  { value: 'dracula', label: 'Dracula' },
  { value: 'gruvbox', label: 'Gruvbox' },
  { value: 'nord', label: 'Nord' }
]

const COLOR_MODES: ReadonlyArray<{ value: ColorMode; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
]

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
              ? 'That shortcut is taken. Your previous shortcut is still active.'
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

  return (
    <Field orientation="horizontal" className="min-h-12">
      <FieldContent>
        <FieldLabel>Shortcut</FieldLabel>
        {error ? <FieldDescription className="text-destructive">{error}</FieldDescription> : null}
      </FieldContent>
      {recording ? (
        <span className="inline-flex h-8 items-center rounded-lg bg-muted px-3 text-sm text-foreground shadow-inner">
          Press keys…
        </span>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setError(null)
            setRecording(true)
          }}
          disabled={pending}
          aria-label="Change global capture shortcut"
          className="transition-transform active:scale-[0.96]"
        >
          <Kbd>{accelerator}</Kbd>
          <IconChevronDown data-icon="inline-end" />
        </Button>
      )}
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
  const [colorMode, setColorMode] = useSetting<ColorMode>('colorMode')
  const [colorTheme, setColorTheme] = useSetting<ColorTheme>('colorTheme')
  const [uiFont, setUiFont] = useSetting<FontPreference>('uiFont')
  const [uiFontFallback, setUiFontFallback] = useSetting<FontPreference>('uiFontFallback')
  const [codeFont, setCodeFont] = useSetting<FontPreference>('codeFont')
  const [codeFontFallback, setCodeFontFallback] = useSetting<FontPreference>('codeFontFallback')
  const [vimEnabled, setVimEnabled] = useSetting<boolean>('vimEnabled')
  const localFonts = useLocalFonts()
  const zoom = useAppZoom()
  const translucencyDisabled =
    translucentBackground.supported !== true || translucentBackground.reducedTransparency

  const resetAppearance = (): void => {
    setColorTheme('kuskus')
    setColorMode('dark')
    setUiFont(DEFAULT_TYPOGRAPHY.uiFont)
    setUiFontFallback(DEFAULT_TYPOGRAPHY.uiFontFallback)
    setCodeFont(DEFAULT_TYPOGRAPHY.codeFont)
    setCodeFontFallback(DEFAULT_TYPOGRAPHY.codeFontFallback)
    zoom.resetZoom()
    if (translucentBackground.supported) translucentBackground.setEnabled(true)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false} disablePointerDismissal>
      <SheetContent side="right" variant="floating" showOverlay={false} className="overflow-hidden">
        <SheetHeader className="gap-1 px-5 pt-5 pb-4">
          <SheetTitle className="text-balance">Settings</SheetTitle>
          <SheetDescription className="text-pretty">
            Changes appear immediately across Kuskus.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="scroll-fade-y min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]]:focus-visible:ring-0 [&_[data-slot=scroll-area-viewport]]:focus-visible:outline-none">
          <FieldGroup className="gap-7 px-5 pb-5">
            <FieldSet className="gap-4">
              <FieldLegend variant="label" className="text-muted-foreground">
                Appearance
              </FieldLegend>

              <Field orientation="horizontal" className="min-h-12">
                <FieldContent>
                  <FieldLabel>Theme</FieldLabel>
                  <FieldDescription>Choose the character of the entire workspace.</FieldDescription>
                </FieldContent>
                <Select
                  value={colorTheme}
                  onValueChange={(value) => setColorTheme(value as ColorTheme)}
                >
                  <SelectTrigger size="sm" aria-label="Color theme" className="w-52">
                    <SelectValue>
                      {COLOR_THEMES.find((option) => option.value === colorTheme)?.label}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false} align="end">
                    <SelectGroup>
                      {COLOR_THEMES.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          data-theme-choice={option.value}
                        >
                          <span className="flex items-center gap-1" aria-hidden="true">
                            <span className="size-2.5 rounded-full bg-[var(--theme-preview-canvas)] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]" />
                            <span className="size-2.5 rounded-full bg-[var(--theme-preview-sidebar)] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]" />
                            <span className="size-2.5 rounded-full bg-[var(--theme-preview-accent)] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]" />
                          </span>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field orientation="horizontal" className="min-h-12">
                <FieldContent>
                  <FieldLabel>Color mode</FieldLabel>
                </FieldContent>
                <ToggleGroup
                  value={[colorMode]}
                  onValueChange={(values) => {
                    const nextMode = values[0]
                    if (nextMode) setColorMode(nextMode as ColorMode)
                  }}
                  spacing={0}
                  variant="outline"
                  size="sm"
                  aria-label="Color mode"
                >
                  {COLOR_MODES.map((option) => (
                    <ToggleGroupItem key={option.value} value={option.value}>
                      {option.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>

              <Field className="gap-3">
                <FieldContent>
                  <FieldLabel>Typography</FieldLabel>
                  <FieldDescription>
                    Choose primary and fallback fonts for interface and code.
                  </FieldDescription>
                </FieldContent>
                <div
                  role="group"
                  aria-label="Font preferences"
                  className="grid grid-cols-[minmax(0,1fr)_7rem_7rem] items-center gap-2"
                >
                  <span aria-hidden="true" />
                  <span className="text-xs font-medium text-muted-foreground">Primary</span>
                  <span className="text-xs font-medium text-muted-foreground">Fallback</span>

                  <span className="text-sm">UI font</span>
                  <FontPicker
                    value={uiFont}
                    onValueChange={setUiFont}
                    kind="ui"
                    localFonts={localFonts}
                    ariaLabel="Primary UI font"
                  />
                  <FontPicker
                    value={uiFontFallback}
                    onValueChange={setUiFontFallback}
                    kind="ui"
                    localFonts={localFonts}
                    allowGenericOnly
                    ariaLabel="UI font fallback"
                  />

                  <span className="text-sm">Code font</span>
                  <FontPicker
                    value={codeFont}
                    onValueChange={setCodeFont}
                    kind="code"
                    localFonts={localFonts}
                    ariaLabel="Primary code font"
                  />
                  <FontPicker
                    value={codeFontFallback}
                    onValueChange={setCodeFontFallback}
                    kind="code"
                    localFonts={localFonts}
                    allowGenericOnly
                    ariaLabel="Code font fallback"
                  />
                </div>

                <div className="flex flex-col gap-2 rounded-xl bg-muted/60 p-3 shadow-inner">
                  <p className="truncate text-sm" style={{ fontFamily: 'var(--font-ui)' }}>
                    Capture ideas without breaking your flow.
                  </p>
                  <code
                    className="truncate text-xs text-muted-foreground"
                    style={{ fontFamily: 'var(--font-code)' }}
                  >
                    {'const saved = await library.add(note)'}
                  </code>
                </div>
              </Field>

              {window.electron.window.platform === 'win32' ? (
                <Field
                  orientation="horizontal"
                  className="min-h-12"
                  data-disabled={translucencyDisabled || undefined}
                >
                  <FieldContent>
                    <FieldLabel htmlFor="settings-translucent">Window material</FieldLabel>
                    <FieldDescription>
                      {translucentBackground.supported === false
                        ? 'Requires Windows 11 22H2 or newer.'
                        : translucentBackground.reducedTransparency
                          ? 'Enable Windows Transparency effects to use this.'
                          : 'Let the desktop softly show through the app shell.'}
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    id="settings-translucent"
                    checked={translucentBackground.enabled}
                    disabled={translucencyDisabled}
                    onCheckedChange={translucentBackground.setEnabled}
                  />
                </Field>
              ) : null}

              <Field orientation="horizontal" className="min-h-12">
                <FieldContent>
                  <FieldLabel>Interface scale</FieldLabel>
                </FieldContent>
                <Select
                  value={String(zoom.factor)}
                  onValueChange={(factor) => {
                    const parsed = Number(factor)
                    if (Number.isFinite(parsed)) zoom.setFactor(parsed)
                  }}
                >
                  <SelectTrigger size="sm" aria-label="Interface scale" className="w-24">
                    <SelectValue>{`${Math.round(zoom.factor * 100)}%`}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {APP_ZOOM_FACTORS.map((factor) => (
                        <SelectItem key={factor} value={String(factor)}>
                          {`${Math.round(factor * 100)}%`}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetAppearance}
                className="self-start transition-transform active:scale-[0.96]"
              >
                Reset appearance
              </Button>
            </FieldSet>

            <FieldSet className="gap-4">
              <FieldLegend variant="label" className="text-muted-foreground">
                Editing
              </FieldLegend>
              <Field orientation="horizontal" className="min-h-12">
                <FieldContent>
                  <FieldLabel htmlFor="settings-vim-mode">Vim keybindings</FieldLabel>
                  <FieldDescription>Use Vim motions while editing notes.</FieldDescription>
                </FieldContent>
                <Switch
                  id="settings-vim-mode"
                  checked={vimEnabled}
                  onCheckedChange={setVimEnabled}
                />
              </Field>
            </FieldSet>

            <FieldSet className="gap-4">
              <FieldLegend variant="label" className="text-muted-foreground">
                Capture
              </FieldLegend>
              <Field orientation="horizontal" className="min-h-12">
                <FieldContent>
                  <FieldLabel>Global capture</FieldLabel>
                  <FieldDescription>Capture from any app while Kuskus is running.</FieldDescription>
                </FieldContent>
                <Badge
                  aria-live="polite"
                  variant={
                    globalCaptureShortcutStatus?.registered === false ? 'destructive' : 'secondary'
                  }
                >
                  {globalCaptureShortcutStatus === null
                    ? 'Checking…'
                    : globalCaptureShortcutStatus.registered
                      ? 'Ready'
                      : 'Unavailable'}
                </Badge>
              </Field>
              <CaptureShortcutControl
                status={globalCaptureShortcutStatus}
                onStatusChange={onGlobalCaptureShortcutStatusChange}
              />
            </FieldSet>
          </FieldGroup>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
