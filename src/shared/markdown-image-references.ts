export interface MarkdownImageReference {
  start: number
  end: number
  altStart: number
  altEnd: number
  altText: string
  destinationStart: number
  destinationEnd: number
  destination: string
  angleWrapped: boolean
}

export interface StagedMarkdownAttachment {
  filename: string
  relativePath: string
}

function isEscaped(source: string, index: number): boolean {
  let slashes = 0
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor -= 1) slashes += 1
  return slashes % 2 === 1
}

function closingSquareBracket(source: string, start: number): number {
  for (let cursor = start; cursor < source.length; cursor += 1) {
    if (source[cursor] === ']' && !isEscaped(source, cursor)) return cursor
  }
  return -1
}

function decodeMarkdownImageAltText(value: string): string {
  return value.replace(/\\([\\\]])/g, '$1')
}

function encodeMarkdownImageAltText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\]/g, '\\]')
}

function trimDestinationEnd(source: string, start: number, end: number): number {
  let trimmed = end
  while (trimmed > start && /\s/.test(source[trimmed - 1])) trimmed -= 1
  const title = /\s+(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/.exec(source.slice(start, trimmed))
  return title?.index === undefined ? trimmed : start + title.index
}

export function parseMarkdownImageReferences(source: string): MarkdownImageReference[] {
  const references: MarkdownImageReference[] = []
  for (let start = 0; start < source.length - 3; start += 1) {
    if (source[start] !== '!' || source[start + 1] !== '[' || isEscaped(source, start)) continue
    const labelEnd = closingSquareBracket(source, start + 2)
    if (labelEnd < 0 || source[labelEnd + 1] !== '(') continue
    const altStart = start + 2
    const altEnd = labelEnd
    const altText = decodeMarkdownImageAltText(source.slice(altStart, altEnd))

    let cursor = labelEnd + 2
    while (cursor < source.length && /[\t ]/.test(source[cursor])) cursor += 1
    if (source[cursor] === '<') {
      const angleStart = cursor
      cursor += 1
      const destinationStart = cursor
      while (cursor < source.length && (source[cursor] !== '>' || isEscaped(source, cursor))) {
        cursor += 1
      }
      if (cursor >= source.length) continue
      const destinationEnd = cursor
      cursor += 1
      while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1
      if (source[cursor] !== ')') continue
      references.push({
        start,
        end: cursor + 1,
        altStart,
        altEnd,
        altText,
        destinationStart: angleStart,
        destinationEnd: destinationEnd + 1,
        destination: source.slice(destinationStart, destinationEnd),
        angleWrapped: true
      })
      start = cursor
      continue
    }

    const destinationStart = cursor
    let depth = 1
    while (cursor < source.length) {
      if (source[cursor] === '\\' && cursor + 1 < source.length) {
        cursor += 2
        continue
      }
      if (source[cursor] === '(') depth += 1
      if (source[cursor] === ')') {
        depth -= 1
        if (depth === 0) break
      }
      cursor += 1
    }
    if (depth !== 0) continue
    const destinationEnd = trimDestinationEnd(source, destinationStart, cursor)
    let trimmedStart = destinationStart
    while (trimmedStart < destinationEnd && /\s/.test(source[trimmedStart])) trimmedStart += 1
    if (trimmedStart === destinationEnd) continue
    references.push({
      start,
      end: cursor + 1,
      altStart,
      altEnd,
      altText,
      destinationStart: trimmedStart,
      destinationEnd,
      destination: source.slice(trimmedStart, destinationEnd),
      angleWrapped: false
    })
    start = cursor
  }
  return references
}

export function findMarkdownImageAltText(
  source: string,
  targets: readonly string[]
): string | null {
  const targetKeys = new Set(targets.map(markdownImageTargetKey))
  const reference = parseMarkdownImageReferences(source).find((candidate) =>
    targetKeys.has(markdownImageTargetKey(candidate.destination))
  )
  return reference?.altText ?? null
}

export function rewriteMarkdownImageAltText(
  source: string,
  targets: readonly string[],
  altText: string
): string {
  const targetKeys = new Set(targets.map(markdownImageTargetKey))
  const replacement = encodeMarkdownImageAltText(altText)
  let next = source
  for (const reference of parseMarkdownImageReferences(source).reverse()) {
    if (!targetKeys.has(markdownImageTargetKey(reference.destination))) continue
    next = `${next.slice(0, reference.altStart)}${replacement}${next.slice(reference.altEnd)}`
  }
  return next
}

export function safeDecodeMarkdownTarget(value: string): string {
  try {
    return decodeURIComponent(value.replace(/%(?![0-9A-Fa-f]{2})/g, '%25'))
  } catch {
    return value
  }
}

export function normalizeMarkdownImageTarget(value: string): string {
  const withoutQuery = value.trim().replace(/^<|>$/g, '').split(/[?#]/, 1)[0]
  return safeDecodeMarkdownTarget(withoutQuery)
    .replace(/\\([\\()[\]<> ])/g, '$1')
    .replace(/\\/g, '/')
}

export function markdownImageTargetKey(value: string): string {
  return normalizeMarkdownImageTarget(value).replace(/^\.\//, '').toLocaleLowerCase()
}

export function encodeMarkdownPath(path: string): string {
  return path
    .split('/')
    .map((segment) =>
      segment === '.' || segment === '..'
        ? segment
        : encodeURIComponent(segment).replace(
            /[!'()*]/g,
            (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
          )
    )
    .join('/')
}

export function encodeMarkdownImageTarget(value: string): string {
  return encodeMarkdownPath(normalizeMarkdownImageTarget(value))
}

export function rewriteMarkdownImageDestinations(
  source: string,
  replacementFor: (reference: MarkdownImageReference) => string | null
): string {
  let next = source
  for (const reference of parseMarkdownImageReferences(source).reverse()) {
    const replacement = replacementFor(reference)
    if (replacement === null) continue
    next = `${next.slice(0, reference.destinationStart)}${replacement}${next.slice(reference.destinationEnd)}`
  }
  return next
}

export function stagedAttachmentAliases(attachment: StagedMarkdownAttachment): Set<string> {
  const encodedFilename = encodeMarkdownImageTarget(attachment.filename)
  return new Set([
    markdownImageTargetKey(attachment.relativePath),
    markdownImageTargetKey(`./${attachment.filename}`),
    markdownImageTargetKey(`./${encodedFilename}`),
    markdownImageTargetKey(`./assets/${attachment.filename}`),
    markdownImageTargetKey(`./assets/${encodedFilename}`)
  ])
}

export function normalizeStagedAttachmentMarkdown(
  source: string,
  attachments: readonly StagedMarkdownAttachment[]
): string {
  const destinations = new Map<string, string>()
  for (const attachment of attachments) {
    for (const alias of stagedAttachmentAliases(attachment)) {
      destinations.set(alias, attachment.relativePath)
    }
  }
  return rewriteMarkdownImageDestinations(source, (reference) => {
    const destination = destinations.get(markdownImageTargetKey(reference.destination))
    return destination ? encodeMarkdownImageTarget(destination) : null
  })
}

export function removeStagedAttachmentMarkdown(
  source: string,
  attachment: StagedMarkdownAttachment
): string {
  const aliases = stagedAttachmentAliases(attachment)
  let next = source
  for (const reference of parseMarkdownImageReferences(source).reverse()) {
    if (!aliases.has(markdownImageTargetKey(reference.destination))) continue
    next = `${next.slice(0, reference.start)}${next.slice(reference.end)}`
  }
  return next.replace(/\n{3,}/g, '\n\n')
}
