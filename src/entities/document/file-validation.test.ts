import { describe, expect, it } from 'vitest'

import {
  detectDocumentFormat,
  FileValidationError,
  titleFromFilename,
  validateFileBytes,
} from './file-validation'

describe('document file validation', () => {
  it('recognizes only the four V1 document formats', () => {
    expect(detectDocumentFormat('lesson.MD')).toBe('md')
    expect(detectDocumentFormat('notes.txt')).toBe('txt')
    expect(detectDocumentFormat('paper.pdf')).toBe('pdf')
    expect(detectDocumentFormat('manual.docx')).toBe('docx')
    expect(detectDocumentFormat('archive.zip')).toBeNull()
  })

  it('checks the PDF signature instead of trusting the extension', () => {
    expect(() => validateFileBytes('pdf', new TextEncoder().encode('%PDF-1.7'))).not.toThrow()
    expect(() => validateFileBytes('pdf', new TextEncoder().encode('not a pdf'))).toThrow(
      FileValidationError,
    )
  })

  it('requires DOCX zip and Word document markers', () => {
    const bytes = new Uint8Array([
      0x50,
      0x4b,
      0x03,
      0x04,
      ...new TextEncoder().encode('[Content_Types].xml word/document.xml'),
    ])
    expect(() => validateFileBytes('docx', bytes)).not.toThrow()
    expect(() => validateFileBytes('docx', new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toThrow(
      FileValidationError,
    )
  })

  it('derives a readable title without altering the original filename', () => {
    expect(titleFromFilename('REF_SECRET_NUMBER_CLASSROOM_EDITION.md')).toBe(
      'REF_SECRET_NUMBER_CLASSROOM_EDITION',
    )
  })
})
