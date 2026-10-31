import type { UrlItemDto, UrlPreviewDto, UrlPreviewKind } from '../../../shared/library-contract'

// Original demo artwork, rather than copies of third-party website images.
export async function demoUrlPreview(
  item: UrlItemDto,
  kind: UrlPreviewKind
): Promise<UrlPreviewDto> {
  const canvas = document.createElement('canvas')
  const favicon = kind === 'favicon'
  canvas.width = favicon ? 64 : 1200
  canvas.height = favicon ? 64 : 630
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not render the demo link preview.')

  context.fillStyle = '#172b3a'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#7dd3fc'
  if (favicon) {
    context.font = 'bold 40px sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(
      item.domain
        .replace(/^www\./, '')
        .charAt(0)
        .toUpperCase(),
      32,
      34
    )
  } else {
    context.fillRect(64, 64, 64, 8)
    context.font = '28px sans-serif'
    context.fillText(item.domain, 64, 128, 1072)
    context.fillStyle = '#f0f9ff'
    context.font = 'bold 56px sans-serif'
    const words = item.title.split(/\s+/)
    let line = ''
    let y = 250
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (line && context.measureText(next).width > 1072) {
        context.fillText(line, 64, y, 1072)
        y += 72
        line = word
      } else {
        line = next
      }
    }
    context.fillText(line, 64, y, 1072)
    context.fillStyle = '#9ab4c5'
    context.font = '22px sans-serif'
    context.fillText('Kuskus demo · Link preview', 64, 566)
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result)
      else reject(new Error('Could not encode the demo link preview.'))
    }, 'image/png')
  })
  return { bytes: await blob.arrayBuffer(), mediaType: 'image/png' }
}
