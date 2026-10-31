import type { UrlPreviewKind, UrlPreviewMediaType } from '../../../shared/library-contract'
import sources from './assets/bookmarks/sources.json'

const files = import.meta.glob<string>('./assets/bookmarks/*.{png,jpg,webp,gif,ico}', {
  eager: true,
  query: '?url',
  import: 'default'
})
const bookmarks = new Map(sources.map((entry) => [entry.url, entry]))

export function bookmarkAsset(
  url: string,
  kind: UrlPreviewKind
): { url: string; mediaType: UrlPreviewMediaType } | null {
  const asset = bookmarks.get(url)?.[kind]
  if (!asset) return null
  const localUrl = files[`./assets/bookmarks/${asset.file}`]
  return localUrl ? { url: localUrl, mediaType: asset.mediaType as UrlPreviewMediaType } : null
}
