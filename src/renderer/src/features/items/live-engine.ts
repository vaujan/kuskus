import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

/**
 * Live-engine selection. The CodeMirror live surface (atomic-style
 * decorations over one CM6 editor) is being integrated alongside the
 * Milkdown rich editor. This flag chooses which engine backs live mode
 * per app session; both engines stay in the tree until the CodeMirror
 * surface passes its acceptance gates.
 */
export type LiveEngine = 'milkdown' | 'codemirror'

export const LIVE_ENGINE_STORAGE_KEY = 'kuskus-live-engine'

export function parseLiveEngine(value: string | null): LiveEngine {
  return value === 'codemirror' ? 'codemirror' : 'milkdown'
}

export function useLiveEnginePreference(): [LiveEngine, Dispatch<SetStateAction<LiveEngine>>] {
  const [engine, setEngineState] = useState<LiveEngine>(() => {
    try {
      return parseLiveEngine(localStorage.getItem(LIVE_ENGINE_STORAGE_KEY))
    } catch {
      return 'milkdown'
    }
  })
  const setEngine = useCallback((next: SetStateAction<LiveEngine>) => {
    setEngineState((current) => {
      const value = typeof next === 'function' ? next(current) : next
      try {
        localStorage.setItem(LIVE_ENGINE_STORAGE_KEY, value)
      } catch {
        // Storage unavailable — the preference just doesn't persist.
      }
      return value
    })
  }, [])
  return [engine, setEngine]
}
