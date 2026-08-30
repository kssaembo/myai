import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'

import type { GraphPage } from '@/entities/graph/api'
import type { KnowledgeRecord } from '@/entities/knowledge-item/api'
import type { VisualInsight, VisualRelationshipFoundation } from '@/entities/visual-analysis/api'
import type { VisualInsightKind } from '@/shared/lib/supabase/database.types'

interface KnowledgeConstellationProps {
  records: KnowledgeRecord[]
  graph: GraphPage | null
  focusText: string
  activeSourceIds: Set<string>
  visualFoundation: VisualRelationshipFoundation | null
}

interface ConstellationNode {
  id: string
  title: string
  label: string
  color: string
  score: number
  isActive: boolean
}

interface MapPosition {
  x: number
  y: number
}

const contextPositions: MapPosition[] = [
  { x: 150, y: 95 },
  { x: 360, y: 68 },
  { x: 645, y: 70 },
  { x: 850, y: 105 },
  { x: 160, y: 285 },
  { x: 365, y: 310 },
  { x: 645, y: 306 },
  { x: 845, y: 275 },
]

const projectPositions: MapPosition[] = [
  { x: 145, y: 105 },
  { x: 500, y: 72 },
  { x: 855, y: 105 },
  { x: 155, y: 410 },
  { x: 500, y: 448 },
  { x: 845, y: 410 },
]

const insightPositions: MapPosition[] = [
  { x: 335, y: 205 },
  { x: 500, y: 175 },
  { x: 665, y: 205 },
  { x: 350, y: 325 },
  { x: 500, y: 350 },
  { x: 650, y: 325 },
]

const insightMeta: Record<VisualInsightKind, { label: string; color: string }> = {
  commonality: { label: '공통 구조', color: '#109c90' },
  difference: { label: '차이점', color: '#e66b2e' },
  technical_link: { label: '기술 연결', color: '#397dcc' },
  reusable_component: { label: '재사용 요소', color: '#7957bd' },
  recurring_problem: { label: '반복 문제', color: '#d24c58' },
  solution_pattern: { label: '해결 패턴', color: '#27965a' },
  development_pattern: { label: '개발 패턴', color: '#5265c5' },
  educational_link: { label: '교육 연결', color: '#b58512' },
}

const dimensionLabels: Record<string, string> = {
  architecture: '구조',
  technology: '기술',
  ux: '사용 경험',
  operation: '운영',
  education: '교육',
  problem_solving: '문제 해결',
  reuse: '재사용',
}

