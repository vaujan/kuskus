import { useState } from 'react'

import type { CollectionIconKey } from '../../../../shared/library-contract'
import { CollectionIcon } from './collection-icons'
import { FolderIconPickerDialog } from './folder-icon-picker-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

type FolderNameDialogMode =
  | {
      type: 'create'
      parentName?: string
    }
  | { type: 'rename' }

export function FolderNameDialog({
  open,
  mode,
  name,
  busy,
  onOpenChange,
  onNameChange,
  onSubmit
}: {
  open: boolean
  mode: FolderNameDialogMode | null
  name: string
  busy: boolean
  onOpenChange: (open: boolean) => void
  onNameChange: (name: string) => void
  onSubmit: (name: string, icon: CollectionIconKey) => void
}): React.JSX.Element {
  const [icon, setIcon] = useState<CollectionIconKey>('folder')
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [previousOpen, setPreviousOpen] = useState(open)
  if (open !== previousOpen) {
    setPreviousOpen(open)
    setIcon('folder')
    setIconPickerOpen(false)
  }
  const isCreate = mode?.type === 'create'
  const isSubfolder = isCreate && mode.parentName !== undefined
  const trimmedName = name.trim()

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!busy) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={!busy}>
        {mode && (
          <form
            className="grid gap-6"
            onSubmit={(event) => {
              event.preventDefault()
              if (trimmedName && !busy) onSubmit(name, icon)
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {isSubfolder ? 'Add Subfolder' : isCreate ? 'Add Folder' : 'Rename Folder'}
              </DialogTitle>
              <DialogDescription>
                {isSubfolder
                  ? `Choose a name and icon for a folder inside ${mode.parentName}.`
                  : isCreate
                    ? 'Choose a name and icon for this folder.'
                    : 'Enter a new name for this folder.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="folder-name">Folder name</Label>
              <div className="flex items-center gap-2">
                {isCreate && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-lg"
                    aria-label="Choose folder icon"
                    title="Choose folder icon"
                    disabled={busy}
                    onClick={() => setIconPickerOpen(true)}
                  >
                    <CollectionIcon icon={icon} aria-hidden="true" />
                  </Button>
                )}
                <Input
                  id="folder-name"
                  className="h-10"
                  autoFocus
                  autoComplete="off"
                  maxLength={80}
                  placeholder={isCreate ? 'e.g. Design references' : undefined}
                  value={name}
                  disabled={busy}
                  onFocus={(event) => {
                    if (mode.type === 'rename') event.currentTarget.select()
                  }}
                  onChange={(event) => onNameChange(event.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!trimmedName || busy}>
                {busy && <Spinner data-icon="inline-start" />}
                {busy
                  ? isCreate
                    ? 'Adding…'
                    : 'Renaming…'
                  : isSubfolder
                    ? 'Add Subfolder'
                    : isCreate
                      ? 'Add Folder'
                      : 'Rename'}
              </Button>
            </DialogFooter>
          </form>
        )}
        {isCreate && (
          <FolderIconPickerDialog
            open={iconPickerOpen}
            value={icon}
            disabled={busy}
            onOpenChange={setIconPickerOpen}
            onSelect={(nextIcon) => {
              setIcon(nextIcon)
              setIconPickerOpen(false)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
