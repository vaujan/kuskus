import { useEffect, useMemo, useState } from 'react'

import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { SpellingLanguagesStatus } from '../../../../shared/window-contract'

const languageNames = new Intl.DisplayNames(['en'], { type: 'language' })

function labelFor(code: string): string {
  return languageNames.of(code) ?? code
}

export function SpellingLanguages(): React.JSX.Element {
  const [status, setStatus] = useState<SpellingLanguagesStatus | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let active = true
    void window.electron.window.getSpellingLanguages().then(
      (next) => {
        if (active) setStatus(next)
      },
      () => {
        if (active) setError('Spelling languages are unavailable.')
      }
    )
    const unsubscribe = window.electron.window.onSpellingLanguagesChanged((next) => setStatus(next))
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const languages = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return [...(status?.available ?? [])]
      .sort((left, right) => labelFor(left).localeCompare(labelFor(right)))
      .filter((code) => `${labelFor(code)} ${code}`.toLocaleLowerCase().includes(normalized))
  }, [query, status?.available])

  const setSelected = async (code: string, checked: boolean): Promise<void> => {
    if (!status || pending) return
    const selected = checked
      ? [...status.selected, code]
      : status.selected.filter((language) => language !== code)
    if (selected.length === 0) {
      setError('Keep at least one spelling language selected.')
      return
    }
    setPending(true)
    setError('')
    try {
      setStatus(await window.electron.window.setSpellingLanguages(selected))
    } catch {
      setError('Could not update spelling languages.')
    } finally {
      setPending(false)
    }
  }

  return (
    <FieldSet className="gap-3">
      <FieldLegend variant="label">Spelling languages</FieldLegend>
      <FieldDescription>
        Check notes with all selected dictionaries. You can write in different languages without
        switching between notes. New dictionaries may need a one-time download.
      </FieldDescription>
      {status?.managedBySystem ? (
        <p className="text-sm text-muted-foreground">
          macOS manages spelling languages in System Settings.
        </p>
      ) : (
        <div className="rounded-xl bg-card/70 p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.08)]">
          <Input
            aria-label="Search spelling languages"
            placeholder="Search languages…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="mt-2 flex flex-col gap-1">
            {languages.map((code) => (
              <Field key={code} orientation="horizontal" className="min-h-10 px-2 py-1.5">
                <FieldContent className="min-w-0 flex-row items-baseline gap-2">
                  <FieldLabel htmlFor={`spelling-${code}`}>{labelFor(code)}</FieldLabel>
                  <FieldDescription className="shrink-0 text-xs">{code}</FieldDescription>
                </FieldContent>
                <Checkbox
                  id={`spelling-${code}`}
                  checked={status?.selected.includes(code) ?? false}
                  disabled={pending}
                  onCheckedChange={(checked) => void setSelected(code, checked === true)}
                />
              </Field>
            ))}
            {status && languages.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">No matching languages.</p>
            ) : null}
            {!status ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">Loading languages…</p>
            ) : null}
          </div>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </FieldSet>
  )
}
