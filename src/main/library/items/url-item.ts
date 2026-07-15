import type { UrlItemDto } from '../../../shared/library-contract'
import type { PersistedUrlItem } from '../schemas'

const MAX_METADATA_TEXT = 500

export function validateWebUrl(value: string): URL {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    throw new Error('Paste a valid http or https link.')
  }
  return url
}

export function createUrlMetadata(
  id: string,
  sourceUrl: string,
  timestamp: string
): PersistedUrlItem {
  const url = validateWebUrl(sourceUrl)
  return {
    schemaVersion: 1,
    id,
    type: 'url',
    title: url.hostname,
    createdAt: timestamp,
    updatedAt: timestamp,
    sourceUrl,
    sourceFilename: null,
    contentFilename: null,
    domain: url.hostname,
    description: null,
    faviconUrl: null,
    previewImageUrl: null,
    metadataStatus: 'pending',
    metadataError: null,
    note: '',
    originalCollectionId: null
  }
}

export function toUrlDto(metadata: PersistedUrlItem): UrlItemDto {
  return {
    schemaVersion: metadata.schemaVersion,
    id: metadata.id,
    type: metadata.type,
    title: metadata.title,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
    sourceUrl: metadata.sourceUrl,
    domain: metadata.domain,
    description: metadata.description,
    faviconUrl: metadata.faviconUrl,
    previewImageUrl: metadata.previewImageUrl,
    metadataStatus: metadata.metadataStatus,
    metadataError: metadata.metadataError
  }
}

function decode(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim()
}

function metaValue(html: string, names: string[]): string | null {
  for (const name of names) {
    const expression = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`,
      'i'
    )
    const match = html.match(expression)
    if (match?.[1] || match?.[2]) return decode(match[1] || match[2]).slice(0, MAX_METADATA_TEXT)
  }
  return null
}

export function extractUrlMetadata(
  html: string,
  pageUrl: URL
): Pick<PersistedUrlItem, 'title' | 'description' | 'faviconUrl' | 'previewImageUrl'> {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const rawTitle =
    metaValue(html, ['og:title', 'twitter:title']) || (titleMatch ? decode(titleMatch[1]) : null)
  const resolve = (value: string | null): string | null => {
    if (!value) return null
    try {
      const url = new URL(value, pageUrl)
      return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null
    } catch {
      return null
    }
  }
  const faviconMatch = html.match(
    /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i
  )
  return {
    title: (rawTitle || pageUrl.hostname).slice(0, 160),
    description: metaValue(html, ['og:description', 'description', 'twitter:description']),
    faviconUrl: resolve(faviconMatch?.[1] ?? '/favicon.ico'),
    previewImageUrl: resolve(metaValue(html, ['og:image', 'twitter:image']))
  }
}
