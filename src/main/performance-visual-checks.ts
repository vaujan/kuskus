import { writeFile } from 'node:fs/promises'
import type { BrowserWindow } from 'electron'
import { writePerformanceEvent } from './performance-log'

// Explicit benchmark-only visual checks. Changing the fixture profile never changes the user's profile.
export async function capturePerformanceScreenshots(window: BrowserWindow): Promise<void> {
  const output = process.env.KUSU_PERFORMANCE_OUTPUT
  if (!output || process.env.KUSU_PERFORMANCE_SCREENSHOTS !== '1') return
  const previous: string | null = await window.webContents.executeJavaScript(
    "localStorage.getItem('kusu-color-mode')"
  )
  const pause = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 200))
  const setMode = async (mode: string | null): Promise<void> => {
    await window.webContents.executeJavaScript(`(() => {
      const value = ${JSON.stringify(mode)};
      if (value === null) localStorage.removeItem('kusu-color-mode'); else localStorage.setItem('kusu-color-mode', value);
      window.dispatchEvent(new StorageEvent('storage', { key: 'kusu-color-mode', newValue: value, storageArea: localStorage }));
    })()`)
    await pause()
  }
  try {
    for (const mode of ['light', 'dark']) {
      await setMode(mode)
      const dark: boolean = await window.webContents.executeJavaScript(
        "document.documentElement.classList.contains('dark')"
      )
      if (dark !== (mode === 'dark')) throw new Error('The fixture theme did not update.')
      const screenshot = await window.capturePage()
      if (screenshot.isEmpty()) throw new Error('The fixture screenshot was empty.')
      const path = `${output}.${process.env.KUSU_PERFORMANCE_RUN ?? '1'}.${mode}.png`
      await writeFile(path, screenshot.toPNG())
      writePerformanceEvent('screenshot', { mode, path })
    }
    const protocol = window.webContents.debugger
    protocol.attach('1.3')
    try {
      await protocol.sendCommand('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
      })
      const reduced: boolean = await window.webContents.executeJavaScript(
        "matchMedia('(prefers-reduced-motion: reduce)').matches"
      )
      if (!reduced) throw new Error('Reduced motion emulation did not apply.')
      await window.webContents.executeJavaScript(`(() => {
        const root = [...document.querySelectorAll('[data-virtual-list]')].find(el => el.getBoundingClientRect().height > 0);
        const scroller = root.closest('[data-slot="scroll-area-viewport"]');
        scroller.scrollTop += 600;
      })()`)
      await pause()
      writePerformanceEvent('reduced-motion', { verified: true })
    } finally {
      await protocol.sendCommand('Emulation.setEmulatedMedia', { features: [] })
      protocol.detach()
    }
  } finally {
    await setMode(previous)
  }
}
