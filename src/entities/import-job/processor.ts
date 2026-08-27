import {
  commitDocumentParse,
  createUploadedDocument,
  findDuplicateDocument,
} from '@/entities/document/api'
import {
  MAX_DOCUMENT_BYTES,
  FileValidationError,
  titleFromFilename,
  validateDocumentFile,
} from '@/entities/document/file-validation'
import { runDocumentParser } from '@/entities/document/parser/run-parser'
import type { ImportCandidate } from '@/entities/import-job/archive'
import {
  refreshImportJob,
  setImportJobStatus,
  updateImportEntry,
  type ImportEntry,
} from '@/entities/import-job/api'
import type { ImportType } from '@/shared/lib/supabase/database.types'

export interface ImportProgress {
  completed: number
  total: number
  filename: string
  phase: string
}

export async function processImportCandidates(input: {
  ownerId: string
  jobId: string
  importType: ImportType
  candidates: ImportCandidate[]
  existingEntries?: Map<string, ImportEntry>
  isCancelled: () => boolean
  onProgress: (progress: ImportProgress) => void
}) {
  let completed = 0
  for (const candidate of input.candidates) {
    if (input.isCancelled()) break
    if (!candidate.format) {
      completed += 1
      input.onProgress({
        completed,
        total: input.candidates.length,
        filename: candidate.sourceFilename,
        phase: '지원하지 않는 형식 건너뜀',
      })
      continue
    }

    const existing = input.existingEntries?.get(candidate.id)
    let documentId = existing?.document_id ?? null
    let versionId = existing?.version_id ?? null
    try {
      await setImportJobStatus(input.jobId, 'validating')
      await updateImportEntry(candidate.id, { status: 'validating' })
      input.onProgress({
        completed,
        total: input.candidates.length,
        filename: candidate.sourceFilename,
        phase: '검증 중',
      })
      if (candidate.sizeBytes > MAX_DOCUMENT_BYTES) {
        throw new FileValidationError(
          'FILE_TOO_LARGE',
          '파일 하나는 최대 50MiB까지 업로드할 수 있습니다.',
        )
      }
      const file = await candidate.loadFile()
      const validated = await validateDocumentFile(file)
      if (existing?.content_hash && existing.content_hash !== validated.contentHash) {
        throw new FileValidationError(
          'RETRY_HASH_MISMATCH',
          '재처리 파일이 최초 검증한 원본과 다릅니다.',
        )
      }

      if (!documentId || !versionId) {
        const duplicate = await findDuplicateDocument(validated.contentHash)
        if (duplicate) {
          await updateImportEntry(candidate.id, {
            status: 'duplicate',
            contentHash: validated.contentHash,
            documentId: duplicate.itemId,
            versionId: duplicate.versionId,
            errorCode: 'DUPLICATE_DOCUMENT_HASH',
            errorMessage: '동일한 원본이 이미 보존되어 있습니다.',
          })
          completed += 1
          if (!input.isCancelled()) await refreshImportJob(input.jobId)
          input.onProgress({
            completed,
            total: input.candidates.length,
            filename: candidate.sourceFilename,
            phase: '중복 연결',
          })
          continue
        }

        await setImportJobStatus(input.jobId, 'uploading')
        input.onProgress({
          completed,
          total: input.candidates.length,
          filename: candidate.sourceFilename,
          phase: 'Private Storage 업로드',
        })
        const created = await createUploadedDocument({
          ownerId: input.ownerId,
          title: titleFromFilename(candidate.sourceFilename),
          summary: '',
          categoryId: null,
          tagIds: [],
          documentKind:
            input.importType === 'ref_zip' ||
            candidate.sourceFilename.toLocaleUpperCase('en-US').startsWith('REF_')
              ? 'ref'
              : 'reference',
          validated,
        })
        documentId = created.itemId
        versionId = created.versionId
        await updateImportEntry(candidate.id, {
          status: 'uploaded',
          contentHash: validated.contentHash,
          documentId,
          versionId,
        })
      }

      await setImportJobStatus(input.jobId, 'parsing')
      input.onProgress({
        completed,
        total: input.candidates.length,
        filename: candidate.sourceFilename,
        phase: '본문·Section 추출',
      })
      const result = await runDocumentParser(candidate.format, await file.arrayBuffer())
      await commitDocumentParse(versionId, result)
      const fullyParsed = result.status === 'parsed'
      await updateImportEntry(candidate.id, {
        status: fullyParsed ? 'parsed' : 'partial',
        contentHash: validated.contentHash,
        documentId,
        versionId,
        errorCode: result.errorCode,
        errorMessage:
          result.errorMessage ??
          (fullyParsed ? null : '원본은 저장됐지만 일부 내용만 추출했습니다.'),
      })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '파일 처리 중 오류가 발생했습니다.'
      await updateImportEntry(candidate.id, {
        status: documentId && versionId ? 'partial' : 'failed',
        documentId,
        versionId,
        errorCode: caught instanceof FileValidationError ? caught.code : 'IMPORT_ENTRY_FAILED',
        errorMessage: message,
      }).catch(() => undefined)
    }

    completed += 1
    if (!input.isCancelled()) await refreshImportJob(input.jobId)
    input.onProgress({
      completed,
      total: input.candidates.length,
      filename: candidate.sourceFilename,
      phase: '처리 완료',
    })
  }
  if (input.isCancelled()) return 'cancelled' as const
  return refreshImportJob(input.jobId)
}
