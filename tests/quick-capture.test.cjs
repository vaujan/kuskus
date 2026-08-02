const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { mkdtemp, rm } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
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

const {
  calculateQuickCaptureBounds,
  clampQuickCaptureHeight,
  QUICK_CAPTURE_INITIAL_HEIGHT
} = require('../src/main/window/quick-capture-bounds.ts')
const { resolveQuickCapturePresentation } = require('../src/main/window/quick-capture-material.ts')
const {
  CaptureSessionService,
  StaleCaptureSessionError
} = require('../src/main/capture/capture-session-service.ts')
const { CaptureSubmissionService } = require('../src/main/capture/capture-submission-service.ts')
const {
  CaptureDraftTracker
} = require('../src/renderer/src/features/capture/capture-draft-tracker.ts')
const { LibraryService } = require('../src/main/library/library-service.ts')

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL88wAAAABJRU5ErkJggg==',
  'base64'
)

test('anchors quick capture inside the active display work area and clamps its height', () => {
  const workArea = { x: 1920, y: 0, width: 1920, height: 1040 }
  assert.deepEqual(calculateQuickCaptureBounds(workArea, 500), {
    x: 3408,
    y: 524,
    width: 416,
    height: 500
  })
  assert.equal(clampQuickCaptureHeight(900, workArea), 728)
  assert.equal(clampQuickCaptureHeight(120, workArea), 160)
  assert.equal(clampQuickCaptureHeight(Number.NaN, workArea), QUICK_CAPTURE_INITIAL_HEIGHT)
  assert.deepEqual(calculateQuickCaptureBounds({ x: 0, y: 0, width: 320, height: 480 }, 900), {
    x: 16,
    y: 128,
    width: 288,
    height: 336
  })
})

test('resolves quick-capture material and corner ownership by platform capability', () => {
  assert.deepEqual(resolveQuickCapturePresentation('win32', '10.0.22621', false), {
    material: 'acrylic',
    corners: 'native',
    acrylicCapable: true
  })
  assert.deepEqual(resolveQuickCapturePresentation('win32', '10.0.26100', true), {
    material: 'opaque',
    corners: 'native',
    acrylicCapable: true
  })
  assert.deepEqual(resolveQuickCapturePresentation('win32', '10.0.22000', false), {
    material: 'opaque',
    corners: 'native',
    acrylicCapable: false
  })
  assert.deepEqual(resolveQuickCapturePresentation('win32', 'unknown', false), {
    material: 'opaque',
    corners: 'css',
    acrylicCapable: false
  })
  assert.deepEqual(resolveQuickCapturePresentation('darwin', '24.0.0', false), {
    material: 'opaque',
    corners: 'css',
    acrylicCapable: false
  })
  assert.deepEqual(resolveQuickCapturePresentation('linux', '6.8.0', false), {
    material: 'opaque',
    corners: 'css',
    acrylicCapable: false
  })
})

test('persists revisioned capture text and rejects stale or inactive writers', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-capture-session-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const path = join(root, 'sessions.json')
  const service = new CaptureSessionService(path)
  await service.initialize()

  const claimed = service.claim('library-one', 'main')
  const updated = await service.update('library-one', claimed.revision, 'Keep this', 'main')
  await assert.rejects(
    () => service.update('library-one', claimed.revision, 'Stale', 'main'),
    StaleCaptureSessionError
  )
  service.setBusy('library-one', 'main', true)
  assert.throws(() => service.claim('library-one', 'quick'), /still saving or staging/i)
  service.setBusy('library-one', 'main', false)
  service.claim('library-one', 'quick')
  await assert.rejects(
    () => service.update('library-one', updated.revision, 'Wrong owner', 'main'),
    /no longer active/i
  )

  const reopened = new CaptureSessionService(path)
  await reopened.initialize()
  assert.equal(reopened.get('library-one').markdown, 'Keep this')
  assert.equal(reopened.get('library-one').owner, null)
})

