import type { DocumentFormat } from '@/shared/lib/supabase/database.types'

export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024

const fileDefinitions: Record<
  DocumentFormat,
  { extension: string; mimeType: string; acceptedMimeTypes: string[] }
> = {
  md: {
    extension: 'md',
    mimeType: 'text/markdown',
    acceptedMimeTypes: ['', 'text/markdown', 'text/plain', 'application/octet-stream'],
  },
  txt: {
    extension: 'txt',
    mimeType: 'text/plain',
    acceptedMimeTypes: ['', 'text/plain', 'application/octet-stream'],
  },
  pdf: {
    extension: 'pdf',
    mimeType: 'application/pdf',
    acceptedMimeTypes: ['', 'application/pdf', 'application/octet-stream'],
  },
  docx: {
    extension: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    acceptedMimeTypes: [
      '',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
      'application/octet-stream',
    ],
  },
}

export interface ValidatedDocumentFile {
  file: File
  format: DocumentFormat
  extension: string
  mimeType: string
  contentHash: string
}

export class FileValidationError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

function includesAscii(bytes: Uint8Array, text: string) {
  const pattern = new TextEncoder().encode(text)
  let start = 0
  while (start <= bytes.length - pattern.length) {
    const index = bytes.indexOf(pattern[0], start)
    if (index < 0) return false
    let matches = true
    for (let offset = 0; offset < pattern.length; offset += 1) {
      if (bytes[index + offset] !== pattern[offset]) {
        matches = false
        break
      }
    }
    if (matches) return true
    start = index + 1
  }
  return false
}

export function detectDocumentFormat(filename: string): DocumentFormat | null {
  const extension = filename.trim().toLocaleLowerCase('en-US').split('.').pop()
  return extension && extension in fileDefinitions ? (extension as DocumentFormat) : null
}

export function validateFileBytes(format: DocumentFormat, bytes: Uint8Array) {
  if (format === 'pdf') {
    const signature = [0x25, 0x50, 0x44, 0x46, 0x2d]
    if (!signature.every((value, index) => bytes[index] === value)) {
      throw new FileValidationError('SIGNATURE_MISMATCH', 'PDF 파일 서명이 올바르지 않습니다.')
    }
  }

  if (format === 'docx') {
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
    const hasContentTypes = includesAscii(bytes, '[Content_Types].xml')
    const hasWordDocument = includesAscii(bytes, 'word/document.xml')
    if (!isZip || !hasContentTypes || !hasWordDocument) {
      throw new FileValidationError('SIGNATURE_MISMATCH', 'DOCX 문서 구조가 올바르지 않습니다.')
    }
  }
}

async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

export async function validateDocumentFile(file: File): Promise<ValidatedDocumentFile> {
  const format = detectDocumentFormat(file.name)
  if (!format) {
    throw new FileValidationError(
      'UNSUPPORTED_FORMAT',
      'MD, TXT, PDF, DOCX 파일만 업로드할 수 있습니다.',
    )
  }
  if (file.size === 0)
    throw new FileValidationError('EMPTY_FILE', '빈 파일은 업로드할 수 없습니다.')
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new FileValidationError(
      'FILE_TOO_LARGE',
      '파일 하나는 최대 50MiB까지 업로드할 수 있습니다.',
    )
  }

  const definition = fileDefinitions[format]
  if (!definition.acceptedMimeTypes.includes(file.type)) {
    throw new FileValidationError('MIME_MISMATCH', '파일 확장자와 MIME 형식이 일치하지 않습니다.')
  }

  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  validateFileBytes(format, bytes)

  if (format === 'md' || format === 'txt') {
    let decodedText: string
    try {
      decodedText = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      throw new FileValidationError('INVALID_UTF8', '텍스트 파일은 UTF-8 형식이어야 합니다.')
    }
    if (decodedText.includes('\0')) {
      throw new FileValidationError(
        'BINARY_TEXT',
        '텍스트 파일에서 바이너리 데이터가 발견되었습니다.',
      )
    }
  }

  return {
    file,
    format,
    extension: definition.extension,
    mimeType: definition.mimeType,
    contentHash: await sha256(buffer),
  }
}

export function titleFromFilename(filename: string) {
  return filename.replace(/\.[^.]+$/, '').trim() || '제목 없는 문서'
}
