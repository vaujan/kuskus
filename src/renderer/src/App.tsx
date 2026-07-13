import { useEffect, useMemo, useState } from 'react'
import {
  AppWindow,
  Bell,
  Check,
  ChevronDown,
  Copy,
  FolderKanban,
  Gauge,
  Laptop,
  Minus,
  Moon,
  PanelLeft,
  Plus,
  Settings,
  Sparkles,
  Square,
  Sun,
  X
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type Theme = 'dark' | 'light' | 'system'

const navItems = [
  { label: 'Overview', icon: Gauge, active: true },
  { label: 'Projects', icon: FolderKanban },
  { label: 'Activity', icon: Bell },
  { label: 'Settings', icon: Settings }
]

const themeOptions: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Laptop }
]

function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'light' || saved === 'system' || saved === 'dark' ? saved : 'dark'
  })

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateDocumentTheme = (): void => {
      const isDark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', isDark)
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
    }

    localStorage.setItem('theme', theme)
    updateDocumentTheme()
    media.addEventListener('change', updateDocumentTheme)
    return () => media.removeEventListener('change', updateDocumentTheme)
  }, [theme])

  return [theme, setTheme]
}

function TitleBar(): React.JSX.Element {
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

  return (
    <header
      className={cn(
        'window-drag flex h-10 shrink-0 items-center border-b bg-background/95',
        isMac && 'pl-20'
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
        <AppWindow className="size-4 text-primary" aria-hidden="true" />
        <span className="truncate text-xs font-medium text-muted-foreground">
          Electron shadcn Starter
        </span>
      </div>
      {!isMac && (
        <div className="window-no-drag flex h-full">
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
            {isMaximized ? (
              <Copy className="rotate-180" aria-hidden="true" />
            ) : (
              <Square aria-hidden="true" />
            )}
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
      )}
    </header>
  )
}

function ThemeMenu({
  theme,
  onThemeChange
}: {
  theme: Theme
  onThemeChange: (theme: Theme) => void
}): React.JSX.Element {
  const current = useMemo(
    () => themeOptions.find((option) => option.value === theme) ?? themeOptions[0],
    [theme]
  )
  const CurrentIcon = current.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="w-full justify-start gap-2 px-2 sidebar-button" variant="ghost">
          <CurrentIcon aria-hidden="true" />
          <span className="nav-label flex-1 text-left">{current.label} theme</span>
          <ChevronDown className="nav-label size-3.5 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" className="w-44">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => onThemeChange(value as Theme)}
        >
          {themeOptions.map((option) => {
            const Icon = option.icon
            return (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                <Icon aria-hidden="true" />
                {option.label}
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function App(): React.JSX.Element {
  const [theme, setTheme] = useTheme()

  return (
    <TooltipProvider>
      <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
        <TitleBar />
        <div className="flex min-h-0 flex-1">
          <aside className="desktop-sidebar flex w-56 shrink-0 flex-col border-r bg-sidebar/70 p-3 text-sidebar-foreground">
            <div className="flex h-10 items-center gap-2 px-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Sparkles className="size-4" aria-hidden="true" />
              </div>
              <div className="nav-label min-w-0">
                <p className="truncate text-sm font-semibold">Vega Desktop</p>
                <p className="truncate text-[11px] text-muted-foreground">Starter workspace</p>
              </div>
            </div>

            <Separator className="my-3" />
            <nav className="flex flex-1 flex-col gap-1" aria-label="Primary navigation">
              {navItems.map((item) => {
                const Icon = item.icon
                const button = (
                  <Button
                    key={item.label}
                    className={cn(
                      'w-full justify-start px-2 sidebar-button',
                      item.active && 'bg-sidebar-accent text-sidebar-accent-foreground'
                    )}
                    variant="ghost"
                  >
                    <Icon aria-hidden="true" />
                    <span className="nav-label">{item.label}</span>
                  </Button>
                )

                return (
                  <Tooltip key={item.label}>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent className="sidebar-tooltip" side="right">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </nav>

            <Separator className="my-3" />
            <ThemeMenu theme={theme} onThemeChange={setTheme} />
          </aside>

          <main className="min-w-0 flex-1 overflow-auto">
            <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-6 p-6 lg:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="secondary">Desktop starter</Badge>
                    <span className="text-xs text-muted-foreground">Electron + React + shadcn</span>
                  </div>
                  <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                    Welcome to your workspace
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    A secure, dark-first foundation with native window controls and the cyan Vega
                    design system.
                  </p>
                </div>
                <Button>
                  <Plus data-icon="inline-start" aria-hidden="true" />
                  New project
                </Button>
              </div>

              <Card className="relative overflow-hidden">
                <div className="pointer-events-none absolute -top-24 right-0 size-64 rounded-full bg-primary/15 blur-3xl" />
                <CardHeader className="relative">
                  <CardTitle>Everything is wired up</CardTitle>
                  <CardDescription>
                    Start building renderer features while Electron stays behind a narrow, typed
                    preload boundary.
                  </CardDescription>
                  <CardAction>
                    <Badge className="gap-1" variant="outline">
                      <Check className="size-3" aria-hidden="true" /> Ready
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="relative grid gap-3 sm:grid-cols-3">
                  {[
                    ['Secure bridge', 'Context isolation on, Node access off.'],
                    ['Theme aware', 'Dark, light, and system modes persist.'],
                    ['Desktop ready', 'Responsive shell with native-feeling chrome.']
                  ].map(([title, description]) => (
                    <div key={title} className="rounded-lg border bg-background/60 p-4">
                      <p className="text-sm font-medium">{title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {description}
                      </p>
                    </div>
                  ))}
                </CardContent>
                <CardFooter className="relative gap-2 border-t">
                  <Button size="sm">Primary action</Button>
                  <Button size="sm" variant="outline">
                    Secondary
                  </Button>
                  <Button size="sm" variant="ghost">
                    Learn more
                  </Button>
                </CardFooter>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>Project activity</CardTitle>
                    <CardDescription>Your starter is ready for its first feature.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 rounded-lg border border-dashed p-3">
                      <PanelLeft className="size-5 text-primary" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">Desktop shell created</p>
                        <p className="truncate text-xs text-muted-foreground">
                          Responsive sidebar and dashboard
                        </p>
                      </div>
                      <Badge variant="outline">Now</Badge>
                    </div>
                  </CardContent>
                </Card>
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>Preset details</CardTitle>
                    <CardDescription>b7BYMJXFK applied through the shadcn CLI.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {['Vega', 'Mist', 'Cyan', 'Inter', 'Lucide'].map((detail) => (
                      <Badge key={detail} variant="secondary">
                        {detail}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default App
