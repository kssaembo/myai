import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import {
  archiveKnowledge,
  createKnowledge,
  getKnowledge,
  listKnowledge,
  restoreKnowledge,
  updateKnowledge,
  type KnowledgeInput,
  type KnowledgeRecord,
} from '@/entities/knowledge-item/api'
import { readTaxonomy, type Category, type NodeType, type Tag } from '@/entities/taxonomy/api'
import { useAuth } from '@/features/auth/auth-context'
import { KnowledgeUtilityBar } from '@/features/knowledge/KnowledgeUtilityBar'
import { DocumentDetailView } from '@/pages/documents/DocumentDetailView'
import { ProjectDetailView } from '@/pages/projects/ProjectDetailView'
import {
  formatDate,
  friendlyDataError,
  itemStatusLabels,
  lifecycleLabels,
  projectKindLabels,
  verificationLabels,
} from '@/shared/lib/display'
import type {
  ItemStatus,
  ProjectKind,
  ProjectLifecycleStatus,
  VerificationStatus,
} from '@/shared/lib/supabase/database.types'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/States'

const itemStatuses = Object.entries(itemStatusLabels) as [ItemStatus, string][]
const verificationStatuses = Object.entries(verificationLabels) as [VerificationStatus, string][]
const projectKinds = Object.entries(projectKindLabels) as [ProjectKind, string][]
const lifecycles = Object.entries(lifecycleLabels) as [ProjectLifecycleStatus, string][]

function TypeBadge({ record }: { record: KnowledgeRecord }) {
  return (
    <span
      className="type-badge"
      style={{ '--badge-color': record.nodeType.color } as React.CSSProperties}
    >
      {record.nodeType.label_ko}
    </span>
  )
}

function KnowledgeCard({
  record,
  onArchive,
  detailBase = '/knowledge',
}: {
  record: KnowledgeRecord
  onArchive: () => void
  detailBase?: string
}) {
  return (
    <article className="knowledge-card">
      <div className="knowledge-card-top">
        <TypeBadge record={record} />
        <span className={`status-chip status-${record.status}`}>
          {itemStatusLabels[record.status]}
        </span>
      </div>
      <div>
        <Link className="knowledge-title-link" to={`${detailBase}/${record.id}`}>
          {record.title}
        </Link>
        <p>{record.summary ?? '요약이 아직 없습니다.'}</p>
      </div>
      <div className="metadata-row">
        {record.category && <span>{record.category.name}</span>}
        {record.tags.slice(0, 3).map((tag) => (
          <span key={tag.id}>#{tag.name}</span>
        ))}
      </div>
      <footer>
        <span>{formatDate(record.updated_at)} 수정</span>
        {record.status === 'archived' ? (
          <button className="text-action" type="button" onClick={onArchive}>
            복원
          </button>
        ) : (
          <button className="text-action danger" type="button" onClick={onArchive}>
            보관
          </button>
        )}
      </footer>
    </article>
  )
}

