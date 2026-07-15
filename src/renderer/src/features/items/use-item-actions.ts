export function useItemActions(
  itemId: string,
  onError: (error: string) => void
): { open: () => Promise<void>; reveal: () => Promise<void> } {
  return {
    open: async (): Promise<void> => {
      const result = await window.kuskus.openItem(itemId)
      if (!result.ok) onError(result.error)
    },
    reveal: async (): Promise<void> => {
      const result = await window.kuskus.showItemInExplorer(itemId)
      if (!result.ok) onError(result.error)
    }
  }
}
