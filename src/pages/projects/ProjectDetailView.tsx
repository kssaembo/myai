import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  archiveKnowledge,
  restoreKnowledge,
  type KnowledgeRecord,
} from '@/entities/knowledge-item/api'
import {
  getProjectAggregate,
  type ProjectAggregate,
  type ProjectAggregateNode,
} from '@/entities/project/api'
import {
  friendlyDataError,
  itemStatusLabels,
  lifecycleLabels,
  projectKindLabels,
  verificationLabels,
} from '@/shared/lib/display'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/States'

type ProjectTab = 'documents' | 'problems' | 'decisions' | 'patterns' | 'lessons'

const tabs: { key: ProjectTab; label: string }[] = [
  { key: 'documents', label: '문서' },
  { key: 'problems', label: '문제–해결' },
  { key: 'decisions', label: '결정' },
  { key: 'patterns', label: '패턴' },
  { key: 'lessons', label: '교훈' },
]

function EvidenceLink({ node }: { node: ProjectAggregateNode }) {
  if (!node.document_id || !node.section_id)
    return <span className="evidence-missing">근거 없음</span>
  const version = node.version_id ? `?version=${node.version_id}` : ''
  return (
    <Link
      className="project-source-link"
      to={`/knowledge/${node.document_id}${version}#section-${node.section_id}`}
    >
      원문 근거 열기
    </Link>
  )
}

function NodeCard({ node, children }: { node: ProjectAggregateNode; children?: React.ReactNode }) {
  return (
    <article className="project-node-card">
      <div className="project-node-heading">
        <span
          className="type-badge"
          style={{ '--badge-color': node.node_type_color } as React.CSSProperties}
        >
          {node.node_type_label}
        </span>
        <span className="status-chip">{verificationLabels[node.verification_status]}</span>
      </div>
      <Link className="project-node-title" to={`/knowledge/${node.id}`}>
        {node.title}
      </Link>
      {node.summary && <p>{node.summary}</p>}
      {node.evidence_text && <blockquote>{node.evidence_text}</blockquote>}
      {node.heading_path?.length ? <small>{node.heading_path.join(' › ')}</small> : null}
      <EvidenceLink node={node} />
      {children}
    </article>
  )
}