test('tracks staged-asset changes independently and clears the complete draft revision', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-capture-assets-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const service = new CaptureSessionService(join(root, 'sessions.json'))
  service.claim('library-two', 'quick')
  const touched = await service.touchAssets('library-two')
  assert.equal(touched.assetsRevision, 1)
  const cleared = await service.clear('library-two')
  assert.equal(cleared.markdown, '')
  assert.equal(cleared.assetsRevision, 2)
})

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function captureSession(markdown, revision, owner = 'main', overrides = {}) {
  return {
    libraryId: 'library-one',
    revision,
    assetsRevision: 0,
    markdown,
    owner,
    busy: false,
    ...overrides
  }
}

test('does not let delayed capture acknowledgements replace newer optimistic input', () => {
  const tracker = new CaptureDraftTracker('')
  tracker.accept(captureSession('', 0), 'main')
  const h = tracker.edit('h')
  const he = tracker.edit('he')
  const hello = tracker.edit('hello')

  tracker.finish(h, captureSession('h', 1), 'main')
  assert.equal(tracker.getSnapshot().markdown, 'hello')
  tracker.finish(he, captureSession('he', 2), 'main')
  assert.equal(tracker.getSnapshot().markdown, 'hello')
  tracker.finish(hello, captureSession('hello', 3), 'main')

  assert.equal(tracker.getSnapshot().markdown, 'hello')
  assert.equal(tracker.getSnapshot().revision, 3)
})

test('tracks edit generations when the newest text matches an older acknowledgement', () => {
  const tracker = new CaptureDraftTracker('')
  tracker.accept(captureSession('', 0), 'main')
  const firstA = tracker.edit('a')
  const middle = tracker.edit('ab')
  const latestA = tracker.edit('a')

  tracker.finish(firstA, captureSession('a', 1), 'main')
  tracker.finish(middle, captureSession('ab', 2), 'main')
  assert.equal(tracker.getSnapshot().markdown, 'a')
  tracker.finish(latestA, captureSession('a', 3), 'main')

  assert.equal(tracker.getSnapshot().markdown, 'a')
  assert.equal(tracker.getSnapshot().revision, 3)
})

test('ignores stale session, busy, and asset responses while local capture input is pending', () => {
  const tracker = new CaptureDraftTracker('')
  tracker.edit('saved locally')

  tracker.accept(captureSession('saved', 4), 'main')
  tracker.accept(captureSession('saved', 4, 'main', { busy: true }), 'main')
  tracker.accept(captureSession('saved', 4, 'main', { assetsRevision: 1 }), 'main')
  tracker.accept(captureSession('older', 3), 'main')

  assert.equal(tracker.getSnapshot().markdown, 'saved locally')
  assert.equal(tracker.getSnapshot().revision, 4)
  assert.equal(tracker.getSnapshot().assetsRevision, 1)
})

test('ownership transfer applies the active surface draft and invalidates delayed writes', () => {
  const tracker = new CaptureDraftTracker('')
  tracker.accept(captureSession('shared', 1), 'main')
  const delayedMainWrite = tracker.edit('main typing')

  tracker.accept(captureSession('quick typing', 2, 'quick'), 'main')

  assert.equal(tracker.getSnapshot().markdown, 'quick typing')
  assert.equal(tracker.canPersist(delayedMainWrite, 'main'), false)
})

test('failed persistence leaves the newest local capture input intact', () => {
  const tracker = new CaptureDraftTracker('saved')
  tracker.accept(captureSession('saved', 1), 'main')
  const failed = tracker.edit('new unsaved text')

  tracker.finish(failed, null, 'main')
  tracker.accept(captureSession('saved', 1), 'main')

  assert.equal(tracker.getSnapshot().markdown, 'new unsaved text')
})

/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-empty-function */
class FakeCaptureLibrary {
  constructor() {
    this.records = []
    this.items = []
    this.commits = []
    this.releaseFirst = null
    this.blockFirst = false
    this.failNext = false
    this.restored = null
  }

  isReadyForCapture() {
    return true
  }

