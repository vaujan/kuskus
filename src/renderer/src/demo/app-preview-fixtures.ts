import type {
  ApiResult,
  CollectionDto,
  CreateNoteInput,
  MoveItemsInput,
  UpdateNoteInput,
  FileItemDto,
  ImageItemDto,
  ImagePreviewDto,
  KuskusLibraryApi,
  LibraryDto,
  LibraryItemDto,
  LibraryOverviewDto,
  NoteItemDto,
  UrlItemDto,
  UrlPreviewKind
} from '../../../shared/library-contract'
import type { LibraryDestination } from '../features/shell/library-sidebar'
import type { CaptureApi } from '../../../shared/capture-contract'
import type { ElectronWindowApi } from '../../../shared/window-contract'
import { NOTE_FORMATTING_MARKDOWN, SAMPLE_NOTE } from '../features/items/note-story-fixtures'
import notebookImage from './assets/wireframe-notebook.webp?url'
import paletteImage from './assets/material-palette.webp?url'
import { studentCollections, studentItems } from './student-library-fixtures'
import { demoUrlPreview } from './url-preview'

const date = '2026-09-24T00:00:00.000Z'
const inbox = { type: 'inbox' } as const
const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data })
const unavailable = (): ApiResult<never> => ({
  ok: false,
  code: 'invalid-input',
  error: 'This action is unavailable in the demo preview.'
})
const unsubscribe = (): void => {}

function note(id: string, title: string, body: string): NoteItemDto {
  return { ...SAMPLE_NOTE, id, title, body, relativePath: `${title}.md`, location: inbox }
}

export const planningNote = note('planning', 'Project notes', SAMPLE_NOTE.body)
export const formattingNote = note('formatting', 'Writing patterns', NOTE_FORMATTING_MARKDOWN)
export const meetingNote = note(
  'meeting',
  'Research meeting',
  '# Research meeting\n\n## Decisions\n\n- Keep the library easy to scan.\n- Put supporting references beside each note.\n\n## Follow up\n\n- [ ] Review the image studies\n- [ ] Share the project brief'
)

export const image: ImageItemDto = {
  schemaVersion: 2,
  id: 'notebook-image',
  type: 'image',
  title: 'Notebook wireframe',
  createdAt: date,
  updatedAt: date,
  sourceFilename: 'wireframe-notebook.png',
  contentFilename: 'wireframe-notebook.png',
  mediaType: 'image/png',
  width: 1254,
  height: 1254,
  missingContent: false,
  location: inbox,
  relativePath: 'wireframe-notebook.png',
  referencedAttachment: false,
  attachmentOrigin: null
}

export const paletteImageItem: ImageItemDto = {
  ...image,
  id: 'palette-image',
  title: 'Material palette',
  sourceFilename: 'material-palette.png',
  contentFilename: 'material-palette.png',
  relativePath: 'material-palette.png',
  width: 2172,
  height: 724
}

export const link: UrlItemDto = {
  schemaVersion: 2,
  id: 'design-link',
  type: 'url',
  title: 'Design systems that scale',
  createdAt: date,
  updatedAt: date,
  sourceUrl: 'https://example.com/design-systems',
  domain: 'example.com',
  description: 'A reference for reusable interface patterns and documentation.',
  siteName: 'Design Journal',
  contentKind: 'webpage',
  metadataVersion: 1,
  hasFavicon: true,
  hasPreviewImage: true,
  metadataStatus: 'ready',
  metadataError: null,
  location: inbox,
  relativePath: 'Design systems that scale.url',
  referencedAttachment: false
}

export const file: FileItemDto = {
  schemaVersion: 2,
  id: 'project-brief',
  type: 'file',
  title: 'Project brief.pdf',
  createdAt: date,
  updatedAt: date,
  sourceFilename: 'Project brief.pdf',
  contentFilename: 'Project brief.pdf',
  mediaType: 'application/pdf',
  size: 184_320,
  missingContent: false,
  location: inbox,
  relativePath: 'Project brief.pdf',
  referencedAttachment: false
}

export function library(
  id: string,
  items: LibraryItemDto[],
  options: { name?: string; collections?: CollectionDto[] } = {}
): LibraryDto {
  return {
    schemaVersion: 2,
    id,
    name: options.name ?? 'Storybook Library',
    path: `/storybook/${id}`,
    createdAt: date,
    pinnedItemIds: items.length ? [items[0].id] : [],
    items,
    collections: options.collections ?? []
  }
}

function overview(value: LibraryDto): LibraryOverviewDto {
  return {
    ...value,
    revision: 1,
    rebuildState: 'ready',
    items: value.items.map((item) => {
      if (item.type !== 'note') return item
      const { body, ...summary } = item
      return { ...summary, previewMarkdown: body }
    })
  }
}

async function imagePreview(
  url: string,
  width: number,
  height: number
): Promise<ApiResult<ImagePreviewDto>> {
  const bytes = await fetch(url).then((response) => response.arrayBuffer())
  return ok({ bytes, mediaType: 'image/webp', width, height })
}

