import { useState } from 'react'
import { ScrollArea } from '../../src/renderer/src/components/ui/scroll-area'
import { NoteModeButton } from '../../src/renderer/src/features/items/note-mode-button'
import { MarkdownEditor } from '../../src/renderer/src/features/items/markdown-editor'
import { MarkdownPreview } from '../../src/renderer/src/features/items/markdown-preview'
import { LibrarySidebar } from '../../src/renderer/src/features/shell/library-sidebar'
import { SidebarProvider } from '../../src/renderer/src/features/shell/app-sidebar'
import { createRoot } from 'react-dom/client'
import { LiveMarkdownEditor } from '../../src/renderer/src/features/items/live/live-markdown-editor'
import { ItemCardSurface } from '../../src/renderer/src/features/items/item-card'
import { NoteItemCard } from '../../src/renderer/src/features/items/note-item-card'
import { LibrarySearchInput } from '../../src/renderer/src/features/search/library-search-input'
import { AddItemComposer } from '../../src/renderer/src/features/capture/add-item-composer'
import { TooltipProvider } from '../../src/renderer/src/components/ui/tooltip'
import { SettingsPreviewProvider } from '../../src/renderer/src/settings/settings-context'
import { SAMPLE_NOTE } from '../../src/renderer/src/features/items/note-story-fixtures'
import { installPreview, library } from '../../src/renderer/src/demo/app-preview-fixtures'
import {
  applyTheme,
  applyControlStyle,
  DEFAULT_TYPOGRAPHY
} from '../../src/renderer/src/hooks/theme'
import './preview.css'
import './how-card.css'

// Component scenes shared by selectable landing previews and visual captures.
const capture = `# Checkout friction\n\n2 of 5 participants checked the basket for delivery costs. Test a shipping estimate beside the subtotal in Friday’s prototype.`
const decision = `# Delivery costs before payment\n\n## What we heard\n\nIn Tuesday’s checkout sessions, **2 of 5 participants** returned to the basket to check delivery costs. Both expected shipping to be included in the subtotal.\n\n> “I’d rather know the full amount before I put my card in.”\n\n## Decision for the next prototype\n\nShow the delivery estimate beside the subtotal. If the postcode is missing, say why we need it rather than showing a zero.\n\n- [x] Compare the five interview recordings\n- [ ] Test the revised summary with three participants\n- [ ] Check long postcodes and unavailable delivery areas\n\n## Open question\n\nDoes showing a range reduce uncertainty, or does it look like the price will change later? Keep the exact-price and range variants separate in Friday’s test.\n\nSource: checkout interviews, 14 October · sessions 02 and 04.`
const implementationNote =
  '# Delivery estimate\n\nShow **delivery before payment**. Keep an unknown price as `null`, never zero.\n\n```ts\nconst shipping = quote?.amount ?? null\nconst total = shipping === null\n  ? null\n  : subtotal + shipping\n```\n\n- [x] Keep totals in minor currency units\n- [ ] Test missing postcodes and remote areas\n\n> Session 04: “I thought delivery was included.”\n\n## Test cases\n\n| Postcode | Delivery | Summary |\n| --- | --- | --- |\n| Known | £4.50 | Exact total |\n| Missing | Unknown | Request postcode |\n\nLink this implementation to [[Checkout interviews — session 04]] before Friday’s review.'
