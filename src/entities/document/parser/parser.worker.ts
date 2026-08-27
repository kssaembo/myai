/// <reference lib="webworker" />

import mammoth from 'mammoth'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

import { buildParserSections, parseMarkdownBlocks, parseTextBlocks } from './parse-core'
import type { ParserBlock, ParserResult, ParserWorkerRequest, ParserWorkerResponse } from './types'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl
const workerScope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope

function post(message: ParserWorkerResponse) {
  workerScope.postMessage(message)
}

function progress(value: number, label: string) {
  post({ type: 'progress', progress: value, label })
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === 'number' ? value : fallback
}

async function parseText(format: 'md' | 'txt', buffer: ArrayBuffer): Promise<ParserResult> {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  const blocks = format === 'md' ? parseMarkdownBlocks(text) : parseTextBlocks(text)
  const sections = await buildParserSections(blocks)
  return {
    status: sections.length ? 'parsed' : 'failed',
    contentText: text,
    sections,
    parserName: format === 'md' ? 'knowledge-os-markdown' : 'knowledge-os-text',
    parserVersion: '1.0.0',
    errorCode: sections.length ? null : 'NO_TEXT_CONTENT',
    errorMessage: sections.length ? null : '추출할 텍스트가 없습니다.',
    warnings: [],
  }
}

async function parsePdf(buffer: ArrayBuffer): Promise<ParserResult> {
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    useWasm: false,
  })
  const pdf = await loadingTask.promise
  const blocks: ParserBlock[] = []
  const extractedPages: string[] = []
  const failedPages: number[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    progress(
      10 + Math.round((pageNumber / pdf.numPages) * 65),
      `${pageNumber}/${pdf.numPages} 페이지 추출`,
    )
    try {
      const page = await pdf.getPage(pageNumber)
      const textContent = await page.getTextContent()
      let previousY: number | null = null
      let text = ''
      for (const item of textContent.items) {
        const textItem = item as { str?: unknown; transform?: unknown }
        if (typeof textItem.str !== 'string' || !Array.isArray(textItem.transform)) continue
        const rawY: unknown = textItem.transform[5]
        const y = numberOr(rawY, previousY ?? 0)
        const separator = previousY !== null && Math.abs(y - previousY) > 2 ? '\n' : text ? ' ' : ''
        text += `${separator}${textItem.str}`
        previousY = y
      }
      const normalized = text.replace(/[ \t]+\n/g, '\n').trim()
      extractedPages.push(normalized)
      if (normalized) {
        blocks.push({
          heading: `Page ${pageNumber}`,
          headingLevel: 1,
          headingPath: [`Page ${pageNumber}`],
          content: normalized,
          chunkKind: 'paragraph_group',
          locator: { page: pageNumber },
        })
      }
      page.cleanup()
    } catch {
      failedPages.push(pageNumber)
      extractedPages.push('')
    }
  }
  await loadingTask.destroy()

  const contentText = extractedPages.join('\n\n').trim()
  const sections = await buildParserSections(blocks)
  if (!contentText || contentText.length < Math.max(20, pdf.numPages * 5)) {
    return {
      status: 'needs_ocr',
      contentText: contentText || null,
      sections,
      parserName: 'pdfjs-dist',
      parserVersion: '6.2.108',
      errorCode: 'PDF_TEXT_NOT_FOUND',
      errorMessage: '텍스트가 거의 없어 이미지형 PDF로 판단했습니다. OCR이 필요합니다.',
      warnings: failedPages.length ? [`${failedPages.length}개 페이지 추출 실패`] : [],
    }
  }
  return {
    status: failedPages.length ? 'partial' : 'parsed',
    contentText,
    sections,
    parserName: 'pdfjs-dist',
    parserVersion: '6.2.108',
    errorCode: failedPages.length ? 'PDF_PAGE_PARTIAL' : null,
    errorMessage: failedPages.length
      ? `${failedPages.length}개 페이지를 추출하지 못했습니다.`
      : null,
    warnings: failedPages.map((page) => `${page}페이지 추출 실패`),
  }
}

