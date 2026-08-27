import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  addUploadedDocumentVersion,
  downloadDocumentVersion,
  findDuplicateDocument,
  readDocumentMetadata,
  type Document,
  type DocumentVersion,
} from '@/entities/document/api'
import { validateDocumentFile } from '@/entities/document/file-validation'
import type { KnowledgeRecord } from '@/entities/knowledge-item/api'
import { useAuth } from '@/features/auth/auth-context'
import {
  formatDate,
  friendlyDataError,
  itemStatusLabels,
  verificationLabels,
} from '@/shared/lib/display'
import { ErrorState, LoadingState } from '@/shared/ui/States'

const kindLabels: Record<Document['document_kind'], string> = {
  note: '개인 메모',
  reference: '참고 자료',
  ref: 'REF 개발 기록',
  research: '연구 자료',
  manual: '매뉴얼',
  source_record: '원본 기록',
  other: '기타',
}

export function DocumentDetailView({ record }: { record: KnowledgeRecord }) {
  const { user } = useAuth()
  const [documentData, setDocumentData] = useState<Document | null>(null)
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const data = await readDocumentMetadata(record.id)
      setDocumentData(data.document)
      setVersions(data.versions)
    } catch (caught) {
      setError(friendlyDataError(caught))
    } finally {
      setIsLoading(false)
    }
  }, [record.id])

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [load])

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
      setMessage(`원본을 덮어쓰지 않고 Version ${result.versionNumber}으로 보존했습니다.`)
      await load()
    } catch (caught) {
      const duplicateError =
        caught instanceof Error && caught.message.includes('DUPLICATE_DOCUMENT_HASH')
      setError(
        duplicateError
          ? '동일한 SHA-256 원본이 이미 보존되어 있습니다.'
          : caught instanceof Error
            ? caught.message
            : friendlyDataError(caught),
      )
    } finally {
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
  const activeVersion =
    versions.find((version) => version.id === documentData.active_version_id) ?? versions[0]

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
            {isWorking ? '검증 중…' : '새 Version'}
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
      <div className="document-layout">
        <aside className="content-card document-sidebar">
          <p className="eyebrow">Versions</p>
          <h2>원본 이력</h2>
          <div className="version-list">
            {versions.map((version) => (
              <button
                type="button"
                className={version.id === activeVersion?.id ? 'active' : ''}
                key={version.id}
                onClick={() =>
                  void downloadDocumentVersion(version).catch((caught: unknown) =>
                    setError(friendlyDataError(caught)),
                  )
                }
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
        </aside>
        <article className="content-card document-preview">
          <header>
            <div>
              <p className="eyebrow">Original Preview</p>
              <h2>{activeVersion?.source_filename ?? '원본 없음'}</h2>
            </div>
            {activeVersion && (
              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  void downloadDocumentVersion(activeVersion).catch((caught: unknown) =>
                    setError(friendlyDataError(caught)),
                  )
                }
              >
                원본 다운로드
              </button>
            )}
          </header>
          <div className="quiet-empty">
            <strong>원본은 안전하게 보존되었습니다</strong>
            <p>MD·TXT·PDF·DOCX 본문 추출과 Section 생성은 다음 Parser 단계에서 진행됩니다.</p>
          </div>
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
              <dd>{activeVersion?.format.toUpperCase()}</dd>
            </div>
            <div>
              <dt>처리 상태</dt>
              <dd>
                {activeVersion?.parse_status === 'pending'
                  ? '파싱 대기'
                  : activeVersion?.parse_status}
              </dd>
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
        </aside>
      </div>
    </section>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
