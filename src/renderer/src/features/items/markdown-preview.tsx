import {
  Children,
  cloneElement,
  isValidElement,
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import { cn } from '@/lib/utils'
import { useNoteAttachmentPreviews } from '@/features/items/use-note-attachment-previews'
import type { NoteAttachmentDto } from '../../../../shared/library-contract'
import { markdownImageTargetKey } from '../../../../shared/markdown-image-references'
import { prepareObsidianMarkdown } from '@/features/items/obsidian-markdown'
import { MarkdownCodeBlock, MarkdownCodeCardHeader } from '@/features/items/markdown-code-block'
import {
  decodeMarkdownLinkTarget,
  setMarkdownTaskChecked
} from '@/features/items/markdown-formatting'

const REMARK_PLUGINS = [remarkGfm, remarkBreaks, remarkMath]
const REHYPE_PLUGINS = [rehypeKatex]

function katexSource(node: React.ReactNode): string | null {
  if (!isValidElement<{ children?: React.ReactNode; encoding?: string }>(node)) return null
  if (node.type === 'annotation' && node.props.encoding === 'application/x-tex') {
    return Children.toArray(node.props.children).join('')
  }
  for (const child of Children.toArray(node.props.children)) {
    const source = katexSource(child)
    if (source !== null) return source
  }
  return null
}

function extractTaskCheckbox(node: React.ReactNode): {
  checkbox: React.ReactNode
  rest: React.ReactNode
} {
  if (isValidElement<{ children?: React.ReactNode; type?: string }>(node)) {
    if (node.props.type === 'checkbox') {
      return { checkbox: node, rest: null }
    }
    let checkbox: React.ReactNode = null
    const rest = Children.map(node.props.children, (child) => {
      if (checkbox !== null) return child
      const result = extractTaskCheckbox(child)
      if (result.checkbox !== null) checkbox = result.checkbox
      return result.rest
    })
    return { checkbox, rest: cloneElement(node, {}, rest) }
  }
  if (Array.isArray(node)) {
    let checkbox: React.ReactNode = null
    const rest = Children.map(node, (child) => {
      if (checkbox !== null) return child
      const result = extractTaskCheckbox(child)
      if (result.checkbox !== null) checkbox = result.checkbox
      return result.rest
    })
    return { checkbox, rest }
  }
  return { checkbox: null, rest: node }
}

function MarkdownImage({
  src,
  alt,
  width,
  height,
  interactive,
  remote = false
}: {
  src: string
  alt: string
  width?: number
  height?: number
  interactive: boolean
  remote?: boolean
}): React.JSX.Element {
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    if (!zoomed) return
    const close = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setZoomed(false)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [zoomed])

  return (
    <button
      type="button"
      className="not-typeset kuskus-markdown-image-button"
      data-not-typeset
      data-zoomed={zoomed}
      disabled={!interactive}
      aria-label={`${zoomed ? 'Close' : 'Zoom'} image${alt ? `: ${alt}` : ''}`}
      aria-pressed={interactive ? zoomed : undefined}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setZoomed((current) => !current)
      }}
    >
      <img
        src={src}
        alt=""
        width={width}
        height={height}
        loading={remote ? 'lazy' : undefined}
        referrerPolicy={remote ? 'no-referrer' : undefined}
        className="kuskus-markdown-image"
      />
      {alt ? <span className="kuskus-markdown-image-caption">{alt}</span> : null}
    </button>
  )
}

function EmbeddedImageState({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span
      className="not-typeset my-3 flex min-h-24 items-center justify-center rounded-lg bg-muted px-4 text-center text-xs text-muted-foreground"
      data-not-typeset
    >
      {children}
    </span>
  )
}

