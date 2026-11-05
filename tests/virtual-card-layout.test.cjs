const assert = require('node:assert/strict')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()
const {
  layoutCards,
  cardsInViewport
} = require('../src/renderer/src/features/library/virtual-card-layout.ts')

test('6000-card browsing keeps the viewport window bounded at the start, middle and end', () => {
  const items = Array.from({ length: 6000 }, (_, id) => ({ id: String(id) }))
  const layout = layoutCards(items, 4, new Map(), false, false)
  for (const top of [0, layout.height / 2, layout.height - 900]) {
    const mounted = [...cardsInViewport(layout.cards, top, 900)]
    assert.ok(mounted.length > 0 && mounted.length < 40)
    for (const index of mounted) {
      const card = layout.cards[index]
      assert.ok(card.top + card.height >= top - 600 && card.top <= top + 1500)
    }
  }
  assert.ok(cardsInViewport(layout.cards, layout.height - 900, 900).has(5999))
})

test('ordered masonry preserves reading order and uses measured heights', () => {
  const items = ['a', 'b', 'c', 'd'].map((id) => ({ id }))
  const result = layoutCards(
    items,
    2,
    new Map([
      ['a', 100],
      ['b', 200]
    ]),
    false,
    false
  )
  assert.deepEqual(
    result.cards.map(({ column, top }) => [column, top]),
    [
      [0, 0],
      [1, 0],
      [0, 116],
      [1, 216]
    ]
  )
})

test('grid rows align below their tallest card and the composer occupies the first slot', () => {
  const items = ['a', 'b', 'c'].map((id) => ({ id }))
  const result = layoutCards(
    items,
    2,
    new Map([
      ['$leading', 200],
      ['a', 100]
    ]),
    true,
    true
  )
  assert.deepEqual(
    result.cards.map(({ column, top }) => [column, top]),
    [
      [1, 0],
      [0, 216],
      [1, 216]
    ]
  )
  assert.equal(layoutCards([], 2, new Map(), false, false).height, 0)
})

test('single-column focus rows remain bounded when navigating to the last of 6000 items', () => {
  const items = Array.from({ length: 6000 }, (_, id) => ({ id: String(id) }))
  const layout = layoutCards(items, 1, new Map(), false, false, 0, 96)
  const end = cardsInViewport(layout.cards, layout.height - 600, 600)
  assert.ok(end.has(5999))
  assert.ok(end.size < 25)
  assert.equal(layout.cards[5999].top, 5999 * 96)
})
