import { useCallback, useEffect, useState } from 'react'

import { APP_ZOOM_FACTORS } from '../../../shared/window-contract'

const ZOOM_STORAGE_KEY = 'kuskus-app-zoom'
const DEFAULT_ZOOM_FACTOR = 1

function readStoredZoomFactor(): number {
  const storedFactor = Number(localStorage.getItem(ZOOM_STORAGE_KEY))
  return APP_ZOOM_FACTORS.some((factor) => factor === storedFactor)
    ? storedFactor
    : DEFAULT_ZOOM_FACTOR
}

export interface AppZoom {
  factor: number
  canZoomIn: boolean
  canZoomOut: boolean
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
}

export function useAppZoom(): AppZoom {
  const [factor, setFactor] = useState(readStoredZoomFactor)
  const factorIndex = APP_ZOOM_FACTORS.findIndex((candidate) => candidate === factor)

  const zoomIn = useCallback(() => {
    setFactor((currentFactor) => {
      const currentIndex = APP_ZOOM_FACTORS.findIndex((candidate) => candidate === currentFactor)
      return APP_ZOOM_FACTORS[Math.min(currentIndex + 1, APP_ZOOM_FACTORS.length - 1)]
    })
  }, [])

  const zoomOut = useCallback(() => {
    setFactor((currentFactor) => {
      const currentIndex = APP_ZOOM_FACTORS.findIndex((candidate) => candidate === currentFactor)
      return APP_ZOOM_FACTORS[Math.max(currentIndex - 1, 0)]
    })
  }, [])

  const resetZoom = useCallback(() => setFactor(DEFAULT_ZOOM_FACTOR), [])

  useEffect(() => {
    localStorage.setItem(ZOOM_STORAGE_KEY, String(factor))
    void window.electron.window.setZoomFactor(factor).catch(() => undefined)
  }, [factor])

  useEffect(() => {
    return window.electron.window.onZoomShortcut((shortcut) => {
      if (shortcut === 'in') zoomIn()
      else if (shortcut === 'out') zoomOut()
      else resetZoom()
    })
  }, [resetZoom, zoomIn, zoomOut])

  return {
    factor,
    canZoomIn: factorIndex < APP_ZOOM_FACTORS.length - 1,
    canZoomOut: factorIndex > 0,
    zoomIn,
    zoomOut,
    resetZoom
  }
}
