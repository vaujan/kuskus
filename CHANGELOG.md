# Changelog

All notable changes to Kuskus are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- Updated Electron, KaTeX, and Mermaid dependencies and patched transitive sanitizer/math dependencies.
- Restricted external links to HTTP(S), blocked renderer navigation and webviews, and authenticated IPC requests from registered app main frames.

### Changed

- Removed obsolete library and draft migrations; vault opening no longer converts old Markdown metadata.
- Restricted packaged repository files, generated third-party notices, and added package inspection.
- Added Windows/Linux CI checks and a Windows release command that validates and requires signing without changing versions or publishing.
- Documented release scope, privacy, contributions, vulnerability reporting, and release verification.

### Added

- Development-only React Scan and React Grab overlays for spotting wasted renders and copying component source.

## [0.0.3] - 2026-08-17

### Added

- First Windows installer build (`build:win`) producing a signed NSIS setup.
- Find in note canvas.
- Split mode toggle by key code.
- `F12` devtools toggle.
- Toast explaining first-open vault indexing.
- Vim ex-command line (`:w`, `:q`, `:wq`, `:s/old/new/g`) with substitute support.
- Cursor offset saved and restored when switching between note editing modes.
- Sticky Vim search bar that stays pinned to the editor viewport.

### Changed

- Debounced search while keeping results visible as you type.
- Bound note saving to the changed item.
- Shortened the pin action label.
- Refreshed the interface palette around a violet-tinted theme with IBM Plex Sans headings.
- Rendered heading rules and tuned Acrylic material transparency against the new tokens.
- Pinned the Vim search and ex-command bars to the bottom of the editor viewport.

### Performance

- Paged focus rail mounting instead of mounting every item at once.
- Decoupled note previews from the keystroke path.
- Replaced note card previews with bounded snippets.
- Hardened and measured typing interactivity in the packaged runner.

## [0.0.2] - 2026-08-17

First tracked release of the local-first visual library.

### Added

- Local Kuskus libraries with readable `note.md` and `item.json` files on disk.
- Obsidian-compatible vault storage: schema-v2 scanning, frontmatter, wikilinks, aliases, headings, note embeds, and image embeds.
- Markdown authoring through the inline New Item composer and a global `Ctrl+Shift+Space` Quick Capture popup.
- Milkdown-based editor with Read, Live, highlighted Markdown, and linked Split presentations.
- Clipboard image paste and file paste/drag-and-drop with recoverable staging and collision-safe imports.
- URL capture with offline-safe `.url` shortcuts and background metadata enrichment.
- Collections as nested folders, plus Archive, Trash, and a Pinned destination.
- Focus master-detail view, Masonry view, and Uniform Grid view with persisted preferences.
- Search by title, note, URL/domain, and filename, with type filters, attachment visibility, and sorting.
- Task checkboxes in Markdown, syntax-highlighted code, Mermaid diagrams, KaTeX math, and image zoom with captions.
- Inline `F2` rename and `Delete` item commands, range selection with shift-click anchor, and auto-scroll to the active item.
- Type badges in the Focus index and action errors surfaced as toasts.
- Performance foundation: atomic rebuildable library snapshot, bounded scanning, 100-card progressive rendering, and LRU preview caching.

### Changed

- Restyled interface around a base-luma theme and Inter Variable sans typography.
- Restored search, filters, and Focus view across app restarts.
- Restored note cursor and scroll position when entering live editing.
- Deferred note editor modules and released idle Quick Capture windows to reduce memory use.

### Fixed

- Read-mode task lists splitting text into flex columns.
- Note cursor dropping below the pane bottom while typing.
- Rename triggering from anywhere in the detail pane instead of a single hot spot.

## [0.0.1] - 2026-08-13

- Hello, world!
