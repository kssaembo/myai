import { BlobReader, ZipReader } from '@zip.js/zip.js'

import { detectDocumentFormat } from '@/entities/document/file-validation'
import type { DocumentFormat, ImportType } from '@/shared/lib/supabase/database.types'

export const MAX_ARCHIVE_BYTES = 200 * 1024 * 1024
export const MAX_IMPORT_ENTRIES = 200
export const MAX_EXPANDED_BYTES = 500 * 1024 * 1024

export interface ImportCandidate {
  id: string
  sourceFilename: string
  relativePath: string
  sizeBytes: number
  format: DocumentFormat | null
  loadFile: () => Promise<File>
}

export interface PreparedImport {
  importType: ImportType
  sourceLabel: string
  candidates: ImportCandidate[]
  dispose: () => Promise<void>
}

export class ArchiveValidationError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export function normalizeSafePath(path: string) {
  const normalized = path.replaceAll('\\', '/').replace(/^\.\//, '')
  const segments = normalized.split('/')
  if (
    !normalized ||
    normalized.includes('\0') ||
    normalized.startsWith('/') ||
    /^[a-z]:\//i.test(normalized) ||
    segments.some((segment) => segment === '..')
  ) {
    throw new ArchiveValidationError('UNSAFE_ZIP_PATH', `안전하지 않은 ZIP 경로입니다: ${path}`)
  }
  return normalized
}

export function prepareFiles(files: File[]): PreparedImport {
  if (!files.length || files.length > MAX_IMPORT_ENTRIES) {
    throw new ArchiveValidationError(
      'IMPORT_ENTRY_COUNT_OUT_OF_RANGE',
      `한 번에 1개부터 ${MAX_IMPORT_ENTRIES}개 파일까지 가져올 수 있습니다.`,
    )
  }
  const candidates = files.map((file) => {
    const relativePath = normalizeSafePath(file.webkitRelativePath || file.name)
    return {
      id: crypto.randomUUID(),
      sourceFilename: file.name,
      relativePath,
      sizeBytes: file.size,
      format: detectDocumentFormat(file.name),
      loadFile: () => Promise.resolve(file),
    }
  })
  return {
    importType: 'files',
    sourceLabel: `${files.length}개 파일`,
    candidates,
    dispose: () => Promise.resolve(),
  }
}

export async function prepareArchive(file: File, refArchive: boolean): Promise<PreparedImport> {
  if (file.size === 0 || file.size > MAX_ARCHIVE_BYTES) {
    throw new ArchiveValidationError(
      'ZIP_SIZE_OUT_OF_RANGE',
      'ZIP 파일은 비어 있지 않아야 하며 최대 200MiB까지 지원합니다.',
    )
  }
  if (!file.name.toLocaleLowerCase('en-US').endsWith('.zip')) {
    throw new ArchiveValidationError('NOT_A_ZIP', '확장자가 .zip인 파일을 선택해 주세요.')
  }

  const reader = new ZipReader(new BlobReader(file), {
    checkOverlappingEntry: true,
    checkSignature: true,
  })
  try {
    const allEntries = await reader.getEntries()
    const entries = allEntries.filter((entry) => !entry.directory)
    if (!entries.length || entries.length > MAX_IMPORT_ENTRIES) {
      throw new ArchiveValidationError(
        'IMPORT_ENTRY_COUNT_OUT_OF_RANGE',
        `ZIP 내부 파일은 1개부터 ${MAX_IMPORT_ENTRIES}개까지 지원합니다.`,
      )
    }
    if (entries.some((entry) => entry.encrypted)) {
      throw new ArchiveValidationError('ENCRYPTED_ZIP', '암호화된 ZIP은 지원하지 않습니다.')
    }
    if (entries.some((entry) => entry.symlink)) {
      throw new ArchiveValidationError(
        'ZIP_SYMLINK',
        '심볼릭 링크가 포함된 ZIP은 지원하지 않습니다.',
      )
    }
    if (entries.some((entry) => entry.filename.toLocaleLowerCase('en-US').endsWith('.zip'))) {
      throw new ArchiveValidationError(
        'NESTED_ZIP',
        'ZIP 안에 포함된 중첩 ZIP은 지원하지 않습니다.',
      )
    }
    const expandedBytes = entries.reduce((sum, entry) => sum + entry.uncompressedSize, 0)
    if (expandedBytes > MAX_EXPANDED_BYTES) {
      throw new ArchiveValidationError(
        'ZIP_EXPANSION_LIMIT',
        '압축 해제 크기가 500MiB를 초과해 안전을 위해 중단했습니다.',
      )
    }

    const candidates: ImportCandidate[] = entries.map((entry) => {
      const relativePath = normalizeSafePath(entry.filename)
      const sourceFilename = relativePath.split('/').at(-1) ?? relativePath
      const format = detectDocumentFormat(sourceFilename)
      return {
        id: crypto.randomUUID(),
        sourceFilename,
        relativePath,
        sizeBytes: entry.uncompressedSize,
        format,
        loadFile: async () => {
          const buffer = await entry.arrayBuffer({
            checkOverlappingEntry: true,
            checkSignature: true,
          })
          return new File([buffer], sourceFilename, {
            type: mimeTypeFor(format),
            lastModified: entry.lastModDate.getTime(),
          })
        },
      }
    })

    return {
      importType: refArchive ? 'ref_zip' : 'zip',
      sourceLabel: file.name,
      candidates,
      dispose: () => reader.close(),
    }
  } catch (caught) {
    await reader.close().catch(() => undefined)
    if (caught instanceof ArchiveValidationError) throw caught
    throw new ArchiveValidationError('INVALID_ZIP', 'ZIP 구조가 손상되었거나 지원되지 않습니다.')
  }
}

function mimeTypeFor(format: DocumentFormat | null) {
  if (format === 'md') return 'text/markdown'
  if (format === 'txt') return 'text/plain'
  if (format === 'pdf') return 'application/pdf'
  if (format === 'docx')
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  return 'application/octet-stream'
}
