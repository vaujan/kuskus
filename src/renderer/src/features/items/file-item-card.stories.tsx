import type { Meta, StoryObj } from '@storybook/react-vite'

import type { FileItemDto } from '../../../../shared/library-contract'
import { FileItemCard } from './file-item-card'

const file: FileItemDto = {
  schemaVersion: 2,
  id: 'sample-file',
  type: 'file',
  title: 'Project brief.pdf',
  createdAt: '2026-09-23T00:00:00.000Z',
  updatedAt: '2026-09-23T00:00:00.000Z',
  sourceFilename: 'Project brief.pdf',
  contentFilename: 'Project brief.pdf',
  mediaType: 'application/pdf',
  size: 180_000,
  missingContent: false,
  location: { type: 'inbox' },
  relativePath: 'Project brief.pdf',
  referencedAttachment: false
}

const meta = {
  title: 'Library/File card',
  component: FileItemCard,
  args: {
    item: file,
    view: 'visual',
    selected: false,
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
} satisfies Meta<typeof FileItemCard>

export default meta
type Story = StoryObj<typeof meta>

export const Visual: Story = {}

export const Selected: Story = {
  args: { selected: true }
}

export const Grid: Story = {
  args: { view: 'grid' }
}

export const Compact: Story = {
  args: { compact: true }
}
