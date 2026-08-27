import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { readDocumentMetadata, readDocumentSections } from '@/entities/document/api'
import { getKnowledge, type KnowledgeRecord } from '@/entities/knowledge-item/api'
import { commitRefReview, saveRefProfile } from '@/entities/ref-review/api'
import {
  refSectionAliases,
  structureRefDocument,
  type RefNodeProposal,
  type RefRelationProposal,
  type RefStructureResult,
} from '@/entities/ref-review/structure'
import { friendlyDataError } from '@/shared/lib/display'
import type {
  ProjectLifecycleStatus,
  VerificationStatus,
} from '@/shared/lib/supabase/database.types'
import { ErrorState, LoadingState } from '@/shared/ui/States'

const nodeLabels: Record<RefNodeProposal['nodeTypeKey'], string> = {
  project: '프로젝트',
  technology: '기술',
  problem: '문제',
  solution: '해결',
  decision: '결정',
  pattern: '재사용 패턴',
  anti_pattern: '위험·금지 패턴',
  lesson: '현장 교훈',
}
const lifecycleLabels: Record<ProjectLifecycleStatus, string> = {
  idea: '아이디어',
  planning: '기획',
  developing: '개발 중',
  testing: '테스트',
  deployed: '배포됨',
  paused: '중단',
  completed: '완료',
}

