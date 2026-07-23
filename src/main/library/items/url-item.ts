import type { ItemLocation, UrlItemDto } from '../../../shared/library-contract'
import type { PersistedUrlItem } from '../schemas'

export const CURRENT_URL_METADATA_VERSION = 2
const MAX_METADATA_TEXT = 500
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

export function validateWebUrl(value: string): URL {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    throw new Error('Paste a valid http or https link.')
  }
  return url
}

export function isYouTubeVideoUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if (host === 'youtu.be') return YOUTUBE_VIDEO_ID.test(url.pathname.split('/')[1] ?? '')
  if (host !== 'youtube.com' && host !== 'm.youtube.com') return false
  if (url.pathname === '/watch') return YOUTUBE_VIDEO_ID.test(url.searchParams.get('v') ?? '')
  const match = url.pathname.match(/^\/(?:shorts|embed)\/([^/?#]+)/)
  return match ? YOUTUBE_VIDEO_ID.test(match[1]) : false
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
    siteName: null,
    contentKind: isYouTubeVideoUrl(url) ? 'video' : 'webpage',
    metadataVersion: CURRENT_URL_METADATA_VERSION,
    metadataStatus: 'pending',
    metadataError: null,
    note: '',
    originalCollectionId: null
  }
}

export function toUrlDto(
  metadata: PersistedUrlItem,
  location: ItemLocation = { type: 'inbox' }
): UrlItemDto {
  let inferredKind: 'webpage' | 'video' = 'webpage'
  try {
    inferredKind = isYouTubeVideoUrl(validateWebUrl(metadata.sourceUrl)) ? 'video' : 'webpage'
  } catch {
    // Persisted validation will keep malformed items out of ordinary library reads.
  }
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
    siteName: metadata.siteName?.trim() || metadata.domain,
    contentKind: metadata.contentKind ?? inferredKind,
    metadataVersion: metadata.metadataVersion ?? 1,
    hasFavicon: metadata.faviconUrl !== null,
    hasPreviewImage: metadata.previewImageUrl !== null,
    metadataStatus: metadata.metadataStatus,
    metadataError: metadata.metadataError,
    location
  }
}

function decode(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function attributes(tag: string): Map<string, string> {
  const parsed = new Map<string, string>()
  const expression = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g
  for (const match of tag.matchAll(expression)) {
    parsed.set(match[1].toLowerCase(), decode(match[2] ?? match[3] ?? match[4] ?? ''))
  }
  return parsed
}

function metaValue(html: string, names: string[]): string | null {
  const accepted = new Set(names.map((name) => name.toLowerCase()))
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const values = attributes(tag)
    const name = (values.get('property') ?? values.get('name') ?? '').toLowerCase()
    const content = values.get('content')
    if (accepted.has(name) && content) return content.slice(0, MAX_METADATA_TEXT)
  }
  return null
}

function faviconValue(html: string): string | null {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const values = attributes(tag)
    const rel = (values.get('rel') ?? '').toLowerCase().split(/\s+/)
    const href = values.get('href')
    if (rel.some((value) => value === 'icon' || value === 'shortcut') && href) return href
  }
  return null
}

function resolveRemoteUrl(value: string | null, pageUrl: URL): string | null {
  if (!value) return null
  try {
    const url = new URL(value, pageUrl)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

export function extractUrlMetadata(
  html: string,
  pageUrl: URL
): Pick<
  PersistedUrlItem,
  | 'title'
  | 'description'
  | 'faviconUrl'
  | 'previewImageUrl'
  | 'siteName'
  | 'contentKind'
  | 'metadataVersion'
> {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const rawTitle =
    metaValue(html, ['og:title', 'twitter:title']) ||
    (titleMatch ? decode(titleMatch[1].replace(/<[^>]+>/g, '')) : null)
  const openGraphType = metaValue(html, ['og:type'])?.toLowerCase() ?? ''
  return {
    title: (rawTitle || pageUrl.hostname).slice(0, 160),
    description: metaValue(html, ['og:description', 'description', 'twitter:description']),
    faviconUrl: resolveRemoteUrl(faviconValue(html) ?? '/favicon.ico', pageUrl),
    previewImageUrl: resolveRemoteUrl(metaValue(html, ['og:image', 'twitter:image']), pageUrl),
    siteName: metaValue(html, ['og:site_name']),
    contentKind:
      openGraphType === 'video' || openGraphType.startsWith('video.') || isYouTubeVideoUrl(pageUrl)
        ? 'video'
        : 'webpage',
    metadataVersion: CURRENT_URL_METADATA_VERSION
  }
}
