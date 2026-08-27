import type { ParserBlock, ParserSection } from './types'

const TARGET_TOKENS = 700
const MAX_TOKENS = 1000
const OVERLAP_TOKENS = 80

export function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.trim().length / 3))
}

async function hashText(text: string) {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

function splitOversizedContent(content: string) {
  if (estimateTokens(content) <= MAX_TOKENS) return [content.trim()]

  const paragraphs = content
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  if (paragraphs.length <= 1) {
    const maxCharacters = MAX_TOKENS * 3
    const overlapCharacters = OVERLAP_TOKENS * 3
    const chunks: string[] = []
    for (let start = 0; start < content.length; start += maxCharacters - overlapCharacters) {
      chunks.push(content.slice(start, start + maxCharacters).trim())
    }
    return chunks.filter(Boolean)
  }

  const chunks: string[] = []
  const normalizedParagraphs = paragraphs.flatMap((paragraph) => {
    if (estimateTokens(paragraph) <= MAX_TOKENS) return [paragraph]
    const maxCharacters = MAX_TOKENS * 3
    const overlapCharacters = OVERLAP_TOKENS * 3
    const pieces: string[] = []
    for (let start = 0; start < paragraph.length; start += maxCharacters - overlapCharacters) {
      pieces.push(paragraph.slice(start, start + maxCharacters).trim())
    }
    return pieces.filter(Boolean)
  })
  let current: string[] = []
  let currentTokens = 0
  for (const paragraph of normalizedParagraphs) {
    const paragraphTokens = estimateTokens(paragraph)
    if (current.length && currentTokens + paragraphTokens > TARGET_TOKENS) {
      chunks.push(current.join('\n\n'))
      const overlap: string[] = []
      let overlapTokens = 0
      for (
        let index = current.length - 1;
        index >= 0 && overlapTokens < OVERLAP_TOKENS;
        index -= 1
      ) {
        overlap.unshift(current[index])
        overlapTokens += estimateTokens(current[index])
      }
      current = overlap
      currentTokens = overlapTokens
    }
    current.push(paragraph)
    currentTokens += paragraphTokens
  }
  if (current.length) chunks.push(current.join('\n\n'))
  return chunks
}

export async function buildParserSections(blocks: ParserBlock[]): Promise<ParserSection[]> {
  const sections: ParserSection[] = []
  const firstOrdinalByHeadingPath = new Map<string, number>()

  for (const block of blocks) {
    const content = block.content.trim()
    if (!content) continue
    const parentPath = block.headingPath.slice(0, -1)
    const parentOrdinal = parentPath.length
      ? (firstOrdinalByHeadingPath.get(parentPath.join('\u0000')) ?? null)
      : null
    const chunks = splitOversizedContent(content)
    const firstOrdinal = sections.length

    for (const [chunkIndex, chunk] of chunks.entries()) {
      const ordinal = sections.length
      sections.push({
        ordinal,
        parentOrdinal,
        heading: block.heading,
        headingLevel: block.headingLevel,
        headingPath: block.headingPath,
        content: chunk,
        chunkKind: chunks.length > 1 ? 'paragraph_group' : block.chunkKind,
        locator: {
          ...block.locator,
          chunk_index: chunkIndex,
          chunk_count: chunks.length,
        },
        contentHash: await hashText(chunk),
        tokenEstimate: estimateTokens(chunk),
      })
    }

    if (block.headingPath.length) {
      const pathKey = block.headingPath.join('\u0000')
      if (!firstOrdinalByHeadingPath.has(pathKey)) {
        firstOrdinalByHeadingPath.set(pathKey, firstOrdinal)
      }
    }
  }
  return sections
}

export function parseMarkdownBlocks(text: string): ParserBlock[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const blocks: ParserBlock[] = []
  const headingStack: string[] = []
  let currentHeading: string | null = null
  let currentLevel: number | null = null
  let contentStart = 1
  let contentLines: string[] = []

  const flush = (lineEnd: number) => {
    const content = contentLines.join('\n').trim()
    if (content) {
      blocks.push({
        heading: currentHeading,
        headingLevel: currentLevel,
        headingPath: currentHeading
          ? headingStack.slice(0, currentLevel ?? 1).filter((value) => Boolean(value))
          : [],
        content,
        chunkKind: detectChunkKind(content),
        locator: { line_start: contentStart, line_end: Math.max(contentStart, lineEnd) },
      })
    }
    contentLines = []
  }

  for (const [index, line] of lines.entries()) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match) {
      contentLines.push(line)
      continue
    }
    flush(index)
    currentLevel = match[1].length
    currentHeading = match[2].trim()
    headingStack.length = currentLevel
    headingStack[currentLevel - 1] = currentHeading
    contentStart = index + 2
  }
  flush(lines.length)
  return blocks
}

export function parseTextBlocks(text: string): ParserBlock[] {
  const normalized = text.replace(/^\uFEFF/, '').trim()
  if (!normalized) return []
  return [
    {
      heading: null,
      headingLevel: null,
      headingPath: [],
      content: normalized,
      chunkKind: 'paragraph_group',
      locator: { line_start: 1, line_end: normalized.split(/\r?\n/).length },
    },
  ]
}

function detectChunkKind(content: string) {
  const trimmed = content.trim()
  if (trimmed.startsWith('```') && trimmed.endsWith('```')) return 'code' as const
  if (/^\|.+\|/m.test(trimmed)) return 'table' as const
  if (/^(?:[-*+] |\d+\. )/m.test(trimmed)) return 'list' as const
  return 'section' as const
}
