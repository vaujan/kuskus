import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

import { applyTheme, resolveAppliedTheme } from '@/hooks/theme'
import { SETTINGS_SCHEMA, findSetting, type SettingKey, type SettingValue } from './settings-schema'

// Split into a values context and a stable dispatch context (Redux-style) so
// useSetting can return a referentially stable setter — matching the stability
// of useState setters — while still reading fresh values every render.
const SettingsValuesContext = createContext<Record<string, SettingValue> | null>(null)
const SettingsDispatchContext = createContext<
  (<T extends SettingValue>(key: SettingKey, value: T) => void) | null
>(null)

export function SettingsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [values, setValues] = useState<Record<string, SettingValue>>(() => {
    const hydrated: Record<string, SettingValue> = {}
    for (const definition of SETTINGS_SCHEMA) {
      try {
        hydrated[definition.key] = definition.parse(localStorage.getItem(definition.storageKey))
      } catch {
        hydrated[definition.key] = definition.default
      }
    }
    return hydrated
  })

  useEffect(() => {
    for (const definition of SETTINGS_SCHEMA) {
      const value = values[definition.key]
      if (value === undefined) continue
      try {
        localStorage.setItem(definition.storageKey, String(value))
      } catch {
        // Storage can be unavailable (private mode, quota); the in-memory value still applies.
      }
    }
  }, [values])

  // The theme preference is the one setting with a DOM side effect. Apply it
  // here so every surface (main window, note window, quick capture) stays in
  // sync with the stored value, including live OS changes when set to
  // 'system'. main.tsx still applies the stored theme once at startup to
  // avoid a flash before this provider mounts.
  const theme = values.theme
  useEffect(() => {
    const apply = (): void => applyTheme(resolveAppliedTheme(theme as 'dark' | 'light' | 'system'))
    apply()
    if (theme !== 'system') return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => apply()
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [theme])

  const setSetting = useCallback(<T extends SettingValue>(key: SettingKey, value: T): void => {
    // Reject unknown keys instead of silently storing values no consumer reads.
    void findSetting<T>(key)
    setValues((current) => ({ ...current, [key]: value }))
  }, [])

  return (
    <SettingsValuesContext.Provider value={values}>
      <SettingsDispatchContext.Provider value={setSetting}>
        {children}
      </SettingsDispatchContext.Provider>
    </SettingsValuesContext.Provider>
  )
}

export function useSetting<T extends SettingValue>(key: SettingKey): [T, (value: T) => void] {
  const values = useContext(SettingsValuesContext)
  const setSetting = useContext(SettingsDispatchContext)
  if (!values || !setSetting) throw new Error('useSetting must be used within a SettingsProvider')
  const rawValue = values[key]
  const value = (rawValue === undefined ? findSetting<T>(key).default : rawValue) as T
  const setValue = useCallback((nextValue: T) => setSetting(key, nextValue), [setSetting, key])
  return [value, setValue]
}
