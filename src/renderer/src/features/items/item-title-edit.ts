export interface InlineTitleEditState {
  editing: boolean
  draft: string
  pending: boolean
  error: string
}

export type InlineTitleEditAction =
  | { type: 'start'; title: string }
  | { type: 'change'; value: string }
  | { type: 'submit' }
  | { type: 'success'; title: string }
  | { type: 'failure'; error: string }
  | { type: 'cancel'; title: string }

export function createInlineTitleEditState(title: string): InlineTitleEditState {
  return { editing: false, draft: title, pending: false, error: '' }
}

export function reduceInlineTitleEdit(
  state: InlineTitleEditState,
  action: InlineTitleEditAction
): InlineTitleEditState {
  switch (action.type) {
    case 'start':
      return state.pending
        ? state
        : { editing: true, draft: action.title, pending: false, error: '' }
    case 'change':
      return state.pending ? state : { ...state, draft: action.value, error: '' }
    case 'submit':
      return state.editing && !state.pending ? { ...state, pending: true, error: '' } : state
    case 'success':
      return { editing: false, draft: action.title, pending: false, error: '' }
    case 'failure':
      return { ...state, editing: true, pending: false, error: action.error }
    case 'cancel':
      return { editing: false, draft: action.title, pending: false, error: '' }
  }
}

export function resolveInlineTitleSubmission(
  currentTitle: string,
  draft: string
): { type: 'cancel' } | { type: 'rename'; title: string } {
  const title = draft.trim()
  return !title || title === currentTitle ? { type: 'cancel' } : { type: 'rename', title }
}
