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
  onSubmit: (name: string) => void
}): React.JSX.Element {
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
              if (trimmedName && !busy) onSubmit(name)
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {isSubfolder ? 'Add Subfolder' : isCreate ? 'Add Folder' : 'Rename Folder'}
              </DialogTitle>
              <DialogDescription>
                {isSubfolder
                  ? `Choose a name for a folder inside ${mode.parentName}.`
                  : isCreate
                    ? 'Choose a name for this folder.'
                    : 'Enter a new name for this folder.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="folder-name">Folder name</Label>
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
      </DialogContent>
    </Dialog>
  )
}