const featureNotes = {
  edit: '# Friday checkout test\n\n## Before the first session\n\n- [x] Reset the basket to the same three items\n- [ ] Check the postcode error message\n- [ ] Record whether delivery changes the decision\n\n## Questions to ask\n\nWhat do you expect the total to include?\nWhen would you want to see the delivery price?\n\nKeep the prompt neutral; do not mention shipping until the participant does.',
  diagram:
    '# Delivery quote flow\n\n```mermaid\nflowchart LR\n  A[Basket] --> B{Postcode?}\n  B -->|Yes| C[Get quote]\n  B -->|No| D[Ask for postcode]\n  C --> E[Show total]\n```\n\n**Conversion rate:** $r = \\frac{orders}{checkout\\ starts}$\n\n```ts\nconst total = subtotal + shipping\n```',
  links:
    '# Friday test plan\n\nCompare the revised summary with [[Delivery costs before payment]]. Use the same basket in every session.\n\n## Interview evidence\n\nSee [[Checkout interviews — session 04]] for the participant who expected shipping to be included.\n\n- [x] Collect consent forms\n- [ ] Test the exact-price prototype\n- [ ] Note the first question each participant asks\n\n## After the sessions\n\nUpdate [[Delivery costs before payment]] with the observed hesitation points and the final decision.'
}
const results = [
  { title: 'Delivery costs before payment', body: decision },
  {
    title: 'Checkout interviews — session 04',
    body: 'Participant returned to the basket before entering a card number. Expected delivery to be included.\n\n## Follow-up\n\nAsk what “estimated total” means to them before showing the revised order summary.'
  },
  {
    title: 'Friday usability test — delivery estimate',
    body: 'Compare an exact delivery price with a price range. Keep the same basket and postcode across both prototypes.\n\n- [ ] Recruit three participants\n- [ ] Record first-click and hesitation points'
  }
]
const previewLibrary = library(
  'workflow',
  results.map((note, i) => ({
    ...SAMPLE_NOTE,
    ...note,
    id: `vault-${i}`,
    location: { type: 'collection' as const, collectionId: 'checkout' }
  })),
  {
    name: 'Product research',
    collections: [
      {
        schemaVersion: 2,
        id: 'checkout',
        name: 'Checkout research',
        icon: 'folder',
        createdAt: SAMPLE_NOTE.createdAt,
        relativePath: 'Checkout research',
        parentId: null
      },
      {
        schemaVersion: 2,
        id: 'interviews',
        name: 'Interview notes',
        icon: 'folder',
        createdAt: SAMPLE_NOTE.createdAt,
        relativePath: 'Checkout research/Interview notes',
        parentId: 'checkout'
      },
      {
        schemaVersion: 2,
        id: 'prototypes',
        name: 'Prototype reviews',
        icon: 'folder',
        createdAt: SAMPLE_NOTE.createdAt,
        relativePath: 'Prototype reviews',
        parentId: null
      }
    ]
  }
)
installPreview(previewLibrary)
const kind = new URLSearchParams(location.search).get('kind') ?? 'write'
const theme = 'vscode'
applyTheme('light', theme, DEFAULT_TYPOGRAPHY)
applyControlStyle('skeuomorphic')
const session = {
  libraryId: previewLibrary.id,
  revision: 1,
  assetsRevision: 0,
  markdown: capture,
  owner: 'main' as const,
  busy: false
}
window.capture.getSession = async () => ({ ok: true, data: session })
window.capture.setBusy = async () => ({ ok: true, data: session })
window.capture.claimSurface = async () => ({ ok: true, data: session })
window.kuskus.listCaptureDraftImages = async () => ({ ok: true, data: [] })
window.kuskus.getCaptureDraftFile = async () => ({ ok: true, data: null })
if (new URLSearchParams(location.search).has('embed')) {
  document.documentElement.dataset.embeddedScene = 'true'
  const resize = (): void =>
    document.documentElement.style.setProperty('--scene-scale', String(window.innerWidth / 520))
  resize()
  window.addEventListener('resize', resize)
}
window.capture.updateSession = async (input) => {
  session.markdown = input.markdown
  session.revision += 1
  return { ok: true, data: { ...session } }
}
window.capture.clearSession = async () => {
  session.markdown = ''
  session.revision += 1
  return { ok: true, data: { ...session } }
}
const noop = (): void => {}

export function WritingScene(): React.JSX.Element {
  const [mode, setMode] = useState<'live' | 'markdown' | 'read'>('live')
  const [value, setValue] = useState(featureNotes.edit)
  return (
    <ItemCardSurface className="feature-editor feature-editor--edit">
      <div className="feature-editor-toolbar">
        <NoteModeButton
          mode={mode}
          onClick={() =>
            setMode((current) =>
              current === 'live' ? 'markdown' : current === 'markdown' ? 'read' : 'live'
            )
          }
        />
      </div>
      <ScrollArea className="feature-editor-body">
        {mode === 'read' ? (
          <article className="kuskus-detail-document-frame py-[var(--typeset-detail-padding-block)]">
            <MarkdownPreview value={value} presentation="detail" />
          </article>
        ) : mode === 'live' ? (
          <LiveMarkdownEditor
            value={value}
            active={false}
            editable
            presentation="detail"
            onChange={setValue}
          />
        ) : (
          <MarkdownEditor value={value} active={false} onChange={setValue} />
        )}
      </ScrollArea>
    </ItemCardSurface>
  )
}

