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
- Which view is actually used: Visual, Grid, or List?
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
