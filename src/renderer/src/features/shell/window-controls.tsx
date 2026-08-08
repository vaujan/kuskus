import { useEffect, useState, type ReactNode } from 'react'
import {
  IconCopy as Copy,
  IconMinus as Minus,
  IconSquare as Square,
  IconX as X
} from '@tabler/icons-react'

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
  useWindowsGlyph,
  close = false,
  onClick
}: {
  label: string
  glyph: ReactNode
  useWindowsGlyph: boolean
  close?: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <CaptionTileButton label={label} close={close} onClick={onClick}>
      <span
        className={cn('grid place-items-center', useWindowsGlyph && 'windows-caption-glyph')}
        aria-hidden="true"
      >
        {glyph}
      </span>
    </CaptionTileButton>
  )
}

export function WindowControls({
  onClose
}: { onClose?: () => void } = {}): React.JSX.Element | null {
  const isMac = window.electron.window.platform === 'darwin'
  const isWindows = window.electron.window.platform === 'win32'
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
    <div className="flex h-10 self-stretch [-webkit-app-region:no-drag]">
      <CaptionButton
        label="Minimize window"
        glyph={isWindows ? WINDOWS_CAPTION_GLYPHS.minimize : <Minus className="size-4" />}
        useWindowsGlyph={isWindows}
        onClick={window.electron.window.minimize}
      />
      <CaptionButton
        label={isMaximized ? 'Restore window' : 'Maximize window'}
        glyph={
          isWindows ? (
            isMaximized ? (
              WINDOWS_CAPTION_GLYPHS.restore
            ) : (
              WINDOWS_CAPTION_GLYPHS.maximize
            )
          ) : isMaximized ? (
            <Copy className="size-4" />
          ) : (
            <Square className="size-4" />
          )
        }
        useWindowsGlyph={isWindows}
        onClick={window.electron.window.toggleMaximize}
      />
      <CaptionButton
        close
        label="Close window"
        glyph={isWindows ? WINDOWS_CAPTION_GLYPHS.close : <X className="size-4" />}
        useWindowsGlyph={isWindows}
        onClick={onClose ?? window.electron.window.close}
      />
    </div>
  )
}
