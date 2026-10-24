import { createRoot } from 'react-dom/client'
import { LiveMarkdownEditor } from '../../src/renderer/src/features/items/live/live-markdown-editor'
import { ItemCardSurface } from '../../src/renderer/src/features/items/item-card'
import {
  applyTheme,
  applyControlStyle,
  DEFAULT_TYPOGRAPHY
} from '../../src/renderer/src/hooks/theme'
import './preview.css'
import './card-example.css'

applyTheme('light', 'kuskus', DEFAULT_TYPOGRAPHY)
applyControlStyle('skeuomorphic')

const markdown = `# Make room for ideas\n\nKeep **ideas and sources** together.\n\n- [x] Collect the references\n- [ ] Try a smaller first version`

createRoot(document.getElementById('root')!).render(
  <main className="example-page">
    <p className="example-label">ONE CARD EXPLORATION · ACTUAL APP COMPONENTS</p>
    <article className="example-card">
      <div className="example-visual">
        <ItemCardSurface className="example-note">
          <LiveMarkdownEditor
            value={markdown}
            active={false}
            editable={false}
            presentation="detail"
            onChange={() => {}}
          />
        </ItemCardSurface>
      </div>
      <div className="example-copy">
        <span>02 / Write</span>
        <h2>Take notes as you research</h2>
        <p>
          Develop your thinking in Markdown notes with Live Preview, right beside the links, images,
          and files that informed it.
        </p>
      </div>
    </article>
    <p className="example-provenance">
      Rendered with Kuskus’s LiveMarkdownEditor, ItemCardSurface, app theme, and typography. Only
      the surrounding marketing card is styled here.
    </p>
  </main>
)
