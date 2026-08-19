import { HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'

export const markdownHighlightStyle = HighlightStyle.define([
  // Headings keep a readable outline. The hash markers below share the
  // Markdown accent, so the document structure reads at a glance.
  {
    tag: tags.heading1,
    fontSize: '1.375rem',
    lineHeight: '2rem',
    fontWeight: '600'
  },
  {
    tag: tags.heading2,
    fontSize: '1.1875rem',
    lineHeight: '1.75rem',
    fontWeight: '600'
  },
  {
    tag: tags.heading3,
    fontSize: '1.0625rem',
    lineHeight: '1.625rem',
    fontWeight: '600'
  },
  {
    tag: [tags.heading4, tags.heading5, tags.heading6],
    fontWeight: '600'
  },

  // Inline emphasis.
  { tag: tags.strong, fontWeight: '600' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  {
    tag: tags.strikethrough,
    color: 'var(--muted-foreground)',
    textDecoration: 'line-through'
  },

  // Links: the label takes the primary accent, the destination stays muted.
  { tag: tags.link, color: 'var(--primary)' },
  { tag: tags.url, color: 'var(--muted-foreground)' },

  // Inline code and fenced-code language labels.
  {
    tag: tags.monospace,
    backgroundColor: 'var(--code-background)',
    borderRadius: '0.25rem'
  },
  { tag: tags.labelName, color: 'oklch(0.7 0.13 210)', fontWeight: '500' },

  // Blocks.
  { tag: tags.quote, color: 'var(--muted-foreground)', fontStyle: 'italic' },

  // Leading YAML frontmatter reads as subdued metadata, not headings.
  { tag: tags.meta, color: 'var(--muted-foreground)', fontWeight: '400' },

  // GFM task checkboxes read as interactive markers.
  { tag: tags.atom, color: 'var(--primary)' },

  // Markdown punctuation sits last so the accent wins on marker nodes that
  // also carry a structural tag (heading, strong, link, quote, …).
  // lezer-markdown tags every markup mark (header, list, quote, emphasis,
  // code, link, strike) as processingInstruction/contentSeparator.
  {
    tag: [tags.processingInstruction, tags.contentSeparator],
    color: 'color-mix(in oklch, var(--primary) 62%, var(--foreground) 38%)'
  }
])