export function ProjectDetailView({
  record,
  onChanged,
}: {
  record: KnowledgeRecord
  onChanged: () => Promise<void>
}) {
  const [aggregate, setAggregate] = useState<ProjectAggregate | null>(null)
  const [activeTab, setActiveTab] = useState<ProjectTab>('documents')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showArchive, setShowArchive] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      setAggregate(await getProjectAggregate(record.id))
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

  const grouped = useMemo(() => {
    const nodes = aggregate?.nodes ?? []
    const problemSolutionRelations = (aggregate?.relations ?? []).filter(
      (relation) => relation.relation_type_key === 'RESOLVED_BY',
    )
    return {
      problems: nodes.filter((node) => node.node_type_key === 'problem'),
      decisions: nodes.filter((node) => node.node_type_key === 'decision'),
      patterns: nodes.filter((node) => ['pattern', 'anti_pattern'].includes(node.node_type_key)),
      lessons: nodes.filter((node) => node.node_type_key === 'lesson'),
      solutions: new Map(
        problemSolutionRelations.map((relation) => [
          relation.source_item_id,
          nodes.find((node) => node.id === relation.target_item_id),
        ]),
      ),
      unpairedSolutions: nodes.filter(
        (node) =>
          node.node_type_key === 'solution' &&
          !problemSolutionRelations.some((relation) => relation.target_item_id === node.id),
      ),
    }
  }, [aggregate])

  const confirmArchive = async () => {
    try {
      if (record.status === 'archived') await restoreKnowledge(record.id)
      else await archiveKnowledge(record.id)
      setShowArchive(false)
      await onChanged()
    } catch (caught) {
      setShowArchive(false)
      setError(friendlyDataError(caught))
    }
  }

  if (isLoading) return <LoadingState label="Project 개발 지식을 집계하는 중입니다" />
  if (error || !aggregate)
    return (
      <ErrorState
        title="Project 지식을 불러오지 못했습니다"
        description={error}
        actionLabel="다시 시도"
        onAction={() => void load()}
      />
    )

  const stats = aggregate.stats
  const currentNodes =
    activeTab === 'decisions'
      ? grouped.decisions
      : activeTab === 'patterns'
        ? grouped.patterns
        : activeTab === 'lessons'
          ? grouped.lessons
          : []

  return (
    <section className="page-section project-detail-page">
      <nav className="breadcrumb">
        <Link to="/projects">Projects</Link>
        <span>/</span>
        <span>{record.title}</span>
      </nav>
      <header className="detail-hero content-card project-hero">
        <div>
          <div className="detail-badges">
            <span
              className="type-badge"
              style={{ '--badge-color': record.nodeType.color } as React.CSSProperties}
            >
              프로젝트
            </span>
            <span className={`status-chip status-${record.status}`}>
              {itemStatusLabels[record.status]}
            </span>
            <span className="status-chip">{verificationLabels[record.verification_status]}</span>
          </div>
          <h1>{record.title}</h1>
          <p>{record.summary ?? '요약이 아직 없습니다.'}</p>
          {record.project && (
            <div className="project-hero-meta">
              <span>{projectKindLabels[record.project.project_kind]}</span>
              <span>{lifecycleLabels[record.project.lifecycle_status]}</span>
              <span>{record.project.current_version_label ?? '버전 미기록'}</span>
            </div>
          )}
        </div>
        <div className="detail-actions">
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

      <div className="project-stat-grid">
        <div>
          <span>문서</span>
          <strong>{stats.documents}</strong>
        </div>
        <div>
          <span>문제 / 해결</span>
          <strong>
            {stats.problems} / {stats.solutions}
          </strong>
        </div>
        <div>
          <span>결정</span>
          <strong>{stats.decisions}</strong>
        </div>
        <div>
          <span>패턴</span>
          <strong>{stats.patterns}</strong>
        </div>
        <div>
          <span>교훈</span>
          <strong>{stats.lessons}</strong>
        </div>
        <div>
          <span>근거 연결률</span>
          <strong>{stats.evidence_coverage}%</strong>
        </div>
      </div>

      {stats.needs_review > 0 && (
        <p className="project-review-notice">
          확인이 필요한 항목이 {stats.needs_review}개 있습니다. 원문 근거를 열어 상태를 확인하세요.
        </p>
      )}

      <div className="project-tabs" role="tablist" aria-label="Project 지식 유형">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={activeTab === tab.key ? 'active' : ''}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="project-tab-panel content-card" role="tabpanel">
        {activeTab === 'documents' &&
          (aggregate.documents.length ? (
            <div className="project-document-list">
              {aggregate.documents.map((document) => {
                const version = document.version_id ? `?version=${document.version_id}` : ''
                const section = document.section_id ? `#section-${document.section_id}` : ''
                return (
                  <article key={document.id}>
                    <div>
                      <span className="mini-badge">{document.format?.toUpperCase() ?? 'FILE'}</span>
                      <span className={`parse-status parse-${document.parse_status}`}>
                        {document.parse_status ?? '미파싱'}
                      </span>
                    </div>
                    <Link to={`/knowledge/${document.id}`}>{document.title}</Link>
                    <p>{document.summary ?? document.source_filename ?? '설명 없음'}</p>
                    <Link
                      className="project-source-link"
                      to={`/knowledge/${document.id}${version}${section}`}
                    >
                      원문 열기
                    </Link>
                  </article>
                )
              })}
            </div>
          ) : (
            <EmptyState
              title="연결된 문서가 없습니다"
              description="REF 구조화에서 Project와 Document 관계를 확인해 주세요."
            />
          ))}

        {activeTab === 'problems' &&
          (grouped.problems.length || grouped.unpairedSolutions.length ? (
            <div className="project-node-list">
              {grouped.problems.map((problem) => {
                const solution = grouped.solutions.get(problem.id)
                return (
                  <NodeCard key={problem.id} node={problem}>
                    {solution && (
                      <div className="problem-solution">
                        <span>해결</span>
                        <Link to={`/knowledge/${solution.id}`}>{solution.title}</Link>
                        <p>{solution.summary}</p>
                        <EvidenceLink node={solution} />
                      </div>
                    )}
                  </NodeCard>
                )
              })}
              {grouped.unpairedSolutions.map((solution) => (
                <NodeCard key={solution.id} node={solution} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="기록된 문제–해결이 없습니다"
              description="REF Problems 섹션을 구조화하면 이곳에 표시됩니다."
            />
          ))}

        {['decisions', 'patterns', 'lessons'].includes(activeTab) &&
          (currentNodes.length ? (
            <div className="project-node-list">
              {currentNodes.map((node) => (
                <NodeCard key={node.id} node={node} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="이 유형의 지식이 없습니다"
              description="해당 REF 섹션을 구조화하고 검토 결과를 저장해 주세요."
            />
          ))}
      </div>

      {showArchive && (
        <div className="modal-backdrop">
          <div className="confirm-modal" role="dialog" aria-modal="true">
            <h2>
              {record.status === 'archived' ? 'Project를 복원할까요?' : 'Project를 보관할까요?'}
            </h2>
            <p>연결된 문서와 지식은 삭제되지 않습니다.</p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setShowArchive(false)}
              >
                취소
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => void confirmArchive()}
              >
                {record.status === 'archived' ? '복원' : '보관'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
