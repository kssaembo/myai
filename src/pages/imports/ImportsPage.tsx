import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  createUploadedDocument,
  findDuplicateDocument,
  type DuplicateDocument,
} from '@/entities/document/api'
import {
  MAX_DOCUMENT_BYTES,
  titleFromFilename,
  validateDocumentFile,
  type ValidatedDocumentFile,
} from '@/entities/document/file-validation'
import { readTaxonomy, type Category, type Tag } from '@/entities/taxonomy/api'
import { useAuth } from '@/features/auth/auth-context'
import { friendlyDataError } from '@/shared/lib/display'
import type { DocumentKind } from '@/shared/lib/supabase/database.types'

const documentKinds: [DocumentKind, string][] = [
  ['reference', '참고 자료'],
  ['ref', 'REF 개발 기록'],
  ['note', '개인 메모'],
  ['research', '연구 자료'],
  ['manual', '매뉴얼'],
  ['source_record', '원본 기록'],
  ['other', '기타'],
]

type UploadPhase = 'idle' | 'validating' | 'ready' | 'uploading' | 'saving' | 'complete'

export function ImportsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [validated, setValidated] = useState<ValidatedDocumentFile | null>(null)
  const [duplicate, setDuplicate] = useState<DuplicateDocument | null>(null)
  const [phase, setPhase] = useState<UploadPhase>('idle')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '',
    summary: '',
    categoryId: '',
    tagIds: [] as string[],
    documentKind: 'reference' as DocumentKind,
  })

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void readTaxonomy()
        .then((taxonomy) => {
          setCategories(taxonomy.categories.filter((category) => !category.is_archived))
          setTags(taxonomy.tags)
        })
        .catch((caught: unknown) => setError(friendlyDataError(caught)))
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [])

  const prepareFile = async (file?: File) => {
    if (!file) return
    setError('')
    setDuplicate(null)
    setValidated(null)
    setPhase('validating')
    try {
      const next = await validateDocumentFile(file)
      const existing = await findDuplicateDocument(next.contentHash)
      setValidated(next)
      setDuplicate(existing)
      setForm((current) => ({
        ...current,
        title: titleFromFilename(file.name),
        documentKind: file.name.toLocaleUpperCase('en-US').startsWith('REF_') ? 'ref' : 'reference',
      }))
      setPhase('ready')
    } catch (caught) {
      setPhase('idle')
      setError(caught instanceof Error ? caught.message : friendlyDataError(caught))
    }
  }

  const upload = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user || !validated || duplicate || !form.title.trim()) return
    setError('')
    setPhase('uploading')
    try {
      const itemId = await createUploadedDocument({
        ownerId: user.id,
        title: form.title,
        summary: form.summary,
        categoryId: form.categoryId || null,
        tagIds: form.tagIds,
        documentKind: form.documentKind,
        validated,
        onStorageUploaded: () => setPhase('saving'),
      })
      setPhase('complete')
      window.setTimeout(() => void navigate(`/knowledge/${itemId}`), 500)
    } catch (caught) {
      setPhase('ready')
      setError(friendlyDataError(caught))
    }
  }

  const setTag = (tagId: string, checked: boolean) => {
    setForm((current) => ({
      ...current,
      tagIds: checked
        ? [...new Set([...current.tagIds, tagId])]
        : current.tagIds.filter((id) => id !== tagId),
    }))
  }

  return (
    <section className="page-section imports-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Imports · Single File</p>
          <h1>원본 파일 가져오기</h1>
          <p>
            원본은 Private Storage에 불변 Version으로 보존됩니다. 이번 단계에서는 파일 하나씩
            업로드합니다.
          </p>
        </div>
        <span className="limit-badge">최대 {MAX_DOCUMENT_BYTES / 1024 / 1024}MiB</span>
      </header>

      <div className="upload-steps" aria-label="업로드 진행 단계">
        {[
          ['validating', '1', '검증'],
          ['uploading', '2', '업로드'],
          ['saving', '3', '기록'],
          ['complete', '4', '완료'],
        ].map(([value, number, label]) => {
          const order = ['idle', 'validating', 'ready', 'uploading', 'saving', 'complete']
          const active = order.indexOf(phase) >= order.indexOf(value)
          return (
            <div className={active ? 'active' : ''} key={value}>
              <span>{number}</span>
              <strong>{label}</strong>
            </div>
          )
        })}
      </div>

      {!validated ? (
        <label
          className={`upload-dropzone${phase === 'validating' ? ' is-busy' : ''}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            void prepareFile(event.dataTransfer.files[0])
          }}
        >
          <input
            type="file"
            accept=".md,.txt,.pdf,.docx"
            disabled={phase === 'validating'}
            onChange={(event) => void prepareFile(event.target.files?.[0])}
          />
          <div className="upload-icon" aria-hidden="true">
            ↑
          </div>
          <h2>
            {phase === 'validating'
              ? '파일을 안전하게 검사하는 중입니다'
              : '파일을 놓거나 선택하세요'}
          </h2>
          <p>MD · TXT · PDF · DOCX / 확장자·MIME·파일 서명·SHA-256 검사</p>
          <span className="secondary-button">파일 선택</span>
        </label>
      ) : (
        <form className="upload-workspace" onSubmit={(event) => void upload(event)}>
          <article className="content-card selected-file-card">
            <div className="file-format-mark">{validated.format.toUpperCase()}</div>
            <div>
              <strong>{validated.file.name}</strong>
              <span>
                {formatBytes(validated.file.size)} · SHA-256 {validated.contentHash.slice(0, 12)}…
              </span>
            </div>
            <button
              className="text-action"
              type="button"
              disabled={phase === 'uploading' || phase === 'saving'}
              onClick={() => {
                setValidated(null)
                setDuplicate(null)
                setPhase('idle')
              }}
            >
              다른 파일
            </button>
          </article>

          {duplicate ? (
            <article className="duplicate-card" role="status">
              <div>
                <strong>동일한 원본이 이미 보존되어 있습니다</strong>
                <p>
                  {duplicate.sourceFilename}과 SHA-256이 같습니다. 중복 업로드하지 않고 기존
                  Document로 이동할 수 있습니다.
                </p>
              </div>
              <Link className="secondary-button" to={`/knowledge/${duplicate.itemId}`}>
                기존 문서 열기
              </Link>
            </article>
          ) : (
            <div className="upload-form-grid">
              <article className="content-card upload-form-card">
                <p className="eyebrow">Document Metadata</p>
                <h2>문서 정보</h2>
                <label>
                  제목
                  <input
                    required
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </label>
                <label>
                  문서 종류
                  <select
                    value={form.documentKind}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        documentKind: event.target.value as DocumentKind,
                      }))
                    }
                  >
                    {documentKinds.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  요약
                  <textarea
                    rows={5}
                    value={form.summary}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, summary: event.target.value }))
                    }
                    placeholder="문서가 담고 있는 내용과 활용 목적"
                  />
                </label>
              </article>
              <article className="content-card upload-form-card">
                <p className="eyebrow">Classification</p>
                <h2>분류</h2>
                <label>
                  Category
                  <select
                    value={form.categoryId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, categoryId: event.target.value }))
                    }
                  >
                    <option value="">미분류</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.parent_id ? '↳ ' : ''}
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset className="tag-picker">
                  <legend>Tags</legend>
                  {tags.length ? (
                    tags.map((tag) => (
                      <label className="tag-option" key={tag.id}>
                        <input
                          type="checkbox"
                          checked={form.tagIds.includes(tag.id)}
                          onChange={(event) => setTag(tag.id, event.target.checked)}
                        />
                        <span
                          style={{ '--tag-color': tag.color ?? '#64748B' } as React.CSSProperties}
                        >
                          {tag.name}
                        </span>
                      </label>
                    ))
                  ) : (
                    <p>설정에서 Tag를 추가할 수 있습니다.</p>
                  )}
                </fieldset>
                <div className="privacy-note">
                  <strong>AI 처리 안 함</strong>
                  <p>원본 저장만 수행하며 파싱·구조화·AI 전송은 하지 않습니다.</p>
                </div>
              </article>
            </div>
          )}

          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          {!duplicate && (
            <div className="upload-actions">
              <button
                className="primary-button"
                type="submit"
                disabled={phase === 'uploading' || phase === 'saving' || phase === 'complete'}
              >
                {phase === 'uploading'
                  ? '원본 업로드 중…'
                  : phase === 'saving'
                    ? 'Version 기록 중…'
                    : phase === 'complete'
                      ? '저장 완료'
                      : 'Private Storage에 저장'}
              </button>
            </div>
          )}
        </form>
      )}
      {error && !validated && (
        <p className="inline-error upload-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
