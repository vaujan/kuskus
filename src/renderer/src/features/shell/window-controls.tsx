import { useEffect, useState } from 'react'
import {
  IconCopy as Copy,
  IconMinus as Minus,
  IconSquare as Square,
  IconX as X
} from '@tabler/icons-react'

import { Button } from '@/components/ui/button'

export function WindowControls(): React.JSX.Element | null {
  const isMac = window.electron.window.platform === 'darwin'
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (isMac) return

    let mounted = true
    void window.electron.window.isMaximized().then((value) => {
      if (mounted) setIsMaximized(value)
    })
    const unsubscribe = window.electron.window.onMaximizedChange(setIsMaximized)
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [isMac])

  if (isMac) return null

  return (
    <div className="flex h-full self-stretch [-webkit-app-region:no-drag]">
      <Button
        className="h-full w-12 rounded-none"
        size="icon"
        variant="ghost"
        type="button"
        aria-label="Minimize window"
        onClick={window.electron.window.minimize}
      >
        <Minus aria-hidden="true" />
      </Button>
      <Button
        className="h-full w-12 rounded-none"
        size="icon"
        variant="ghost"
        type="button"
        aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
        onClick={window.electron.window.toggleMaximize}
      >
        {isMaximized ? <Copy aria-hidden="true" /> : <Square aria-hidden="true" />}
      </Button>
      <Button
        className="h-full w-12 rounded-none"
        size="icon"
        variant="ghost"
        type="button"
        aria-label="Close window"
        onClick={window.electron.window.close}
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  )
}
