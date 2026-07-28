const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true
    },
    fileName: filename
  })
  module._compile(output.outputText, filename)
}

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
