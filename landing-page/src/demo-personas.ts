import type { ColorTheme, FontPreference } from '../../src/renderer/src/hooks/theme'

export const demoPersonas = [
  {
    id: 'student',
    label: 'Learn',
    icon: 'book',
    description: 'Notes, exercises, and references.',
    theme: 'obsidian',
    font: 'inter',
    mode: 'light'
  },
  {
    id: 'developer',
    label: 'Build',
    icon: 'code',
    description: 'Projects, code, and documentation.',
    theme: 'one',
    font: 'system-mono',
    mode: 'dark'
  },
  {
    id: 'researcher',
    label: 'Research',
    icon: 'search',
    description: 'Sources, evidence, and questions.',
    theme: 'solarized',
    font: 'plex',
    mode: 'light'
  },
  {
    id: 'creative',
    label: 'Create',
    icon: 'pen',
    description: 'Ideas, drafts, and inspiration.',
    theme: 'vscode',
    font: 'system-ui',
    mode: 'dark'
  }
] as const satisfies ReadonlyArray<{
  id: string
  label: string
  description: string
  icon: 'book' | 'code' | 'search' | 'pen'
  theme: ColorTheme
  font: FontPreference
  mode: 'light' | 'dark'
}>

export type DemoPersonaId = (typeof demoPersonas)[number]['id']

export const DEMO_SELECT_MESSAGE = 'kuskus-demo:select'
export const DEMO_READY_MESSAGE = 'kuskus-demo:ready'
