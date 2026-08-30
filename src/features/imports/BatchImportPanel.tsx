import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  MAX_ARCHIVE_BYTES,
  MAX_IMPORT_ENTRIES,
  prepareArchive,
  prepareFiles,
  type PreparedImport,
} from '@/entities/import-job/archive'
import {
  cancelImportJob,
  createImportJob,
  listImportJobs,
  type ImportEntry,
  type ImportJobRecord,
} from '@/entities/import-job/api'
import { processImportCandidates, type ImportProgress } from '@/entities/import-job/processor'
import {
  autoStructureExistingRef,
  listRefAutomationCandidates,
  type RefAutomationCandidate,
} from '@/entities/ref-review/api'
import { useAuth } from '@/features/auth/auth-context'
import { formatDate, friendlyDataError } from '@/shared/lib/display'
import type {
  ImportEntryStatus,
  ImportJobStatus,
  ImportType,
} from '@/shared/lib/supabase/database.types'

const jobLabels: Record<ImportJobStatus, string> = {
  queued: '대기',
  validating: '검증 중',
  uploading: '업로드 중',
  parsing: '파싱 중',
  structuring: '구조화 중',
  completed: '완료',
  partial: '일부 완료',
  failed: '실패',
  cancelled: '취소됨',
}

const entryLabels: Record<ImportEntryStatus, string> = {
  queued: '대기',
  validating: '검증 중',
  duplicate: '중복',
  uploaded: '업로드됨',
  parsed: '완료',
  partial: '일부 완료',
  failed: '실패',
  skipped: '건너뜀',
}