function ProjectClusterMap({
  graph,
  activeSourceIds,
}: Pick<KnowledgeConstellationProps, 'graph' | 'activeSourceIds'>) {
  const nodes = graph?.nodes ?? []
  const edges = graph?.edges ?? []
  const projectNodes = nodes.filter((node) => node.node_type_key === 'project').slice(0, 3)
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const projectIds = new Set(projectNodes.map((project) => project.id))
  const positions = new Map<string, MapPosition>()
  const visibleNodes = [...projectNodes]

  projectNodes.forEach((project, projectIndex) => {
    const projectX = [170, 500, 830][projectIndex]
    positions.set(project.id, { x: projectX, y: 145 })
    const childIds = edges
      .flatMap((edge) => {
        if (edge.source_item_id === project.id) return [edge.target_item_id]
        if (edge.target_item_id === project.id) return [edge.source_item_id]
        return []
      })
      .filter((id) => !projectIds.has(id))
    const children = [...new Set(childIds)]
      .map((id) => nodeMap.get(id))
      .filter((node): node is NonNullable<typeof node> => Boolean(node))
      .sort((left, right) => {
        if (left.node_type_key === 'document') return -1
        if (right.node_type_key === 'document') return 1
        return right.evidence_count - left.evidence_count
      })
      .slice(0, 3)
    children.forEach((child, childIndex) => {
      positions.set(child.id, { x: projectX + [-92, 0, 92][childIndex], y: 350 })
      if (!visibleNodes.some((node) => node.id === child.id)) visibleNodes.push(child)
    })
  })

  const visibleIds = new Set(visibleNodes.map((node) => node.id))
  const visibleEdges = edges.filter(
    (edge) => visibleIds.has(edge.source_item_id) && visibleIds.has(edge.target_item_id),
  )

  return (
    <div className="constellation-canvas project-cluster-map" aria-label="프로젝트 중심 지식 지도">
      <div className="project-map-guide">
        <strong>프로젝트 중심 지도</strong>
        <span>프로젝트를 선택하면 연결된 원문과 핵심 지식을 확인할 수 있습니다.</span>
      </div>
      <svg viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true">
        {visibleEdges.map((edge) => {
          const source = positions.get(edge.source_item_id)
          const target = positions.get(edge.target_item_id)
          if (!source || !target) return null
          return (
            <line
              className={
                projectIds.has(edge.source_item_id) && projectIds.has(edge.target_item_id)
                  ? 'project-cross-link'
                  : 'project-child-link'
              }
              key={edge.id}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
            />
          )
        })}
      </svg>
      {visibleNodes.map((node) => {
        const position = positions.get(node.id)
        if (!position) return null
        const isProject = projectIds.has(node.id)
        return (
          <Link
            className={`${isProject ? 'project-cluster-root' : 'project-cluster-child'}${activeSourceIds.has(node.id) ? ' is-active' : ''}`}
            style={visualStyle(position, node.color, 5)}
            to={`/knowledge/${node.id}`}
            key={node.id}
          >
            <span>{isProject ? '프로젝트' : node.node_type_label}</span>
            <strong>{node.title}</strong>
          </Link>
        )
      })}
    </div>
  )
}

function keywords(value: string) {
  return [...new Set(value.toLocaleLowerCase().match(/[가-힣a-z0-9_-]{2,}/g) ?? [])].slice(0, 8)
}

function visualStyle(position: MapPosition, color: string, height: number): CSSProperties {
  return {
    '--node-color': color,
    left: `${position.x / 10}%`,
    top: `${position.y / height}%`,
  } as CSSProperties
}

