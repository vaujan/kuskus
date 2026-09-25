# Folding and alignment check

Compare this note in Read and Live. List text, markers, headings, and disclosure controls should stay aligned when sections are folded or expanded. Folding a heading should hide its content and lower-level headings, then stop at the next heading of the same or higher level.

## Plain bullets

- First top-level item
- Parent bullet
  - First child
  - Second child
    - Grandchild
  - Final child
- Next top-level item

## Numbered list

1. First numbered item
2. Parent numbered item
   1. First numbered child
   2. Second numbered child
3. Next numbered item

## Mixed nesting

- Parent bullet with numbered children
  1. First numbered child
  2. Second numbered child
     - A bullet grandchild
- Next bullet after the parent

## Tasks

- [ ] Open parent task
  - [x] Completed child
  - [ ] Open child with **bold** and _italic_ text
- [x] Completed parent task
  - [ ] Open child below a completed parent
  - [x] Completed child below a completed parent
- [ ] Next top-level task

## Wrapped parent text

- This parent has a longer sentence that should wrap when the note pane is narrow, while its disclosure control stays aligned with the first line of text.
  - Child under the wrapped parent
  - Another child under the wrapped parent
- Next item after the wrapped parent

## Heading hierarchy

This paragraph belongs to the Heading hierarchy section.

### First subsection

Content under the first subsection.

#### Nested subsection

- A bullet inside the nested subsection
  - Its child

### Second subsection

Content after the nested subsection.

Setext subsection
-----------------

This section uses an underlined heading and folds like the hash headings.

## Literal Markdown

The following fenced block contains list syntax that should remain plain code:

```md
- [x] Not a task in this note
  - Not a foldable child

## Not a heading in this note
```
