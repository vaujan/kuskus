export const KUSU_FOLDER_DRAG_TYPE = 'application/x-kusu-folder-id'

export function hasKusuFolderDrag(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(KUSU_FOLDER_DRAG_TYPE)
}

export function readKusuFolderDrag(dataTransfer: DataTransfer): string | null {
  if (!hasKusuFolderDrag(dataTransfer)) return null
  const folderId = dataTransfer.getData(KUSU_FOLDER_DRAG_TYPE)
  return folderId || null
}