export function SearchScene(): React.JSX.Element {
  const [query, setQuery] = useState('delivery')
  return (
    <div className="workflow-search">
      <LibrarySearchInput
        inputRef={null}
        value={query}
        onValueChange={setQuery}
        pending={false}
        scopeLabel="Checkout research"
      />
      <div className="workflow-results">
        {results
          .filter((note) =>
            `${note.title} ${note.body}`.toLowerCase().includes(query.toLowerCase())
          )
          .map((note, i) => (
            <NoteItemCard
              key={note.title}
              item={{ ...SAMPLE_NOTE, ...note, id: `workflow-${i}` }}
              view="grid"
              searchQuery={query}
              selected={false}
              opensDialog
              onActivate={noop}
              onOpen={noop}
            />
          ))}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <SettingsPreviewProvider>
    <TooltipProvider>
      <main className={`workflow-scene workflow-scene--${kind}`}>
        {kind === 'vault' ? (
          <div className="feature-vault">
            <SidebarProvider defaultWidth={228} className="feature-vault-layout">
              <LibrarySidebar
                beforeDevReload={async () => true}
                library={previewLibrary}
                destination={{ type: 'collection', collectionId: 'checkout' }}
                onDestinationChange={noop}
                onLibraryChange={noop}
                onMoveItems={noop}
                onError={noop}
                onStatus={noop}
                librarySwitchBlocked={false}
                onOpenSettings={noop}
              />
              <div className="feature-vault-notes">
                {previewLibrary.items.map((item) =>
                  item.type === 'note' ? (
                    <NoteItemCard
                      key={item.id}
                      item={item}
                      view="visual"
                      selected={false}
                      opensDialog
                      onActivate={noop}
                      onOpen={noop}
                    />
                  ) : null
                )}
              </div>
            </SidebarProvider>
          </div>
        ) : kind === 'edit' ? (
          <WritingScene />
        ) : kind === 'diagram' || kind === 'links' ? (
          <ItemCardSurface className={`feature-editor feature-editor--${kind}`}>
            <LiveMarkdownEditor
              value={featureNotes[kind]}
              active={false}
              editable={false}
              presentation="detail"
              onChange={noop}
            />
          </ItemCardSurface>
        ) : kind === 'capture' ? (
          <div className="workflow-capture-grid">
            <div className="workflow-capture">
              <div className="quick-capture-composer">
                <AddItemComposer
                  open
                  actionsDisabled
                  focusRequest={0}
                  discardRequest={0}
                  libraryId={previewLibrary.id}
                  surface="main"
                  importRequest={null}
                  view="grid"
                  onOpenChange={noop}
                  onImportRequestHandled={noop}
                  onCreated={() => true}
                  onLinkCommitted={async (item) => ({ item, remainsVisible: true })}
                  onLinkUpdated={noop}
                  onLinkReleased={noop}
                  onStatus={noop}
                  onDraftStateChange={noop}
                  onTransientWorkChange={noop}
                />
              </div>
            </div>
            {results.map((note, i) => (
              <div className={`workflow-neighbor workflow-neighbor--${i}`} key={note.title}>
                <NoteItemCard
                  item={{ ...SAMPLE_NOTE, ...note, id: `capture-neighbor-${i}` }}
                  view="visual"
                  selected={false}
                  opensDialog
                  onActivate={noop}
                  onOpen={noop}
                />
              </div>
            ))}
          </div>
        ) : kind === 'return' ? (
          <SearchScene />
        ) : (
          <ItemCardSurface className="workflow-note">
            <LiveMarkdownEditor
              value={implementationNote}
              active={false}
              editable={false}
              presentation="detail"
              onChange={noop}
            />
          </ItemCardSurface>
        )}
      </main>
    </TooltipProvider>
  </SettingsPreviewProvider>
)
