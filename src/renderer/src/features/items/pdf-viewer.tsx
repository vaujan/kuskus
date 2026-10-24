import { useEffect, useRef, useState } from 'react'
import {
  AnnotationMode,
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentLoadingTask
} from 'pdfjs-dist'
import {
  EventBus,
  PDFFindController,
  PDFLinkService,
  PDFViewer
} from 'pdfjs-dist/web/pdf_viewer.mjs'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import 'pdfjs-dist/web/pdf_viewer.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

GlobalWorkerOptions.workerSrc = workerUrl

export default function PdfReader({
  itemId,
  title
}: {
  itemId: string
  title: string
}): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<PDFViewer | null>(null)
  const busRef = useRef<EventBus | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  const [scale, setScale] = useState(80)
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const container = containerRef.current!
    const abort = new AbortController()
    const eventBus = new EventBus()
    const linkService = new PDFLinkService({ eventBus })
    // External URLs are not opened from document-controlled annotations.
    linkService.externalLinkEnabled = false
    const findController = new PDFFindController({ eventBus, linkService })
    const options = {
      container,
      eventBus,
      linkService,
      findController,
      annotationMode: AnnotationMode.ENABLE,
      abortSignal: abort.signal
    }
    const viewer = new PDFViewer(options)
    viewerRef.current = viewer
    busRef.current = eventBus
    linkService.setViewer(viewer)
    const resizeObserver = new ResizeObserver(() => {
      if (!viewer.pagesCount) return
      const scaleValue = viewer.currentScaleValue
      if (['page-width', 'page-fit', 'auto'].includes(scaleValue)) {
        viewer.currentScaleValue = scaleValue
      }
      viewer.update()
    })
    resizeObserver.observe(container)
    let task: PDFDocumentLoadingTask | undefined
    eventBus.on('pagesinit', () => {
      if (abort.signal.aborted) return
      viewer.currentScale = 0.8
      setPages(viewer.pagesCount)
    })
    eventBus.on('pagechanging', ({ pageNumber }: { pageNumber: number }) => {
      if (!abort.signal.aborted) setPage(pageNumber)
    })
    eventBus.on('scalechanging', ({ scale }: { scale: number }) => {
      if (!abort.signal.aborted) setScale(Math.round(scale * 100))
    })
    const updateMatches = ({
      matchesCount
    }: {
      matchesCount: { current: number; total: number }
    }): void => {
      if (!abort.signal.aborted) setMatches(`${matchesCount.current} of ${matchesCount.total}`)
    }
    eventBus.on('updatefindmatchescount', updateMatches)
    eventBus.on('updatefindcontrolstate', updateMatches)
    eventBus.on('pagerendered', ({ error }: { error?: Error }) => {
      if (error && !abort.signal.aborted) setError('This PDF page could not be rendered.')
    })
    void (async () => {
      const result = await window.kuskus.getPdfPreview(itemId)
      if (abort.signal.aborted) return
      if (!result.ok) throw new Error(result.error)
      const assets = new URL(`${import.meta.env.BASE_URL}pdfjs/`, window.location.href).href
      task = getDocument({
        data: new Uint8Array(result.data),
        cMapUrl: `${assets}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${assets}standard_fonts/`,
        wasmUrl: `${assets}wasm/`,
        iccUrl: `${assets}iccs/`
      })
      const pdf = await task.promise
      if (abort.signal.aborted) return
      linkService.setDocument(pdf)
      viewer.setDocument(pdf)
    })().catch((reason: unknown) => {
      if (!abort.signal.aborted)
        setError(reason instanceof Error ? reason.message : 'The PDF could not be opened.')
    })
    return () => {
      abort.abort()
      resizeObserver.disconnect()
      eventBus.dispatch('findbarclose', { source: container })
      viewer.setDocument(null)
      linkService.setDocument(null)
      viewerRef.current = null
      busRef.current = null
      void task?.destroy()
    }
  }, [itemId])

  const find = (value: string, again = false, previous = false): void => {
    busRef.current?.dispatch('find', {
      source: searchRef.current,
      type: again ? 'again' : '',
      query: value,
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
      findPrevious: previous,
      matchDiacritics: false
    })
  }

  return (
    <section
      aria-label={`PDF reader: ${title}`}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/25"
      onKeyDown={(event) => {
        // Keep reader navigation from switching library items in the parent dialog.
        if (
          [
            'ArrowLeft',
            'ArrowRight',
            'ArrowUp',
            'ArrowDown',
            'PageUp',
            'PageDown',
            'Home',
            'End'
          ].includes(event.key)
        )
          event.stopPropagation()
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
          event.preventDefault()
          event.stopPropagation()
          searchRef.current?.focus()
          searchRef.current?.select()
        }
      }}
    >
      <div
        role="group"
        aria-label="PDF controls"
        className="flex flex-wrap items-center gap-1 border-b border-border p-2 pr-14"
      >
        <Button
          variant="ghost"
          size="sm"
          disabled={!pages || page <= 1}
          onClick={() => viewerRef.current?.previousPage()}
          aria-label="Previous PDF page"
        >
          Previous
        </Button>
        <Input
          key={page}
          aria-label="PDF page number"
          className="w-16"
          type="number"
          min={1}
          max={pages || 1}
          disabled={!pages}
          defaultValue={page}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            const number = Number(event.currentTarget.value)
            if (Number.isInteger(number) && number >= 1 && number <= pages && viewerRef.current)
              viewerRef.current.currentPageNumber = number
          }}
          onBlur={(event) => {
            const number = Number(event.currentTarget.value)
            if (Number.isInteger(number) && number >= 1 && number <= pages && viewerRef.current)
              viewerRef.current.currentPageNumber = number
            else event.currentTarget.value = String(page)
          }}
        />
        <span className="px-1 text-xs text-muted-foreground tabular-nums">/ {pages}</span>
        <Button
          variant="ghost"
          size="sm"
          disabled={!pages || page >= pages}
          onClick={() => viewerRef.current?.nextPage()}
          aria-label="Next PDF page"
        >
          Next
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!pages || scale <= 25}
          onClick={() => {
            if (viewerRef.current)
              viewerRef.current.currentScale = Math.max(0.25, viewerRef.current.currentScale / 1.25)
          }}
          aria-label="Zoom out"
        >
          −
        </Button>
        <span className="text-xs tabular-nums" aria-label="PDF zoom">
          {scale}%
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={!pages || scale >= 400}
          onClick={() => {
            if (viewerRef.current)
              viewerRef.current.currentScale = Math.min(4, viewerRef.current.currentScale * 1.25)
          }}
          aria-label="Zoom in"
        >
          +
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!pages}
          onClick={() => {
            if (viewerRef.current) viewerRef.current.currentScaleValue = 'page-width'
          }}
        >
          Fit width
        </Button>
        <Input
          ref={searchRef}
          aria-label="Find in PDF"
          placeholder="Find in PDF…"
          className="min-w-32 flex-1"
          disabled={!pages}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setMatches('')
            find(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              find(query, true, event.shiftKey)
            }
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          disabled={!pages || !query}
          onClick={() => find(query, true, true)}
          aria-label="Previous search match"
        >
          ↑
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!pages || !query}
          onClick={() => find(query, true)}
          aria-label="Next search match"
        >
          ↓
        </Button>
        <span role="status" className="text-xs text-muted-foreground tabular-nums">
          {query ? matches : ''}
        </span>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>PDF preview unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : !pages ? (
        <p role="status" className="p-4 text-sm text-muted-foreground">
          Loading PDF…
        </p>
      ) : null}
      <div className="relative min-h-0 flex-1">
        <div
          ref={containerRef}
          tabIndex={0}
          aria-label="PDF pages"
          className="absolute inset-0 overflow-auto outline-none"
        >
          <div className="pdfViewer" />
        </div>
      </div>
    </section>
  )
}