  async getCaptureContext() {
    return { libraryId: 'library-one', libraryPath: 'C:\\vault' }
  }

  async listCaptureSubmissions() {
    return this.records.map((record) => ({ ...record }))
  }

  async prepareCaptureSubmission(record) {
    if (!this.records.some((candidate) => candidate.id === record.id)) {
      this.records.push({ ...record })
    }
  }

  async updateCaptureSubmission(record) {
    const index = this.records.findIndex((candidate) => candidate.id === record.id)
    this.records[index] = { ...record }
  }

  async discardActiveCaptureDraft() {}

  async discardCaptureSubmission(id) {
    this.records = this.records.filter((record) => record.id !== id)
  }

  async commitCaptureSubmission(record) {
    this.commits.push(record.markdown)
    if (this.failNext) {
      this.failNext = false
      throw new Error('Simulated write failure')
    }
    if (this.blockFirst && this.commits.length === 1) {
      await new Promise((resolve) => {
        this.releaseFirst = resolve
      })
    }
    const item = {
      id: record.id,
      type: 'note',
      title: record.markdown,
      body: record.markdown,
      createdAt: record.submittedAt
    }
    this.items.push(item)
    return item
  }

  async enrichUrl() {}

  async restoreCaptureSubmissionDraft(id) {
    this.restored = id
  }
}
/* eslint-enable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-empty-function */

test('accepts rapid submissions into a FIFO queue without keeping the shared draft busy', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-capture-queue-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const sessions = new CaptureSessionService(join(root, 'sessions.json'))
  await sessions.initialize()
  const library = new FakeCaptureLibrary()
  library.blockFirst = true
  const queues = []
  const service = new CaptureSubmissionService(
    sessions,
    library,
    (queue) => queues.push(queue),
    () => undefined
  )
  await service.initialize()

  let session = sessions.claim('library-one', 'quick')
  const receipts = []
  for (const markdown of ['Hello world', 'Second note', 'Third note']) {
    session = await sessions.update('library-one', session.revision, markdown, 'quick')
    const input = {
      libraryId: 'library-one',
      expectedRevision: session.revision,
      kind: 'note',
      attachmentIds: [],
      fileId: null
    }
    const receipt = await service.submit(input, 'quick')
    const duplicate = await service.submit(input, 'quick')
    assert.equal(duplicate.id, receipt.id)
    receipts.push(receipt)
    session = sessions.get('library-one')
    assert.equal(session.markdown, '')
    assert.equal(session.busy, false)
  }

  assert.equal(library.records.length, 3)
  assert.deepEqual(library.commits, ['Hello world'])
  library.releaseFirst()
  const items = await Promise.all(receipts.map((receipt) => service.waitForSubmission(receipt.id)))
  assert.deepEqual(
    items.map((item) => item.body),
    ['Hello world', 'Second note', 'Third note']
  )
  assert.deepEqual(library.commits, ['Hello world', 'Second note', 'Third note'])
  assert.ok(queues.some((queue) => queue.pendingCount >= 2))
})

test('keeps failed submissions recoverable through retry, restore, and discard', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-capture-recovery-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const sessions = new CaptureSessionService(join(root, 'sessions.json'))
  await sessions.initialize()
  const library = new FakeCaptureLibrary()
  const service = new CaptureSubmissionService(
    sessions,
    library,
    () => undefined,
    () => undefined
  )
  await service.initialize()
  let session = sessions.claim('library-one', 'quick')

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const fail = async (markdown) => {
    session = await sessions.update('library-one', session.revision, markdown, 'quick')
    library.failNext = true
    const receipt = await service.submit(
      {
        libraryId: 'library-one',
        expectedRevision: session.revision,
        kind: 'note',
        attachmentIds: [],
        fileId: null
      },
      'quick'
    )
    session = sessions.get('library-one')
    await assert.rejects(() => service.waitForSubmission(receipt.id), /simulated write failure/i)
    return receipt
  }

  const retried = await fail('Retry me')
  assert.equal((await service.getQueue('library-one')).failures.length, 1)
  await service.retry(retried.id)
  const saved = await service.waitForSubmission(retried.id)
  assert.equal(saved.body, 'Retry me')

  const restored = await fail('Restore me')
  const restoredSession = await service.restore(restored.id, 'quick')
  assert.equal(restoredSession.markdown, 'Restore me')
  assert.equal(library.restored, restored.id)

  await sessions.clear('library-one')
  session = sessions.get('library-one')
  const discarded = await fail('Discard me')
  await service.discard(discarded.id)
  assert.equal((await service.getQueue('library-one')).failures.length, 0)
})

