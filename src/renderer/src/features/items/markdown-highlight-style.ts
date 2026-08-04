import { HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'

export const markdownHighlightStyle = HighlightStyle.define([
  {
    tag: tags.heading1,
    color: 'var(--foreground)',
    fontSize: '1.375rem',
    lineHeight: '2rem',
    fontWeight: '600'
  },
  {
    tag: tags.heading2,
    color: 'var(--foreground)',
    fontSize: '1.1875rem',
    lineHeight: '1.75rem',
    fontWeight: '600'
  },
  {
    tag: tags.heading3,
    color: 'var(--foreground)',
    fontSize: '1.0625rem',
    lineHeight: '1.625rem',
    fontWeight: '600'
  },
  {
    tag: [tags.heading4, tags.heading5, tags.heading6],
    color: 'var(--foreground)',
    fontWeight: '600'
  },
  { tag: tags.strong, color: 'var(--foreground)', fontWeight: '600' },
  { tag: tags.emphasis, color: 'var(--foreground)', fontStyle: 'italic' },
  {
    tag: [tags.link, tags.url],
    color: 'var(--foreground)',
    textDecoration: 'underline',
    textDecorationColor: 'color-mix(in oklab, currentColor 35%, transparent)'
  },
  {
    tag: tags.monospace,
    color: 'var(--foreground)',
    backgroundColor: 'var(--muted)',
    borderRadius: '0.25rem'
  },
  { tag: tags.quote, color: 'var(--muted-foreground)', fontStyle: 'italic' },
  { tag: tags.list, color: 'var(--muted-foreground)' },
  {
    tag: [tags.meta, tags.punctuation, tags.contentSeparator],
    color: 'color-mix(in oklab, var(--muted-foreground) 78%, transparent)'
  }
])

export const markdownLiveHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.heading1, tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6],
    color: 'var(--foreground)',
    fontWeight: '400'
  },
  { tag: tags.strong, color: 'inherit', fontWeight: 'inherit' },
  { tag: tags.emphasis, color: 'inherit', fontStyle: 'italic' },
  {
    tag: [tags.link, tags.url],
    color: 'inherit',
    fontWeight: '500',
    textDecoration: 'underline',
    textDecorationColor: 'color-mix(in oklab, currentColor 30%, transparent)'
  },
  { tag: tags.monospace, color: 'inherit', fontFamily: 'var(--typeset-font-mono)' },
  { tag: tags.quote, color: 'inherit', fontStyle: 'normal' },
  { tag: tags.list, color: 'inherit' },
  {
    tag: [tags.meta, tags.punctuation, tags.contentSeparator],
    color: 'color-mix(in oklab, var(--muted-foreground) 78%, transparent)'
  }
])