export function RefReviewPage() {
  const { itemId = '' } = useParams()
  const [record, setRecord] = useState<KnowledgeRecord | null>(null)
  const [versionId, setVersionId] = useState('')
  const [filename, setFilename] = useState('')
  const [sections, setSections] = useState<Awaited<ReturnType<typeof readDocumentSections>>>([])
  const [analysis, setAnalysis] = useState<RefStructureResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const nextRecord = await getKnowledge(itemId)
      if (nextRecord.nodeType.key !== 'document') throw new Error('REF_REVIEW_REQUIRES_DOCUMENT')
      const metadata = await readDocumentMetadata(itemId)
      const version =
        metadata.versions.find(
          (candidate) => candidate.id === metadata.document.active_version_id,
        ) ?? metadata.versions[0]
      if (!version) throw new Error('DOCUMENT_VERSION_NOT_FOUND')
      setRecord(nextRecord)
      setVersionId(version.id)
      setFilename(version.source_filename)
      setSections(await readDocumentSections(version.id))
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

  const analyze = async () => {
    if (!record || !versionId) return
    setIsWorking(true)
    setError('')
    setMessage('')
    try {
      const result = structureRefDocument(filename, record.title, sections)
      await saveRefProfile(versionId, result)
      setAnalysis(result)
      setMessage(`${result.matchedKeys.length}개 REF 영역을 인식했습니다.`)
    } catch (caught) {
      setError(friendlyDataError(caught))
    } finally {
      setIsWorking(false)
    }
  }

  const updateNode = (localId: string, changes: Partial<RefNodeProposal>) => {
    setAnalysis((current) =>
      current
        ? {
            ...current,
            nodes: current.nodes.map((node) =>
              node.localId === localId ? { ...node, ...changes } : node,
            ),
          }
        : current,
    )
  }

  const updateRelation = (localId: string, changes: Partial<RefRelationProposal>) => {
    setAnalysis((current) =>
      current
        ? {
            ...current,
            relations: current.relations.map((relation) =>
              relation.localId === localId ? { ...relation, ...changes } : relation,
            ),
          }
        : current,
    )
  }

  const commit = async () => {
    if (!analysis || !versionId) return
    setIsWorking(true)
    setError('')
    setMessage('')
    try {
      const result = await commitRefReview(itemId, versionId, analysis.nodes, analysis.relations)
      setMessage(
        `${result.nodeCount}개 Node와 ${result.relationCount}개 Relation을 근거와 함께 저장했습니다.`,
      )
    } catch (caught) {
      setError(friendlyDataError(caught))
    } finally {
      setIsWorking(false)
    }
  }

  const selectedCount = analysis?.nodes.filter((node) => node.selected).length ?? 0
  const groupedNodes = useMemo(() => {
    const groups = new Map<RefNodeProposal['nodeTypeKey'], RefNodeProposal[]>()
    for (const node of analysis?.nodes ?? [])
      groups.set(node.nodeTypeKey, [...(groups.get(node.nodeTypeKey) ?? []), node])
    return [...groups.entries()]
  }, [analysis])

  if (isLoading) return <LoadingState label="REF 문서와 Section을 불러오는 중입니다" />
  if (!record)
    return (
      <ErrorState
        title="REF 검토 화면을 열 수 없습니다"
        description={error}
        actionLabel="다시 시도"
        onAction={() => void load()}
      />
    )

  return (
    <section className="page-section ref-review-page">
      <nav className="breadcrumb">
        <Link to={`/knowledge/${itemId}`}>{record.title}</Link>
        <span>/</span>
        <span>REF 구조화 검토</span>
      </nav>
      <header className="page-heading ref-review-heading">
        <div>
          <p className="eyebrow">Rule-based REF Review</p>
          <h1>REF 구조화 검토</h1>
          <p>규칙이 제안한 Node·Relation과 원문 Evidence를 확인한 뒤 선택한 항목만 저장합니다.</p>
        </div>
        <button
          className="primary-button"
          type="button"
          disabled={isWorking || !sections.length}
          onClick={() => void analyze()}
        >
          {analysis ? '다시 분석' : 'REF 분석 시작'}
        </button>
      </header>
      {!sections.length && (
        <p className="inline-error">먼저 문서 상세에서 본문 추출을 완료해 주세요.</p>
      )}
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

      {!analysis ? (
        <div className="quiet-empty content-card ref-empty">
          <strong>아직 REF 규칙 분석을 실행하지 않았습니다</strong>
          <p>원문은 수정하지 않으며 Section 별칭과 검토 제안만 생성합니다.</p>
        </div>
      ) : (
        <>
          <div className="ref-analysis-summary">
            <article className="content-card">
              <span>Detection</span>
              <strong>{analysis.profile}</strong>
              <p>{filename}</p>
            </article>
            <article className="content-card">
              <span>Coverage</span>
              <strong>{analysis.coverage}%</strong>
              <p>
                {analysis.matchedKeys.length}/{Object.keys(refSectionAliases).length} canonical
                sections
              </p>
            </article>
            <article className="content-card">
              <span>Proposals</span>
              <strong>{analysis.nodes.length}</strong>
              <p>선택 {selectedCount}개</p>
            </article>
            <article className="content-card">
              <span>Relations</span>
              <strong>{analysis.relations.length}</strong>
              <p>Evidence 포함</p>
            </article>
          </div>
          <article className="content-card canonical-coverage-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">Section Alias Dictionary</p>
                <h2>REF 영역 인식</h2>
              </div>
            </div>
            <div className="canonical-grid">
              {(Object.keys(refSectionAliases) as (keyof typeof refSectionAliases)[]).map((key) => (
                <div className={analysis.matchedKeys.includes(key) ? 'matched' : ''} key={key}>
                  <span>{analysis.matchedKeys.includes(key) ? '✓' : '—'}</span>
                  <strong>{key}</strong>
                  <small>{refSectionAliases[key].slice(0, 2).join(' · ')}</small>
                </div>
              ))}
            </div>
          </article>
          {analysis.warnings.length > 0 && (
            <div className="ref-warnings">
              {analysis.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}
          <div className="ref-review-toolbar content-card">
            <div>
              <strong>검토 대상 {selectedCount}개</strong>
              <span>모든 규칙 추출 Node는 원문 Evidence를 포함합니다.</span>
            </div>
            <div>
              <button
                className="text-action"
                type="button"
                onClick={() =>
                  setAnalysis((current) =>
                    current
                      ? {
                          ...current,
                          nodes: current.nodes.map((node) => ({
                            ...node,
                            verificationStatus: 'confirmed',
                          })),
                        }
                      : current,
                  )
                }
              >
                전체 확인됨 표시
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={isWorking || selectedCount === 0 || analysis.profile === 'not_ref'}
                onClick={() => void commit()}
              >
                선택 구조 저장
              </button>
            </div>
          </div>
          <div className="ref-proposal-groups">
            {groupedNodes.map(([type, nodes]) => (
              <section className="content-card ref-proposal-group" key={type}>
                <header>
                  <div>
                    <p className="eyebrow">{type}</p>
                    <h2>{nodeLabels[type]}</h2>
                  </div>
                  <span>
                    {nodes.filter((node) => node.selected).length}/{nodes.length}
                  </span>
                </header>
                <div className="ref-proposal-list">
                  {nodes.map((node) => (
                    <article className={node.selected ? 'selected' : ''} key={node.localId}>
                      <label className="proposal-check">
                        <input
                          type="checkbox"
                          checked={node.selected}
                          onChange={(event) =>
                            updateNode(node.localId, { selected: event.target.checked })
                          }
                        />
                        <span />
                      </label>
                      <div className="proposal-fields">
                        <input
                          aria-label={`${nodeLabels[type]} 제목`}
                          value={node.title}
                          onChange={(event) =>
                            updateNode(node.localId, { title: event.target.value })
                          }
                        />
                        <textarea
                          aria-label={`${nodeLabels[type]} 요약`}
                          rows={2}
                          value={node.summary}
                          onChange={(event) =>
                            updateNode(node.localId, { summary: event.target.value })
                          }
                        />
                        <details>
                          <summary>원문 Evidence 보기</summary>
                          <pre>{node.evidenceText}</pre>
                        </details>
                      </div>
                      <div className="proposal-status">
                        <select
                          aria-label={`${nodeLabels[type]} 검증 상태`}
                          value={node.verificationStatus}
                          onChange={(event) =>
                            updateNode(node.localId, {
                              verificationStatus: event.target.value as VerificationStatus,
                            })
                          }
                        >
                          <option value="unconfirmed">확인 필요</option>
                          <option value="confirmed">확인됨</option>
                          <option value="conflicted">충돌</option>
                        </select>
                        {node.nodeTypeKey === 'project' && (
                          <select
                            aria-label="프로젝트 진행 상태"
                            value={node.lifecycleStatus}
                            onChange={(event) =>
                              updateNode(node.localId, {
                                lifecycleStatus: event.target.value as ProjectLifecycleStatus,
                              })
                            }
                          >
                            {Object.entries(lifecycleLabels).map(([value, label]) => (
                              <option value={value} key={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <article className="content-card relation-review-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">Evidence-backed Relations</p>
                <h2>관계 제안</h2>
              </div>
            </div>
            <div>
              {analysis.relations.map((relation) => (
                <article className={relation.selected ? 'selected' : ''} key={relation.localId}>
                  <label>
                    <input
                      type="checkbox"
                      checked={relation.selected}
                      onChange={(event) =>
                        updateRelation(relation.localId, { selected: event.target.checked })
                      }
                    />
                    {relation.relationTypeKey}
                  </label>
                  <select
                    value={relation.status}
                    disabled={!relation.selected}
                    onChange={(event) =>
                      updateRelation(relation.localId, {
                        status: event.target.value as RefRelationProposal['status'],
                      })
                    }
                  >
                    <option value="proposed">제안</option>
                    <option value="active">활성</option>
                    <option value="rejected">거절</option>
                  </select>
                </article>
              ))}
            </div>
          </article>
        </>
      )}
    </section>
  )
}
