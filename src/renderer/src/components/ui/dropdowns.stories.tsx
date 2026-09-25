import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from './button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './dropdown-menu'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './select'

function DropdownExamples(): React.JSX.Element {
  const [sort, setSort] = useState('newest')

  return (
    <div className="flex items-center gap-5">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="secondary" />}>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuItem>Rename</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive">Move to trash</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Select value={sort} onValueChange={(value) => setSort(value ?? 'newest')}>
        <SelectTrigger aria-label="Sort order">
          <SelectValue>{sort === 'newest' ? 'Newest first' : 'Oldest first'}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

const meta = {
  title: 'Controls/Dropdowns',
  component: DropdownExamples
} satisfies Meta<typeof DropdownExamples>

export default meta
type Story = StoryObj<typeof meta>

export const Gallery: Story = {}
