import { startTransition, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { LibraryDto } from '../../../../shared/library-contract'
import { UrlEnrichmentQueue } from './url-enrichment-queue'

export function useUrlEnrichment(
  library: LibraryDto,
  setLibrary: Dispatch<SetStateAction<LibraryDto>>
): void {
  const queueRef = useRef<UrlEnrichmentQueue | null>(null)
  useEffect(() => {
    const libraryId = library.id
    const queue = new UrlEnrichmentQueue(
      (id) => window.kusu.enrichUrl(id),
      (items) => {
        const changed = new Map(items.map((item) => [item.id, item]))
        startTransition(() =>
          setLibrary((current) => {
            if (current.id !== libraryId) return current
            return {
              ...current,
              items: current.items.map((item) => {
                const update = changed.get(item.id)
                if (
                  !update ||
                  item.type !== 'url' ||
                  item.sourceUrl !== update.sourceUrl ||
                  item.relativePath !== update.relativePath ||
                  item.updatedAt > update.updatedAt
                )
                  return item
                return update
              })
            }
          })
        )
      }
    )
    queueRef.current = queue
    const defer = (): void => queue.deferForInteraction()
    const events = [
      'pointerdown',
      'click',
      'keydown',
      'input',
      'wheel',
      'touchmove',
      'scroll'
    ] as const
    for (const event of events)
      window.addEventListener(event, defer, { capture: true, passive: true })
    return () => {
      for (const event of events) window.removeEventListener(event, defer, { capture: true })
      queue.dispose()
      queueRef.current = null
    }
  }, [library.id, setLibrary])
  useEffect(() => {
    queueRef.current?.sync(library.items)
  }, [library.id, library.items])
}
