import { lookup as defaultLookup } from 'node:dns/promises'
import { isIP, type LookupFunction } from 'node:net'
import { Agent } from 'undici'

type LookupResult = { address: string; family: number }
export type LookupHost = (
  hostname: string,
  options: { all: true; verbatim: true }
) => Promise<LookupResult[]>

export interface UrlNetworkDependencies {
  fetch: typeof fetch
  lookup: LookupHost
}

// Validate the addresses handed to the socket, including reconnects. A separate
// preflight lookup alone allows a hostname to rebind before fetch connects.
export function createPublicLookup(lookup: LookupHost): LookupFunction {
  return (hostname, options, callback) => {
    void lookup(hostname, { all: true, verbatim: true }).then(
      (addresses) => {
        if (!addresses.length || addresses.some(({ address }) => !isPublicIpAddress(address))) {
          callback(new Error('Local or private network links cannot be fetched for metadata.'), '')
          return
        }
        const matching = addresses.filter(
          ({ family }) => !options.family || family === options.family
        )
        if (!matching.length) {
          callback(new Error('The link has no address for the requested network family.'), '')
          return
        }
        if (options.all) callback(null, matching)
        else callback(null, matching[0].address, matching[0].family)
      },
      (error) => callback(error, '')
    )
  }
}

const publicResourceAgent = new Agent({
  connect: { lookup: createPublicLookup(defaultLookup as LookupHost) }
})

export const defaultUrlNetworkDependencies: UrlNetworkDependencies = {
  fetch: (input, init) => {
    const options = { ...init, dispatcher: publicResourceAgent }
    return fetch(input, options)
  },
  lookup: defaultLookup as LookupHost
}

function isPublicIpv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false
  }
  const [a, b, c] = parts
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  )
}

function isPublicIpv6(address: string): boolean {
  const normalized = address
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .split('%')[0]
  const mapped = normalized.match(/^(?:::ffff:)?(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPublicIpv4(mapped[1])
  if (normalized === '::' || normalized === '::1') return false
  if (normalized.startsWith('::ffff:')) {
    const suffix = normalized.slice('::ffff:'.length)
    return isPublicIpv4(suffix)
  }
  const first = Number.parseInt(normalized.split(':')[0] || '0', 16)
  if (!Number.isFinite(first) || first < 0x2000 || first > 0x3fff) return false
  return !normalized.startsWith('2001:db8:') && normalized !== '2001:db8::'
}

export function isPublicIpAddress(address: string): boolean {
  const version = isIP(address.replace(/^\[|\]$/g, '').split('%')[0])
  if (version === 4) return isPublicIpv4(address)
  if (version === 6) return isPublicIpv6(address)
  return false
}

export async function assertPublicRemoteUrl(url: URL, lookup: LookupHost): Promise<void> {
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    throw new Error('Only http or https links can be fetched.')
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Local or private network links cannot be fetched for metadata.')
  }
  const literalVersion = isIP(hostname)
  const addresses = literalVersion
    ? [{ address: hostname, family: literalVersion }]
    : await lookup(hostname, { all: true, verbatim: true })
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new Error('Local or private network links cannot be fetched for metadata.')
  }
}

export async function fetchPublicResource(
  initialUrl: URL,
  accept: string,
  dependencies: UrlNetworkDependencies,
  redirectCount = 0
): Promise<Response> {
  if (redirectCount > 5) throw new Error('The link redirected too many times.')
  await assertPublicRemoteUrl(initialUrl, dependencies.lookup)
  const response = await dependencies.fetch(initialUrl, {
    redirect: 'manual',
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: accept }
  })
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location')
    await response.body?.cancel()
    if (!location) throw new Error('The link redirected without a destination.')
    return fetchPublicResource(
      new URL(location, initialUrl),
      accept,
      dependencies,
      redirectCount + 1
    )
  }
  if (!response.ok) throw new Error(`The link returned ${response.status}.`)
  return response
}

export async function readHtmlHead(response: Response, maximumBytes = 1_000_000): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return (await response.text()).slice(0, maximumBytes)
  const decoder = new TextDecoder()
  let byteCount = 0
  let html = ''
  try {
    while (byteCount < maximumBytes) {
      const { done, value } = await reader.read()
      if (done) break
      const remaining = maximumBytes - byteCount
      const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value
      byteCount += chunk.byteLength
      html += decoder.decode(chunk, { stream: true })
      const headEnd = html.search(/<\/head\s*>/i)
      if (headEnd >= 0) {
        html = html.slice(0, headEnd + html.slice(headEnd).indexOf('>') + 1)
        break
      }
    }
    html += decoder.decode()
  } finally {
    await reader.cancel().catch(() => undefined)
  }
  return html
}

export async function readBoundedBytes(response: Response, maximumBytes: number): Promise<Buffer> {
  const declaredLength = Number(response.headers.get('content-length') ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new Error('The preview image is too large.')
  }
  const reader = response.body?.getReader()
  if (!reader) {
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.byteLength > maximumBytes) throw new Error('The preview image is too large.')
    return bytes
  }
  const chunks: Uint8Array[] = []
  let byteCount = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      byteCount += value.byteLength
      if (byteCount > maximumBytes) throw new Error('The preview image is too large.')
      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }
  return Buffer.concat(chunks)
}