function decodeEntities(value: string) {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  }
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
    if (entity.startsWith('#x')) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16))
    if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10))
    return named[entity.toLowerCase()] ?? ''
  })
}

function htmlText(value: string) {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/t[dh]>/gi, '\t')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  ).trim()
}

function docxBlocks(html: string): ParserBlock[] {
  const blocks: ParserBlock[] = []
  const headingStack: string[] = []
  const pattern = /<(h[1-6]|p|li|pre|table)[^>]*>([\s\S]*?)<\/\1>/gi
  let match: RegExpExecArray | null
  let paragraph = 0
  let heading: string | null = null
  let headingLevel: number | null = null

  while ((match = pattern.exec(html))) {
    const tag = match[1].toLowerCase()
    const text = htmlText(match[2])
    if (!text) continue
    paragraph += 1
    if (tag.startsWith('h')) {
      headingLevel = Number(tag.slice(1))
      heading = text
      headingStack.length = headingLevel
      headingStack[headingLevel - 1] = heading
      continue
    }
    blocks.push({
      heading,
      headingLevel,
      headingPath: heading
        ? headingStack.slice(0, headingLevel ?? 1).filter((value) => Boolean(value))
        : [],
      content: text,
      chunkKind:
        tag === 'table' ? 'table' : tag === 'pre' ? 'code' : tag === 'li' ? 'list' : 'section',
      locator: { paragraph },
    })
  }
  return blocks
}

async function parseDocx(buffer: ArrayBuffer): Promise<ParserResult> {
  const [htmlResult, textResult] = await Promise.all([
    mammoth.convertToHtml(
      { arrayBuffer: buffer.slice(0) },
      {
        externalFileAccess: false,
        convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: '' })),
      },
    ),
    mammoth.extractRawText({ arrayBuffer: buffer.slice(0) }),
  ])
  const warnings = [...htmlResult.messages, ...textResult.messages].map(
    (message) => message.message,
  )
  const blocks = docxBlocks(htmlResult.value)
  if (!blocks.length && textResult.value.trim()) blocks.push(...parseTextBlocks(textResult.value))
  const sections = await buildParserSections(blocks)
  return {
    status: sections.length ? (warnings.length ? 'partial' : 'parsed') : 'failed',
    contentText: textResult.value.trim() || null,
    sections,
    parserName: 'mammoth',
    parserVersion: '1.12.1',
    errorCode: sections.length ? (warnings.length ? 'DOCX_WARNINGS' : null) : 'NO_TEXT_CONTENT',
    errorMessage: sections.length
      ? warnings.length
        ? '일부 DOCX 요소를 완전히 변환하지 못했습니다.'
        : null
      : '추출할 텍스트가 없습니다.',
    warnings: warnings.slice(0, 20),
  }
}

workerScope.onmessage = (event: MessageEvent<ParserWorkerRequest>) => {
  if (event.data.type !== 'parse') return
  void (async () => {
    try {
      progress(5, '파서 준비')
      const { format, buffer } = event.data
      const result =
        format === 'md' || format === 'txt'
          ? await parseText(format, buffer)
          : format === 'pdf'
            ? await parsePdf(buffer)
            : await parseDocx(buffer)
      progress(95, 'Section 생성 완료')
      post({ type: 'result', result })
    } catch {
      post({
        type: 'result',
        result: {
          status: 'failed',
          contentText: null,
          sections: [],
          parserName: 'knowledge-os-worker',
          parserVersion: '1.0.0',
          errorCode: 'PARSER_FAILED',
          errorMessage: '문서를 처리하지 못했습니다. 원본은 안전하게 보존되어 있습니다.',
          warnings: [],
        },
      })
    }
  })()
}

export {}
