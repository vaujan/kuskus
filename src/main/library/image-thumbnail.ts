import type { ImagePreviewDto } from '../../shared/library-contract'

export const CARD_THUMBNAIL_EDGE = 512

export function fitThumbnailSize(
  width: number,
  height: number,
  maximumEdge = CARD_THUMBNAIL_EDGE
): { width: number; height: number } {
  const scale = Math.min(1, maximumEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  }
}

export async function createImageThumbnail(
  bytes: Buffer,
  width: number,
  height: number
): Promise<ImagePreviewDto> {
  const { nativeImage } = await import('electron')
  const size = fitThumbnailSize(width, height)
  const image = nativeImage.createFromBuffer(bytes)
  if (image.isEmpty()) throw new Error('The saved image could not be decoded.')
  const resized = size.width === width && size.height === height ? image : image.resize(size)
  const thumbnail = resized.toPNG()
  return {
    bytes: thumbnail.buffer.slice(
      thumbnail.byteOffset,
      thumbnail.byteOffset + thumbnail.byteLength
    ) as ArrayBuffer,
    mediaType: 'image/png',
    ...size
  }
}
