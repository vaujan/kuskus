import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

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

  const setSetting = useCallback(<T extends SettingValue>(key: SettingKey, value: T): void => {
    const definition = findSetting<T>(key)
    if (definition.validate && !definition.validate(value)) return
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
