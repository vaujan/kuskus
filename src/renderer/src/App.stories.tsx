import type { Meta, StoryObj } from '@storybook/react-vite'

import type {
  ApiResult,
  FileItemDto,
  ImageItemDto,
  ImagePreviewDto,
  KuskusLibraryApi,
  LibraryDto,
  LibraryItemDto,
  LibraryOverviewDto,
  NoteItemDto,
  UrlItemDto
} from '../../shared/library-contract'
import type { CaptureApi } from '../../shared/capture-contract'
import type { ElectronWindowApi } from '../../shared/window-contract'
import { NOTE_FORMATTING_MARKDOWN, SAMPLE_NOTE } from './features/items/note-story-fixtures'
import { SettingsProvider } from './settings/settings-context'
import App from './App'
import notebookImage from '../../../scripts/demo-assets/wireframe-notebook.png?url'
import paletteImage from '../../../scripts/demo-assets/material-palette.png?url'

const date = '2026-09-24T00:00:00.000Z'
const inbox = { type: 'inbox' } as const
const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data })
const unavailable = (): ApiResult<never> => ({
  ok: false,
  code: 'invalid-input',
  error: 'This action is unavailable in the Storybook preview.'
})
const unsubscribe = (): void => {}

function note(id: string, title: string, body: string): NoteItemDto {
  return { ...SAMPLE_NOTE, id, title, body, relativePath: `${title}.md`, location: inbox }
}

const planningNote = note('planning', 'Project notes', SAMPLE_NOTE.body)
const formattingNote = note('formatting', 'Writing patterns', NOTE_FORMATTING_MARKDOWN)
const meetingNote = note(
  'meeting',
  'Research meeting',
  '# Research meeting\n\n## Decisions\n\n- Keep the library easy to scan.\n- Put supporting references beside each note.\n\n## Follow up\n\n- [ ] Review the image studies\n- [ ] Share the project brief'
)

const image: ImageItemDto = {
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

const paletteImageItem: ImageItemDto = {
  ...image,
  id: 'palette-image',
  title: 'Material palette',
  sourceFilename: 'material-palette.png',
  contentFilename: 'material-palette.png',
  relativePath: 'material-palette.png',
  width: 2172,
  height: 724
}

const link: UrlItemDto = {
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

const file: FileItemDto = {
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

function library(id: string, items: LibraryItemDto[]): LibraryDto {
  return {
    schemaVersion: 2,
    id,
    name: 'Storybook Library',
    path: `/storybook/${id}`,
    createdAt: date,
    pinnedItemIds: items.length ? [items[0].id] : [],
    items,
    collections: [],
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
  return ok({ bytes, mediaType: 'image/png', width, height })
}

function installPreview(value: LibraryDto): void {
  performance.mark('kuskus:renderer-entry')
  localStorage.setItem('kuskus-sidebar-hidden', 'false')
  localStorage.setItem('kuskus-library-view', 'visual')
  localStorage.setItem(
    `kuskus-session:v1:${value.path}`,
    JSON.stringify({ destination: { type: 'inbox' }, typeFilters: [] })
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
    getImageThumbnail: async (itemId: string) =>
      itemId === 'palette-image'
        ? imagePreview(paletteImage, 2172, 724)
        : imagePreview(notebookImage, 1254, 1254),
    getImagePreview: async (itemId: string) =>
      itemId === 'palette-image'
        ? imagePreview(paletteImage, 2172, 724)
        : imagePreview(notebookImage, 1254, 1254),
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

const meta = {
  title: 'App/Library states',
  component: App,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <SettingsProvider>
        <Story />
      </SettingsProvider>
    )
  ]
} satisfies Meta<typeof App>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  loaders: [() => installPreview(library('empty', []))]
}

export const Notes: Story = {
  loaders: [() => installPreview(library('notes', [planningNote, formattingNote, meetingNote]))]
}

export const MixedLibrary: Story = {
  loaders: [
    () =>
      installPreview(
        library('mixed', [planningNote, image, link, file, paletteImageItem, meetingNote])
      )
  ]
}

export const MissingFiles: Story = {
  loaders: [
    () =>
      installPreview(
        library('missing', [
          { ...planningNote, id: 'missing-note', title: 'Unavailable note', missingContent: true },
          { ...image, id: 'missing-image', title: 'Unavailable image', missingContent: true },
          { ...file, id: 'missing-file', title: 'Unavailable brief.pdf', missingContent: true }
        ])
      )
  ]
}
