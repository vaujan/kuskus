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
import { CollectionIcon } from '@/features/collections/collection-icons'
import type { CollectionIconKey } from '../../../../shared/library-contract'

type FolderNameDialogMode =
  { type: 'create'; icon: CollectionIconKey; onChooseIcon: () => void } | { type: 'rename' }

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
              <DialogTitle>{isCreate ? 'Add folder' : 'Rename folder'}</DialogTitle>
              <DialogDescription>
                {isCreate
                  ? 'Choose a name and optional icon for this folder.'
                  : 'Enter a new name for this folder.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="folder-name">Folder name</Label>
              <div className="flex items-center gap-2">
                {mode.type === 'create' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-10 shrink-0 active:scale-[0.96]"
                    aria-label="Choose folder icon"
                    title="Choose folder icon"
                    disabled={busy}
                    onClick={mode.onChooseIcon}
                  >
                    <CollectionIcon icon={mode.icon} aria-hidden="true" />
                  </Button>
                )}
                <Input
                  id="folder-name"
                  className="h-10 min-w-0 flex-1"
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
                {busy ? (isCreate ? 'Adding…' : 'Renaming…') : isCreate ? 'Add Folder' : 'Rename'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
