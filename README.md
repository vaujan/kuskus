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
