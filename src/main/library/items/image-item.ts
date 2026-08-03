import type {
  ImageImportInput,
  ImageItemDto,
  ItemLocation,
  SupportedImageMediaType
} from '../../../shared/library-contract'
import { IMAGE_EXTENSIONS, MAXIMUM_IMAGE_BYTES } from '../constants'
import type { PersistedImageItem } from '../schemas'

export interface DetectedImage {
  mediaType: SupportedImageMediaType
  width: number
  height: number
}

export function validateImageInput(input: ImageImportInput): Uint8Array {
  if (!input || typeof input !== 'object' || !(input.bytes instanceof ArrayBuffer)) {
    throw new Error('The image data is invalid.')
  }
  if (
    typeof input.mediaType !== 'string' ||
    (input.sourceFilename !== null && typeof input.sourceFilename !== 'string')
  ) {
    throw new Error('The image details are invalid.')
  }

  const bytes = new Uint8Array(input.bytes)
  if (bytes.byteLength === 0) throw new Error('The image is empty.')
  if (bytes.byteLength > MAXIMUM_IMAGE_BYTES) {
    throw new Error('Images larger than 25 MB cannot be imported yet.')
  }
  return bytes
}

export function detectImage(bytes: Uint8Array): DetectedImage | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const has = (...values: number[]): boolean =>
    values.every((value, index) => bytes[index] === value)
  const dimensions = (width: number, height: number): { width: number; height: number } | null =>
    width > 0 && height > 0 && width <= 50_000 && height <= 50_000 ? { width, height } : null

  if (bytes.byteLength >= 24 && has(137, 80, 78, 71, 13, 10, 26, 10)) {
    const size = dimensions(view.getUint32(16), view.getUint32(20))
    return size && { mediaType: 'image/png', ...size }
  }
  if (bytes.byteLength >= 10 && (has(71, 73, 70, 56, 55, 97) || has(71, 73, 70, 56, 57, 97))) {
    const size = dimensions(view.getUint16(6, true), view.getUint16(8, true))
    return size && { mediaType: 'image/gif', ...size }
  }
  if (bytes.byteLength >= 26 && has(66, 77)) {
    const size = dimensions(Math.abs(view.getInt32(18, true)), Math.abs(view.getInt32(22, true)))
    return size && { mediaType: 'image/bmp', ...size }
  }
  if (
    bytes.byteLength >= 12 &&
    has(82, 73, 70, 70) &&
    bytes[8] === 87 &&
    bytes[9] === 69 &&
    bytes[10] === 66 &&
    bytes[11] === 80
  ) {
    const chunk = String.fromCharCode(...bytes.slice(12, 16))
    if (chunk === 'VP8X' && bytes.byteLength >= 30) {
      const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16)
      const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)
      const size = dimensions(width, height)
      return size && { mediaType: 'image/webp', ...size }
    }
    if (chunk === 'VP8L' && bytes.byteLength >= 25 && bytes[20] === 47) {
      const bits = view.getUint32(21, true)
      const size = dimensions((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1)
      return size && { mediaType: 'image/webp', ...size }
    }
    if (
      chunk === 'VP8 ' &&
      bytes.byteLength >= 30 &&
      bytes[23] === 157 &&
      bytes[24] === 1 &&
      bytes[25] === 42
    ) {
      const size = dimensions(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff)
      return size && { mediaType: 'image/webp', ...size }
    }
  }
  if (bytes.byteLength >= 4 && has(255, 216, 255)) {
    let offset = 2
    while (offset + 9 < bytes.byteLength) {
      if (bytes[offset] !== 255) {
        offset += 1
        continue
      }
      const marker = bytes[offset + 1]
      const length = view.getUint16(offset + 2)
      if (length < 2 || offset + 2 + length > bytes.byteLength) break
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203].includes(marker)) {
        const size = dimensions(view.getUint16(offset + 7), view.getUint16(offset + 5))
        return size && { mediaType: 'image/jpeg', ...size }
      }
      offset += 2 + length
    }
  }
  return null
}

export function safeSourceFilename(filename: string | null): string | null {
  if (!filename) return null
  const safe = filename
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
    .slice(0, 160)
  return safe || null
}

export function deriveImageTitle(filename: string | null): string {
  const safe = safeSourceFilename(filename)
  if (!safe) return 'Pasted image'
  return (
    safe
      .replace(/\.[^.]+$/, '')
      .trim()
      .slice(0, 120) || 'Image'
  )
}

export function createImageMetadata(
  id: string,
  sourceFilename: string | null,
  detected: DetectedImage,
  timestamp: string
): PersistedImageItem {
  const contentFilename = `image.${IMAGE_EXTENSIONS[detected.mediaType]}`
  return {
    schemaVersion: 2,
    id,
    type: 'image',
    title: deriveImageTitle(sourceFilename),
    createdAt: timestamp,
    updatedAt: timestamp,
    sourceUrl: null,
    sourceFilename: safeSourceFilename(sourceFilename),
    contentFilename,
    mediaType: detected.mediaType,
    width: detected.width,
    height: detected.height,
    note: '',
    originalCollectionId: null
  }
}

export function toImageDto(
  metadata: PersistedImageItem,
  location: ItemLocation = { type: 'inbox' }
): ImageItemDto {
  return {
    ...metadata,
    missingContent: false,
    location,
    relativePath: metadata.relativePath ?? metadata.contentFilename,
    referencedAttachment: metadata.referencedAttachment ?? false,
    attachmentOrigin: metadata.attachmentOrigin ?? null
  }
}
