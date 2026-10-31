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

## Public deployment on Vercel

Production: [kuskus-tau.vercel.app](https://kuskus-tau.vercel.app). The `kuskus` project is linked
to `vaujan/kuskus` in the `ahmad-fauzans-projects-9878f23f` Vercel scope, with `main` as the
production branch. The first production upload reached Ready on 2026-10-23 (Asia/Jayapura).
Vercel Authentication protects preview deployments only; production is public.

Import the repository with its root directory set to the repository root, not `landing-page`.
The root `vercel.json` defines installation, website type checking/building, and the
`landing-page/dist` output. Electron's runtime download is skipped for this static website build. The Vercel install
uses `--force` because its dependency cache can restore `node_modules` without pnpm's
package-store indexes; license generation requires those indexes to be rebuilt.
The uploaded source includes the renderer and license-generation inputs; `.vercelignore` excludes
local profiles, scratch work, credentials, and generated builds.

Use an authenticated Vercel CLI to link the intended project and run `vercel deploy --prod` from
the repository root. Verify the deployment reaches Ready in Vercel. The CLI's local `.vercel/`
linkage is ignored by Git. No website runtime environment variables or backend are required.
Keep production deployment protection disabled if the site is intended to be publicly accessible.
For this project's CLI commands, use `--scope ahmad-fauzans-projects-9878f23f`.

Connect the GitHub repository in Vercel for subsequent deployments. Configure `main` as the
production branch, preview deployments for pull requests, and required GitHub checks before
merging. A CLI upload alone does not establish Git integration or branch protection. Use Vercel's
deployment history to roll back production to a previously verified deployment.
The first deployment uploaded the local working tree without committing or pushing it. Commit
the deployment configuration and intended website changes before relying on later Git deployments.

Before announcing, confirm the public source link is accessible, check `/`, `/download.html`,
`/preview.html`, `/LICENSE`, and `/THIRD_PARTY_NOTICES.txt`, and inspect mobile/keyboard use.
Website publication does not publish desktop installers or make the GitHub repository public.

## Edit the interactive demo

Learn, Build, Research, and Create sit above the mockup. Each tab has an icon and a short description. `src/demo-personas.ts` defines their content and appearance presets; `src/demo-tabs.ts` handles keyboard navigation and sends the selected preset to the preview.

The student library contains 55 items from `../src/renderer/src/demo/student-library-fixtures.ts`. The developer, researcher, and creative libraries each contain 18 original notes and real bookmarks in `src/persona-libraries.ts`. The creative library is an editorial newsletter project; no generated photographs or fictitious participant records are included.

`src/preview.tsx` mounts one React root in one persistent iframe. `src/demo-app.tsx` installs the demo API and handles content and appearance changes. Same-origin messages switch its library and update the existing settings provider; the iframe does not navigate. Only the active workspace renders, with library-specific state initialized when switching collections of demo content. Each persona has its own session key, so returning to a tab restores its folder and open item. The demo uses 90% zoom, a 208px sidebar, and a 320px item rail. Note editing and creation work temporarily in memory, with no disk writes or browser persistence. Other write actions remain unavailable.

Bookmark cards use bundled copies of the actual social preview images and icons advertised by their linked pages. Source pages, image URLs, and capture dates are recorded in `../src/renderer/src/demo/assets/bookmarks/sources.json`. Links without a usable image show the no-preview state. Visitors make no requests to publishers for these images. Run `node scripts/cache-demo-previews.cjs` from the repository root to refresh the snapshots, then review the assets and manifest before committing. Normal builds use the checked-in files without fetching remote pages.

## Platform logos

The macOS (Apple), Windows, and Linux logos in `assets/os-*.svg` come from [Simple Icons 11.15.0](https://github.com/simple-icons/simple-icons/tree/11.15.0), distributed under [CC0-1.0](https://github.com/simple-icons/simple-icons/blob/11.15.0/LICENSE.md). Their fill color matches the landing page. Brand marks remain subject to their owners’ trademark guidelines.

## Download page

`download.html` and `download-id.html` load the latest published GitHub
release (including explicitly labeled experimental previews) through the public GitHub API. Windows NSIS (`-setup.exe`), macOS (`.dmg`), and
Linux (`.AppImage`) assets appear as direct downloads with their filenames (including
architecture) and sizes. Source archives and a link to all release files, checksums,
and notes use the same release tag. Platform icons on the landing page open the matching
OS section. Installation guidance and experimental macOS/Linux labels appear in both languages.

Publish tested artifacts on GitHub Releases to make them appear without rebuilding the
website. Only architectures actually attached to the latest release are offered. An OS
without a matching artifact remains unavailable; an unpublished release or an API error
shows an explicit status with a permanent GitHub Releases link. JavaScript is required
for the inline file list. The public API requires no credentials and may be rate limited.
Publishing source or the website does not publish installers or verify signing/native
installation. Follow the repository release process before attaching public artifacts.

## Languages and builder attribution

English is available at `index.html` and `download.html`; Bahasa Indonesia at
`index-id.html` and `download-id.html`. Each page has a native language dropdown that opens the equivalent page in
the other language, preserving the current section. Pages and language options declare
their languages. `src/language-select.ts` handles navigation.
Keep both static versions in sync when changing copy. Demo tabs are translated in
`src/demo-tabs.ts`; the embedded app interface and example library remain in English.
Builder credits must refer to [@buildfrombed](https://x.com/buildfrombed).

## Live feature cards

One feature section contains all six interactive cards, embedding actual renderer components through
`how-card.html?kind=capture|write|return|edit|diagram|links&embed=1`, lazy-loaded by
`src/live-card-frames.ts`. Text is selectable, search filters example notes, and
capture uses an in-memory draft with saving, file import, and draft actions disabled. Portal menus scale with the embedded scene. The writing preview reuses the app mode button to cycle Live, Markdown, and Read, sharing temporary edits across all three modes and using the app ScrollArea. Both languages share these previews.

Edit example content in `src/how-card.tsx` and framing in `src/how-card.css`.
Each scene uses a 520 × 390 layout, scaled to its card while keeping native DOM
content. Preview settings are isolated from the hero and app preferences. The
background uses the landing page’s muted green palette, without gradients.

Three icon cards highlight local/offline use, no account requirement, and free/open-source availability. Feature and ownership cards have no borders and show a muted background only on hover. App previews keep their own framing.
