import { useEffect, useState } from 'react'
import { acquirePreview } from '@/features/items/preview-cache'

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
    let release: (() => void) | null = null
    void acquirePreview(`image:${itemId}`, async () => {
      const result = await window.kuskus.getImagePreview(itemId)
      if (!result.ok) throw new Error(result.error)
      return result.data
    }).then(
      (lease) => {
        if (!active) return lease.release()
        release = lease.release
        setState({ itemId, preview: lease.url, error: '' })
      },
      (error: unknown) => {
        if (active)
          setState({
            itemId,
            preview: null,
            error: error instanceof Error ? error.message : 'Preview unavailable'
          })
      }
    )
    return () => {
      active = false
      release?.()
    }
  }, [itemId, missingContent])

  return {
    preview: state.itemId === itemId ? state.preview : null,
    previewError: state.itemId === itemId ? state.error : ''
  }
}
