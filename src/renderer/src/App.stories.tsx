import type { Meta, StoryObj } from '@storybook/react-vite'

import { SettingsProvider } from './settings/settings-context'
import App from './App'
import {
  file,
  formattingNote,
  image,
  installHeroPreview,
  installPreview,
  library,
  link,
  meetingNote,
  paletteImageItem,
  planningNote
} from './demo/app-preview-fixtures'

const meta = {
  title: 'App/Library states',
  component: App,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <SettingsProvider>
        <Story />
      </SettingsProvider>
    )
  ]
} satisfies Meta<typeof App>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  loaders: [() => installPreview(library('empty', []))]
}

export const Notes: Story = {
  loaders: [() => installPreview(library('notes', [planningNote, formattingNote, meetingNote]))]
}

export const MixedLibrary: Story = {
  loaders: [
    () =>
      installPreview(
        library('mixed', [planningNote, image, link, file, paletteImageItem, meetingNote])
      )
  ]
}

export const HeroAppMockup: Story = {
  name: 'Hero app mockup — project library',
  loaders: [installHeroPreview]
}

export const MissingFiles: Story = {
  loaders: [
    () =>
      installPreview(
        library('missing', [
          { ...planningNote, id: 'missing-note', title: 'Unavailable note', missingContent: true },
          { ...image, id: 'missing-image', title: 'Unavailable image', missingContent: true },
          { ...file, id: 'missing-file', title: 'Unavailable brief.pdf', missingContent: true }
        ])
      )
  ]
}

export const KeyboardLibrary: Story = {
  loaders: [
    () =>
      installPreview(
        library(
          'keyboard',
          Array.from({ length: 120 }, (_, index) => ({
            ...planningNote,
            id: `keyboard-note-${index}`,
            title: `Keyboard note ${String(index + 1).padStart(3, '0')}`,
            relativePath: `Inbox/Keyboard note ${String(index + 1).padStart(3, '0')}.md`
          })),
          {
            collections: [
              {
                schemaVersion: 2,
                id: 'keyboard-folder',
                name: 'Keyboard testing',
                icon: 'folder',
                parentId: null,
                createdAt: planningNote.createdAt,
                relativePath: 'Keyboard testing'
              }
            ]
          }
        )
      )
  ]
}
