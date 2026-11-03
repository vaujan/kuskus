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
import { installPreview } from '../../src/renderer/src/demo/app-preview-fixtures'
import {
  applyTheme,
  applyControlStyle,
  DEFAULT_TYPOGRAPHY
} from '../../src/renderer/src/hooks/theme'
import { personaLibrary } from './persona-libraries'
import './preview.css'
import './how-card.css'

// Use the same project and notes as the Build demo.
const previewLibrary = personaLibrary('developer')
const buildNotes = previewLibrary.items.filter((item) => item.type === 'note')
const capture = buildNotes.find((note) => note.title === 'The date moved back a day')!.body
const implementationNote = buildNotes.find((note) => note.title === 'Fetch failure checklist')!.body
const featureNotes = {
  edit: buildNotes.find((note) => note.title === 'Release checklist')!.body,
  diagram:
    '# Assignment save flow\n\n' +
    '```mermaid\nflowchart LR\n  A[Assignment form] --> B{Valid course?}\n  B -->|Yes| C[Save to SQLite]\n  B -->|No| D[Show field error]\n  C --> E[Refresh upcoming view]\n```\n\n' +
    '**Completion rate:** $r = \\frac{completed}{total}$\n\n' +
    '```ts\nconst upcoming = assignments.filter(task => !task.completed)\n```',
  links:
    '# Next build session\n\nStart with [[Before I open another tab]] to keep the course planner focused.\n\n## Debugging notes\n\nFix [[The date moved back a day]] before adding reminders. Keep calendar dates intact through storage.\n\n- [x] Finish assignment validation\n- [ ] Test month boundaries\n- [ ] Run the [[Release checklist]]\n\n## After the fix\n\nUpdate [[Monday build log]] with the result and the next small step.'
}
const results = [
  'Before I open another tab',
  'API contract — assignments',
  'Testing the upcoming view'
].map((title) => buildNotes.find((note) => note.title === title)!)
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
window.kusu.listCaptureDraftImages = async () => ({ ok: true, data: [] })
window.kusu.getCaptureDraftFile = async () => ({ ok: true, data: null })
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
    <div className="feature-writing-scene">
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
      <ItemCardSurface className="feature-editor feature-editor--edit">
        <ScrollArea className="feature-editor-body">
          {mode === 'read' ? (
            <article className="kusu-detail-document-frame py-[var(--typeset-detail-padding-block)]">
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
    </div>
  )
}

export function SearchScene(): React.JSX.Element {
  const [query, setQuery] = useState('assignment')
  return (
    <div className="workflow-search">
      <LibrarySearchInput
        inputRef={null}
        value={query}
        onValueChange={setQuery}
        pending={false}
        scopeLabel="Course planner"
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
                destination={{ type: 'collection', collectionId: 'developer-folder-0' }}
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
