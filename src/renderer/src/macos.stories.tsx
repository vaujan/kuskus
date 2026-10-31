import type { Meta, StoryObj } from '@storybook/react-vite'

import App from './App'
import {
  installPreview,
  library,
  planningNote,
  image,
  link,
  file
} from './demo/app-preview-fixtures'
import { NoteWindowApp } from './features/items/note-window-app'
import { SettingsWindowApp } from './features/settings/settings-window-app'
import { TooltipProvider } from './components/ui/tooltip'
import { SettingsProvider } from './settings/settings-context'

const meta = {
  title: 'App/macOS windows',
  component: App,
  parameters: { layout: 'fullscreen' },
  loaders: [
    () =>
      installPreview(
        library('macos', [planningNote, image, link, file]),
        { type: 'inbox' },
        'darwin'
      )
  ],
  decorators: [
    (Story) => (
      <SettingsProvider>
        <TooltipProvider>
          {/* Visual reference only. Electron supplies the real controls on macOS. */}
          <div
            aria-hidden="true"
            className="pointer-events-none fixed z-[100] flex"
            style={{
              left: 'calc(16px / var(--app-zoom-factor, 1))',
              top: 'calc(18px / var(--app-zoom-factor, 1))',
              gap: 'calc(8px / var(--app-zoom-factor, 1))'
            }}
          >
            {['#ff5f57', '#febc2e', '#28c840'].map((color) => (
              <span
                key={color}
                className="rounded-full shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.15)]"
                style={{
                  width: 'calc(12px / var(--app-zoom-factor, 1))',
                  height: 'calc(12px / var(--app-zoom-factor, 1))',
                  backgroundColor: color
                }}
              />
            ))}
          </div>
          <Story />
        </TooltipProvider>
      </SettingsProvider>
    )
  ]
} satisfies Meta<typeof App>

export default meta
type Story = StoryObj<typeof meta>

export const Library: Story = {}
export const Settings: Story = { render: () => <SettingsWindowApp /> }
export const Note: Story = { render: () => <NoteWindowApp itemId={planningNote.id} /> }
