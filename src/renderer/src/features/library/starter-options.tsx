import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { ColorMode, ColorTheme, FontPreference } from '@/hooks/theme'
import { useSetting } from '@/settings/settings-context'

export type StarterContent = 'tutorials' | 'fresh'

const colorThemes: ReadonlyArray<{ value: ColorTheme; label: string }> = [
  { value: 'kuskus', label: 'Kuskus' },
  { value: 'graphite', label: 'Graphite' },
  { value: 'moss', label: 'Moss' }
]

const colorModes: ReadonlyArray<{ value: ColorMode; label: string }> = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' }
]

const fonts: ReadonlyArray<{ value: FontPreference; label: string }> = [
  { value: 'inter', label: 'Inter' },
  { value: 'plex', label: 'IBM Plex' },
  { value: 'system-ui', label: 'System' }
]

export function StarterOptions({
  starterContent,
  onStarterContentChange,
  onBack,
  onContinue
}: {
  starterContent: StarterContent
  onStarterContentChange: (value: StarterContent) => void
  onBack: () => void
  onContinue: () => void
}): React.JSX.Element {
  const [colorTheme, setColorTheme] = useSetting<ColorTheme>('colorTheme')
  const [colorMode, setColorMode] = useSetting<ColorMode>('colorMode')
  const [uiFont, setUiFont] = useSetting<FontPreference>('uiFont')
  const [, setContentFont] = useSetting<FontPreference>('contentFont')

  return (
    <Card className="setup-options-card gap-0 py-0">
      <CardContent className="py-4">
        <FieldGroup className="gap-4">
          <Field className="gap-2">
            <FieldLabel>Theme</FieldLabel>
            <ToggleGroup
              value={[colorTheme]}
              onValueChange={(values) => {
                if (values[0]) setColorTheme(values[0] as ColorTheme)
              }}
              spacing={0}
              variant="outline"
              size="sm"
              aria-label="Theme"
            >
              {colorThemes.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value}>
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <Field className="gap-2">
            <FieldLabel>Color mode</FieldLabel>
            <ToggleGroup
              value={[colorMode]}
              onValueChange={(values) => {
                if (values[0]) setColorMode(values[0] as ColorMode)
              }}
              spacing={0}
              variant="outline"
              size="sm"
              aria-label="Color mode"
            >
              {colorModes.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value}>
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <Field className="gap-2">
            <FieldLabel>Interface &amp; note font</FieldLabel>
            <ToggleGroup
              value={[uiFont]}
              onValueChange={(values) => {
                const selected = values[0] as FontPreference | undefined
                if (!selected) return
                setUiFont(selected)
                setContentFont(selected)
              }}
              spacing={0}
              variant="outline"
              size="sm"
              aria-label="Font"
            >
              {fonts.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value}>
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <Separator />
          <Field className="gap-2">
            <FieldLabel>Start with</FieldLabel>
            <ToggleGroup
              value={[starterContent]}
              onValueChange={(values) => {
                if (values[0]) onStarterContentChange(values[0] as StarterContent)
              }}
              spacing={0}
              variant="outline"
              size="sm"
              aria-label="Starter content"
            >
              <ToggleGroupItem value="tutorials">Tutorials</ToggleGroupItem>
              <ToggleGroupItem value="fresh">Fresh start</ToggleGroupItem>
            </ToggleGroup>
            <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
              {starterContent === 'tutorials'
                ? 'Add a Start here note with three short tutorials.'
                : 'Open an empty library and add your own items.'}
            </p>
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter className="flex justify-between gap-3 border-t py-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onContinue}>Continue</Button>
      </CardFooter>
    </Card>
  )
}
