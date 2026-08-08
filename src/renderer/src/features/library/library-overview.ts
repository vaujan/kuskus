import type {
  LibraryDto,
  LibraryOverviewState,
  LibraryState
} from '../../../../shared/library-contract'

export function expandLibraryOverview(state: LibraryOverviewState): LibraryState {
  if (state.status !== 'ready') return state
  const library: LibraryDto = {
    ...state.library,
    items: state.library.items.map((item) =>
      item.type === 'note'
        ? {
            ...item,
            body: item.previewMarkdown,
            bodyTruncated: true
          }
        : item
    )
  }
  return { status: 'ready', library }
}
