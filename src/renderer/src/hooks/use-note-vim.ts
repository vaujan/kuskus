import { useEffect, useState } from 'react'

import { NOTE_VIM_MODE_STORAGE_KEY, parseNoteVimEnabled } from '@/features/items/note-vim-mode'

export function useNoteVim(): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState(() =>
    parseNoteVimEnabled(localStorage.getItem(NOTE_VIM_MODE_STORAGE_KEY))
  )

  useEffect(() => {
    localStorage.setItem(NOTE_VIM_MODE_STORAGE_KEY, String(enabled))
  }, [enabled])

  return [enabled, setEnabled]
}
