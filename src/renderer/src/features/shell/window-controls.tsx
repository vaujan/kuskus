import { useEffect, useState } from 'react'
import { Copy, Minus, Square, X } from 'lucide-react'

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
    <div className="window-no-drag flex h-full self-stretch">
      <button
        className="titlebar-control"
        type="button"
        aria-label="Minimize window"
        onClick={window.electron.window.minimize}
      >
        <Minus aria-hidden="true" />
      </button>
      <button
        className="titlebar-control"
        type="button"
        aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
        onClick={window.electron.window.toggleMaximize}
      >
        {isMaximized ? <Copy aria-hidden="true" /> : <Square aria-hidden="true" />}
      </button>
      <button
        className="titlebar-control titlebar-close"
        type="button"
        aria-label="Close window"
        onClick={window.electron.window.close}
      >
        <X aria-hidden="true" />
      </button>
    </div>
  )
}
