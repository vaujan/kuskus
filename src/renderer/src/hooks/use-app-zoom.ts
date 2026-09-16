import { useCallback, useEffect, useState } from 'react'

import { APP_ZOOM_FACTORS } from '../../../shared/window-contract'

const ZOOM_STORAGE_KEY = 'kuskus-app-zoom'
const DEFAULT_ZOOM_FACTOR = 1

export function resolveStoredZoomFactor(value: string | null): number {
  const storedFactor = Number(value)
  return APP_ZOOM_FACTORS.some((factor) => factor === storedFactor)
    ? storedFactor
    : DEFAULT_ZOOM_FACTOR
}

function readStoredZoomFactor(): number {
  return resolveStoredZoomFactor(localStorage.getItem(ZOOM_STORAGE_KEY))
}

export interface AppZoom {
  factor: number
  canZoomIn: boolean
  canZoomOut: boolean
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  setFactor: (factor: number) => void
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

  const setFactorExplicit = useCallback((nextFactor: number) => {
    setFactor(
      APP_ZOOM_FACTORS.includes(nextFactor as (typeof APP_ZOOM_FACTORS)[number])
        ? nextFactor
        : DEFAULT_ZOOM_FACTOR
    )
  }, [])

  useEffect(() => {
    localStorage.setItem(ZOOM_STORAGE_KEY, String(factor))
    void window.electron.window.setZoomFactor(factor).catch(() => undefined)
  }, [factor])

  useEffect(() => {
    const handleStorage = (event: StorageEvent): void => {
      if (event.key === ZOOM_STORAGE_KEY) setFactor(resolveStoredZoomFactor(event.newValue))
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

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
    resetZoom,
    setFactor: setFactorExplicit
  }
}
