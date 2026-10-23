# Kuskus

Kuskus is a private visual library for project references, stored on your computer. It is currently a Windows-first personal MVP built with Electron, React, and TypeScript.

The app supports local Markdown notes, images, files, web references, nested folders, search, pinned items, Trash, detached note windows, and quick capture. Notes and attachments remain ordinary files in the selected vault; Kuskus keeps its index and app metadata in the hidden `.kuskus` directory. Existing Markdown folders can be indexed without converting their notes.

**Release status:** The first launch milestone is the source repository and browser demo; see the [source-launch handoff](docs/17-source-launch.md). Windows is the first public installer target, with signing and native testing still outstanding. macOS and Linux builds are experimental. Public installers must pass the [release checklist](docs/14-open-source-release-checklist.md) and [release process](docs/15-release-process.md). Updates are installed manually; there is no automatic updater.

**Privacy:** library content is stored locally. Fetching web-reference metadata contacts the referenced site, and displaying remote Markdown images contacts their hosts. These requests expose the usual connection information, such as your IP address and requested URL. Offline use works for local content. Close the app and back up the entire vault, including `.kuskus`, before testing prerelease versions.

## Product context

Start with [the product brief](docs/00-product-brief.md) and [the active build plan](docs/07-build-plan.md). Repository conventions and required reading live in [AGENTS.md](AGENTS.md).

The standalone marketing website lives in [landing-page](landing-page/README.md). Its hero mockup is captured from the **App / Library states / Hero app mockup** Storybook story.

## Prerequisites

- pnpm 11.26.0 (requires Node.js 22 or later to run).
- Project scripts use Node.js 24.19.0, which pnpm downloads automatically during installation. The same version is pinned in `.mise.toml` for mise users.

## Development

```bash
pnpm install --frozen-lockfile
pnpm dev
```

To compile the desktop app, run `pnpm build`. The output is written to `out/`; run `pnpm start` to open it.

Electron downloads its native runtime on first use. To fetch it explicitly, run `pnpm exec install-electron`, then verify it with `pnpm exec electron --version` before starting the app. Runtime downloads require access to the official Electron release artifacts; a successful JavaScript build does not confirm the native runtime is available.

Development windows load [React Scan](https://github.com/aidenybai/react-scan) and [React Grab](https://github.com/aidenybai/react-grab) so you can see re-renders and copy a component's source for an agent. Neither package is included in packaged builds. React Scan's toolbar appears in the corner. Hold **Alt+C** to start React Grab, hover a control, then press **C** to copy its component stack.

### Component stories

```bash
pnpm storybook
```

Storybook previews renderer components in the browser at `http://localhost:6006`. Use its light/dark toolbar control to check both color modes. Stories cover buttons, file cards, folder dialogs, note cards, Markdown reading, and the live note editor. The note stories use local sample content; edits and checklist changes stay inside the preview. **App → Library states** renders the whole app with empty, notes-only, mixed-media, and missing-file libraries. These app stories use browser fixtures for the Electron APIs, so library changes do not touch files on disk. The accessibility panel checks the rendered stories. For workflows that need a real library, use `pnpm dev:demo` instead. Run `pnpm build:storybook` to verify the standalone story build.

### Fresh onboarding workspace

```bash
pnpm dev:onboarding
```

Each launch clears `.onboarding/` and starts with no library, saved theme, or other app preferences. The Create Library folder picker starts in `.onboarding/libraries/`; create test libraries there so the next launch clears them too. Libraries created elsewhere are not removed. This profile is separate from the normal development, demo, and packaged app profiles. Close the onboarding app before starting another run.

To clear the workspace without starting the app, run `pnpm onboarding:reset` after closing it.

### Isolated demo environment

Run Kuskus with a populated, repository-local profile:

```bash
pnpm dev:demo
```

The command creates `.demo/Fauzan\u2019s Library` and `.demo/user-data` on first use. This profile is completely separate from the normal development and packaged-app profiles. Changes made while testing persist between demo launches.

After closing the demo app, restore the original mock folders and data at any time:

```bash
pnpm demo:reset
```

Use `pnpm demo:seed` to create a missing demo library without resetting existing demo changes. The fixture represents a designer-developer actively dogfooding Kuskus, with recent working notes, original local visuals in several proportions, healthy URL references, a portable note attachment, partially populated folders, one Trash item, and a dedicated Markdown Lab containing focused feature fixtures plus a long stress document.

If `.demo` already exists, run `pnpm demo:reset` once to add or restore the canonical Markdown Lab. `demo:seed` intentionally preserves an existing profile and will not overwrite local dogfooding changes.

## Verification

```bash
pnpm check
pnpm audit --prod
```

## Packaging

```bash
pnpm build:win
pnpm build:mac
pnpm build:linux
```

These commands prepare local artifacts without publishing. `pnpm release` runs the verification suite and builds signed Windows installers; signing credentials are required. See the [release process](docs/15-release-process.md) before distributing them.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contributions and bug reports, and [SECURITY.md](SECURITY.md) for private vulnerability reporting.

## License

Kuskus is licensed under the [GNU General Public License, version 3 only](LICENSE)
(`GPL-3.0-only`). You may use, modify, and redistribute it, including commercially,
under the terms of that license. Distributed covered versions must include the
corresponding source code or provide access to it as required by the license.

Third-party code and dependencies retain their respective licenses and notices.
