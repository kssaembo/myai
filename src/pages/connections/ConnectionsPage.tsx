import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { getKnowledge, listKnowledge, type KnowledgeRecord } from '@/entities/knowledge-item/api'
import {
  archiveRelation,
  getKnowledgeConnections,
  mergeKnowledgeItems,
  saveRelation,
  type ConnectionRelation,
  type ConnectionsSnapshot,
} from '@/entities/relation/api'
import { readTaxonomy, type RelationType } from '@/entities/taxonomy/api'
import { friendlyDataError } from '@/shared/lib/display'
import type { RelationStatus } from '@/shared/lib/supabase/database.types'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/States'

interface RelationForm {
  id: string | null
  sourceId: string
  targetId: string
  typeId: string
  status: RelationStatus
  rationale: string
  evidenceIds: string[]
}

const emptySnapshot: ConnectionsSnapshot = {
  relations: [],
  item_evidence: [],
  duplicate_candidates: [],
}

export function ConnectionsPage() {
  const { itemId = '' } = useParams()
  const navigate = useNavigate()
  const [record, setRecord] = useState<KnowledgeRecord | null>(null)
  const [items, setItems] = useState<KnowledgeRecord[]>([])
  const [relationTypes, setRelationTypes] = useState<RelationType[]>([])
  const [snapshot, setSnapshot] = useState<ConnectionsSnapshot>(emptySnapshot)
  const [form, setForm] = useState<RelationForm>({
    id: null,
    sourceId: itemId,
    targetId: '',
    typeId: '',
    status: 'proposed',
    rationale: '',
    evidenceIds: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [mergeCandidate, setMergeCandidate] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const [nextRecord, nextItems, taxonomy, nextSnapshot] = await Promise.all([
        getKnowledge(itemId),
        listKnowledge({ includeArchived: false }),
        readTaxonomy(),
        getKnowledgeConnections(itemId),
      ])
      setRecord(nextRecord)
      setItems(nextItems)
      setRelationTypes(taxonomy.relationTypes)
      setSnapshot(nextSnapshot)
      setForm((current) => ({ ...current, sourceId: current.id ? current.sourceId : itemId }))
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

  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const allowedTypes = useMemo(() => {
    const sourceType = itemMap.get(form.sourceId)?.nodeType.key
    const targetType = itemMap.get(form.targetId)?.nodeType.key
    return relationTypes.filter(
      (type) =>
        (!type.allowed_source_types.length ||
          (sourceType && type.allowed_source_types.includes(sourceType))) &&
        (!type.allowed_target_types.length ||
          (targetType && type.allowed_target_types.includes(targetType))),
    )
  }, [form.sourceId, form.targetId, itemMap, relationTypes])

  const resetForm = () =>
    setForm({
      id: null,
      sourceId: itemId,
      targetId: '',
      typeId: '',
      status: 'proposed',
      rationale: '',
      evidenceIds: [],
    })
  const editRelation = (relation: ConnectionRelation) =>
    setForm({
      id: relation.id,
      sourceId: relation.source_item_id,
      targetId: relation.target_item_id,
      typeId: relation.relation_type_id,
      status: relation.status,
      rationale: relation.rationale ?? '',
      evidenceIds: [],
    })

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.sourceId || !form.targetId || !form.typeId) return
    setIsSaving(true)
    setError('')
    try {
      await saveRelation({
        id: form.id,
        sourceItemId: form.sourceId,
        targetItemId: form.targetId,
        relationTypeId: form.typeId,
        status: form.status,
        rationale: form.rationale,
        itemEvidenceIds: form.evidenceIds,
      })
      resetForm()
      await load()
    } catch (caught) {
      setError(friendlyDataError(caught))
    } finally {
      setIsSaving(false)
    }
  }

  const merge = async () => {
    if (!mergeCandidate) return
    setIsSaving(true)
    try {
      await mergeKnowledgeItems(itemId, mergeCandidate)
      setMergeCandidate(null)
      await load()
    } catch (caught) {
      setError(friendlyDataError(caught))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <LoadingState label="Relation과 Evidence를 불러오는 중입니다" />
  if (!record)
    return (
      <ErrorState
        title="항목을 열 수 없습니다"
        description={error}
        actionLabel="목록으로"
        onAction={() => void navigate('/knowledge')}
      />
    )

  return (
    <section className="page-section connections-page">
      <nav className="breadcrumb">
        <Link to={`/knowledge/${record.id}`}>{record.title}</Link>
        <span>/</span>
        <span>Relation & Evidence</span>
      </nav>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Relation · Evidence · Merge</p>
          <h1>연결 관리</h1>
          <p>
            허용된 Node 유형끼리 연결하고, 여러 원문 Evidence를 보존하며 중복 Node를 병합합니다.
          </p>
        </div>
      </header>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="connections-layout">
        <div className="connections-main">
          <form className="content-card relation-form" onSubmit={(event) => void submit(event)}>
            <div className="connection-section-heading">
              <div>
                <p className="eyebrow">{form.id ? 'Edit Relation' : 'New Relation'}</p>
                <h2>{form.id ? 'Relation 수정' : 'Relation 추가'}</h2>
              </div>
              {form.id && (
                <button className="text-action" type="button" onClick={resetForm}>
                  새 연결
                </button>
              )}
            </div>
            <div className="form-grid two-columns">
              <label>
                Source
                <select
                  value={form.sourceId}
                  onChange={(event) =>
                    setForm({ ...form, sourceId: event.target.value, typeId: '' })
                  }
                >
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nodeType.label_ko} · {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Target
                <select
                  value={form.targetId}
                  onChange={(event) =>
                    setForm({ ...form, targetId: event.target.value, typeId: '' })
                  }
                >
                  <option value="">선택</option>
                  {items
                    .filter((item) => item.id !== form.sourceId)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nodeType.label_ko} · {item.title}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Relation 유형
                <select
                  value={form.typeId}
                  onChange={(event) => setForm({ ...form, typeId: event.target.value })}
                >
                  <option value="">허용 유형 선택</option>
                  {allowedTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label_ko} · {type.label_en}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                상태
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value as RelationStatus })
                  }
                >
                  <option value="proposed">제안</option>
                  <option value="active">활성</option>
                  <option value="rejected">거절</option>
                </select>
              </label>
            </div>
            <label>
              판단 근거
              <textarea
                rows={3}
                value={form.rationale}
                onChange={(event) => setForm({ ...form, rationale: event.target.value })}
                placeholder="이 연결이 성립하는 이유"
              />
            </label>
            <fieldset className="relation-evidence-picker">
              <legend>이 Node의 Evidence를 Relation에 추가</legend>
              {snapshot.item_evidence.length ? (
                snapshot.item_evidence.map((evidence) => (
                  <label key={evidence.id}>
                    <input
                      type="checkbox"
                      checked={form.evidenceIds.includes(evidence.id)}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          evidenceIds: event.target.checked
                            ? [...form.evidenceIds, evidence.id]
                            : form.evidenceIds.filter((id) => id !== evidence.id),
                        })
                      }
                    />
                    <span>{evidence.evidence_text}</span>
                  </label>
                ))
              ) : (
                <p>
                  연결할 원문 Evidence가 없습니다. 활성 상태로 저장해도 Evidence가 없으면 제안
                  상태로 유지됩니다.
                </p>
              )}
            </fieldset>
            <button
              className="primary-button"
              disabled={isSaving || !form.targetId || !form.typeId}
              type="submit"
            >
              {isSaving ? '저장 중…' : 'Relation 저장'}
            </button>
          </form>
          <div className="content-card relation-manager">
            <div className="connection-section-heading">
              <div>
                <p className="eyebrow">Connections</p>
                <h2>현재 Relation · {snapshot.relations.length}</h2>
              </div>
            </div>
            {snapshot.relations.length ? (
              snapshot.relations.map((relation) => (
                <article key={relation.id}>
                  <div>
                    <strong>{relation.relation_type_label}</strong>
                    <span className={`status-chip status-${relation.status}`}>
                      {relation.status}
                    </span>
                  </div>
                  <Link to={`/knowledge/${relation.counterpart_id}`}>
                    {relation.counterpart_type_label} · {relation.counterpart_title}
                  </Link>
                  <p>{relation.rationale ?? '판단 근거 미기록'}</p>
                  <div className="relation-evidence-count">
                    Evidence {relation.evidence.length}개
                  </div>
                  {relation.evidence.map((evidence) => (
                    <blockquote key={evidence.id}>
                      {evidence.evidence_text}
                      <Link
                        to={`/knowledge/${evidence.document_id}?version=${evidence.version_id}${evidence.section_id ? `#section-${evidence.section_id}` : ''}`}
                      >
                        원문 열기
                      </Link>
                    </blockquote>
                  ))}
                  <footer>
                    <button
                      className="text-action"
                      type="button"
                      onClick={() => editRelation(relation)}
                    >
                      수정
                    </button>
                    <button
                      className="text-action danger"
                      type="button"
                      onClick={() =>
                        void archiveRelation(relation.id)
                          .then(load)
                          .catch((caught: unknown) => setError(friendlyDataError(caught)))
                      }
                    >
                      보관
                    </button>
                  </footer>
                </article>
              ))
            ) : (
              <EmptyState title="Relation이 없습니다" description="첫 연결을 추가해 보세요." />
            )}
          </div>
        </div>
        <aside className="content-card duplicate-panel">
          <p className="eyebrow">Duplicate Candidates</p>
          <h2>중복 Node 후보</h2>
          <p>
            같은 유형과 유사한 제목만 후보로 표시합니다. 병합하면 현재 Node가 기준으로 남습니다.
          </p>
          {snapshot.duplicate_candidates.length ? (
            snapshot.duplicate_candidates.map((candidate) => (
              <label
                key={candidate.id}
                className={mergeCandidate === candidate.id ? 'selected' : ''}
              >
                <input
                  type="radio"
                  name="merge"
                  checked={mergeCandidate === candidate.id}
                  onChange={() => setMergeCandidate(candidate.id)}
                />
                <span>
                  <strong>{candidate.title}</strong>
                  <small>유사도 {Math.round(candidate.similarity * 100)}%</small>
                </span>
              </label>
            ))
          ) : (
            <div className="quiet-empty compact">
              <strong>중복 후보 없음</strong>
              <p>병합할 유사 Node가 없습니다.</p>
            </div>
          )}
          <button
            className="danger-button"
            type="button"
            disabled={!mergeCandidate || isSaving}
            onClick={() => void merge()}
          >
            선택 Node 병합
          </button>
          <small>
            Evidence, Tag, Relation은 현재 Node로 이동하며 원본 Document Version은 변경되지
            않습니다.
          </small>
        </aside>
      </div>
    </section>
  )
}
