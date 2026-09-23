import { useEffect, useState } from 'react'
import { IconKeyboard, IconPalette, IconPencil } from '@tabler/icons-react'

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
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { FontPicker } from '@/features/settings/font-picker'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger
} from '@/features/shell/app-sidebar'
import { WindowControls } from '@/features/shell/window-controls'
import { useAppZoom } from '@/hooks/use-app-zoom'
import {
  DEFAULT_TYPOGRAPHY,
  type BaseFontSize,
  type ColorMode,
  type ColorTheme,
  type FontPreference
} from '@/hooks/theme'
import { useLocalFonts } from '@/hooks/use-local-fonts'
import { useTranslucentBackground } from '@/hooks/use-translucent-background'
import { cn } from '@/lib/utils'
import { useSetting } from '@/settings/settings-context'
import { APP_ZOOM_FACTORS } from '../../../../shared/window-contract'

const COLOR_THEMES: ReadonlyArray<{ value: ColorTheme; label: string }> = [
  { value: 'kuskus', label: 'Kuskus' },
  { value: 'graphite', label: 'Graphite' },
  { value: 'github', label: 'GitHub' },
  { value: 'vscode', label: 'VS Code' },
  { value: 'ayu', label: 'Ayu' },
  { value: 'material', label: 'Material' },
  { value: 'moss', label: 'Moss' },
  { value: 'clay', label: 'Clay' },
  { value: 'solarized', label: 'Solarized' },
  { value: 'catppuccin', label: 'Catppuccin' },
  { value: 'tokyo-storm', label: 'Tokyo Storm' },
  { value: 'monokai', label: 'Monokai' },
  { value: 'one', label: 'One Dark' },
  { value: 'dracula', label: 'Dracula' },
  { value: 'gruvbox', label: 'Gruvbox' },
  { value: 'nord', label: 'Nord' }
]

const COLOR_MODES: ReadonlyArray<{ value: ColorMode; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
]

const FONT_SIZES: readonly BaseFontSize[] = ['13', '14', '15', '16', '17', '18', '20']

type SettingsSection = 'appearance' | 'editing' | 'shortcuts'

