import { useEffect, useState } from 'react'

export function useImagePreview(
  itemId: string,
  missingContent: boolean
): { preview: string | null; previewError: string } {
  const [state, setState] = useState<{ itemId: string; preview: string | null; error: string }>({
    itemId: '',
    preview: null,
    error: ''
  })

  useEffect(() => {
    if (missingContent) return
    let active = true
    let objectUrl: string | null = null
    void window.kuskus.getImagePreview(itemId).then((result) => {
      if (!active) return
      if (!result.ok) {
        setState({ itemId, preview: null, error: result.error })
        return
      }
      objectUrl = URL.createObjectURL(
        new Blob([result.data.bytes], { type: result.data.mediaType })
      )
      setState({ itemId, preview: objectUrl, error: '' })
    })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [itemId, missingContent])

  return {
    preview: state.itemId === itemId ? state.preview : null,
    previewError: state.itemId === itemId ? state.error : ''
  }
}
