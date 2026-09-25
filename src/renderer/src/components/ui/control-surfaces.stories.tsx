import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { FontPicker } from '@/features/settings/font-picker'
import type { FontPreference } from '@/hooks/theme'
import { Button } from './button'
import { ButtonGroup } from './button-group'
import { Kbd, ShortcutKbd } from './kbd'

function ControlSurfaces(): React.JSX.Element {
  const [selected, setSelected] = useState('Read')
  const [font, setFont] = useState<FontPreference>('system-ui')

  return (
    <div className="flex w-80 flex-col gap-7">
      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-xs">Button group</span>
        <ButtonGroup aria-label="Note mode">
          {['Read', 'Live', 'Source'].map((mode) => (
            <Button
              key={mode}
              variant="ghost"
              aria-pressed={selected === mode}
              onClick={() => setSelected(mode)}
              className="rounded-lg aria-pressed:bg-muted"
            >
              {mode}
            </Button>
          ))}
        </ButtonGroup>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-xs">Font picker</span>
        <div className="w-52">
          <FontPicker
            value={font}
            onValueChange={setFont}
            kind="ui"
            ariaLabel="UI font"
            localFonts={{ status: 'ready', families: [], request: async () => {} }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-muted-foreground text-xs">Keyboard shortcuts</span>
        <div className="flex items-center gap-3">
          <ShortcutKbd shortcut="Ctrl+Shift+N" />
          <ShortcutKbd shortcut="Enter" />
          <Kbd>Esc</Kbd>
        </div>
        <Button size="sm">
          Save <ShortcutKbd shortcut="Ctrl+Enter" />
        </Button>
      </div>
    </div>
  )
}

const meta = {
  title: 'Controls/Surface details',
  component: ControlSurfaces
} satisfies Meta<typeof ControlSurfaces>

export default meta
type Story = StoryObj<typeof meta>

export const Gallery: Story = {}