export const MarkdownPreview = memo(function MarkdownPreview({
  value,
  itemId,
  attachments = [],
  attachmentPreviews,
  onOpenLink,
  onOpenVaultLink,
  onChange,
  presentation = 'card'
}: {
  value: string
  itemId?: string
  attachments?: NoteAttachmentDto[]
  attachmentPreviews?: Record<string, string>
  onOpenLink?: (url: string) => void
  onOpenVaultLink?: (target: string) => void
  onChange?: (value: string) => void
  presentation?: 'card' | 'compact' | 'detail'
}): React.JSX.Element {
  const previewRef = useRef<HTMLDivElement>(null)
  const [isClipped, setIsClipped] = useState(false)
  const loadedPreviews = useNoteAttachmentPreviews(
    itemId ?? '',
    itemId ? attachments : [],
    attachmentPreviews === undefined
  )
  const previews = attachmentPreviews ?? loadedPreviews
  const localImages = useMemo(() => {
    const images = new Map<string, { attachment: NoteAttachmentDto; preview: string | null }>()
    for (const attachment of attachments) {
      const value = { attachment, preview: previews[attachment.id] ?? null }
      images.set(markdownImageTargetKey(attachment.relativePath), value)
      images.set(markdownImageTargetKey(attachment.filename), value)
    }
    return images
  }, [attachments, previews])

  useLayoutEffect(() => {
    if (presentation === 'detail') return

    const preview = previewRef.current
    if (!preview) return

    const updateClipped = (): void => {
      setIsClipped(preview.scrollHeight > preview.clientHeight)
    }
    const observer = new ResizeObserver(updateClipped)
    const frame = requestAnimationFrame(updateClipped)

    observer.observe(preview)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [presentation, value])

  const components: Components = {
    ol: ({ className, start = 1, style, ...props }) => (
      <ol
        {...props}
        className={cn('kuskus-rendered-list kuskus-rendered-list--ordered', className)}
        start={start}
        style={
          {
            ...style,
            '--kuskus-list-start': start
          } as React.CSSProperties
        }
      />
    ),
    ul: ({ className, ...props }) => (
      <ul
        {...props}
        className={cn('kuskus-rendered-list kuskus-rendered-list--bullet', className)}
      />
    ),
    input: ({ checked }) => (
      <input
        type="checkbox"
        className="kuskus-task-checkbox"
        checked={Boolean(checked)}
        disabled={!onChange}
        aria-label={checked ? 'Completed task' : 'Open task'}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          const root = event.currentTarget.closest('.typeset')
          const checkboxes = [...(root?.querySelectorAll('.kuskus-task-checkbox') ?? [])]
          onChange?.(
            setMarkdownTaskChecked(value, checkboxes.indexOf(event.currentTarget), !checked)
          )
        }}
      />
    ),
    li: ({ className, children, ...props }) => {
      if (
        !String(className ?? '')
          .split(/\s+/)
          .includes('task-list-item')
      ) {
        return (
          <li className={className} {...props}>
            <div className="kuskus-list-content">{children}</div>
          </li>
        )
      }
      const { checkbox, rest } = extractTaskCheckbox(children)
      if (checkbox === null) {
        return (
          <li className={className} {...props}>
            {children}
          </li>
        )
      }
      const checked =
        isValidElement<{ checked?: boolean }>(checkbox) && checkbox.props.checked === true
      return (
        <li className={className} {...props}>
          <span className="kuskus-task-marker">{checkbox}</span>
          <div
            className={cn(
              'kuskus-list-content kuskus-rich-task-content',
              checked && 'kuskus-task-checked'
            )}
          >
            {rest}
          </div>
        </li>
      )
    },
    a: ({ href, children, ...props }) => {
      if (href?.startsWith('kuskus-note:')) {
        const target = decodeMarkdownLinkTarget(href.slice('kuskus-note:'.length))
        return (
          <a
            {...props}
            href={href}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              if (target !== null) onOpenVaultLink?.(target)
            }}
          >
            {children}
          </a>
        )
      }
      if (!href || !/^https?:\/\//i.test(href)) return <span>{children}</span>
      return (
        <a
          {...props}
          href={href}
          className="transition-[opacity] [transition-duration:var(--motion-duration-press)] [transition-timing-function:var(--motion-ease-out)] active:opacity-60"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onOpenLink?.(href)
          }}
        >
          {children}
        </a>
      )
    },
    img: ({ src, alt }) => {
      const source = typeof src === 'string' ? src : ''
      const local = localImages.get(markdownImageTargetKey(source))
      if (local) {
        if (local.attachment.missingContent) {
          return (
            <EmbeddedImageState>
              Image missing: {alt || local.attachment.filename}
            </EmbeddedImageState>
          )
        }
        if (!local.preview) return <EmbeddedImageState>Loading image…</EmbeddedImageState>
        return (
          <MarkdownImage
            src={local.preview}
            alt={alt ?? local.attachment.filename}
            width={local.attachment.width}
            height={local.attachment.height}
            interactive={presentation === 'detail'}
          />
        )
      }
      if (/^https?:\/\//i.test(source)) {
        return (
          <MarkdownImage
            src={source}
            alt={alt ?? ''}
            interactive={presentation === 'detail'}
            remote
          />
        )
      }
      return <code>{source || alt || 'Invalid image'}</code>
    },
    pre: ({ children }) => {
      const child = Children.toArray(children)[0]
      if (!isValidElement<{ className?: string; children?: React.ReactNode }>(child)) {
        return <pre>{children}</pre>
      }
      const language = /(?:^|\s)language-([^\s]+)/.exec(child.props.className ?? '')?.[1] ?? ''
      return (
        <MarkdownCodeBlock
          code={String(child.props.children ?? '').replace(/\n$/, '')}
          language={language}
          diagrams={presentation === 'detail'}
        />
      )
    },
    span: ({ node, children, className, ...props }) => {
      void node
      if (className?.split(/\s+/).includes('katex-display')) {
        const source = katexSource(children) ?? ''
        return (
          <div className="kuskus-code-block not-typeset" data-not-typeset>
            <MarkdownCodeCardHeader code={source} label="Math" />
            <div className="kuskus-math-block-body">
              <span {...props} className={className}>
                {children}
              </span>
            </div>
          </div>
        )
      }
      return (
        <span {...props} className={className}>
          {children}
        </span>
      )
    },
    table: ({ children, className, ...props }) => (
      <div className="typeset-scroll kuskus-markdown-table-scroll">
        <table {...props} className={cn('kuskus-markdown-table', className)}>
          {children}
        </table>
      </div>
    )
  }

  return (
    <div
      ref={previewRef}
      className={cn(
        'relative',
        presentation === 'card' && 'max-h-80 overflow-hidden',
        presentation === 'compact' && 'max-h-[13.25rem] overflow-hidden',
        presentation !== 'detail' && isClipped && 'kuskus-card-content-fade'
      )}
    >
      <div className="typeset kuskus-typeset" data-typeset-presentation={presentation}>
        <ReactMarkdown
          remarkPlugins={REMARK_PLUGINS}
          rehypePlugins={REHYPE_PLUGINS}
          components={components}
          urlTransform={(url) => (url.startsWith('kuskus-note:') ? url : defaultUrlTransform(url))}
        >
          {prepareObsidianMarkdown(value, attachments)}
        </ReactMarkdown>
      </div>
    </div>
  )
})
