# Kuskus landing page

This is a separate website project. Its build bundles the real Kuskus renderer with an illustrative local demo library, so the hero remains interactive after deployment. The built site does not need Electron or Storybook at runtime.

## Run locally

```bash
cd landing-page
pnpm dev
```

Open `http://127.0.0.1:4173`.

## Build

```bash
pnpm typecheck
pnpm build
```

Deploy the generated `dist/` directory to any static host. Building from source requires the app repository because the preview imports its renderer and demo fixture.

## Edit the hero mockup

The preview uses the real Kuskus UI and the same fixture as the **App / Library states / Hero app mockup** Storybook story. Edit `src/renderer/src/demo/app-preview-fixtures.ts` in the app repository to change the displayed project.

The collection and article shown in the preview are illustrative demo content. Actions that would write to a library are unavailable in the demo.
