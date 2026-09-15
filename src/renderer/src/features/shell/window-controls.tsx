import { useEffect, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

const WINDOWS_CAPTION_GLYPHS = {
  minimize: '\uE921',
  maximize: '\uE922',
  restore: '\uE923',
  close: '\uE8BB'
} as const

export function CaptionTileButton({
  label,
  onClick,
  close = false,
  disabled = false,
  className,
  children
}: {
  label: string
  onClick?: () => void
  close?: boolean
  disabled?: boolean
  className?: string
  children?: ReactNode
}): React.JSX.Element {
  return (
    <button
      className={cn(
        'grid h-full w-[46px] shrink-0 place-items-center border-0 bg-transparent p-0 text-foreground outline-none',
        'hover:bg-black/[0.06] active:bg-black/[0.12] dark:hover:bg-white/[0.08] dark:active:bg-white/[0.12]',
        'focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]',
        close &&
          'hover:bg-[#c42b1c] hover:text-white active:bg-[#a4262c] active:text-white dark:hover:bg-[#c42b1c] dark:active:bg-[#a4262c]',
        disabled && 'pointer-events-none opacity-40',
        className
      )}
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="grid place-items-center" aria-hidden="true">
        {children}
      </span>
    </button>
  )
}

function CaptionButton({
  label,
  glyph,
  close = false,
  onClick
}: {
  label: string
  glyph: ReactNode
  close?: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <CaptionTileButton label={label} close={close} onClick={onClick}>
      <span className="windows-caption-glyph grid place-items-center" aria-hidden="true">
        {glyph}
      </span>
    </CaptionTileButton>
  )
}

export function WindowControls({
  onClose
}: { onClose?: () => void } = {}): React.JSX.Element | null {
  const isWindows = window.electron.window.platform === 'win32'
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (!isWindows) return

    let mounted = true
    void window.electron.window.isMaximized().then((value) => {
      if (mounted) setIsMaximized(value)
    })
    const unsubscribe = window.electron.window.onMaximizedChange(setIsMaximized)
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [isWindows])

  if (!isWindows) return null

  return (
    <div className="flex h-10 self-stretch [-webkit-app-region:no-drag]">
      <CaptionButton
        label="Minimize window"
        glyph={WINDOWS_CAPTION_GLYPHS.minimize}
        onClick={window.electron.window.minimize}
      />
      <CaptionButton
        label={isMaximized ? 'Restore window' : 'Maximize window'}
        glyph={isMaximized ? WINDOWS_CAPTION_GLYPHS.restore : WINDOWS_CAPTION_GLYPHS.maximize}
        onClick={window.electron.window.toggleMaximize}
      />
      <CaptionButton
        close
        label="Close window"
        glyph={WINDOWS_CAPTION_GLYPHS.close}
        onClick={onClose ?? window.electron.window.close}
      />
    </div>
  )
}
