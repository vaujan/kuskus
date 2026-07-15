import { useEffect, useState } from 'react'

export function useImagePreview(
  itemId: string,
  missingContent: boolean
): { preview: string | null; previewError: string } {
  const [preview, setPreview] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState('')

  useEffect(() => {
    if (missingContent) return
    let active = true
    let objectUrl: string | null = null
    void window.kuskus.getImagePreview(itemId).then((result) => {
      if (!active) return
      if (!result.ok) {
        setPreviewError(result.error)
        return
      }
      objectUrl = URL.createObjectURL(
        new Blob([result.data.bytes], { type: result.data.mediaType })
      )
      setPreviewError('')
      setPreview(objectUrl)
    })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [itemId, missingContent])

  return { preview, previewError }
}
