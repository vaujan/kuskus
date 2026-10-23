import { useEffect, useRef, useState } from 'react'

import { installPreview } from '../../src/renderer/src/demo/app-preview-fixtures'
import { TooltipProvider } from '../../src/renderer/src/components/ui/tooltip'
import { Toaster } from '../../src/renderer/src/features/shell/app-toaster'
import { Workspace } from '../../src/renderer/src/features/library/workspace'
import { NOTE_INLINE_TITLE_STORAGE_KEY } from '../../src/renderer/src/features/items/note-inline-title'
import { useAppZoom } from '../../src/renderer/src/hooks/use-app-zoom'
import {
  applyControlStyle,
  applyTheme,
  DEFAULT_TYPOGRAPHY
} from '../../src/renderer/src/hooks/theme'
import { useSetting } from '../../src/renderer/src/settings/settings-context'
import {
  demoPersonas,
  DEMO_READY_MESSAGE,
  DEMO_SELECT_MESSAGE,
  type DemoPersonaId
} from './demo-personas'
import { personaLibrary } from './persona-libraries'

function installLibrary(id: DemoPersonaId): ReturnType<typeof personaLibrary> {
  localStorage.setItem(NOTE_INLINE_TITLE_STORAGE_KEY, 'false')
  const library = personaLibrary(id)
  const sessionKey = `kuskus-session:v1:${library.path}`
  const previousSession = localStorage.getItem(sessionKey)
  installPreview(
    library,
    id === 'developer' || id === 'researcher'
      ? { type: 'collection', collectionId: library.collections[0].id }
      : { type: 'all' }
  )
  if (previousSession) localStorage.setItem(sessionKey, previousSession)
  return library
}

const firstPersona = demoPersonas[0]
const initialLibrary = installLibrary(firstPersona.id)
applyTheme(firstPersona.mode, firstPersona.theme, {
  ...DEFAULT_TYPOGRAPHY,
  uiFont: firstPersona.font,
  contentFont: firstPersona.font
})
applyControlStyle('skeuomorphic')
localStorage.setItem('kuskus-color-mode', firstPersona.mode)
localStorage.setItem('kuskus-color-theme', firstPersona.theme)
localStorage.setItem('kuskus-ui-font', firstPersona.font)
localStorage.setItem('kuskus-content-font', firstPersona.font)
localStorage.setItem('kuskus-app-zoom', '0.9')
localStorage.setItem('kuskus-sidebar-width', '208')
localStorage.setItem('kuskus-focus-list-width', '320')

export default function Demo(): React.JSX.Element {
  const [library, setLibrary] = useState(initialLibrary)
  const currentPersona = useRef<DemoPersonaId>(firstPersona.id)
  const [, setMode] = useSetting('colorMode')
  const [, setTheme] = useSetting('colorTheme')
  const [, setUiFont] = useSetting('uiFont')
  const [, setContentFont] = useSetting('contentFont')
  const zoom = useAppZoom()

  useEffect(() => {
    const selectPersona = (event: MessageEvent): void => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return
      if (event.data?.type !== DEMO_SELECT_MESSAGE) return
      const persona = demoPersonas.find((entry) => entry.id === event.data.persona)
      if (!persona || persona.id === currentPersona.current) return
      currentPersona.current = persona.id
      setLibrary(installLibrary(persona.id))
      setMode(persona.mode)
      setTheme(persona.theme)
      setUiFont(persona.font)
      setContentFont(persona.font)
    }
    window.addEventListener('message', selectPersona)
    window.parent.postMessage({ type: DEMO_READY_MESSAGE }, window.location.origin)
    return () => window.removeEventListener('message', selectPersona)
  }, [setMode, setTheme, setUiFont, setContentFont])

  return (
    <TooltipProvider>
      <Workspace key={library.id} initialLibrary={library} zoom={zoom} />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}
