import { useSetting } from '@/settings/settings-context'

export function useNoteVim(): [boolean, (enabled: boolean) => void] {
  return useSetting<boolean>('vimEnabled')
}
