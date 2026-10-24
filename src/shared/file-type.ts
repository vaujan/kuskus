import type { FileItemDto } from './library-contract'

export function isPdfFile(item: Pick<FileItemDto, 'mediaType' | 'contentFilename'>): boolean {
  return (
    item.mediaType.split(';', 1)[0].trim().toLowerCase() === 'application/pdf' ||
    item.contentFilename.toLowerCase().endsWith('.pdf')
  )
}
