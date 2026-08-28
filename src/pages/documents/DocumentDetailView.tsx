import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'

import {
  addUploadedDocumentVersion,
  commitDocumentParse,
  downloadDocumentVersion,
  findDuplicateDocument,
  readDocumentMetadata,
  readDocumentSections,
  readOriginalForParsing,
  readOriginalPreview,
  setVersionProcessing,
  type Document,
  type DocumentVersion,
} from '@/entities/document/api'
import { validateDocumentFile } from '@/entities/document/file-validation'
import { runDocumentParser } from '@/entities/document/parser/run-parser'
import type { ParserResult } from '@/entities/document/parser/types'
import type { KnowledgeRecord } from '@/entities/knowledge-item/api'
import { useAuth } from '@/features/auth/auth-context'
import type { Tables } from '@/shared/lib/supabase'
import type { ParseStatus } from '@/shared/lib/supabase/database.types'
import {
  formatDate,
  friendlyDataError,
  itemStatusLabels,
  verificationLabels,
} from '@/shared/lib/display'
import { ErrorState, LoadingState } from '@/shared/ui/States'

type DocumentSection = Tables<'document_sections'>
type OriginalPreview = Awaited<ReturnType<typeof readOriginalPreview>>

const kindLabels: Record<Document['document_kind'], string> = {
  note: '개인 메모',
  reference: '참고 자료',
  ref: 'REF 개발 기록',
  research: '연구 자료',
  manual: '매뉴얼',
  source_record: '원본 기록',
  other: '기타',
}

const parseStatusLabels: Record<ParseStatus, string> = {
  pending: '파싱 대기',
  processing: '처리 중',
  parsed: '추출 완료',
  partial: '일부 추출',
  failed: '추출 실패',
  needs_ocr: 'OCR 필요',
}

const failedResult = (message: string): ParserResult => ({
  status: 'failed',
  contentText: null,
  sections: [],
  parserName: 'knowledge-os-worker',
  parserVersion: '1.0.0',
  errorCode: 'PARSER_WORKER_FAILED',
  errorMessage: message,
  warnings: [],
})

