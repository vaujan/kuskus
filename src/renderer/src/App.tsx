import { useEffect, useState } from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { LoadingScreen } from '@/app/loading-screen'
import { SetupScreen } from '@/features/library/setup-screen'
import { Workspace } from '@/features/library/workspace'
import { useAppZoom } from '@/hooks/use-app-zoom'
import { useTranslucentBackground } from '@/hooks/use-translucent-background'
import type { LibraryState } from '../../shared/library-contract'

function App(): React.JSX.Element {
  const [state, setState] = useState<LibraryState | null>(null)
  useAppZoom()
  const translucentBackground = useTranslucentBackground()

  useEffect(() => {
    let mounted = true
    void window.kuskus.getState().then((result) => {
      if (mounted) {
        setState(
          result.ok ? result.data : { status: 'unavailable', path: '', message: result.error }
        )
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <TooltipProvider>
      {!state ? (
        <LoadingScreen />
      ) : state.status === 'ready' ? (
        <Workspace initialLibrary={state.library} translucentBackground={translucentBackground} />
      ) : (
        <SetupScreen initialState={state} />
      )}
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}

export default App
