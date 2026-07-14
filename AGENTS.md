# Kuskus Repository Guidance

## Required context

Before changing product behavior, read the relevant documents in this order:

1. `docs/00-product-brief.md`
2. `docs/01-golden-workflows.md`
3. `docs/02-mvp-scope.md`
4. `docs/03-storage-contract.md`
5. `docs/04-interface-spec.md`
6. `docs/05-technical-decisions.md`
7. `docs/07-build-plan.md`

Use `docs/06-dogfooding-log.md` to record evidence from real use; do not use it as a source of settled requirements.

## Product constraints

- Kuskus is local-first and must work without an account, cloud service, or AI feature.
- User-readable library files are authoritative. Databases, previews, and caches must be rebuildable.
- Imported content is copied into the selected library for the MVP. Never modify or delete the external source.
- The universal Add Item composer accepts content before asking for metadata or organization.
- Every local item must support Show in Explorer through a validated main-process operation.
- Keep the MVP Windows-first without unnecessarily coupling domain logic to Windows.

## Architecture

- Preserve Electron context isolation, renderer sandboxing, and disabled Node integration.
- Filesystem, shell, dialogs, and network metadata operations belong in the main process or a controlled worker.
- Expose the narrowest practical typed API through the preload bridge.
- Treat all renderer input and persisted library contents as untrusted at native-operation boundaries.
- Keep shared IPC data structures in `src/shared/` and avoid exposing arbitrary filesystem operations to the renderer.

## Working conventions

- Preserve unrelated user changes in the worktree.
- Prefer small vertical slices that end in persistent, user-visible behavior.
- Record new architectural decisions in `docs/05-technical-decisions.md`.
- Add or update acceptance criteria when behavior changes.
- Use existing shadcn/ui primitives and the established theme before creating new foundational UI components.
- Do not add a dependency when the platform or current dependency set provides a clear solution.

## Verification

For implementation changes, run at minimum:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Also perform focused verification of the changed workflow. Storage changes require testing creation, restart/reload, invalid data, missing content, and path safety in proportion to the change.
