import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { FolderNameDialog } from './folder-name-dialog'

function FolderDialogExample({
  mode,
  busy = false
}: {
  mode: { type: 'create'; parentName?: string } | { type: 'rename' }
  busy?: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(true)
  const [name, setName] = useState(mode.type === 'rename' ? 'Design references' : '')

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open folder dialog</Button>
      <FolderNameDialog
        open={open}
        mode={mode}
        name={name}
        busy={busy}
        onOpenChange={setOpen}
        onNameChange={setName}
        onSubmit={() => setOpen(false)}
      />
    </>
  )
}

const meta = {
  title: 'Collections/Folder dialog',
  component: FolderDialogExample,
  args: { mode: { type: 'create' } }
} satisfies Meta<typeof FolderDialogExample>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {}

export const Subfolder: Story = {
  args: { mode: { type: 'create', parentName: 'Design references' } }
}

export const Rename: Story = {
  args: { mode: { type: 'rename' } }
}

export const Busy: Story = {
  args: { mode: { type: 'create' }, busy: true }
}
