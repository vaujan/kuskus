# Third-party and visual asset inventory

The production build generates THIRD_PARTY_NOTICES.txt from installed application dependencies and the vendored atomic editor notice. It reads license files and full README license sections, with reviewed version-specific supplements in `third-party/`. A dependency missing full license text fails the build. Electron's executable carries its own LICENSE.electron.txt and LICENSES.chromium.html; package inspection requires both.

The generator excludes the Electron npm downloader subtree, which is build tooling rather than app code. Dependencies reachable through other application packages remain included. The landing-page demo reuses application source and dependencies: its distribution also includes the generated notices and root license.

| Assets                                                                            | Source evidence                                                                               | Publication status                                                                                                                   |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/renderer/src/features/items/live/atomic/`                                    | MIT notice, Kenny Bergquist, retained from the source and included in generated notices       | Notice retained; maintain original attribution                                                                                       |
| Inter and IBM Plex Sans variable fonts                                            | Installed Fontsource packages include font license texts                                      | Included in generated notices                                                                                                        |
| Icon libraries and math/diagram rendering                                         | Installed dependency licenses                                                                 | Included in generated notices                                                                                                        |
| `resources/icon.png`, derived build icons, `landing-page/assets/kuskus-icon.webp` | Maintainer confirmed ownership on 2026-10-22                                                  | Cleared by maintainer for public redistribution                                                                                      |
| `landing-page/assets/bubuntu-line.svg`                                            | Maintainer confirmed ownership on 2026-10-22                                                  | Cleared by maintainer for public redistribution                                                                                      |
| `scripts/demo-assets/*.png`                                                       | Maintainer confirmed ownership on 2026-10-22                                                  | Cleared by maintainer for public redistribution                                                                                      |
| `.agents/skills/`                                                                 | Five upstream sources recorded in `skills-lock.json`; MIT declarations verified on 2026-10-22 | Source attribution and notices retained in [third-party/skills](../third-party/skills/README.md); excluded from application archives |

Artwork clearance records the maintainer's explicit confirmation, rather than inferring ownership from files being checked into Git. Preserve third-party notices when redistributing the repository. Review screenshots and sample text for personal information as well.

## Bookmark previews

Publisher images and book covers were removed from the browser demo on 2026-10-25 because their redistribution permission was not recorded. Demo bookmarks retain their titles, descriptions, and source links and use the app's normal cards without preview images. Do not reintroduce copied previews without recorded redistribution terms and attribution.

The removed images remain in earlier Git commits. Review their presence in published history before changing repository visibility; removing files from the current tree does not clear historical redistribution rights.
