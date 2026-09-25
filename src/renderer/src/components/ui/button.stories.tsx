import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from './button'

const meta = {
  title: 'Controls/Button',
  component: Button,
  args: { children: 'Save item' }
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {}

export const Secondary: Story = {
  args: { variant: 'secondary' }
}

export const Tonal: Story = {
  args: { variant: 'tonal' }
}

export const Outline: Story = {
  args: { variant: 'outline' }
}

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Delete item' }
}

export const Disabled: Story = {
  args: { disabled: true }
}

export const Gallery: Story = {
  render: () => (
    <div className="grid grid-cols-[6rem_auto_auto] items-center gap-x-5 gap-y-4">
      <span className="text-muted-foreground text-xs">Default</span>
      <Button>Save item</Button>
      <Button disabled>Save item</Button>

      <span className="text-muted-foreground text-xs">Secondary</span>
      <Button variant="secondary">Save item</Button>
      <Button variant="secondary" disabled>
        Save item
      </Button>

      <span className="text-muted-foreground text-xs">Outline</span>
      <Button variant="outline">Save item</Button>
      <Button variant="outline" disabled>
        Save item
      </Button>

      <span className="text-muted-foreground text-xs">Tonal</span>
      <Button variant="tonal">Save item</Button>
      <Button variant="tonal" disabled>
        Save item
      </Button>

      <span className="text-muted-foreground text-xs">Destructive</span>
      <Button variant="destructive">Delete item</Button>
      <Button variant="destructive" disabled>
        Delete item
      </Button>
    </div>
  )
}
