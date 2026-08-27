import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ImportCandidate } from './archive'
import { processImportCandidates } from './processor'

const harness = vi.hoisted(() => ({
  commitDocumentParse: vi.fn(),
  createUploadedDocument: vi.fn(),
  findDuplicateDocument: vi.fn(),
  refreshImportJob: vi.fn(),
  runDocumentParser: vi.fn(),
  setImportJobStatus: vi.fn(),
  updateImportEntry: vi.fn(),
}))

vi.mock('@/entities/document/api', () => ({
  commitDocumentParse: harness.commitDocumentParse,
  createUploadedDocument: harness.createUploadedDocument,
  findDuplicateDocument: harness.findDuplicateDocument,
}))

vi.mock('@/entities/document/parser/run-parser', () => ({
  runDocumentParser: harness.runDocumentParser,
}))

vi.mock('@/entities/import-job/api', () => ({
  refreshImportJob: harness.refreshImportJob,
  setImportJobStatus: harness.setImportJobStatus,
  updateImportEntry: harness.updateImportEntry,
}))

describe('batch import failure isolation', () => {
  beforeEach(() => {
    for (const mock of Object.values(harness)) mock.mockReset()
    harness.findDuplicateDocument.mockResolvedValue(null)
    harness.createUploadedDocument.mockResolvedValue({
      itemId: 'document-2',
      versionId: 'version-2',
    })
    harness.runDocumentParser.mockResolvedValue({
      status: 'parsed',
      contentText: '# 정상 문서',
      sections: [],
      parserName: 'test',
      parserVersion: '1',
      errorCode: null,
      errorMessage: null,
      warnings: [],
    })
    harness.commitDocumentParse.mockResolvedValue(1)
    harness.refreshImportJob.mockResolvedValue('completed')
    harness.setImportJobStatus.mockResolvedValue(undefined)
    harness.updateImportEntry.mockResolvedValue(undefined)
  })

  it('continues with the next entry after one file fails', async () => {
    const candidates: ImportCandidate[] = [
      {
        id: 'entry-1',
        sourceFilename: 'broken.md',
        relativePath: 'broken.md',
        sizeBytes: 10,
        format: 'md',
        loadFile: () => Promise.reject(new Error('broken archive entry')),
      },
      {
        id: 'entry-2',
        sourceFilename: 'REF_VALID.md',
        relativePath: 'REF_VALID.md',
        sizeBytes: 16,
        format: 'md',
        loadFile: () =>
          Promise.resolve(new File(['# 정상 문서'], 'REF_VALID.md', { type: 'text/markdown' })),
      },
    ]

    await processImportCandidates({
      ownerId: 'owner-1',
      jobId: 'job-1',
      importType: 'ref_zip',
      candidates,
      isCancelled: () => false,
      onProgress: vi.fn(),
    })

    expect(harness.createUploadedDocument).toHaveBeenCalledTimes(1)
    expect(harness.updateImportEntry).toHaveBeenCalledWith(
      'entry-1',
      expect.objectContaining({ status: 'failed' }),
    )
    expect(harness.updateImportEntry).toHaveBeenCalledWith(
      'entry-2',
      expect.objectContaining({ status: 'parsed', documentId: 'document-2' }),
    )
  })
})
