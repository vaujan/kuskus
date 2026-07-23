import type {
  UrlPreviewDto,
  UrlPreviewKind,
  UrlPreviewMediaType
} from '../../shared/library-contract'
import { detectImage } from './items/image-item'

export const URL_PREVIEW_LIMITS: Record<UrlPreviewKind, { bytes: number; pixels: number }> = {
  preview: { bytes: 5 * 1024 * 1024, pixels: 100_000_000 },
  favicon: { bytes: 512 * 1024, pixels: 4_000_000 }
}

export const URL_PREVIEW_EXTENSIONS: Record<UrlPreviewMediaType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico'
}

function detectIco(bytes: Uint8Array): { width: number; height: number } | null {
  if (
    bytes.byteLength < 22 ||
    bytes[0] !== 0 ||
    bytes[1] !== 0 ||
    bytes[2] !== 1 ||
    bytes[3] !== 0
  ) {
    return null
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const count = view.getUint16(4, true)
  if (count < 1 || bytes.byteLength < 6 + count * 16) return null
  let width = 0
  let height = 0
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16
    const entryWidth = bytes[offset] || 256
    const entryHeight = bytes[offset + 1] || 256
    const size = view.getUint32(offset + 8, true)
    const imageOffset = view.getUint32(offset + 12, true)
    if (size === 0 || imageOffset < 6 + count * 16 || imageOffset + size > bytes.byteLength)
      return null
    width = Math.max(width, entryWidth)
    height = Math.max(height, entryHeight)
  }
  return { width, height }
}

export function validateUrlPreview(
  bytes: Uint8Array,
  contentType: string,
  kind: UrlPreviewKind
): { mediaType: UrlPreviewMediaType; extension: string } {
  const mime = contentType.split(';')[0].trim().toLowerCase()
  if (!mime.startsWith('image/')) throw new Error('The preview response is not an image.')
  const detected = detectImage(bytes)
  const ico = detected ? null : detectIco(bytes)
  const mediaType: UrlPreviewMediaType | null = detected?.mediaType ?? (ico ? 'image/x-icon' : null)
  if (!mediaType) throw new Error('The preview image format is not supported.')
  const acceptedMime =
    mime === mediaType ||
    (mediaType === 'image/jpeg' && mime === 'image/jpg') ||
    (mediaType === 'image/x-icon' && ['image/vnd.microsoft.icon', 'image/ico'].includes(mime))
  if (!acceptedMime) throw new Error('The preview image type does not match its content.')
  const dimensions = detected ?? ico
  if (!dimensions || dimensions.width * dimensions.height > URL_PREVIEW_LIMITS[kind].pixels) {
    throw new Error('The preview image dimensions are too large.')
  }
  return { mediaType, extension: URL_PREVIEW_EXTENSIONS[mediaType] }
}

export function toUrlPreviewDto(bytes: Uint8Array, mediaType: UrlPreviewMediaType): UrlPreviewDto {
  return {
    bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    mediaType
  }
}
