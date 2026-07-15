import { useEffect, useState } from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'
import { LoadingScreen } from '@/app/loading-screen'
import { SetupScreen } from '@/features/library/setup-screen'
import { Workspace } from '@/features/library/workspace'
import type { LibraryState } from '../../shared/library-contract'

function App(): React.JSX.Element {
  const [state, setState] = useState<LibraryState | null>(null)

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
        <Workspace initialLibrary={state.library} />
      ) : (
        <SetupScreen initialState={state} />
      )}
    </TooltipProvider>
  )
}

export default App
