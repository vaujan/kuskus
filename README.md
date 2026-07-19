# Kuskus

Kuskus is a private visual library for project references, stored on your computer. It is currently a Windows-first personal MVP built with Electron, React, and TypeScript.

The first implemented vertical slice supports:

- Creating or opening a local Kuskus library.
- Writing Markdown through the inline Add Item composer.
- Persisting readable `note.md` and `item.json` files.
- Reloading saved notes from disk.
- Revealing a note in Windows File Explorer.

## Product context

Start with [the product brief](docs/00-product-brief.md) and [the active build plan](docs/07-build-plan.md). Repository conventions and required reading live in [AGENTS.md](AGENTS.md).

## Prerequisites

- Node.js 22 or later.
- pnpm.

## Development

```bash
pnpm install
pnpm dev
```

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

Use `pnpm demo:seed` to create a missing demo library without resetting existing demo changes. The fixture represents a designer-developer actively dogfooding Kuskus, with recent working notes, original local visuals in several proportions, healthy URL references, a portable note attachment, partially populated folders, and one Trash item.

## Verification

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Packaging

```bash
pnpm build:win
pnpm build:mac
pnpm build:linux
```
