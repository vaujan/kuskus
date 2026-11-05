/* eslint-disable @typescript-eslint/explicit-function-return-type */
const assert = require('node:assert/strict')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()
const {
  UrlEnrichmentQueue
} = require('../src/renderer/src/features/library/url-enrichment-queue.ts')
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}
const links = (count) =>
  Array.from({ length: count }, (_, id) => ({
    id: String(id),
    type: 'url',
    metadataStatus: 'pending',
    metadataVersion: 2
  }))

test('URL enrichment bounds requests and batches completions rather than publishing per link', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const requested = []
  const resolvers = new Map()
  const batches = []
  const queue = new UrlEnrichmentQueue(
    (id) => {
      requested.push(id)
      return new Promise((resolve) => resolvers.set(id, resolve))
    },
    (items) => batches.push(items)
  )
  t.after(() => queue.dispose())
  const items = links(20)
  queue.sync(items)
  await flush()
  assert.equal(requested.length, 4)
  for (const id of requested.slice())
    resolvers.get(id)({ ok: true, data: { ...items[Number(id)], metadataStatus: 'ready' } })
  await flush()
  assert.equal(requested.length, 8)
  assert.equal(batches.length, 0)
  t.mock.timers.tick(100)
  assert.equal(batches.length, 1)
  assert.equal(batches[0].length, 4)
  queue.sync(items)
  await flush()
  assert.equal(requested.length, 8, 'in-flight and completed IDs are not requested twice')
})

test('URL enrichment drops removed queued items and ignores completions after vault disposal', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const resolvers = []
  const requested = []
  const published = []
  const queue = new UrlEnrichmentQueue(
    (id) => {
      requested.push(id)
      return new Promise((resolve) => resolvers.push(resolve))
    },
    (batch) => published.push(batch)
  )
  queue.sync(links(8))
  await flush()
  queue.sync([])
  resolvers[0]({ ok: false, error: { message: 'offline' } })
  await flush()
  assert.equal(requested.length, 4)
  queue.dispose()
  resolvers[1]({ ok: true, data: links(2)[1] })
  await flush()
  t.mock.timers.tick(1000)
  assert.deepEqual(published, [])
})

test('background metadata yields to recent interaction before requesting or publishing more work', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })
  const requested = []
  const resolvers = []
  const batches = []
  const queue = new UrlEnrichmentQueue(
    (id) => {
      requested.push(id)
      return new Promise((resolve) => resolvers.push(resolve))
    },
    (items) => batches.push(items)
  )
  t.after(() => queue.dispose())
  queue.deferForInteraction()
  queue.sync(links(8))
  await flush()
  assert.equal(requested.length, 0)
  t.mock.timers.tick(150)
  await flush()
  assert.equal(requested.length, 4)
  queue.deferForInteraction()
  for (const [index, resolve] of resolvers.entries())
    resolve({ ok: true, data: { ...links(4)[index], metadataStatus: 'ready' } })
  await flush()
  t.mock.timers.tick(100)
  await flush()
  assert.equal(requested.length, 4)
  assert.equal(batches.length, 0)
  t.mock.timers.tick(50)
  await flush()
  assert.equal(requested.length, 8)
  assert.equal(batches.length, 1)
})
