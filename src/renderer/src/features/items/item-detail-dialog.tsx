import { Dialog } from '@base-ui/react/dialog'
import { ExternalLink, FileImage, FileText, Globe2, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MarkdownPreview } from '@/features/items/markdown-preview'
import { useImagePreview } from '@/features/items/use-image-preview'
import type { LibraryItemDto } from '../../../../shared/library-contract'

function ImageDetail({
  item
}: {
  item: Extract<LibraryItemDto, { type: 'image' }>
}): React.JSX.Element {
  const { preview, previewError } = useImagePreview(item.id, item.missingContent)
  return (
    <>
      <div className="flex max-h-[58vh] min-h-48 items-center justify-center bg-muted">
        {preview ? (
          <img
            src={preview}
            alt={item.title}
            className="max-h-[58vh] max-w-full object-contain outline outline-1 outline-white/10"
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {item.missingContent || previewError ? 'Preview unavailable' : 'Loading image…'}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <p className="font-medium">{item.title}</p>
        <p className="text-sm text-muted-foreground">
          {item.sourceFilename ?? 'Pasted image'} · {item.width} × {item.height}
        </p>
      </div>
    </>
  )
}

export function ItemDetailDialog({
  item,
  onOpenChange,
  onError
}: {
  item: LibraryItemDto | null
  onOpenChange: (open: boolean) => void
  onError: (message: string) => void
}): React.JSX.Element {
  return (
    <Dialog.Root open={item !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex w-[min(42rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-auto rounded-xl bg-popover p-5 text-popover-foreground shadow-2xl outline outline-1 outline-border transition-[opacity,transform] duration-150 data-ending-style:translate-y-[calc(-50%+0.75rem)] data-ending-style:opacity-0 data-starting-style:translate-y-[calc(-50%+0.75rem)] data-starting-style:opacity-0">
          {item ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge variant="secondary">
                    {item.type === 'image' ? (
                      <FileImage data-icon="inline-start" />
                    ) : item.type === 'url' ? (
                      <Globe2 data-icon="inline-start" />
                    ) : (
                      <FileText data-icon="inline-start" />
                    )}
                    {item.type === 'url' ? item.domain : item.type}
                  </Badge>
                  <h2 className="truncate text-lg font-semibold">{item.title}</h2>
                </div>
                <Dialog.Close
                  render={<Button size="icon-sm" variant="ghost" aria-label="Close item details" />}
                >
                  <X aria-hidden="true" />
                </Dialog.Close>
              </div>
              {item.type === 'image' ? (
                <ImageDetail item={item} />
              ) : item.type === 'url' ? (
                <>
                  <div className="overflow-hidden rounded-lg bg-muted">
                    {item.previewImageUrl ? (
                      <img
                        src={item.previewImageUrl}
                        alt=""
                        className="max-h-[48vh] w-full object-cover outline outline-1 outline-white/10"
                      />
                    ) : (
                      <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
                        {item.metadataStatus === 'pending'
                          ? 'Loading preview…'
                          : 'Preview unavailable'}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {item.description ?? item.sourceUrl}
                    </p>
                    <p className="break-all text-xs text-muted-foreground">{item.sourceUrl}</p>
                  </div>
                  <Button
                    className="self-start"
                    onClick={async () => {
                      const result = await window.kuskus.openExternalUrl(item.sourceUrl)
                      if (!result.ok) onError(result.error)
                    }}
                  >
                    <ExternalLink data-icon="inline-start" aria-hidden="true" />
                    Open link
                  </Button>
                </>
              ) : (
                <MarkdownPreview
                  value={item.body}
                  onOpenLink={async (url) => {
                    const result = await window.kuskus.openExternalUrl(url)
                    if (!result.ok) onError(result.error)
                  }}
                />
              )}
            </>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
