# Domain model

Shared vocabulary for the Kuskus codebase. Terms here give names to seams and concepts the editor and
workspace modules are built around. When modelling a new module, name it after a concept below rather
than inventing a parallel word. Add terms here when a deepened module introduces a concept that does
not yet have a name.

## Terms

- **Library** — an ordinary local folder the user chooses, optionally an Obsidian vault. Schema-v2
  identity lives in `.kuskus/library.json`; visible files and folders remain authoritative.
- **Collection** — an ordinary nested folder inside a library. Folder nesting is the organization;
  `.kuskus/collections/<id>.json` stores only stable identity and presentation.
- **Item** — a visible file in the library, one of four discriminated types: **note** (`<title>.md`),
  **image**, **url** (`.url` Internet Shortcut), **file**. Items have a stable UUID that survives
  filename/folder changes.
- **Note** — a Markdown file that is the item body, title derived from the first readable line.
  Attachments are sibling image files referenced by relative Markdown embeds. No Kuskus-owned
  frontmatter; valid user frontmatter is preserved byte-for-byte outside the rich document.
- **Note mode** — the renderer-local editing presentation of a note: `read`, `live`, `markdown`, or
  `split`. Read shows a rendered document; live is the writable rich (ProseMirror) surface; markdown
  and split use the exact CodeMirror source editor.
- **Rich editor** — the Milkdown/ProseMirror structured surface for Read and Live (the default live engine).
  Markdown is the persisted authority; rich and source modes synchronize through Markdown when
  ownership changes.
- **Live editor (CodeMirror)** — the atomic-style CM6 decoration surface for Live mode, selectable
  through the live-engine preference. One editor instance serves both live and source modes; the
  live compartment adds only preview decorations, so selection, undo, find, cursor offsets, and Vim
  are identical surfaces rather than separate engines.
- **Source editor** — the CodeMirror 6 surface for exact Markdown and Split source.
- **Note-editor seam** — the mode-agnostic surface both editors present: focus, cursor offset into the
  Markdown source string, and the shared Vim mode/action contract. Consumers address one active
  surface by mode instead of knowing which engine is mounted.
- **Capture** — the flow of turning an accepted draft (text and staged assets) into a durable item
  through a FIFO submission queue.