export function installPreview(
  value: LibraryDto,
  destination: LibraryDestination = inbox,
  platform: ElectronWindowApi['platform'] = 'linux'
): void {
  // Demo edits belong to this preview only, never to the shared fixtures or disk.
  value = structuredClone(value)
  document.documentElement.dataset.platform = platform
  performance.mark('kuskus:renderer-entry')
  localStorage.setItem('kuskus-sidebar-hidden', 'false')
  localStorage.setItem('kuskus-library-view', 'visual')
  localStorage.setItem(
    `kuskus-session:v1:${value.path}`,
    JSON.stringify({ destination, typeFilters: [] })
  )

  const readApi = {
    createNote: async ({ markdown }: CreateNoteInput) => {
      const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || 'Untitled note'
      const timestamp = new Date().toISOString()
      const item: NoteItemDto = {
        ...SAMPLE_NOTE,
        id: crypto.randomUUID(),
        title,
        body: markdown,
        createdAt: timestamp,
        updatedAt: timestamp,
        location: inbox,
        relativePath: `${title}.md`
      }
      value.items = [...value.items, item]
      return ok(item)
    },
    updateNote: async ({ itemId, markdown }: UpdateNoteInput) => {
      const item = value.items.find((entry) => entry.id === itemId)
      if (item?.type !== 'note') return unavailable()
      const updated: NoteItemDto = { ...item, body: markdown, updatedAt: new Date().toISOString() }
      value.items = value.items.map((entry) => (entry.id === itemId ? updated : entry))
      return ok(updated)
    },
    moveItems: async ({ itemIds, destination: nextLocation }: MoveItemsInput) => {
      value.items = value.items.map((item) =>
        itemIds.includes(item.id) ? { ...item, location: nextLocation } : item
      )
      return ok(value)
    },
    getState: async () => ok({ status: 'ready' as const, library: value }),
    getOverview: async () => ok({ status: 'ready' as const, library: overview(value) }),
    reconcileOverview: async () => ok({ status: 'ready' as const, library: overview(value) }),
    reconcile: async () => ok({ status: 'ready' as const, library: value }),
    getItemDetail: async (itemId: string) => {
      const item = value.items.find((entry) => entry.id === itemId)
      return item ? ok(item) : unavailable()
    },
    queryItems: async ({ query }: { query: string }) =>
      ok({
        revision: 1,
        itemIds: value.items
          .filter((item) =>
            `${item.title} ${item.type}`.toLowerCase().includes(query.toLowerCase())
          )
          .map((item) => item.id)
      }),
    getImageThumbnail: async (itemId: string) => imagePreviewFor(itemId),
    getImagePreview: async (itemId: string) => imagePreviewFor(itemId),
    getUrlPreview: async (itemId: string, kind: UrlPreviewKind) => {
      const item = value.items.find((entry) => entry.id === itemId)
      if (item?.type !== 'url') return unavailable()
      return ok(await demoUrlPreview(item, kind))
    },
    onVaultChanged: () => unsubscribe
  }
  window.kuskus = new Proxy(readApi, {
    get(target, property, receiver) {
      return Reflect.get(target, property, receiver) ?? (async () => unavailable())
    }
  }) as unknown as KuskusLibraryApi

  const windowApi: ElectronWindowApi = {
    platform,
    minimize: () => {},
    toggleMaximize: () => {},
    close: () => {},
    isMaximized: async () => false,
    onMaximizedChange: () => unsubscribe,
    setZoomFactor: async (factor) => {
      document.documentElement.style.zoom = String(factor)
      document.documentElement.style.setProperty('--preview-zoom', String(factor))
      return factor
    },
    setNativeThemeSource: () => {},
    setTranslucentBackground: async () => ({
      supported: false,
      enabled: false,
      reducedTransparency: false
    }),
    onReducedTransparencyChange: () => unsubscribe,
    onZoomShortcut: () => unsubscribe,
    edit: () => {},
    getSpellingLanguages: async () => ({
      available: ['en-US', 'id'],
      selected: ['en-US', 'id'],
      managedBySystem: false
    }),
    setSpellingLanguages: async (languages) => ({
      available: ['en-US', 'id'],
      selected: languages,
      managedBySystem: false
    }),
    onSpellingLanguagesChanged: () => unsubscribe,
    onTextContextMenu: () => unsubscribe,
    textContextMenuAction: () => {},
    getGlobalCaptureShortcutStatus: async () => ({
      accelerator: 'Super+Shift+K',
      registered: true
    }),
    setGlobalCaptureShortcut: async (accelerator) => ({ accelerator, registered: true }),
    onGlobalCaptureRequested: () => unsubscribe,
    openSettingsWindow: async () => {},
    openNoteWindow: async () => {},
    onNoteWindowCloseRequested: () => unsubscribe,
    resolveNoteWindowClose: () => {}
  }
  window.electron = { window: windowApi }

  const captureApi = {
    getQueue: async () => ok({ pendingCount: 0, failures: [] }),
    onSessionChanged: () => unsubscribe,
    onQueueChanged: () => unsubscribe,
    onRecoveryRequested: () => unsubscribe,
    onMainItemRequested: () => unsubscribe,
    onQuickCaptureActivated: () => unsubscribe
  }
  window.capture = new Proxy(captureApi, {
    get(target, property, receiver) {
      return Reflect.get(target, property, receiver) ?? (async () => unavailable())
    }
  }) as unknown as CaptureApi
}

function imagePreviewFor(itemId: string): Promise<ApiResult<ImagePreviewDto>> {
  if (itemId === 'palette-image') {
    return imagePreview(paletteImage, 2172, 724)
  }
  return imagePreview(notebookImage, 1254, 1254)
}

export const heroCollection = studentCollections[0]
export const heroLocation = { type: 'collection', collectionId: heroCollection.id } as const
export const heroItems = studentItems

export function installHeroPreview(): void {
  installPreview(
    library('landing-hero', heroItems, { name: 'My Library', collections: studentCollections }),
    { type: 'all' }
  )
}
