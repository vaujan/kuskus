export interface CardPosition {
  column: number
  top: number
  height: number
}

export function layoutCards(
  items: readonly { id: string }[],
  columns: number,
  heights: ReadonlyMap<string, number>,
  leading: boolean,
  grid: boolean,
  gap = 16,
  estimatedHeight = 340
): { cards: CardPosition[]; height: number } {
  const bottoms = Array<number>(columns).fill(0)
  if (leading) bottoms[0] = (heights.get('$leading') ?? estimatedHeight) + gap
  const cards = items.map((item, index) => {
    const slot = index + (leading ? 1 : 0)
    const column = slot % columns
    if (grid && column === 0) bottoms.fill(Math.max(...bottoms))
    const top = bottoms[column]
    const height = heights.get(item.id) ?? estimatedHeight
    bottoms[column] = top + height + gap
    return { column, top, height }
  })
  return { cards, height: Math.max(0, ...bottoms) > 0 ? Math.max(...bottoms) - gap : 0 }
}

export function cardsInViewport(
  cards: readonly CardPosition[],
  top: number,
  height: number
): Set<number> {
  const indices = new Set<number>()
  for (let index = 0; index < cards.length; index++) {
    const card = cards[index]
    if (card.top + card.height >= top - 600 && card.top <= top + height + 600) {
      indices.add(index)
    }
  }
  return indices
}