function FontSizeSelect({
  value,
  onValueChange,
  label
}: {
  value: BaseFontSize
  onValueChange: (value: BaseFontSize) => void
  label: string
}): React.JSX.Element {
  return (
    <Select value={value} onValueChange={(nextValue) => onValueChange(nextValue as BaseFontSize)}>
      <SelectTrigger size="sm" aria-label={label} className="w-28">
        <SelectValue>{value} px</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          {FONT_SIZES.map((size) => (
            <SelectItem key={size} value={size}>
              {size} px
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function SettingsWindowApp(): React.JSX.Element {
  const [section, setSection] = useState<SettingsSection>('appearance')
  const [globalCaptureShortcut, setGlobalCaptureShortcut] = useState('Ctrl+Shift+Space')
  const [colorMode, setColorMode] = useSetting<ColorMode>('colorMode')
  const [colorTheme, setColorTheme] = useSetting<ColorTheme>('colorTheme')
  const [uiFont, setUiFont] = useSetting<FontPreference>('uiFont')
  const [contentFont, setContentFont] = useSetting<FontPreference>('contentFont')
  const [codeFont, setCodeFont] = useSetting<FontPreference>('codeFont')
  const [sourceFontSize, setSourceFontSize] = useSetting<BaseFontSize>('sourceFontSize')
  const [contentFontSize, setContentFontSize] = useSetting<BaseFontSize>('contentFontSize')
  const [vimEnabled, setVimEnabled] = useSetting<boolean>('vimEnabled')
  const [sourceLineNumbers, setSourceLineNumbers] = useSetting<boolean>('sourceLineNumbers')
  const localFonts = useLocalFonts()
  const zoom = useAppZoom()
  const translucentBackground = useTranslucentBackground()
  const translucencyDisabled =
    translucentBackground.supported !== true || translucentBackground.reducedTransparency
  const isMac = window.electron.window.platform === 'darwin'
  const commandKey = isMac ? 'Cmd' : 'Ctrl'

  useEffect(() => {
    void window.electron.window
      .getGlobalCaptureShortcutStatus()
      .then((status) => setGlobalCaptureShortcut(status.accelerator))
  }, [])

  const shortcutGroups = [
    {
      label: 'General',
      shortcuts: [
        { label: 'Quick capture', keys: globalCaptureShortcut },
        { label: 'Open settings', keys: `${commandKey}+,` },
        { label: 'Quick open', keys: `${commandKey}+O` },
        { label: 'Search library', keys: `${commandKey}+Shift+F` },
        { label: 'New note', keys: 'Ctrl+N' },
        { label: 'Add item', keys: 'Ctrl+Shift+N' }
      ]
    },
    {
      label: 'Items',
      shortcuts: [
        { label: 'Select all items', keys: `${commandKey}+A` },
        { label: 'Rename selected item', keys: 'F2' },
        { label: 'Move selected items to Trash', keys: 'Delete' },
        { label: 'Clear selection', keys: 'Esc' }
      ]
    },
    {
      label: 'Notes',
      shortcuts: [
        { label: 'Find in note', keys: `${commandKey}+F` },
        { label: 'Toggle Read and Live modes', keys: 'Ctrl+E' },
        { label: 'Toggle Markdown Source mode', keys: 'Ctrl+Alt+E' },
        { label: 'Toggle Split view', keys: 'Ctrl+Shift+E' },
        { label: 'Toggle zen mode', keys: 'Ctrl+Shift+\\' },
        { label: 'Save note', keys: 'Ctrl+Enter' }
      ]
    }
  ]

  const resetAppearance = (): void => {
    setColorTheme('kuskus')
    setColorMode('dark')
    setUiFont(DEFAULT_TYPOGRAPHY.uiFont)
    setContentFont(DEFAULT_TYPOGRAPHY.contentFont)
    setCodeFont(DEFAULT_TYPOGRAPHY.codeFont)
    setSourceFontSize(DEFAULT_TYPOGRAPHY.sourceFontSize)
    setContentFontSize(DEFAULT_TYPOGRAPHY.contentFontSize)
    zoom.resetZoom()
    if (translucentBackground.supported) translucentBackground.setEnabled(true)
  }

  return (
    <main className="settings-window window-root window-canvas relative flex h-screen min-h-0 overflow-hidden text-foreground">
      <div
        className="pointer-events-none absolute top-0 right-0 left-10 z-30 h-10 [-webkit-app-region:drag] md:left-[208px]"
        aria-hidden="true"
      />
      <div className="absolute top-0 right-0 z-50 h-10">
        <WindowControls />
      </div>

      <SidebarProvider
        defaultWidth={208}
        minWidth={208}
        maxWidth={208}
        keyboardShortcutEnabled={false}
        className="min-h-0 flex-1"
      >
        <Sidebar>
          <SidebarContent className={cn(isMac && 'pt-10')}>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu aria-label="Settings categories">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      aria-current={section === 'appearance' ? 'page' : undefined}
                      isActive={section === 'appearance'}
                      onClick={() => setSection('appearance')}
                    >
                      <IconPalette aria-hidden="true" />
                      <span>Appearance</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      aria-current={section === 'editing' ? 'page' : undefined}
                      isActive={section === 'editing'}
                      onClick={() => setSection('editing')}
                    >
                      <IconPencil aria-hidden="true" />
                      <span>Editing</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      aria-current={section === 'shortcuts' ? 'page' : undefined}
                      isActive={section === 'shortcuts'}
                      onClick={() => setSection('shortcuts')}
                    >
                      <IconKeyboard aria-hidden="true" />
                      <span>Keyboard shortcuts</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarInset className="min-h-0 overflow-hidden bg-transparent">
          <SidebarTrigger className="absolute top-1 left-1 z-40 md:hidden" />
          <ScrollArea className="scroll-fade-y size-full [&_[data-slot=scroll-area-viewport]]:focus-visible:ring-0 [&_[data-slot=scroll-area-viewport]]:focus-visible:outline-none">
            {section === 'appearance' ? (
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-8 pt-12 pb-8">
                <div className="flex flex-col gap-1">
                  <h1 className="text-balance text-xl font-semibold">Appearance</h1>
                  <p className="text-pretty text-sm text-muted-foreground">
                    Change how Kuskus looks across every window.
                  </p>
                </div>

                <FieldGroup className="gap-6">
                  <FieldSet className="gap-3">
                    <FieldLegend variant="label">Theme</FieldLegend>
                    <div className="overflow-hidden rounded-xl bg-card/70 text-card-foreground shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_rgb(0_0_0/0.04)] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_1px_2px_rgb(0_0_0/0.18)]">
                      <Field orientation="horizontal" className="min-h-16 px-4 py-3">
                        <FieldContent>
                          <FieldLabel>Color theme</FieldLabel>
                          <FieldDescription>
                            Choose the character of the workspace.
                          </FieldDescription>
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

                      <Field
                        orientation="horizontal"
                        className="min-h-16 border-t border-foreground/8 px-4 py-3"
                      >
                        <FieldLabel>Color mode</FieldLabel>
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
                    </div>
                  </FieldSet>

                  <FieldSet className="gap-3">
                    <FieldLegend variant="label">Typography</FieldLegend>
                    <FieldDescription>
                      Choose fonts and reading sizes for notes and the interface.
                    </FieldDescription>
                    <div className="overflow-hidden rounded-xl bg-card/70 text-card-foreground shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_rgb(0_0_0/0.04)] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_1px_2px_rgb(0_0_0/0.18)]">
                      <Field orientation="horizontal" className="min-h-16 px-4 py-3">
                        <FieldLabel>UI font</FieldLabel>
                        <div className="w-52">
                          <FontPicker
                            value={uiFont}
                            onValueChange={setUiFont}
                            kind="ui"
                            localFonts={localFonts}
                            ariaLabel="UI font"
                          />
                        </div>
                      </Field>

                      <Field
                        orientation="horizontal"
                        className="min-h-16 border-t border-foreground/8 px-4 py-3"
                      >
                        <FieldContent>
                          <FieldLabel>Content font</FieldLabel>
                          <FieldDescription>
                            Used for note text in Live and Read modes.
                          </FieldDescription>
                        </FieldContent>
                        <div className="w-52">
                          <FontPicker
                            value={contentFont}
                            onValueChange={setContentFont}
                            kind="ui"
                            localFonts={localFonts}
                            ariaLabel="Content font"
                          />
                        </div>
                      </Field>

                      <Field
                        orientation="horizontal"
                        className="min-h-16 border-t border-foreground/8 px-4 py-3"
                      >
                        <FieldLabel>Code font</FieldLabel>
                        <div className="w-52">
                          <FontPicker
                            value={codeFont}
                            onValueChange={setCodeFont}
                            kind="code"
                            localFonts={localFonts}
                            ariaLabel="Code font"
                          />
                        </div>
                      </Field>

                      <Field
                        orientation="horizontal"
                        className="min-h-16 border-t border-foreground/8 px-4 py-3"
                      >
                        <FieldContent>
                          <FieldLabel>Source size</FieldLabel>
                          <FieldDescription>
                            Base text size in Markdown Source mode.
                          </FieldDescription>
                        </FieldContent>
                        <FontSizeSelect
                          value={sourceFontSize}
                          onValueChange={setSourceFontSize}
                          label="Markdown Source font size"
                        />
                      </Field>

                      <Field
                        orientation="horizontal"
                        className="min-h-16 border-t border-foreground/8 px-4 py-3"
                      >
                        <FieldContent>
                          <FieldLabel>Live & Read size</FieldLabel>
                          <FieldDescription>
                            Shared base size for rendered note content.
                          </FieldDescription>
                        </FieldContent>
                        <FontSizeSelect
                          value={contentFontSize}
                          onValueChange={setContentFontSize}
                          label="Live and Read font size"
                        />
                      </Field>
                    </div>
                  </FieldSet>

                  <FieldSet className="gap-3">
                    <FieldLegend variant="label">Interface</FieldLegend>
                    <div className="overflow-hidden rounded-xl bg-card/70 text-card-foreground shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_rgb(0_0_0/0.04)] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_1px_2px_rgb(0_0_0/0.18)]">
                      {window.electron.window.platform === 'win32' ? (
                        <Field
                          orientation="horizontal"
                          className="min-h-16 px-4 py-3"
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

                      <Field
                        orientation="horizontal"
                        className={cn(
                          'min-h-16 px-4 py-3',
                          window.electron.window.platform === 'win32' &&
                            'border-t border-foreground/8'
                        )}
                      >
                        <FieldLabel>Interface scale</FieldLabel>
                        <Select
                          value={String(zoom.factor)}
                          onValueChange={(factor) => {
                            const parsed = Number(factor)
                            if (Number.isFinite(parsed)) zoom.setFactor(parsed)
                          }}
                        >
                          <SelectTrigger size="sm" aria-label="Interface scale" className="w-28">
                            <SelectValue>{`${Math.round(zoom.factor * 100)}%`}</SelectValue>
                          </SelectTrigger>
                          <SelectContent align="end">
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
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={resetAppearance}
                      className="self-start transition-transform active:scale-[0.96]"
                    >
                      Reset appearance
                    </Button>
                  </FieldSet>
                </FieldGroup>
              </div>
            ) : section === 'editing' ? (
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-8 pt-12 pb-8">
                <div className="flex flex-col gap-1">
                  <h1 className="text-balance text-xl font-semibold">Editing</h1>
                  <p className="text-pretty text-sm text-muted-foreground">
                    Choose how note editing behaves.
                  </p>
                </div>
                <FieldSet className="gap-3">
                  <FieldLegend variant="label">Editor</FieldLegend>
                  <div className="overflow-hidden rounded-xl bg-card/70 text-card-foreground shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_rgb(0_0_0/0.04)] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_1px_2px_rgb(0_0_0/0.18)]">
                    <Field orientation="horizontal" className="min-h-16 px-4 py-3">
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
                    <Field
                      orientation="horizontal"
                      className="min-h-16 border-t border-foreground/8 px-4 py-3"
                    >
                      <FieldContent>
                        <FieldLabel htmlFor="settings-source-line-numbers">Line numbers</FieldLabel>
                        <FieldDescription>
                          Show line numbers in Markdown Source mode.
                        </FieldDescription>
                      </FieldContent>
                      <Switch
                        id="settings-source-line-numbers"
                        checked={sourceLineNumbers}
                        onCheckedChange={setSourceLineNumbers}
                      />
                    </Field>
                  </div>
                </FieldSet>
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-8 pt-12 pb-8">
                <div className="flex flex-col gap-1">
                  <h1 className="text-balance text-xl font-semibold">Keyboard shortcuts</h1>
                  <p className="text-pretty text-sm text-muted-foreground">
                    View the shortcuts available in Kuskus. Custom shortcuts are coming later.
                  </p>
                </div>
                <FieldGroup className="gap-6">
                  {shortcutGroups.map((group) => (
                    <FieldSet key={group.label} className="gap-3">
                      <FieldLegend variant="label">{group.label}</FieldLegend>
                      <div className="overflow-hidden rounded-xl bg-card/70 text-card-foreground shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_rgb(0_0_0/0.04)] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_1px_2px_rgb(0_0_0/0.18)]">
                        {group.shortcuts.map((shortcut, index) => (
                          <Field
                            key={shortcut.label}
                            orientation="horizontal"
                            className={cn(
                              'min-h-14 px-4 py-3',
                              index > 0 && 'border-t border-foreground/8'
                            )}
                          >
                            <FieldLabel>{shortcut.label}</FieldLabel>
                            <Kbd>{shortcut.keys}</Kbd>
                          </Field>
                        ))}
                      </div>
                    </FieldSet>
                  ))}
                </FieldGroup>
              </div>
            )}
          </ScrollArea>
        </SidebarInset>
      </SidebarProvider>
    </main>
  )
}
