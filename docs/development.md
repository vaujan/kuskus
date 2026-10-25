# Development workspaces

Use these workspaces to try changes without opening your own library. Start with the [setup instructions](../README.md#run-from-source).

Development windows load [React Scan](https://github.com/aidenybai/react-scan) and [React Grab](https://github.com/aidenybai/react-grab) so you can see re-renders and copy a component's source for an agent. Neither package is included in packaged builds. React Scan's toolbar appears in the corner. Hold **Alt+C** to start React Grab, hover a control, then press **C** to copy its component stack.

## Component stories

```bash
pnpm storybook
```

Storybook previews renderer components in the browser at `http://localhost:6006`. Use its light/dark toolbar control to check both color modes. Stories cover buttons, file cards, folder dialogs, note cards, Markdown reading, and the live note editor. The note stories use local sample content; edits and checklist changes stay inside the preview. **App → Library states** renders the whole app with empty, notes-only, mixed-media, and missing-file libraries. These app stories use browser fixtures for the Electron APIs, so library changes do not touch files on disk. The accessibility panel checks the rendered stories. For workflows that need a real library, use `pnpm dev:demo` instead. Run `pnpm build:storybook` to verify the standalone story build.

## Fresh onboarding workspace

```bash
pnpm dev:onboarding
```

Each launch clears `.onboarding/` and starts with no library, saved theme, or other app preferences. The Create Library folder picker starts in `.onboarding/libraries/`; create test libraries there so the next launch clears them too. Libraries created elsewhere are not removed. This profile is separate from the normal development, demo, and packaged app profiles. Close the onboarding app before starting another run.

To clear the workspace without starting the app, run `pnpm onboarding:reset` after closing it.

## Isolated demo environment

Run Kuskus with a populated, repository-local profile:

```bash
pnpm dev:demo
```

The command creates `.demo/Fauzan’s Library` and `.demo/user-data` on first use. This profile is completely separate from the normal development and packaged-app profiles. Changes made while testing persist between demo launches.

After closing the demo app, restore the original mock folders and data at any time:

```bash
pnpm demo:reset
```

Use `pnpm demo:seed` to create a missing demo library without resetting existing demo changes. The fixture represents a designer-developer actively dogfooding Kuskus, with recent working notes, original local visuals in several proportions, healthy URL references, a portable note attachment, partially populated folders, one Trash item, and a dedicated Markdown Lab containing focused feature fixtures plus a long stress document.

If `.demo` already exists, run `pnpm demo:reset` once to add or restore the canonical Markdown Lab. `demo:seed` intentionally preserves an existing profile and will not overwrite local dogfooding changes.
