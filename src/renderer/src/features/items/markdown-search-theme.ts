import { EditorView } from '@codemirror/view'

export const markdownSearchTheme = EditorView.theme({
  '.cm-panels': {
    background: 'var(--window-toolbar)',
    color: 'var(--foreground)'
  },
  '.cm-panels-top': { borderBottom: '1px solid var(--border)' },
  '.cm-panels-bottom': { borderTop: '1px solid var(--border)' },
  '.cm-panel.cm-search': {
    zIndex: '2',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.375rem',
    padding: '0.5rem 0.75rem',
    borderBottom: '1px solid var(--border)',
    background: 'var(--window-toolbar)',
    color: 'var(--foreground)',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.75rem',
    lineHeight: '1',
    '& :is(input, button, label)': { margin: '0' },
    "& input:not([type='checkbox'])": {
      boxSizing: 'border-box',
      width: '11rem',
      maxWidth: '100%',
      height: 'var(--control-height-sm)',
      padding: '0 0.75rem',
      border: '1px solid transparent',
      borderRadius: 'var(--radius-xl)',
      outline: 'none',
      background: 'color-mix(in oklch, var(--input) 50%, transparent)',
      color: 'var(--foreground)',
      font: 'inherit',
      '&::placeholder': { color: 'var(--muted-foreground)' },
      '&:focus': {
        borderColor: 'var(--ring)',
        boxShadow: '0 0 0 3px color-mix(in oklch, var(--ring) 30%, transparent)'
      }
    },
    '& .cm-button, & [name=close]': {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 'var(--control-height-sm)',
      padding: '0 0.75rem',
      border: '1px solid transparent',
      borderRadius: 'var(--radius-xl)',
      outline: 'none',
      background: 'var(--secondary)',
      color: 'var(--secondary-foreground)',
      font: 'inherit',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'background-color var(--motion-duration-press) var(--motion-ease-out)',
      '&:hover': { background: 'var(--muted)' }
    },
    '& .cm-button[name=next]': {
      background: 'var(--primary)',
      color: 'var(--primary-foreground)',
      '&:hover': { background: 'color-mix(in oklch, var(--primary) 80%, var(--foreground))' }
    },
    '& :is(input, button):focus-visible': {
      outline: '0',
      boxShadow: '0 0 0 3px color-mix(in oklch, var(--ring) 30%, transparent)'
    },
    '& label': {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.375rem',
      height: 'var(--control-height-sm)',
      padding: '0 0.25rem',
      color: 'var(--muted-foreground)',
      whiteSpace: 'nowrap',
      cursor: 'pointer'
    },
    "& input[type='checkbox']": {
      width: '0.875rem',
      height: '0.875rem',
      margin: '0',
      accentColor: 'var(--primary)'
    },
    '& br': { flexBasis: '100%', height: '0' },
    '& [name=close]': {
      position: 'absolute',
      top: '0.5rem',
      right: '0.75rem',
      width: 'var(--control-height-sm)',
      padding: '0',
      fontSize: '1.125rem',
      fontWeight: '400'
    }
  },
  '.cm-searchMatch': {
    background: 'color-mix(in oklch, var(--primary) 25%, transparent)'
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    background: 'color-mix(in oklch, var(--primary) 45%, transparent)'
  }
})
