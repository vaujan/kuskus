import { useState } from 'react'

type LocalFontStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'unsupported'

export interface LocalFontsState {
  status: LocalFontStatus
  families: readonly string[]
  request: () => Promise<void>
}

export function useLocalFonts(): LocalFontsState {
  const [status, setStatus] = useState<LocalFontStatus>('idle')
  const [families, setFamilies] = useState<readonly string[]>([])

  const request = async (): Promise<void> => {
    if (!window.queryLocalFonts) {
      setStatus('unsupported')
      return
    }

    setStatus('loading')
    try {
      const fonts = await window.queryLocalFonts()
      const uniqueFamilies = [
        ...new Set(fonts.map((font) => font.family.trim()).filter(Boolean))
      ].sort((left, right) => left.localeCompare(right))
      setFamilies(uniqueFamilies)
      setStatus('ready')
    } catch {
      setStatus('denied')
    }
  }

  return { status, families, request }
}