export function BatchImportPanel() {
  const { user } = useAuth()
  const [sourceMode, setSourceMode] = useState<'files' | 'zip'>('files')
  const [archiveType, setArchiveType] = useState<Extract<ImportType, 'zip' | 'ref_zip'>>('zip')
  const [prepared, setPrepared] = useState<PreparedImport | null>(null)
  const preparedRef = useRef<PreparedImport | null>(null)
  const [jobs, setJobs] = useState<ImportJobRecord[]>([])
  const [currentJobId, setCurrentJobId] = useState('')
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [isPreparing, setIsPreparing] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const [refCandidates, setRefCandidates] = useState<RefAutomationCandidate[]>([])
  const [isStructuringRefs, setIsStructuringRefs] = useState(false)
  const [refProgress, setRefProgress] = useState<{
    completed: number
    total: number
    title: string
  } | null>(null)
  const [refResult, setRefResult] = useState('')
  const cancelRef = useRef(false)

  const loadJobs = useCallback(async () => {
    try {
      setJobs(await listImportJobs())
    } catch (caught) {
      setError(friendlyDataError(caught))
    }
  }, [])

  const loadRefCandidates = useCallback(async () => {
    try {
      setRefCandidates(await listRefAutomationCandidates())
    } catch (caught) {
      setError(friendlyDataError(caught))
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadJobs()
      void loadRefCandidates()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [loadJobs, loadRefCandidates])

  useEffect(
    () => () => {
      void preparedRef.current?.dispose()
    },
    [],
  )

  const replacePrepared = async (next: PreparedImport | null) => {
    await preparedRef.current?.dispose()
    preparedRef.current = next
    setPrepared(next)
    setCurrentJobId('')
    setProgress(null)
  }

  const selectFiles = async (files: File[]) => {
    setError('')
    setIsPreparing(true)
    try {
      await replacePrepared(prepareFiles(files))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : friendlyDataError(caught))
    } finally {
      setIsPreparing(false)
    }
  }

  const selectArchive = async (file?: File) => {
    if (!file) return
    setError('')
    setIsPreparing(true)
    try {
      await replacePrepared(await prepareArchive(file, archiveType === 'ref_zip'))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : friendlyDataError(caught))
    } finally {
      setIsPreparing(false)
    }
  }

  const run = async (retry = false) => {
    if (!user || !prepared) return
    setError('')
    setIsProcessing(true)
    cancelRef.current = false
    try {
      let jobId = currentJobId
      let candidates = prepared.candidates
      let existingEntries: Map<string, ImportEntry> | undefined
      if (retry) {
        const job = jobs.find((candidate) => candidate.id === currentJobId)
        if (!job) throw new Error('재처리할 Job 정보를 찾지 못했습니다.')
        existingEntries = new Map(job.entries.map((entry) => [entry.id, entry]))
        candidates = candidates.filter((candidate) => {
          const status = existingEntries?.get(candidate.id)?.status
          return status === 'failed' || status === 'partial'
        })
        if (!candidates.length) throw new Error('재처리할 실패 항목이 없습니다.')
      } else {
        jobId = await createImportJob(user.id, prepared.importType, prepared.candidates)
        setCurrentJobId(jobId)
      }

      await processImportCandidates({
        ownerId: user.id,
        jobId,
        importType: prepared.importType,
        candidates,
        existingEntries,
        isCancelled: () => cancelRef.current,
        onProgress: setProgress,
      })
      await loadJobs()
    } catch (caught) {
      setError(friendlyDataError(caught))
    } finally {
      setIsProcessing(false)
    }
  }

  const cancel = async () => {
    if (!currentJobId) return
    cancelRef.current = true
    try {
      await cancelImportJob(currentJobId)
      await loadJobs()
    } catch (caught) {
      setError(friendlyDataError(caught))
    }
  }

  const restructureExistingRefs = async () => {
    if (!refCandidates.length) return
    setError('')
    setRefResult('')
    setIsStructuringRefs(true)
    let structured = 0
    let review = 0
    let failed = 0
    let firstFailure: unknown = null
    try {
      for (const [index, candidate] of refCandidates.entries()) {
        setRefProgress({
          completed: index,
          total: refCandidates.length,
          title: candidate.title,
        })
        try {
          const result = await autoStructureExistingRef(candidate)
          if (result.status === 'structured') structured += 1
          else review += 1
        } catch (caught) {
          failed += 1
          firstFailure ??= caught
        }
      }
      setRefProgress({
        completed: refCandidates.length,
        total: refCandidates.length,
        title: '완료',
      })
      setRefResult(
        `자동 정리 ${structured}개 · 확인 필요 ${review}개${failed ? ` · 실패 ${failed}개` : ''}`,
      )
      if (firstFailure) setError(friendlyDataError(firstFailure))
      await loadRefCandidates()
    } finally {
      setIsStructuringRefs(false)
    }
  }

  const currentJob = jobs.find((job) => job.id === currentJobId)
  const canRetry =
    !isProcessing &&
    Boolean(
      currentJob?.entries.some((entry) => entry.status === 'failed' || entry.status === 'partial'),
    )

  return (
    <section className="page-section batch-import-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Imports · Batch Job</p>
          <h1>여러 문서 일괄 가져오기</h1>
          <p>각 파일을 독립적으로 검증·저장·파싱하여 한 항목의 실패가 전체 작업을 막지 않습니다.</p>
        </div>
        <span className="limit-badge">
          최대 {MAX_IMPORT_ENTRIES}개 · ZIP {MAX_ARCHIVE_BYTES / 1024 / 1024}MiB
        </span>
      </header>

      <article className="content-card ref-auto-card">
        <div>
          <p className="eyebrow">REF 자동 정리</p>
          <h2>기존 REF도 쉬운 지식으로 연결</h2>
          <p>
            문서 {refCandidates.length}개를 다시 업로드하지 않고 정리합니다. 코드·Markdown 제목은
            짧은 개념명으로 바꾸고 기존 근거와 관계는 유지합니다.
          </p>
          {refResult && <strong className="ref-auto-result">{refResult}</strong>}
        </div>
        <div className="ref-auto-actions">
          {refProgress && (
            <span>
              {refProgress.title} · {refProgress.completed}/{refProgress.total}
            </span>
          )}
          <button
            className="secondary-button"
            type="button"
            disabled={isStructuringRefs || !refCandidates.length}
            onClick={() => void restructureExistingRefs()}
          >
            {isStructuringRefs ? 'REF 정리 중…' : '기존 REF 전체 정리'}
          </button>
        </div>
      </article>

      <div className="batch-source-tabs content-card">
        <button
          type="button"
          className={sourceMode === 'files' ? 'active' : ''}
          onClick={() => setSourceMode('files')}
        >
          여러 파일
        </button>
        <button
          type="button"
          className={sourceMode === 'zip' ? 'active' : ''}
          onClick={() => setSourceMode('zip')}
        >
          ZIP / REF ZIP
        </button>
      </div>

      {sourceMode === 'zip' && (
        <div className="archive-type-picker">
          <label>
            <input
              type="radio"
              checked={archiveType === 'zip'}
              onChange={() => setArchiveType('zip')}
            />
            일반 ZIP
          </label>
          <label>
            <input
              type="radio"
              checked={archiveType === 'ref_zip'}
              onChange={() => setArchiveType('ref_zip')}
            />
            REF ZIP
          </label>
          <p>REF ZIP은 본문을 추출한 뒤 확실한 항목을 자동으로 쉬운 지식 구조에 연결합니다.</p>
        </div>
      )}

      {!prepared ? (
        <label
          className={`upload-dropzone batch-dropzone${isPreparing ? ' is-busy' : ''}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            if (sourceMode === 'zip') void selectArchive(event.dataTransfer.files[0])
            else void selectFiles([...event.dataTransfer.files])
          }}
        >
          <input
            type="file"
            multiple={sourceMode === 'files'}
            accept={sourceMode === 'zip' ? '.zip' : '.md,.txt,.pdf,.docx'}
            disabled={isPreparing}
            onChange={(event) => {
              if (sourceMode === 'zip') void selectArchive(event.target.files?.[0])
              else void selectFiles([...(event.target.files ?? [])])
            }}
          />
          <div className="upload-icon" aria-hidden="true">
            ↑
          </div>
          <h2>
            {isPreparing
              ? '안전하게 목록을 검사하는 중입니다'
              : sourceMode === 'zip'
                ? 'ZIP 파일을 놓거나 선택하세요'
                : '여러 문서를 한 번에 선택하세요'}
          </h2>
          <p>
            {sourceMode === 'zip'
              ? '경로 탈출·암호화·중첩 ZIP·개수·압축 해제 크기 검사'
              : 'MD · TXT · PDF · DOCX / 지원하지 않는 형식은 개별 건너뜀'}
          </p>
          <span className="secondary-button">파일 선택</span>
        </label>
      ) : (
        <div className="batch-workspace">
          <article className="content-card batch-summary">
            <div>
              <p className="eyebrow">Prepared Import</p>
              <h2>{prepared.sourceLabel}</h2>
              <p>
                전체 {prepared.candidates.length}개 · 지원{' '}
                {prepared.candidates.filter((candidate) => candidate.format).length}개 · 건너뜀{' '}
                {prepared.candidates.filter((candidate) => !candidate.format).length}개
              </p>
            </div>
            <div className="batch-actions">
              <button
                className="text-action"
                type="button"
                disabled={isProcessing}
                onClick={() => void replacePrepared(null)}
              >
                다시 선택
              </button>
              {isProcessing ? (
                <button className="secondary-button" type="button" onClick={() => void cancel()}>
                  작업 취소
                </button>
              ) : canRetry ? (
                <button className="secondary-button" type="button" onClick={() => void run(true)}>
                  실패 항목 재처리
                </button>
              ) : null}
              <button
                className="primary-button"
                type="button"
                disabled={isProcessing || Boolean(currentJobId)}
                onClick={() => void run(false)}
              >
                {isProcessing ? '가져오는 중…' : currentJobId ? 'Job 생성됨' : '일괄 가져오기 시작'}
              </button>
            </div>
          </article>
          {progress && (
            <div className="batch-progress content-card" role="status">
              <div>
                <strong>{progress.filename}</strong>
                <span>
                  {progress.phase} · {progress.completed}/{progress.total}
                </span>
              </div>
              <progress max={progress.total} value={progress.completed} />
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}

      <section className="import-history">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Recent Jobs</p>
            <h2>가져오기 기록</h2>
          </div>
          <button className="text-action" type="button" onClick={() => void loadJobs()}>
            새로고침
          </button>
        </div>
        {jobs.length ? (
          jobs.map((job) => (
            <details
              className="content-card import-job-card"
              key={job.id}
              open={job.id === currentJobId}
            >
              <summary>
                <div>
                  <strong>
                    {job.import_type.toUpperCase()} · {formatDate(job.created_at)}
                  </strong>
                  <span>
                    전체 {job.total_count} · 완료 {job.success_count} · 일부 {job.partial_count} ·
                    실패 {job.failed_count} · 중복 {job.duplicate_count}
                  </span>
                </div>
                <span className={`job-status job-${job.status}`}>{jobLabels[job.status]}</span>
              </summary>
              <div className="import-entry-list">
                {job.entries.map((entry) => (
                  <div key={entry.id}>
                    <span className={`entry-status entry-${entry.status}`}>
                      {entryLabels[entry.status]}
                    </span>
                    <div>
                      <strong>{entry.relative_path}</strong>
                      <small>
                        {entry.error_message ??
                          `${formatBytes(entry.size_bytes)} · ${entry.format?.toUpperCase() ?? '미지원'}`}
                      </small>
                    </div>
                    {entry.document_id ? (
                      <Link to={`/knowledge/${entry.document_id}`}>문서 열기</Link>
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
              </div>
            </details>
          ))
        ) : (
          <div className="quiet-empty content-card compact">
            <strong>아직 Import Job이 없습니다</strong>
            <p>여러 파일이나 ZIP을 선택해 첫 작업을 시작하세요.</p>
          </div>
        )}
      </section>
    </section>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
