# Dogfooding Log

Status: Living evidence log  
Started: 2026-07-14

## Purpose

Kuskus is initially being built for its creator. This log replaces speculative feature planning with observations from real use.

Record friction quickly. Do not solve every entry immediately. Repeated problems matter more than isolated preferences.

## Seven-day trial criteria

Choose one real project and use Kuskus as its primary reference library for seven consecutive days.

Track whether the user can:

- Capture at least ten real items across multiple formats.
- Return to Kuskus on multiple days.
- Organize items without interrupting capture.
- Retrieve an item saved on an earlier day.
- Open and reveal stored files reliably.
- Back up or inspect the library outside Kuskus.
- Avoid returning to another tool because Kuskus cannot represent something essential.

## Daily summary template

Copy this section for each day.

```markdown
## YYYY-MM-DD - Day N

Project used:

### Activity

- Items captured:
- Formats captured:
- Collections used:
- Searches performed:
- Items retrieved from a previous session:

### What worked

-

### Friction

-

### Workarounds or other apps used

-

### Data or reliability concerns

-

### Most important improvement

-
```

## Friction entry template

Use this for a specific problem worth preserving.

```markdown
### F-XXX: Short description

- Date:
- What I was trying to do:
- What I expected:
- What happened:
- Workaround:
- Pain: 1-5
- Frequency: First occurrence | Repeated
- Evidence: screenshot, item type, or relevant path if safe
- Possible change, if obvious:
```

## Decision rules

- Fix data loss, corruption, and unrecoverable operations immediately.
- Fix repeated capture or retrieval failures before adding new item types.
- Prefer changes that simplify a golden workflow.
- Do not promote a feature into MVP scope from a single low-pain occurrence.
- Record unused features as evidence too; removal may be the right improvement.

## Questions to answer through use

- Does Inbox reduce capture friction, or does it create an organization backlog?
- Are collections sufficient without tags or nested folders?
- Which view is actually used: Masonry, Grid, or Table?
- Is the Add Item card useful after direct paste and drag-and-drop are learned?
- How often is **Show in Explorer** used, and for which item types?
- Are copied files preferable to linked files in daily use?
- Is URL metadata enough, or are offline snapshots genuinely needed?
- Which metadata is repeatedly added manually?
- At what collection size does visual browsing become difficult?
- Which operation feels slow enough to interrupt the capture flow?

### F-001: Mixed item cards are difficult to scan cleanly

- Date: 2026-07-17
- What I was trying to do: Browse a mixed set of saved notes, links, images, and documents visually.
- What I expected: Content previews should lead, with titles and source details easy to scan without competing with the content.
- What happened: Repeated card containers and inconsistent metadata placement made the canvas feel busier than the content required.
- Workaround: None recorded.
- Pain: 3
- Frequency: First occurrence
- Evidence: User feedback with an attached visual reference for a cleaner, preview-led layout.
- Possible change, if obvious: Use transparent item frames, visible preview or text surfaces, and compact captions in Visual and Grid views.

### F-002: Pasted images and links save before confirmation

- Date: 2026-07-22
- What I was trying to do: Paste an image, link, or text into the New Item composer and review what
  Kuskus detected before adding it to the library.
- What I expected: The primary action should identify the detected result as **Save image**,
  **Save link**, or **Save note**, and saving should occur only after activating it.
- What happened: A standalone pasted image or link was added to the library immediately, while only
  note text waited for the Save action.
- Workaround: None recorded.
- Pain: Not rated.
- Frequency: Not recorded.
- Evidence: User-reported composer behavior for image, link, and text capture.
- Possible change, if obvious: Stage every detected type in a recoverable composer state and require
  explicit type-specific confirmation.

### F-003: Saved links lack trustworthy visual progress and rich previews

- Date: 2026-07-22
- What I was trying to do: Save an online reference and keep its visual identity in the mixed-item
  library.
- What I expected: Confirmation should become a calm saving state, followed by a thumbnail-led card
  with recognizable source information.
- What happened: The composer exposed only button-level progress, while renderer security blocked
  the remote preview and favicon URLs stored by metadata enrichment.
- Workaround: Reopen the source in a browser and identify it from its domain.
- Pain: Not rated.
- Frequency: First recorded occurrence.
- Evidence: User feedback with separate rich-link and intermediary-saving visual references.
- Possible change, if obvious: Fetch and validate preview assets in the main process, cache them
  locally, and let a same-slot saving card own the transition into the final URL card.

### F-004: A Quick Capture draft remains locked in the main composer

- Date: 2026-08-03
- What I was trying to do: Start a Markdown note with a pasted image in Quick Capture, hide the
  popup without saving, and continue editing the same draft in the main window.
- What I expected: The shared draft should become editable in the main composer with its Markdown
  and staged image unchanged.
- What happened: The main composer opened disabled and reported that capture was still saving or
  staging in the other window, even after that transient work had finished.
- Workaround: Summon the composer again after staging has finished.
- Pain: 3
- Frequency: First recorded occurrence.
- Evidence: User report with screenshots of the editable Quick Capture draft and the locked main
  composer.
- Possible change, if obvious: Treat a busy ownership request as a temporary wait and retry it while
  the destination surface remains visible.

### F-005: An image embed becomes the captured note title

- Date: 2026-08-03
- What I was trying to do: Paste an image into Quick Capture, add a written observation below it,
  and save the note.
- What I expected: The written observation should provide a recognizable note title and filename.
- What happened: The first non-empty source line was the generated Markdown image embed, so syntax
  such as `![](./dialog-problem.png)` became the visible note title.
- Workaround: Rename the saved note manually from its item menu.
- Pain: 3
- Frequency: First recorded occurrence.
- Evidence: User report with a screenshot of the raw image embed displayed as the detail title.
- Possible change, if obvious: Derive titles from the first human-readable Markdown line, with the
  embedded image filename as the fallback for image-only notes, and allow direct renaming from the
  detail title.

## Trial summary template

```markdown
## Seven-day summary

### Outcome

Completed | Partially completed | Abandoned

### Usage

- Total items:
- URL:
- Image:
- Note:
- PDF:
- Other files:
- Collections:
- Active days:

### Repeated high-pain friction

1.
2.
3.

### Features that were not used

-

### Data integrity or trust issues

-

### Scope changes supported by evidence

-

### Next build milestone

-
```