export function KnowledgeListPage({ projectOnly = false }: { projectOnly?: boolean }) {
  const [records, setRecords] = useState<KnowledgeRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingArchive, setPendingArchive] = useState<KnowledgeRecord | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const typeFilter = searchParams.get('type') ?? ''
  const statusFilter = searchParams.get('status') ?? ''
  const includeArchived = searchParams.get('archived') === 'true'

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      setRecords(await listKnowledge({ projectOnly, includeArchived }))
    } catch (caught) {
      setError(friendlyDataError(caught))
    } finally {
      setIsLoading(false)
    }
  }, [includeArchived, projectOnly])

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  const filtered = useMemo(
    () =>
      records.filter((record) => {
        const needle = query.trim().toLocaleLowerCase('ko-KR')
        const matchesQuery =
          !needle ||
          `${record.title} ${record.summary ?? ''} ${record.tags.map((tag) => tag.name).join(' ')}`
            .toLocaleLowerCase('ko-KR')
            .includes(needle)
        return (
          matchesQuery &&
          (!typeFilter || record.nodeType.key === typeFilter) &&
          (!statusFilter || record.status === statusFilter)
        )
      }),
    [query, records, statusFilter, typeFilter],
  )

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const confirmArchive = async () => {
    if (!pendingArchive) return
    try {
      if (pendingArchive.status === 'archived') await restoreKnowledge(pendingArchive.id)
      else await archiveKnowledge(pendingArchive.id)
      setPendingArchive(null)
      await load()
    } catch (caught) {
      setPendingArchive(null)
      setError(friendlyDataError(caught))
    }
  }

  if (isLoading) return <LoadingState label="지식 목록을 불러오는 중입니다" />
  if (error && records.length === 0)
    return (
      <ErrorState
        title="목록을 불러오지 못했습니다"
        description={error}
        actionLabel="다시 시도"
        onAction={() => void load()}
      />
    )

  const nodeTypes = [
    ...new Map(records.map((record) => [record.nodeType.key, record.nodeType])).values(),
  ]

  return (
    <section className="page-section">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{projectOnly ? 'Projects' : 'Knowledge Library'}</p>
          <h1>{projectOnly ? '프로젝트' : '전체 지식'}</h1>
          <p>
            {projectOnly
              ? '서비스·수업·연구 같은 장기 작업을 관리합니다.'
              : '직접 작성한 Node를 찾고 분류하며 연결을 준비합니다.'}
          </p>
        </div>
        <Link
          className="primary-button"
          to={projectOnly ? '/knowledge/new?type=project' : '/knowledge/new'}
        >
          {projectOnly ? '새 프로젝트' : '새 지식'}
        </Link>
      </header>

      <div className="filter-bar">
        <label className="list-search">
          <span className="sr-only">목록 검색</span>
          <input
            value={query}
            onChange={(event) => updateParam('q', event.target.value)}
            placeholder="제목, 요약, 태그 검색"
          />
        </label>
        {!projectOnly && (
          <select
            aria-label="유형 필터"
            value={typeFilter}
            onChange={(event) => updateParam('type', event.target.value)}
          >
            <option value="">모든 유형</option>
            {nodeTypes.map((type) => (
              <option value={type.key} key={type.id}>
                {type.label_ko}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="상태 필터"
          value={statusFilter}
          onChange={(event) => updateParam('status', event.target.value)}
        >
          <option value="">모든 상태</option>
          {itemStatuses.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="check-control">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => updateParam('archived', event.target.checked ? 'true' : '')}
          />{' '}
          보관 포함
        </label>
      </div>

      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {filtered.length === 0 ? (
        <div className="content-card">
          <EmptyState
            title={
              records.length
                ? '조건에 맞는 지식이 없습니다'
                : projectOnly
                  ? '첫 프로젝트를 만들어 보세요'
                  : '첫 지식을 만들어 보세요'
            }
            description={
              records.length
                ? '검색어나 필터를 변경해 보세요.'
                : '파일 없이 Project, Idea, Concept부터 직접 기록할 수 있습니다.'
            }
          />
        </div>
      ) : (
        <div className="knowledge-grid">
          {filtered.map((record) => (
            <KnowledgeCard
              key={record.id}
              record={record}
              detailBase={projectOnly ? '/projects' : '/knowledge'}
              onArchive={() => setPendingArchive(record)}
            />
          ))}
        </div>
      )}

      {pendingArchive && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-title"
          >
            <p className="eyebrow">
              {pendingArchive.status === 'archived' ? 'Restore' : 'Archive'}
            </p>
            <h2 id="archive-title">
              {pendingArchive.status === 'archived'
                ? '이 항목을 복원할까요?'
                : '이 항목을 보관할까요?'}
            </h2>
            <p>
              {pendingArchive.status === 'archived'
                ? '복원하면 일반 목록에 다시 표시됩니다.'
                : '데이터는 삭제되지 않으며 보관 포함 필터에서 다시 찾을 수 있습니다.'}
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setPendingArchive(null)}
              >
                취소
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => void confirmArchive()}
              >
                {pendingArchive.status === 'archived' ? '복원' : '보관'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

interface FormState {
  nodeTypeId: string
  title: string
  summary: string
  categoryId: string
  status: ItemStatus
  verificationStatus: VerificationStatus
  importance: number
  tagIds: string[]
  projectKind: ProjectKind
  lifecycle: ProjectLifecycleStatus
  startedAt: string
  completedAt: string
  repositoryUrl: string
  serviceUrl: string
  version: string
}

const initialForm: FormState = {
  nodeTypeId: '',
  title: '',
  summary: '',
  categoryId: '',
  status: 'active',
  verificationStatus: 'confirmed',
  importance: 0,
  tagIds: [],
  projectKind: 'other',
  lifecycle: 'idea',
  startedAt: '',
  completedAt: '',
  repositoryUrl: '',
  serviceUrl: '',
  version: '',
}

export function KnowledgeFormPage() {
  const { itemId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [form, setForm] = useState<FormState>(initialForm)
  const [nodeTypes, setNodeTypes] = useState<NodeType[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const isEdit = Boolean(itemId)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const taxonomy = await readTaxonomy()
        if (!active) return
        let allowedTypes = taxonomy.nodeTypes.filter((type) => type.key !== 'document')
        setNodeTypes(allowedTypes)
        setCategories(taxonomy.categories.filter((category) => !category.is_archived))
        setTags(taxonomy.tags)
        const requestedType = searchParams.get('type')
        if (itemId) {
          const record = await getKnowledge(itemId)
          if (!active) return
          if (record.nodeType.key === 'document') allowedTypes = [...allowedTypes, record.nodeType]
          setNodeTypes(allowedTypes)
          setForm({
            nodeTypeId: record.node_type_id,
            title: record.title,
            summary: record.summary ?? '',
            categoryId: record.category_id ?? '',
            status: record.status,
            verificationStatus: record.verification_status,
            importance: record.importance,
            tagIds: record.tags.map((tag) => tag.id),
            projectKind: record.project?.project_kind ?? 'other',
            lifecycle: record.project?.lifecycle_status ?? 'idea',
            startedAt: record.project?.started_at ?? '',
            completedAt: record.project?.completed_at ?? '',
            repositoryUrl: record.project?.repository_url ?? '',
            serviceUrl: record.project?.service_url ?? '',
            version: record.project?.current_version_label ?? '',
          })
        } else {
          const selected =
            allowedTypes.find((type) => type.key === requestedType) ??
            allowedTypes.find((type) => type.key === 'idea') ??
            allowedTypes[0]
          setForm((current) => ({ ...current, nodeTypeId: selected?.id ?? '' }))
        }
      } catch (caught) {
        if (active) setError(friendlyDataError(caught))
      } finally {
        if (active) setIsLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [itemId, searchParams])

  const selectedType = nodeTypes.find((type) => type.id === form.nodeTypeId)
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user || !form.title.trim() || !form.nodeTypeId) return
    setIsSaving(true)
    setError('')
    const project =
      selectedType?.key === 'project'
        ? {
            project_kind: form.projectKind,
            lifecycle_status: form.lifecycle,
            started_at: form.startedAt || null,
            completed_at: form.completedAt || null,
            repository_url: form.repositoryUrl.trim() || null,
            service_url: form.serviceUrl.trim() || null,
            current_version_label: form.version.trim() || null,
          }
        : undefined
    const input: KnowledgeInput = {
      ownerId: user.id,
      nodeTypeId: form.nodeTypeId,
      title: form.title,
      summary: form.summary,
      categoryId: form.categoryId || null,
      status: form.status,
      verificationStatus: form.verificationStatus,
      importance: form.importance,
      tagIds: form.tagIds,
      project,
    }
    try {
      const id = itemId
        ? (await updateKnowledge(itemId, input), itemId)
        : await createKnowledge(input)
      void navigate(`/knowledge/${id}`, { replace: true, state: { saved: true } })
    } catch (caught) {
      setError(friendlyDataError(caught))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <LoadingState label="편집기를 준비하는 중입니다" />

  return (
    <section className="page-section form-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{isEdit ? 'Edit Node' : 'Create Node'}</p>
          <h1>{isEdit ? '지식 수정' : '새 지식 만들기'}</h1>
          <p>직접 작성한 Node는 Evidence 없이도 저장되며 ‘직접 작성’으로 표시됩니다.</p>
        </div>
      </header>
      <form className="knowledge-form content-card" onSubmit={(event) => void handleSubmit(event)}>
        <div className="form-section">
          <div className="form-section-heading">
            <span>01</span>
            <div>
              <h2>기본 정보</h2>
              <p>독립적으로 찾고 연결할 지식의 정체성을 정합니다.</p>
            </div>
          </div>
          <div className="form-grid two-columns">
            <label>
              유형
              <select
                value={form.nodeTypeId}
                disabled={isEdit}
                onChange={(event) => setField('nodeTypeId', event.target.value)}
              >
                {nodeTypes.map((type) => (
                  <option value={type.id} key={type.id}>
                    {type.label_ko} · {type.label_en}
                  </option>
                ))}
              </select>
              <small>{selectedType?.description}</small>
            </label>
            <label>
              제목
              <input
                required
                maxLength={200}
                value={form.title}
                onChange={(event) => setField('title', event.target.value)}
                placeholder="예: Teacher Host Pattern"
              />
            </label>
          </div>
          <label>
            요약
            <textarea
              rows={5}
              value={form.summary}
              onChange={(event) => setField('summary', event.target.value)}
              placeholder="이 지식의 핵심과 활용 맥락을 적어 주세요."
            />
          </label>
        </div>
        <div className="form-section">
          <div className="form-section-heading">
            <span>02</span>
            <div>
              <h2>분류와 상태</h2>
              <p>Category는 하나, Tag는 여러 개 선택할 수 있습니다.</p>
            </div>
          </div>
          <div className="form-grid three-columns">
            <label>
              Category
              <select
                value={form.categoryId}
                onChange={(event) => setField('categoryId', event.target.value)}
              >
                <option value="">선택 안 함</option>
                {categories.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.parent_id ? '↳ ' : ''}
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              상태
              <select
                value={form.status}
                onChange={(event) => setField('status', event.target.value as ItemStatus)}
              >
                {itemStatuses.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              확인 상태
              <select
                value={form.verificationStatus}
                onChange={(event) =>
                  setField('verificationStatus', event.target.value as VerificationStatus)
                }
              >
                {verificationStatuses.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="tag-picker">
            <legend>Tags</legend>
            {tags.length ? (
              tags.map((tag) => (
                <label className="tag-option" key={tag.id}>
                  <input
                    type="checkbox"
                    checked={form.tagIds.includes(tag.id)}
                    onChange={(event) =>
                      setField(
                        'tagIds',
                        event.target.checked
                          ? [...form.tagIds, tag.id]
                          : form.tagIds.filter((id) => id !== tag.id),
                      )
                    }
                  />
                  <span style={{ '--tag-color': tag.color ?? '#64748B' } as React.CSSProperties}>
                    {tag.name}
                  </span>
                </label>
              ))
            ) : (
              <p>설정에서 Tag를 먼저 만들 수 있습니다.</p>
            )}
          </fieldset>
          <label className="importance-control">
            중요도 <strong>{form.importance}</strong>
            <input
              type="range"
              min="0"
              max="5"
              value={form.importance}
              onChange={(event) => setField('importance', Number(event.target.value))}
            />
          </label>
        </div>
        {selectedType?.key === 'project' && (
          <div className="form-section">
            <div className="form-section-heading">
              <span>03</span>
              <div>
                <h2>프로젝트 정보</h2>
                <p>일반 Node에 프로젝트 전용 진행 상태와 링크를 확장합니다.</p>
              </div>
            </div>
            <div className="form-grid two-columns">
              <label>
                종류
                <select
                  value={form.projectKind}
                  onChange={(event) => setField('projectKind', event.target.value as ProjectKind)}
                >
                  {projectKinds.map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Lifecycle
                <select
                  value={form.lifecycle}
                  onChange={(event) =>
                    setField('lifecycle', event.target.value as ProjectLifecycleStatus)
                  }
                >
                  {lifecycles.map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                시작일
                <input
                  type="date"
                  value={form.startedAt}
                  onChange={(event) => setField('startedAt', event.target.value)}
                />
              </label>
              <label>
                완료일
                <input
                  type="date"
                  min={form.startedAt}
                  value={form.completedAt}
                  onChange={(event) => setField('completedAt', event.target.value)}
                />
              </label>
              <label>
                저장소 URL
                <input
                  type="url"
                  value={form.repositoryUrl}
                  onChange={(event) => setField('repositoryUrl', event.target.value)}
                  placeholder="https://github.com/..."
                />
              </label>
              <label>
                서비스 URL
                <input
                  type="url"
                  value={form.serviceUrl}
                  onChange={(event) => setField('serviceUrl', event.target.value)}
                  placeholder="https://..."
                />
              </label>
              <label>
                현재 버전
                <input
                  value={form.version}
                  onChange={(event) => setField('version', event.target.value)}
                  placeholder="예: v1.0"
                />
              </label>
            </div>
          </div>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button className="secondary-button" type="button" onClick={() => void navigate(-1)}>
            취소
          </button>
          <button
            className="primary-button"
            disabled={isSaving || !form.title.trim()}
            type="submit"
          >
            {isSaving ? '저장 중…' : '저장'}
          </button>
        </div>
      </form>
    </section>
  )
}

export function KnowledgeDetailPage() {
  const { itemId = '' } = useParams()
  const navigate = useNavigate()
  const [record, setRecord] = useState<KnowledgeRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showArchive, setShowArchive] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      setRecord(await getKnowledge(itemId))
    } catch (caught) {
      setError(friendlyDataError(caught))
    } finally {
      setIsLoading(false)
    }
  }, [itemId])
  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [load])
  if (isLoading) return <LoadingState label="지식을 불러오는 중입니다" />
  if (error || !record)
    return (
      <ErrorState
        title="지식을 열 수 없습니다"
        description={error || '항목이 존재하지 않습니다.'}
        actionLabel="목록으로"
        onAction={() => void navigate('/knowledge')}
      />
    )

  if (record.nodeType.key === 'document')
    return (
      <>
        <KnowledgeUtilityBar record={record} />
        <DocumentDetailView record={record} />
      </>
    )
  if (record.nodeType.key === 'project')
    return (
      <>
        <KnowledgeUtilityBar record={record} />
        <ProjectDetailView record={record} onChanged={load} />
      </>
    )

  return (
    <>
      <KnowledgeUtilityBar record={record} />
      <section className="page-section detail-page">
        <nav className="breadcrumb">
          <Link to="/knowledge">Knowledge</Link>
          <span>/</span>
          <span>{record.title}</span>
        </nav>
        <header className="detail-hero content-card">
          <div>
            <div className="detail-badges">
              <TypeBadge record={record} />
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
            <Link className="secondary-button" to={`/knowledge/${record.id}/edit`}>
              수정
            </Link>
            <button
              className="secondary-button danger-outline"
              type="button"
              onClick={() => setShowArchive(true)}
            >
              {record.status === 'archived' ? '복원' : '보관'}
            </button>
          </div>
        </header>
        <div className="detail-grid">
          <article className="content-card detail-panel">
            <header>
              <p className="eyebrow">Overview</p>
              <h2>분류와 메타데이터</h2>
            </header>
            <dl className="metadata-list">
              <div>
                <dt>Category</dt>
                <dd>{record.category?.name ?? '미분류'}</dd>
              </div>
              <div>
                <dt>Tags</dt>
                <dd>
                  {record.tags.length
                    ? record.tags.map((tag) => `#${tag.name}`).join(' · ')
                    : '없음'}
                </dd>
              </div>
              <div>
                <dt>중요도</dt>
                <dd>{record.importance} / 5</dd>
              </div>
              <div>
                <dt>생성 출처</dt>
                <dd>직접 작성</dd>
              </div>
              <div>
                <dt>최근 수정</dt>
                <dd>{formatDate(record.updated_at)}</dd>
              </div>
            </dl>
          </article>
          <article className="content-card detail-panel">
            <header>
              <p className="eyebrow">Evidence</p>
              <h2>근거</h2>
            </header>
            <div className="quiet-empty">
              <strong>직접 작성한 Node입니다</strong>
              <p>
                연결된 원문 Evidence가 없습니다. 파일 가져오기와 Evidence 연결은 이후 단계에서
                제공됩니다.
              </p>
            </div>
          </article>
          {record.project && (
            <article className="content-card detail-panel wide-panel">
              <header>
                <p className="eyebrow">Project Extension</p>
                <h2>프로젝트 정보</h2>
              </header>
              <dl className="metadata-list project-metadata">
                <div>
                  <dt>종류</dt>
                  <dd>{projectKindLabels[record.project.project_kind]}</dd>
                </div>
                <div>
                  <dt>Lifecycle</dt>
                  <dd>{lifecycleLabels[record.project.lifecycle_status]}</dd>
                </div>
                <div>
                  <dt>기간</dt>
                  <dd>
                    {record.project.started_at ?? '미정'} —{' '}
                    {record.project.completed_at ?? '진행 중'}
                  </dd>
                </div>
                <div>
                  <dt>현재 버전</dt>
                  <dd>{record.project.current_version_label ?? '미기록'}</dd>
                </div>
                {record.project.repository_url && (
                  <div>
                    <dt>저장소</dt>
                    <dd>
                      <a href={record.project.repository_url} target="_blank" rel="noreferrer">
                        링크 열기
                      </a>
                    </dd>
                  </div>
                )}
                {record.project.service_url && (
                  <div>
                    <dt>서비스</dt>
                    <dd>
                      <a href={record.project.service_url} target="_blank" rel="noreferrer">
                        링크 열기
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </article>
          )}
          <article className="content-card detail-panel wide-panel">
            <header>
              <p className="eyebrow">Connections</p>
              <h2>관계와 관련 Project</h2>
            </header>
            <div className="quiet-empty">
              <strong>Relation과 Evidence 관리</strong>
              <p>
                허용된 유형의 Relation을 만들고 원문 Evidence를 연결하거나 중복 Node를 병합할 수
                있습니다.
              </p>
              <Link className="secondary-button" to={`/knowledge/${record.id}/connections`}>
                연결 관리 열기
              </Link>
            </div>
          </article>
        </div>
        {showArchive && (
          <div className="modal-backdrop">
            <div className="confirm-modal" role="dialog" aria-modal="true">
              <h2>{record.status === 'archived' ? '항목을 복원할까요?' : '항목을 보관할까요?'}</h2>
              <p>원본 데이터는 삭제되지 않습니다.</p>
              <div className="modal-actions">
                <button
                  className="secondary-button"
                  onClick={() => setShowArchive(false)}
                  type="button"
                >
                  취소
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() =>
                    void (async () => {
                      try {
                        if (record.status === 'archived') await restoreKnowledge(record.id)
                        else await archiveKnowledge(record.id)
                        setShowArchive(false)
                        await load()
                      } catch (caught) {
                        setShowArchive(false)
                        setError(friendlyDataError(caught))
                      }
                    })()
                  }
                >
                  {record.status === 'archived' ? '복원' : '보관'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
