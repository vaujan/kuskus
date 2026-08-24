const assert = require('node:assert/strict')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const { NoteAutosaveCoordinator } = require('../src/renderer/src/features/items/note-autosave.ts')

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeNote(body) {
  return {
    schemaVersion: 1,
    id: 'item-1',
    type: 'note',
    title: 'Saved',
    body,
    createdAt: '2026-07-28T09:00:00.000Z',
    updatedAt: '2026-07-28T09:00:00.000Z',
    missingContent: false,
    attachments: [],
    location: { type: 'inbox' }
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createCoordinator(saves, delay = 800) {
  return new NoteAutosaveCoordinator({
    itemId: 'item-1',
    initialMarkdown: '# Saved',
    delay,
    save: async (input) => {
      saves.push(input)
      return { ok: true, data: makeNote(input.markdown) }
    },
    onSaved: () => undefined,
    onDraftReplaced: () => undefined
  })
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function flushMicrotasks() {
  for (let index = 0; index < 5; index += 1) {
    await new Promise((resolve) => setImmediate(resolve))
  }
}

test('autosaves draft changes after the debounce delay', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const saves = []
  const coordinator = createCoordinator(saves)
  coordinator.subscribe(() => undefined)

  coordinator.updateDraft('# Saved\n\nchanged')
  assert.equal(coordinator.getSnapshot().status, 'dirty')

  t.mock.timers.tick(800)
  await flushMicrotasks()

  assert.equal(saves.length, 1)
  assert.equal(saves[0].markdown, '# Saved\n\nchanged')
  assert.equal(saves[0].expectedMarkdown, '# Saved')
  assert.equal(coordinator.getSnapshot().status, 'saved')
  coordinator.dispose()
})

test('revives after a StrictMode-style dispose and keeps autosaving', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const saves = []
  const coordinator = createCoordinator(saves)

  // React StrictMode runs effect setup -> cleanup -> setup on mount, which calls
  // dispose() on the memoized coordinator before the subscription is restored.
  coordinator.subscribe(() => undefined)
  coordinator.dispose()
  coordinator.subscribe(() => undefined)

  coordinator.updateDraft('# Saved\n\nchanged')
  assert.equal(coordinator.getSnapshot().draft, '# Saved\n\nchanged')
  assert.equal(coordinator.getSnapshot().status, 'dirty')

  t.mock.timers.tick(800)
  await flushMicrotasks()

  assert.equal(saves.length, 1)
  assert.equal(saves[0].markdown, '# Saved\n\nchanged')
  assert.equal(coordinator.getSnapshot().status, 'saved')
  coordinator.dispose()
})

test('restores a pending autosave when a dirty draft survives a remount', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const saves = []
  const coordinator = createCoordinator(saves)
  coordinator.subscribe(() => undefined)

  coordinator.updateDraft('# Saved\n\nchanged')
  coordinator.dispose()
  coordinator.subscribe(() => undefined)

  t.mock.timers.tick(800)
  await flushMicrotasks()

  assert.equal(saves.length, 1)
  assert.equal(saves[0].markdown, '# Saved\n\nchanged')
  coordinator.dispose()
})

test('keeps an empty edit quiet and resumes autosave when typing continues', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const saves = []
  const coordinator = createCoordinator(saves)
  coordinator.subscribe(() => undefined)

  coordinator.updateDraft('   ')
  assert.equal(coordinator.getSnapshot().status, 'dirty')
  assert.equal(coordinator.getSnapshot().error, null)
  t.mock.timers.tick(1600)
  await flushMicrotasks()
  assert.equal(saves.length, 0)

  coordinator.updateDraft('# Replacement')
  t.mock.timers.tick(800)
  await flushMicrotasks()
  assert.equal(saves.length, 1)
  assert.equal(saves[0].markdown, '# Replacement')
  coordinator.dispose()
})

test('distinguishes an imported empty note from a cleared saved note on flush', async () => {
  const cleared = createCoordinator([])
  cleared.subscribe(() => undefined)
  cleared.updateDraft('')
  assert.equal(await cleared.flush(), false)
  cleared.dispose()

  const imported = new NoteAutosaveCoordinator({
    itemId: 'item-2',
    initialMarkdown: '   ',
    save: async (input) => ({ ok: true, data: makeNote(input.markdown) }),
    onSaved: () => undefined,
    onDraftReplaced: () => undefined
  })
  imported.subscribe(() => undefined)
  assert.equal(await imported.flush(), true)
  imported.dispose()
})

test('ignores stale library refreshes without replacing the current draft', () => {
  const replacements = []
  const coordinator = new NoteAutosaveCoordinator({
    itemId: 'item-1',
    initialMarkdown: '# Current',
    initialUpdatedAt: '2026-07-28T10:00:00.000Z',
    save: async () => ({ ok: true, data: makeNote('# Current') }),
    onSaved: () => undefined,
    onDraftReplaced: (markdown) => replacements.push(markdown)
  })

  assert.equal(
    coordinator.acceptDiskVersion({
      ...makeNote('# Stale'),
      updatedAt: '2026-07-28T09:00:00.000Z'
    }),
    false
  )
  assert.equal(coordinator.getSnapshot().draft, '# Current')
  assert.deepEqual(replacements, [])
  coordinator.dispose()
})

test('accepts a newer disk version when there are no local changes', () => {
  const replacements = []
  const coordinator = new NoteAutosaveCoordinator({
    itemId: 'item-1',
    initialMarkdown: '# Current',
    initialUpdatedAt: '2026-07-28T09:00:00.000Z',
    save: async () => ({ ok: true, data: makeNote('# Current') }),
    onSaved: () => undefined,
    onDraftReplaced: (markdown) => replacements.push(markdown)
  })

  assert.equal(
    coordinator.acceptDiskVersion({
      ...makeNote('# External'),
      updatedAt: '2026-07-28T10:00:00.000Z'
    }),
    true
  )
  assert.equal(coordinator.getSnapshot().draft, '# External')
  assert.deepEqual(replacements, ['# External'])
  coordinator.dispose()
})

test('stays disposed after the final unmount and ignores late updates', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const saves = []
  const coordinator = createCoordinator(saves)
  coordinator.subscribe(() => undefined)

  coordinator.dispose()
  coordinator.updateDraft('# Saved\n\nchanged')

  assert.equal(coordinator.getSnapshot().draft, '# Saved')
  assert.equal(coordinator.getSnapshot().status, 'saved')

  t.mock.timers.tick(1600)
  await flushMicrotasks()
  assert.equal(saves.length, 0)
})

test('flush saves edits made while an earlier save is in flight in order', async () => {
  const saves = []
  let finishFirstSave
  const coordinator = new NoteAutosaveCoordinator({
    itemId: 'item-1',
    initialMarkdown: '# Saved',
    save: async (input) => {
      saves.push(input)
      if (saves.length === 1) {
        await new Promise((resolve) => {
          finishFirstSave = resolve
        })
      }
      return { ok: true, data: makeNote(input.markdown) }
    },
    onSaved: () => undefined,
    onDraftReplaced: () => undefined
  })

  coordinator.updateDraft('# First edit')
  const flushed = coordinator.flush()
  await flushMicrotasks()
  coordinator.updateDraft('# Second edit')
  finishFirstSave()

  assert.equal(await flushed, true)
  assert.deepEqual(
    saves.map(({ markdown, expectedMarkdown }) => ({ markdown, expectedMarkdown })),
    [
      { markdown: '# First edit', expectedMarkdown: '# Saved' },
      { markdown: '# Second edit', expectedMarkdown: '# First edit' }
    ]
  )
  coordinator.dispose()
})