function ContextConstellation({
  records,
  graph,
  focusText,
  activeSourceIds,
}: Omit<KnowledgeConstellationProps, 'visualFoundation'>) {
  const queryWords = keywords(focusText)
  const recordMap = new Map(records.map((record) => [record.id, record]))
  const graphNodes = graph?.nodes ?? []
  const graphNodeIds = new Set(graphNodes.map((node) => node.id))
  const availableNodes = graphNodes.length
    ? [...graphNodes, ...records.filter((record) => !graphNodeIds.has(record.id))]
    : records
  const candidates: ConstellationNode[] = availableNodes.map((node) => {
    const record = recordMap.get(node.id)
    const title = node.title
    const summary = node.summary ?? ''
    const tagText = record?.tags.map((tag) => tag.name).join(' ') ?? ''
    const haystack = `${title} ${summary} ${tagText}`.toLocaleLowerCase()
    const matchScore = queryWords.reduce(
      (score, word) => score + (haystack.includes(word) ? 18 : 0),
      0,
    )
    const isActive = activeSourceIds.has(node.id)
    const importance =
      'importance' in node ? Number(node.importance) : Number(record?.importance ?? 0)
    return {
      id: node.id,
      title,
      label: 'node_type_label' in node ? node.node_type_label : node.nodeType.label_ko,
      color: 'color' in node ? node.color : node.nodeType.color,
      score: (isActive ? 120 : 0) + matchScore + importance,
      isActive,
    }
  })
  const nodes = candidates
    .sort((left, right) => right.score - left.score)
    .slice(0, contextPositions.length)
  const selectedIds = new Set(nodes.map((node) => node.id))
  const nodePosition = new Map(nodes.map((node, index) => [node.id, contextPositions[index]]))
  const visibleEdges = (graph?.edges ?? []).filter(
    (edge) => selectedIds.has(edge.source_item_id) && selectedIds.has(edge.target_item_id),
  )
  const centerLinks = nodes.filter(
    (node, index) => node.isActive || (!visibleEdges.length && index < 4),
  )
  const centerLabel = focusText.trim() ? focusText.trim().slice(0, 52) : '나의 지식'

  return (
    <div className="constellation-canvas" aria-label="현재 생각과 연결된 지식 지도">
      {nodes.length ? (
        <>
          <svg viewBox="0 0 1000 380" preserveAspectRatio="none" aria-hidden="true">
            {visibleEdges.map((edge) => {
              const source = nodePosition.get(edge.source_item_id)
              const target = nodePosition.get(edge.target_item_id)
              if (!source || !target) return null
              return (
                <line
                  className="constellation-relation"
                  key={edge.id}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                />
              )
            })}
            {centerLinks.map((node) => {
              const position = nodePosition.get(node.id)
              if (!position) return null
              return (
                <line
                  className="constellation-focus-line"
                  key={`focus-${node.id}`}
                  x1="500"
                  y1="190"
                  x2={position.x}
                  y2={position.y}
                />
              )
            })}
          </svg>
          <div className={`constellation-center${focusText.trim() ? ' is-thinking' : ''}`}>
            <span>{focusText.trim() ? 'CURRENT THOUGHT' : 'PERSONAL CONTEXT'}</span>
            <strong>{centerLabel}</strong>
          </div>
          {nodes.map((node, index) => (
            <Link
              className={`constellation-node${node.isActive ? ' is-active' : ''}`}
              style={visualStyle(contextPositions[index], node.color, 3.8)}
              to={`/knowledge/${node.id}`}
              key={node.id}
            >
              <span>{node.label}</span>
              <strong>{node.title}</strong>
            </Link>
          ))}
        </>
      ) : (
        <div className="constellation-empty">
          <strong>아직 연결할 지식이 없습니다.</strong>
          <span>문서를 가져오면 프로젝트와 아이디어의 관계가 이곳에 나타납니다.</span>
        </div>
      )}
    </div>
  )
}

