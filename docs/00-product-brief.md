# Kuskus Product Brief

Status: Draft v0.1  
Last updated: 2026-07-14

## Product definition

Kuskus is a desktop application for collecting links, images, screenshots, PDFs, files, and short notes into visual project collections. Content is stored locally in a user-controlled library and remains accessible outside Kuskus.

Kuskus is initially being built for its creator's personal use. Broader market validation, collaboration, and growth features are not current requirements.

## Problem

Useful project references are scattered across browser bookmarks, screenshots, downloads, notes, and open tabs. Existing bookmark managers tend to favor URLs, visual asset managers favor media, and knowledge-management tools require more configuration than this workflow needs.

The missing experience is a simple place where mixed formats that share the same context can be captured quickly and browsed together visually.

Examples:

- A product project containing demand signals, development notes, UI screenshots, PDFs, and useful webpages.
- A training collection containing instructional videos, workout notes, form images, and supporting files.

## Core job

When I encounter something useful, let me capture it without interrupting my flow, place it beside related material regardless of format, and find it again visually.

## Product promise

> A private visual library for project references, stored on your computer.

## Initial user

The initial user is the creator of Kuskus: a Windows desktop user who collects mixed-format references while researching, designing, writing, and building projects.

## Product principles

1. **Local by default.** A Kuskus library lives in a folder selected by the user.
2. **Files over application lock-in.** User-readable content and metadata are authoritative; generated indexes must be rebuildable.
3. **Capture now, organize later.** New items can go directly to Inbox without mandatory classification.
4. **Fast capture.** The ordinary capture path should take less than five seconds after content is copied or dropped.
5. **Mixed formats, one context.** Different item types belong together when they support the same project.
6. **Visual retrieval.** Rich previews and format-aware cards are preferred over treating everything as a generic note.
7. **Useful without configuration.** The basic workflow must not require templates, schemas, plugins, or property design.
8. **No mandatory account, cloud, or AI.** These are not prerequisites for using the core product.
9. **Desktop-native affordances.** Opening links in the default browser, drag-and-drop, keyboard actions, and standard window behavior are first-class capabilities.

## Experience direction

The content area combines MyMind-style format-aware cards with Are.na-style simplicity and density. Kuskus is not a social platform: the visual canvas exists to make a personal local library easy to scan.

## Success for the first usable version

Kuskus is successful when it can replace the creator's scattered reference workflow for one real project for seven consecutive days without manual data repair.

During that period, the user must be able to:

- Capture real links, images, notes, PDFs, and files.
- Organize them into collections or leave them in Inbox.
- Browse different formats together.
- Search for and reopen previously saved items.
- Edit saved Markdown notes in a rendered WYSIWYG canvas with guarded local autosave while keeping
  the library files authoritative.
- Reopen saved links and inspect saved content without leaving Kuskus.
- Close and reopen Kuskus without losing or corrupting content.
- Back up the library by copying its folder.

## Non-goals for the first usable version

- Accounts and authentication.
- Hosted cloud storage or synchronization.
- Collaboration, publishing, or social discovery.
- Mobile applications.
- AI organization, chat, or semantic search.
- Infinite canvas or graph-based knowledge management.
- Rich document authoring.
- Plugin or extension marketplaces.
- Full-fidelity offline webpage archiving.

## Open product questions

- Whether nested collections are needed after dogfooding.
- Whether tags add value beyond collections and search.
- Whether offline webpage snapshots are worth their complexity.
- Whether imported files should eventually support linking in place as an alternative to copying.
- Whether a browser extension is necessary after paste and drag-and-drop capture are proven.
