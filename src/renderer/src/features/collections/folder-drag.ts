export const KUSKUS_FOLDER_DRAG_TYPE = 'application/x-kuskus-folder-id'

export function hasKuskusFolderDrag(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(KUSKUS_FOLDER_DRAG_TYPE)
}

export function readKuskusFolderDrag(dataTransfer: DataTransfer): string | null {
  if (!hasKuskusFolderDrag(dataTransfer)) return null
  const folderId = dataTransfer.getData(KUSKUS_FOLDER_DRAG_TYPE)
  return folderId || null
}
