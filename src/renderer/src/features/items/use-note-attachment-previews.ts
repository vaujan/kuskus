import { useEffect, useState } from 'react'

import type { NoteAttachmentDto } from '../../../../shared/library-contract'

export function useNoteAttachmentPreviews(
  itemId: string,
  attachments: NoteAttachmentDto[]
): Record<string, string> {
  const [state, setState] = useState<{ itemId: string; previews: Record<string, string> }>({
    itemId: '',
    previews: {}
  })

  useEffect(() => {
    const available = attachments.filter((attachment) => !attachment.missingContent)
    if (available.length === 0) return

    let active = true
    const objectUrls: string[] = []
    void Promise.all(
      available.map(async (attachment) => {
        const result = await window.kuskus.getNoteAttachmentPreview(itemId, attachment.id)
        if (!result.ok) return null
        const url = URL.createObjectURL(
          new Blob([result.data.bytes], { type: result.data.mediaType })
        )
        if (!active) {
          URL.revokeObjectURL(url)
          return null
        }
        objectUrls.push(url)
        return [attachment.id, url] as const
      })
    ).then((entries) => {
      if (!active) return
      setState({
        itemId,
        previews: Object.fromEntries(entries.filter((entry) => entry !== null))
      })
    })

    return () => {
      active = false
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [attachments, itemId])

  return attachments.some((attachment) => !attachment.missingContent) && state.itemId === itemId
    ? state.previews
    : {}
}
