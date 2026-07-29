import { IconCheck, IconFolders } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CollectionIcon } from '@/features/collections/collection-icons'
import { flattenFolderTree, getFolderSubtreeIds } from '@/features/collections/folder-tree'
import type { CollectionDto } from '../../../../shared/library-contract'

export function FolderMoveDialog({
  folder,
  collections,
  busy,
  onOpenChange,
  onMove
}: {
  folder: CollectionDto | null
  collections: CollectionDto[]
  busy: boolean
  onOpenChange: (open: boolean) => void
  onMove: (parentId: string | null) => void
}): React.JSX.Element {
  const excludedIds = folder ? getFolderSubtreeIds(collections, folder.id) : new Set<string>()
  const options = flattenFolderTree(collections).filter(
    ({ folder: option }) => !excludedIds.has(option.id)
  )

  return (
    <Dialog open={folder !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Move “{folder?.name}”</DialogTitle>
          <DialogDescription>
            Choose its new parent folder or move it to the root.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-80">
          <div className="grid gap-1 pr-3">
            <Button
              type="button"
              variant="ghost"
              className="h-9 justify-start rounded-xl px-2 font-normal"
              disabled={busy || folder?.parentId === null}
              onClick={() => onMove(null)}
            >
              <IconFolders aria-hidden="true" />
              Library root
              {folder?.parentId === null ? (
                <IconCheck className="ml-auto" aria-hidden="true" />
              ) : null}
            </Button>
            {options.map(({ folder: option, depth }) => {
              const current = folder?.parentId === option.id
              return (
                <Button
                  key={option.id}
                  type="button"
                  variant="ghost"
                  className="h-9 justify-start rounded-xl px-2 font-normal"
                  disabled={busy || current}
                  onClick={() => onMove(option.id)}
                >
                  {depth > 0 ? (
                    <span className="shrink-0" style={{ width: depth * 12 }} aria-hidden="true" />
                  ) : null}
                  <CollectionIcon icon={option.icon} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-left">{option.name}</span>
                  {current ? <IconCheck className="ml-auto" aria-hidden="true" /> : null}
                </Button>
              )
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
