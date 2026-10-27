export type DevReloadAction = 'reset-onboarding' | 'reset-preferences' | 'reload'

export async function runDevReloadAction(
  action: DevReloadAction,
  beforeReload: () => Promise<boolean>
): Promise<void> {
  if (!(await beforeReload())) return
  if (action === 'reset-onboarding') {
    if (!(await window.electron.window.devAction?.('reset-onboarding'))) return
  }
  if (action === 'reset-preferences') localStorage.clear()
  window.location.reload()
}
