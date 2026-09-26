import type {
  ActiveItemLocation,
  ApiResult,
  CollectionDto,
  FileItemDto,
  ImageItemDto,
  ImagePreviewDto,
  KuskusLibraryApi,
  LibraryDto,
  LibraryItemDto,
  LibraryOverviewDto,
  NoteItemDto,
  UrlItemDto,
  UrlPreviewDto
} from '../../../shared/library-contract'
import type { CaptureApi } from '../../../shared/capture-contract'
import type { ElectronWindowApi } from '../../../shared/window-contract'
import { NOTE_FORMATTING_MARKDOWN, SAMPLE_NOTE } from '../features/items/note-story-fixtures'
import notebookImage from './assets/wireframe-notebook.webp?url'
import paletteImage from './assets/material-palette.webp?url'
import workspaceImage from './assets/evening-workspace.webp?url'
import libraryStudyImage from './assets/library-density-study.webp?url'

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
  hasFavicon: false,
  hasPreviewImage: false,
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
    collections: options.collections ?? [],
    cleanup: { status: 'not-needed', affectedFiles: 0, recoveryRelativePath: null },
    repairConflicts: []
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

async function urlPreview(url: string): Promise<ApiResult<UrlPreviewDto>> {
  const bytes = await fetch(url).then((response) => response.arrayBuffer())
  return ok({ bytes, mediaType: 'image/webp' })
}

export function installPreview(value: LibraryDto, destination: ActiveItemLocation = inbox): void {
  performance.mark('kuskus:renderer-entry')
  localStorage.setItem('kuskus-sidebar-hidden', 'false')
  localStorage.setItem('kuskus-library-view', 'visual')
  localStorage.setItem(
    `kuskus-session:v1:${value.path}`,
    JSON.stringify({ destination, typeFilters: [] })
  )

  const readApi = {
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
    getUrlPreview: async (itemId: string) =>
      itemId === 'hero-link' ? urlPreview(libraryStudyImage) : unavailable(),
    onVaultChanged: () => unsubscribe
  }
  window.kuskus = new Proxy(readApi, {
    get(target, property, receiver) {
      return Reflect.get(target, property, receiver) ?? (async () => unavailable())
    }
  }) as unknown as KuskusLibraryApi

  const windowApi: ElectronWindowApi = {
    platform: 'linux',
    minimize: () => {},
    toggleMaximize: () => {},
    close: () => {},
    isMaximized: async () => false,
    onMaximizedChange: () => unsubscribe,
    setZoomFactor: async (factor) => factor,
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
  if (itemId === 'palette-image' || itemId === 'hero-palette') {
    return imagePreview(paletteImage, 2172, 724)
  }
  if (itemId === 'hero-workspace') return imagePreview(workspaceImage, 1122, 1402)
  return imagePreview(notebookImage, 1254, 1254)
}

export const heroCollection: CollectionDto = {
  schemaVersion: 2,
  id: 'studio-website',
  name: 'Studio website refresh',
  icon: 'palette',
  createdAt: date,
  relativePath: 'Studio website refresh',
  parentId: null
}

export const heroLocation = { type: 'collection', collectionId: heroCollection.id } as const
const heroPath = (name: string): string => `${heroCollection.relativePath}/${name}`
export const heroItems: LibraryItemDto[] = [
  {
    ...note(
      'hero-direction',
      'A quieter place to begin',
      '# A quieter place to begin\n\nThe new site should feel like stepping into the studio: considered, warm, and easy to explore.\n\n## What matters\n\n- Let the work speak first\n- Give every project room to breathe\n- Keep the path to get in touch obvious'
    ),
    location: heroLocation,
    relativePath: heroPath('A quieter place to begin.md'),
    createdAt: '2026-09-24T12:00:00.000Z',
    updatedAt: '2026-09-24T12:00:00.000Z'
  },
  {
    ...image,
    id: 'hero-notebook',
    title: 'Early page sketches',
    location: heroLocation,
    relativePath: heroPath('Early page sketches.png'),
    createdAt: '2026-09-23T12:00:00.000Z',
    updatedAt: '2026-09-23T12:00:00.000Z'
  },
  {
    ...paletteImageItem,
    id: 'hero-palette',
    title: 'Materials and color direction',
    location: heroLocation,
    relativePath: heroPath('Materials and color direction.png'),
    createdAt: '2026-09-22T12:00:00.000Z',
    updatedAt: '2026-09-22T12:00:00.000Z'
  },
  {
    ...link,
    id: 'hero-link',
    title: 'The case for quieter interfaces',
    sourceUrl: 'https://example.com/quiet-interfaces',
    domain: 'example.com',
    siteName: 'Design notes',
    hasPreviewImage: true,
    description: 'A reference for letting content lead and giving each project room to breathe.',
    location: heroLocation,
    relativePath: heroPath('The case for quieter interfaces.url'),
    createdAt: '2026-09-21T12:00:00.000Z',
    updatedAt: '2026-09-21T12:00:00.000Z'
  },
  {
    ...file,
    id: 'hero-brief',
    title: 'Studio website brief.pdf',
    sourceFilename: 'Studio website brief.pdf',
    contentFilename: 'Studio website brief.pdf',
    location: heroLocation,
    relativePath: heroPath('Studio website brief.pdf'),
    createdAt: '2026-09-20T12:00:00.000Z',
    updatedAt: '2026-09-20T12:00:00.000Z'
  },
  {
    ...image,
    id: 'hero-workspace',
    title: 'Studio atmosphere',
    sourceFilename: 'evening-workspace.png',
    contentFilename: 'evening-workspace.png',
    width: 1122,
    height: 1402,
    location: heroLocation,
    relativePath: heroPath('Studio atmosphere.png'),
    createdAt: '2026-09-19T12:00:00.000Z',
    updatedAt: '2026-09-19T12:00:00.000Z'
  }
]

export function installHeroPreview(): void {
  installPreview(
    library('landing-hero', heroItems, { name: 'My Library', collections: [heroCollection] }),
    heroLocation
  )
}
