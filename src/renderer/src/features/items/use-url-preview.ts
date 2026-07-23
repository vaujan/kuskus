import { useEffect, useState } from 'react'

import type { UrlPreviewKind } from '../../../../shared/library-contract'

interface UrlPreviewState {
  key: string
  preview: string | null
  loading: boolean
  error: string
}

export function useUrlPreview(
  itemId: string,
  kind: UrlPreviewKind,
  available: boolean
): { preview: string | null; loading: boolean; error: string } {
  const key = `${itemId}:${kind}`
  const [state, setState] = useState<UrlPreviewState>({
    key,
    preview: null,
    loading: available,
    error: ''
  })

  useEffect(() => {
    if (!available) return
    let active = true
    let objectUrl: string | null = null
    void window.kuskus.getUrlPreview(itemId, kind).then((result) => {
      if (!active) return
      if (!result.ok) {
        setState({ key, preview: null, loading: false, error: result.error })
        return
      }
      objectUrl = URL.createObjectURL(
        new Blob([result.data.bytes], { type: result.data.mediaType })
      )
      setState({ key, preview: objectUrl, loading: false, error: '' })
    })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [available, itemId, key, kind])

  return state.key === key
    ? { preview: state.preview, loading: state.loading, error: state.error }
    : { preview: null, loading: available, error: '' }
}