export function DocumentDetailView({ record }: { record: KnowledgeRecord }) {
  const { user } = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const requestedVersionId = searchParams.get('version') ?? ''
  const [documentData, setDocumentData] = useState<Document | null>(null)
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [sections, setSections] = useState<DocumentSection[]>([])
  const [preview, setPreview] = useState<OriginalPreview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isVersionLoading, setIsVersionLoading] = useState(false)
  const [isWorking, setIsWorking] = useState(false)
  const [progress, setProgress] = useState({ value: 0, label: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) ?? versions[0],
    [selectedVersionId, versions],
  )

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const data = await readDocumentMetadata(record.id)
      setDocumentData(data.document)
      setVersions(data.versions)
      setSelectedVersionId((current) =>
        requestedVersionId && data.versions.some((version) => version.id === requestedVersionId)
          ? requestedVersionId
          : data.versions.some((version) => version.id === current)
            ? current
            : (data.document.active_version_id ?? data.versions[0]?.id ?? ''),
      )
    } catch (caught) {
      setError(friendlyDataError(caught))
    } finally {
      setIsLoading(false)
    }
  }, [record.id, requestedVersionId])

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  useEffect(() => {
    if (!selectedVersion) return
    let cancelled = false
    const timeout = window.setTimeout(() => {
      setIsVersionLoading(true)
      setPreview(null)
      void Promise.all([
        readDocumentSections(selectedVersion.id),
        readOriginalPreview(selectedVersion),
      ])
        .then(([nextSections, nextPreview]) => {
          if (cancelled) return
          setSections(nextSections)
          setPreview(nextPreview)
        })
        .catch((caught: unknown) => {
          if (!cancelled) setError(friendlyDataError(caught))
        })
        .finally(() => {
          if (!cancelled) setIsVersionLoading(false)
        })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [selectedVersion])

  useEffect(() => {
    if (!sections.length || !location.hash.startsWith('#section-')) return
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [location.hash, sections])

  const addVersion = async (file?: File) => {
    if (!file || !user) return
    setIsWorking(true)
    setError('')
    setMessage('')
    try {
      const validated = await validateDocumentFile(file)
      const duplicate = await findDuplicateDocument(validated.contentHash)
      if (duplicate) throw new Error('DUPLICATE_DOCUMENT_HASH')
      const result = await addUploadedDocumentVersion(user.id, record.id, validated)
      setSelectedVersionId(result.versionId)
      setMessage(`원본을 덮어쓰지 않고 Version ${result.versionNumber}으로 보존했습니다.`)
      await load()
    } catch (caught) {
      setError(friendlyDataError(caught))
    } finally {
      setIsWorking(false)
    }
  }

  const parseVersion = async () => {
    if (!selectedVersion) return
    setIsWorking(true)
    setError('')
    setMessage('')
    setProgress({ value: 2, label: '원본 불러오기' })
    try {
      await setVersionProcessing(selectedVersion.id)
      const buffer = await readOriginalForParsing(selectedVersion)
      const result = await runDocumentParser(selectedVersion.format, buffer, (value, label) =>
        setProgress({ value, label }),
      )
      setProgress({ value: 98, label: 'Supabase에 Section 저장' })
      const count = await commitDocumentParse(selectedVersion.id, result)
      setMessage(
        result.status === 'needs_ocr'
          ? '텍스트가 거의 없어 OCR이 필요한 PDF로 분류했습니다.'
          : `${count}개 Section을 생성하고 추출 결과를 저장했습니다.`,
      )
      await load()
    } catch (caught) {
      const safeMessage =
        caught instanceof Error && caught.message === 'PARSER_TIMEOUT'
          ? '파서 제한 시간을 초과했습니다.'
          : '문서를 처리하지 못했습니다. 원본은 변경되지 않았습니다.'
      try {
        await commitDocumentParse(selectedVersion.id, failedResult(safeMessage))
      } catch {
        // Preserve the original failure if the status write also fails.
      }
      setError(friendlyDataError(caught))
      await load()
    } finally {
      setProgress({ value: 0, label: '' })
      setIsWorking(false)
    }
  }

  if (isLoading) return <LoadingState label="문서 Version을 불러오는 중입니다" />
  if (!documentData)
    return (
      <ErrorState
        title="문서 정보를 열 수 없습니다"
        description={error}
        actionLabel="다시 시도"
        onAction={() => void load()}
      />
    )

  return (
    <section className="page-section document-detail-page">
      <nav className="breadcrumb">
        <Link to="/knowledge">Knowledge</Link>
        <span>/</span>
        <span>{record.title}</span>
      </nav>
      <header className="detail-hero content-card">
        <div>
          <div className="detail-badges">
            <span
              className="type-badge"
              style={{ '--badge-color': record.nodeType.color } as React.CSSProperties}
            >
              문서
            </span>
            <span className={`status-chip status-${record.status}`}>
              {itemStatusLabels[record.status]}
            </span>
            <span className="status-chip">{verificationLabels[record.verification_status]}</span>
          </div>
          <h1>{record.title}</h1>
          <p>{record.summary ?? '요약이 아직 없습니다.'}</p>
        </div>
        <div className="detail-actions">
          <Link className="secondary-button" to={`/knowledge/${record.id}/connections`}>
            Relation · Evidence
          </Link>
          {documentData.document_kind === 'ref' && (
            <Link className="secondary-button" to={`/knowledge/${record.id}/ref-review`}>
              REF 구조화
            </Link>
          )}
          <Link className="secondary-button" to={`/knowledge/${record.id}/edit`}>
            메타데이터 수정
          </Link>
          <label className={`primary-button file-button${isWorking ? ' disabled' : ''}`}>
            <input
              type="file"
              accept=".md,.txt,.pdf,.docx"
              disabled={isWorking}
              onChange={(event) => void addVersion(event.target.files?.[0])}
            />
            {isWorking ? '처리 중…' : '새 Version'}
          </label>
        </div>
      </header>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="inline-success" role="status">
          {message}
        </p>
      )}
      {isWorking && progress.value > 0 && (
        <div className="parse-progress content-card" role="status">
          <div>
            <strong>{progress.label}</strong>
            <span>{progress.value}%</span>
          </div>
          <progress max="100" value={progress.value} />
        </div>
      )}
      <div className="document-layout parser-layout">
        <aside className="content-card document-sidebar">
          <p className="eyebrow">Versions</p>
          <h2>원본 이력</h2>
          <div className="version-list">
            {versions.map((version) => (
              <button
                type="button"
                className={version.id === selectedVersion?.id ? 'active' : ''}
                key={version.id}
                onClick={() => setSelectedVersionId(version.id)}
              >
                <span>v{version.version_number}</span>
                <div>
                  <strong>{version.source_filename}</strong>
                  <small>
                    {formatDate(version.created_at)} · {formatBytes(version.size_bytes)}
                  </small>
                </div>
                {version.id === documentData.active_version_id && <em>현재</em>}
              </button>
            ))}
          </div>
          {sections.length > 0 && (
            <div className="section-toc">
              <p className="eyebrow">Sections · {sections.length}</p>
              {sections
                .filter((section) => section.heading)
                .map((section) => (
                  <a
                    key={section.id}
                    href={`#section-${section.id}`}
                    style={{
                      paddingLeft: `${Math.max(0, (section.heading_level ?? 1) - 1) * 10}px`,
                    }}
                  >
                    {section.heading}
                  </a>
                ))}
            </div>
          )}
        </aside>
        <article className="content-card document-preview parser-preview">
          <header>
            <div>
              <p className="eyebrow">Original ↔ Extracted</p>
              <h2>{selectedVersion?.source_filename ?? '원본 없음'}</h2>
            </div>
            <div className="parser-actions">
              {selectedVersion && (
                <>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={isWorking}
                    onClick={() =>
                      void downloadDocumentVersion(selectedVersion).catch((caught: unknown) =>
                        setError(friendlyDataError(caught)),
                      )
                    }
                  >
                    원본 다운로드
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={isWorking}
                    onClick={() => void parseVersion()}
                  >
                    {selectedVersion.parse_status === 'pending' ? '본문 추출 시작' : '다시 추출'}
                  </button>
                </>
              )}
            </div>
          </header>
          {isVersionLoading ? (
            <LoadingState label="원본과 Section을 불러오는 중입니다" />
          ) : selectedVersion?.parse_status === 'pending' ? (
            <div className="quiet-empty">
              <strong>원본이 파싱을 기다리고 있습니다</strong>
              <p>본문 추출을 시작하면 브라우저 안에서 처리한 뒤 Section만 개인 DB에 저장합니다.</p>
            </div>
          ) : (
            <div className="document-compare">
              <section className="source-pane">
                <h3>원본</h3>
                {preview?.kind === 'text' && <pre>{preview.value}</pre>}
                {preview?.kind === 'pdf' && (
                  <iframe src={preview.value} title={`${selectedVersion?.source_filename} 원본`} />
                )}
                {preview?.kind === 'unavailable' && (
                  <div className="quiet-empty compact">
                    <strong>DOCX 원본 미리보기 미지원</strong>
                    <p>원본 다운로드로 확인할 수 있습니다.</p>
                  </div>
                )}
              </section>
              <section className="extracted-pane">
                <h3>추출 본문 · {sections.length} Sections</h3>
                {sections.length ? (
                  sections.map((section) => (
                    <article
                      id={`section-${section.id}`}
                      className="extracted-section"
                      key={section.id}
                    >
                      <div>
                        <strong>{section.heading ?? `Section ${section.ordinal + 1}`}</strong>
                        <span>{section.token_estimate ?? 0} tokens</span>
                      </div>
                      <pre>{section.content}</pre>
                    </article>
                  ))
                ) : (
                  <div className="quiet-empty compact">
                    <strong>추출된 Section이 없습니다</strong>
                    <p>
                      {selectedVersion?.parse_error_message ??
                        '다시 추출하거나 원본을 확인해 주세요.'}
                    </p>
                  </div>
                )}
              </section>
            </div>
          )}
        </article>
        <aside className="content-card document-metadata">
          <p className="eyebrow">Metadata</p>
          <h2>문서 정보</h2>
          <dl className="metadata-list">
            <div>
              <dt>종류</dt>
              <dd>{kindLabels[documentData.document_kind]}</dd>
            </div>
            <div>
              <dt>형식</dt>
              <dd>{selectedVersion?.format.toUpperCase()}</dd>
            </div>
            <div>
              <dt>처리 상태</dt>
              <dd>
                <span className={`parse-status parse-${selectedVersion?.parse_status}`}>
                  {selectedVersion ? parseStatusLabels[selectedVersion.parse_status] : '-'}
                </span>
              </dd>
            </div>
            <div>
              <dt>Parser</dt>
              <dd>{selectedVersion?.parser_name ?? '미실행'}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{record.category?.name ?? '미분류'}</dd>
            </div>
            <div>
              <dt>Tags</dt>
              <dd>
                {record.tags.length ? record.tags.map((tag) => `#${tag.name}`).join(' · ') : '없음'}
              </dd>
            </div>
            <div>
              <dt>AI 허용</dt>
              <dd>{documentData.ai_allowed ? '허용' : '허용 안 함'}</dd>
            </div>
            <div>
              <dt>Version 수</dt>
              <dd>{versions.length}</dd>
            </div>
          </dl>
          {selectedVersion?.parse_error_message && (
            <p className="parser-warning">{selectedVersion.parse_error_message}</p>
          )}
        </aside>
      </div>
    </section>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
