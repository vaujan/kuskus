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

## Edit the interactive demo

Learn, Build, Research, and Create sit above the mockup. Each tab has an icon and a short description. `src/demo-personas.ts` defines their content and appearance presets; `src/demo-tabs.ts` handles keyboard navigation and sends the selected preset to the preview.

The student library contains 55 items from `../src/renderer/src/demo/student-library-fixtures.ts`. The developer, researcher, and creative libraries each contain 18 original notes and real bookmarks in `src/persona-libraries.ts`. The creative library is an editorial newsletter project; no generated photographs or fictitious participant records are included.

`src/preview.tsx` mounts one React root in one persistent iframe. `src/demo-app.tsx` installs the demo API and handles content and appearance changes. Same-origin messages switch its library and update the existing settings provider; the iframe does not navigate. Only the active workspace renders, with library-specific state initialized when switching collections of demo content. Each persona has its own session key, so returning to a tab restores its folder and open item. The demo uses 90% zoom, a 208px sidebar, and a 320px item rail. Note editing and creation work temporarily in memory, with no disk writes or browser persistence. Other write actions remain unavailable.

Bookmark cards use local copies of publisher social previews, book covers, and site artwork. Source URLs are recorded in `../src/renderer/src/demo/assets/bookmarks/sources.json`.

## Platform logos

The macOS (Apple), Windows, and Linux logos in `assets/os-*.svg` come from [Simple Icons 11.15.0](https://github.com/simple-icons/simple-icons/tree/11.15.0), distributed under [CC0-1.0](https://github.com/simple-icons/simple-icons/blob/11.15.0/LICENSE.md). Their fill color matches the landing page. Brand marks remain subject to their owners’ trademark guidelines.

## Download page

`download.html` is a separate static entry in the Vite build and explains the outstanding desktop release gates. The landing page's primary actions lead to the browser demo; demo edits are temporary. Platform links and the release section open the repository’s GitHub Releases page. Switch to download actions only after verified installers are published, and update platform availability to match tested artifacts.
