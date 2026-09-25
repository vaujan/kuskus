import type { Meta, StoryObj } from '@storybook/react-vite'

import { NoteItemCard } from './note-item-card'
import { SAMPLE_NOTE } from './note-story-fixtures'

const meta = {
  title: 'Notes/Note card',
  component: NoteItemCard,
  args: {
    item: SAMPLE_NOTE,
    view: 'visual',
    selected: false,
    opensDialog: true,
    onActivate: () => {},
    onOpen: () => {}
  },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof NoteItemCard>

export default meta
type Story = StoryObj<typeof meta>

export const Preview: Story = {}

export const Selected: Story = {
  args: { selected: true }
}

export const Empty: Story = {
  args: { item: { ...SAMPLE_NOTE, title: 'Untitled note', body: '' } }
}

export const MissingFile: Story = {
  args: { item: { ...SAMPLE_NOTE, missingContent: true } }
}

export const Grid: Story = {
  args: { view: 'grid' }
}