function RelationshipMap({
  foundation,
  activeSourceIds,
}: {
  foundation: VisualRelationshipFoundation
  activeSourceIds: Set<string>
}) {
  const insights = foundation.insights.filter((insight) => insight.items.length >= 2).slice(0, 6)
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null)
  const selectedInsight = insights.find((insight) => insight.id === selectedInsightId) ?? null
  const projectMembers = [
    ...new Map(
      insights
        .flatMap((insight) => insight.items)
        .filter((item) => item.node_type_key === 'project')
        .map((item) => [item.item_id, item]),
    ).values(),
  ].slice(0, projectPositions.length)
  const projectPosition = new Map(
    projectMembers.map((project, index) => [project.item_id, projectPositions[index]]),
  )
  const visibleProjectIds = new Set(projectMembers.map((project) => project.item_id))
  const directRelations = foundation.existing_relations.filter(
    (relation) =>
      visibleProjectIds.has(relation.source_item_id) &&
      visibleProjectIds.has(relation.target_item_id),
  )

  return (
    <div className="relationship-map-shell">
      <div
        className="constellation-canvas relationship-map-canvas"
        aria-label="AI 프로젝트 관계 지도"
      >
        <div className="relationship-map-summary">
          <strong>AI 관계 {insights.length}</strong>
          <span>프로젝트 {projectMembers.length}</span>
        </div>
        <svg viewBox="0 0 1000 520" preserveAspectRatio="none" aria-hidden="true">
          {directRelations.map((relation) => {
            const source = projectPosition.get(relation.source_item_id)
            const target = projectPosition.get(relation.target_item_id)
            if (!source || !target) return null
            return (
              <line
                className="relationship-direct-line"
                key={`direct-${relation.id}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
              />
            )
          })}
          {insights.flatMap((insight, insightIndex) => {
            const target = insightPositions[insightIndex]
            return insight.items.map((member) => {
              const source = projectPosition.get(member.item_id)
              if (!source) return null
              const controlX = (source.x + target.x) / 2
              const controlY = (source.y + target.y) / 2 - 18 + insightIndex * 2
              return (
                <path
                  className={`relationship-insight-line${selectedInsightId === insight.id ? ' is-selected' : ''}`}
                  key={`${insight.id}-${member.item_id}`}
                  style={
                    { '--insight-color': insightMeta[insight.insight_kind].color } as CSSProperties
                  }
                  d={`M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`}
                />
              )
            })
          })}
        </svg>

        {projectMembers.map((project, index) => (
          <Link
            className={`relationship-project-node${activeSourceIds.has(project.item_id) ? ' is-active' : ''}`}
            style={visualStyle(projectPositions[index], project.node_type_color, 5.2)}
            to={`/knowledge/${project.item_id}`}
            key={project.item_id}
          >
            <span>PROJECT</span>
            <strong>{project.title}</strong>
          </Link>
        ))}

        {insights.map((insight, index) => {
          const meta = insightMeta[insight.insight_kind]
          return (
            <button
              className={`relationship-insight-node${selectedInsightId === insight.id ? ' is-selected' : ''}`}
              style={visualStyle(insightPositions[index], meta.color, 5.2)}
              type="button"
              aria-pressed={selectedInsightId === insight.id}
              onClick={() => setSelectedInsightId(insight.id)}
              key={insight.id}
            >
              <span>{meta.label}</span>
              <strong>{insight.title}</strong>
              <small>{dimensionLabels[insight.dimension] ?? insight.dimension}</small>
            </button>
          )
        })}
      </div>

      {selectedInsight && (
        <InsightSummary insight={selectedInsight} onClose={() => setSelectedInsightId(null)} />
      )}
    </div>
  )
}

function InsightSummary({ insight, onClose }: { insight: VisualInsight; onClose: () => void }) {
  const meta = insightMeta[insight.insight_kind]
  return (
    <aside className="relationship-insight-summary" aria-label="선택한 관계 요약">
      <div className="relationship-summary-heading">
        <div>
          <span style={{ '--insight-color': meta.color } as CSSProperties}>{meta.label}</span>
          <h3>{insight.title}</h3>
        </div>
        <button type="button" aria-label="관계 요약 닫기" onClick={onClose}>
          ×
        </button>
      </div>
      <p>{insight.summary}</p>
      <div className="relationship-summary-projects">
        {insight.items.map((item) => (
          <Link to={`/knowledge/${item.item_id}`} key={item.item_id}>
            {item.title}
          </Link>
        ))}
      </div>
      <div className="relationship-summary-meta">
        <span>근거 {insight.evidence.length}개</span>
        {insight.confidence !== null && <span>신뢰도 {Math.round(insight.confidence * 100)}%</span>}
        <span>{insight.status === 'accepted' ? '확인된 관계' : 'AI 제안'}</span>
      </div>
      {!!insight.evidence.length && (
        <details className="relationship-evidence-details">
          <summary>근거 확인</summary>
          <ul>
            {insight.evidence.slice(0, 3).map((evidence) => (
              <li key={evidence.id}>{evidence.evidence_text}</li>
            ))}
          </ul>
        </details>
      )}
    </aside>
  )
}

export function KnowledgeConstellation(props: KnowledgeConstellationProps) {
  const hasVisualInsights = Boolean(
    props.visualFoundation?.insights.some((insight) => insight.items.length >= 2),
  )
  if (hasVisualInsights && props.visualFoundation)
    return (
      <RelationshipMap
        foundation={props.visualFoundation}
        activeSourceIds={props.activeSourceIds}
      />
    )
  if (props.graph?.nodes.some((node) => node.node_type_key === 'project'))
    return <ProjectClusterMap graph={props.graph} activeSourceIds={props.activeSourceIds} />
  return <ContextConstellation {...props} />
}
