import { readJson, writeJsonAtomic } from '../library/storage/json-file'

interface CaptureShortcutSettings {
  accelerator: string | null
}

/**
 * Persists the global capture shortcut accelerator in its own settings file.
 * Kept separate from kuskus-settings.json (which the library service owns) so
 * neither store can clobber the other's fields.
 */
export class CaptureShortcutStore {
  constructor(private readonly settingsPath: string) {}

  async load(): Promise<string | null> {
    try {
      const settings = await readJson<CaptureShortcutSettings>(this.settingsPath)
      return typeof settings.accelerator === 'string' && settings.accelerator
        ? settings.accelerator
        : null
    } catch {
      return null
    }
  }

  async save(accelerator: string): Promise<void> {
    try {
      await writeJsonAtomic(this.settingsPath, { accelerator })
    } catch {
      // Persistence is best-effort; the live shortcut still works for this session.
    }
  }
}