test('isolates and commits rapid mixed note, URL, image, and file submissions', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-capture-mixed-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const library = new LibraryService(join(root, 'settings.json'))
  const state = await library.createIn(root, 'Vault')
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  library.enrichUrl = () => Promise.reject(new Error('Offline test'))
  assert.equal(state.status, 'ready')
  const libraryId = state.library.id
  const sessions = new CaptureSessionService(join(root, 'sessions.json'))
  await sessions.initialize()
  const claimedSession = sessions.claim(libraryId, 'quick')
  const service = new CaptureSubmissionService(
    sessions,
    library,
    () => undefined,
    () => undefined
  )
  await service.initialize()

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const submit = async (kind, attachmentIds = [], fileId = null) => {
    const receipt = await service.submit(
      {
        libraryId,
        expectedRevision: sessions.get(libraryId).revision,
        kind,
        attachmentIds,
        fileId
      },
      'quick'
    )
    return service.waitForSubmission(receipt.id)
  }

  await sessions.update(libraryId, claimedSession.revision, 'Queued note', 'quick')
  const note = await submit('note')

  await sessions.update(
    libraryId,
    sessions.get(libraryId).revision,
    'https://example.com/',
    'quick'
  )
  const url = await submit('url')

  const image = await library.stageCaptureDraftImage({
    bytes: Uint8Array.from(onePixelPng).buffer,
    sourceFilename: 'pixel.png',
    mediaType: 'image/png'
  })
  await sessions.touchAssets(libraryId)
  const savedImage = await submit('image', [image.id])

  const file = await library.stageCaptureDraftFile({
    bytes: Uint8Array.from(Buffer.from('queued file')).buffer,
    sourceFilename: 'queued.txt',
    mediaType: 'text/plain'
  })
  await sessions.touchAssets(libraryId)
  const savedFile = await submit('file', [], file.id)

  assert.deepEqual(
    [note.type, url.type, savedImage.type, savedFile.type],
    ['note', 'url', 'image', 'file']
  )
  const reopened = await library.getState()
  assert.equal(reopened.status, 'ready')
  assert.equal(reopened.library.items.length, 4)
  assert.equal(new Set(reopened.library.items.map((item) => item.id)).size, 4)
  assert.equal((await service.getQueue(libraryId)).pendingCount, 0)
})

test('resumes an interrupted processing submission on launch without duplicating it', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-capture-resume-test-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const sessions = new CaptureSessionService(join(root, 'sessions.json'))
  await sessions.initialize()
  const library = new FakeCaptureLibrary()
  const id = '23be9c7b-ef27-4df4-a72a-704d52a22511'
  library.records.push({
    schemaVersion: 1,
    id,
    libraryId: 'library-one',
    kind: 'note',
    markdown: 'Resume me',
    attachmentIds: [],
    fileId: null,
    submittedAt: '2026-07-31T00:00:00.000Z',
    sourceRevision: 1,
    status: 'processing',
    attempts: 0,
    error: null
  })
  const service = new CaptureSubmissionService(
    sessions,
    library,
    () => undefined,
    () => undefined
  )
  await service.initialize()
  const item = await service.waitForSubmission(id)
  assert.equal(item.body, 'Resume me')
  assert.deepEqual(library.commits, ['Resume me'])
  assert.equal(library.items.length, 1)
})
