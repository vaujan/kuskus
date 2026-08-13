import { useEffect, useState } from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/features/shell/app-toaster'
import { LoadingScreen } from '@/app/loading-screen'
import { SetupScreen } from '@/features/library/setup-screen'
import { Workspace } from '@/features/library/workspace'
import { expandLibraryOverview } from '@/features/library/library-overview'
import { useAppZoom } from '@/hooks/use-app-zoom'
import { useTranslucentBackground } from '@/hooks/use-translucent-background'
import type { LibraryState } from '../../shared/library-contract'

function App(): React.JSX.Element {
  const [state, setState] = useState<LibraryState | null>(null)
  useAppZoom()
  const translucentBackground = useTranslucentBackground()

  useEffect(() => {
    let mounted = true
    void window.kuskus.getOverview().then((result) => {
      if (mounted) {
        performance.mark('kuskus:library-state-received')
        performance.measure(
          'kuskus:renderer-entry-to-library-state',
          'kuskus:renderer-entry',
          'kuskus:library-state-received'
        )
        setState(
          result.ok
            ? expandLibraryOverview(result.data)
            : { status: 'unavailable', path: '', message: result.error }
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
