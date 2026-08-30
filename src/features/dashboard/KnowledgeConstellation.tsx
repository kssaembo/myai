import { useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
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
  const insights = useMemo(
    () => foundation.insights.filter((insight) => insight.items.length >= 2).slice(0, 6),
    [foundation.insights],
  )
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const draggedRef = useRef(false)
  const interactionRef = useRef<
    | {
        kind: 'node'
        id: string
        startX: number
        startY: number
        origin: MapPosition
      }
    | { kind: 'pan'; startX: number; startY: number; origin: { x: number; y: number } }
    | null
  >(null)
  const projectMembers = useMemo(
    () =>
      [
        ...new Map(
          insights
            .flatMap((insight) => insight.items)
            .filter((item) => item.node_type_key === 'project')
            .map((item) => [item.item_id, item]),
        ).values(),
      ].slice(0, projectPositions.length),
    [insights],
  )
  const initialPositions = useMemo(
    () =>
      new Map<string, MapPosition>([
        ...projectMembers.map(
          (project, index) => [project.item_id, projectPositions[index]] as const,
        ),
        ...insights.map((insight, index) => [insight.id, insightPositions[index]] as const),
      ]),
    [insights, projectMembers],
  )
  const [positions, setPositions] = useState(initialPositions)
  const visibleProjectIds = new Set(projectMembers.map((project) => project.item_id))
  const directRelations = foundation.existing_relations.filter(
    (relation) =>
      visibleProjectIds.has(relation.source_item_id) &&
      visibleProjectIds.has(relation.target_item_id),
  )
  const selectedInsight = insights.find((insight) => insight.id === selectedNodeId) ?? null
  const selectedProject =
    projectMembers.find((project) => project.item_id === selectedNodeId) ?? null
  const activeNodeIds = useMemo(() => {
    if (!selectedNodeId) return null
    const active = new Set([selectedNodeId])
    if (selectedInsight) selectedInsight.items.forEach((item) => active.add(item.item_id))
    if (selectedProject) {
      insights
        .filter((insight) => insight.items.some((item) => item.item_id === selectedProject.item_id))
        .forEach((insight) => {
          active.add(insight.id)
          insight.items.forEach((item) => active.add(item.item_id))
        })
    }
    return active
  }, [insights, selectedInsight, selectedNodeId, selectedProject])

  const resetView = () => {
    setPositions(initialPositions)
    setScale(1)
    setOffset({ x: 0, y: 0 })
    setSelectedNodeId(null)
  }

  const startNodeDrag = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation()
    const origin = positions.get(id)
    if (!origin) return
    draggedRef.current = false
    interactionRef.current = {
      kind: 'node',
      id,
      startX: event.clientX,
      startY: event.clientY,
      origin,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current
    if (!interaction) return
    const dx = event.clientX - interaction.startX
    const dy = event.clientY - interaction.startY
    if (Math.abs(dx) + Math.abs(dy) > 4) draggedRef.current = true
    if (interaction.kind === 'pan') {
      setOffset({ x: interaction.origin.x + dx, y: interaction.origin.y + dy })
      return
    }
    setPositions((current) => {
      const next = new Map(current)
      next.set(interaction.id, {
        x: Math.max(60, Math.min(940, interaction.origin.x + dx / scale)),
        y: Math.max(45, Math.min(475, interaction.origin.y + dy / scale)),
      })
      return next
    })
  }

  const selectNode = (id: string) => {
    if (draggedRef.current) {
      draggedRef.current = false
      return
    }
    setSelectedNodeId((current) => (current === id ? null : id))
  }

  return (
    <div className="relationship-map-shell">
      <div
        className="constellation-canvas relationship-map-canvas relationship-map-viewport"
        aria-label="AI 프로젝트 관계 지도"
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest('.relationship-map-node, .map-controls')) return
          interactionRef.current = {
            kind: 'pan',
            startX: event.clientX,
            startY: event.clientY,
            origin: offset,
          }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={() => {
          interactionRef.current = null
        }}
        onWheel={(event) => {
          event.preventDefault()
          setScale((current) => Math.max(0.65, Math.min(1.8, current - event.deltaY * 0.001)))
        }}
      >
        <div className="relationship-map-summary">
          <strong>AI 관계 {insights.length}</strong>
          <span>프로젝트 {projectMembers.length}</span>
          <span>{selectedNodeId ? '연결만 보기' : '전체 보기'}</span>
        </div>
        <div className="map-controls" aria-label="관계지도 조작">
          <button
            type="button"
            aria-label="확대"
            onClick={() => setScale((value) => Math.min(1.8, value + 0.15))}
          >
            +
          </button>
          <button
            type="button"
            aria-label="축소"
            onClick={() => setScale((value) => Math.max(0.65, value - 0.15))}
          >
            −
          </button>
          <button type="button" onClick={resetView}>
            전체 보기
          </button>
        </div>
        <div
          className="relationship-map-world"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        >
          <svg viewBox="0 0 1000 520" preserveAspectRatio="none" aria-hidden="true">
            {directRelations.map((relation) => {
              const source = positions.get(relation.source_item_id)
              const target = positions.get(relation.target_item_id)
              if (!source || !target) return null
              return (
                <line
                  className={`relationship-direct-line${activeNodeIds && (!activeNodeIds.has(relation.source_item_id) || !activeNodeIds.has(relation.target_item_id)) ? ' is-dimmed' : ''}`}
                  key={`direct-${relation.id}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                />
              )
            })}
            {insights.flatMap((insight, insightIndex) => {
              const target = positions.get(insight.id)
              if (!target) return []
              return insight.items.map((member) => {
                const source = positions.get(member.item_id)
                if (!source) return null
                const controlX = (source.x + target.x) / 2
                const controlY = (source.y + target.y) / 2 - 18 + insightIndex * 2
                return (
                  <path
                    className={`relationship-insight-line${selectedNodeId === insight.id ? ' is-selected' : ''}${activeNodeIds && (!activeNodeIds.has(insight.id) || !activeNodeIds.has(member.item_id)) ? ' is-dimmed' : ''}`}
                    key={`${insight.id}-${member.item_id}`}
                    style={
                      {
                        '--insight-color': insightMeta[insight.insight_kind].color,
                      } as CSSProperties
                    }
                    d={`M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`}
                  />
                )
              })
            })}
          </svg>

          {projectMembers.map((project, index) => (
            <button
              className={`relationship-map-node relationship-project-node${activeSourceIds.has(project.item_id) ? ' is-active' : ''}${selectedNodeId === project.item_id ? ' is-selected' : ''}${activeNodeIds && !activeNodeIds.has(project.item_id) ? ' is-dimmed' : ''}`}
              style={visualStyle(
                positions.get(project.item_id) ?? projectPositions[index],
                project.node_type_color,
                5.2,
              )}
              type="button"
              aria-pressed={selectedNodeId === project.item_id}
              onPointerDown={(event) => startNodeDrag(event, project.item_id)}
              onClick={() => selectNode(project.item_id)}
              key={project.item_id}
            >
              <span>PROJECT</span>
              <strong>{project.title}</strong>
            </button>
          ))}

          {insights.map((insight, index) => {
            const meta = insightMeta[insight.insight_kind]
            return (
              <button
                className={`relationship-map-node relationship-insight-node${selectedNodeId === insight.id ? ' is-selected' : ''}${activeNodeIds && !activeNodeIds.has(insight.id) ? ' is-dimmed' : ''}`}
                style={visualStyle(
                  positions.get(insight.id) ?? insightPositions[index],
                  meta.color,
                  5.2,
                )}
                type="button"
                aria-pressed={selectedNodeId === insight.id}
                onPointerDown={(event) => startNodeDrag(event, insight.id)}
                onClick={() => selectNode(insight.id)}
                key={insight.id}
              >
                <span>{meta.label}</span>
                <strong>{insight.title}</strong>
                <small>{dimensionLabels[insight.dimension] ?? insight.dimension}</small>
              </button>
            )
          })}
        </div>
      </div>

      {selectedInsight && (
        <InsightSummary insight={selectedInsight} onClose={() => setSelectedNodeId(null)} />
      )}
      {selectedProject && (
        <ProjectFocusSummary
          project={selectedProject}
          insights={insights.filter((insight) =>
            insight.items.some((item) => item.item_id === selectedProject.item_id),
          )}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  )
}

function ProjectFocusSummary({
  project,
  insights,
  onClose,
}: {
  project: VisualInsight['items'][number]
  insights: VisualInsight[]
  onClose: () => void
}) {
  return (
    <aside className="relationship-insight-summary" aria-label="선택한 프로젝트 연결 요약">
      <div className="relationship-summary-heading">
        <div>
          <span style={{ '--insight-color': project.node_type_color } as CSSProperties}>
            PROJECT
          </span>
          <h3>{project.title}</h3>
        </div>
        <button type="button" aria-label="프로젝트 요약 닫기" onClick={onClose}>
          ×
        </button>
      </div>
      <p>직접 연결된 AI 관계 {insights.length}개만 지도에서 강조했습니다.</p>
      <div className="relationship-summary-projects">
        {insights.map((insight) => (
          <span key={insight.id}>
            {insightMeta[insight.insight_kind].label} · {insight.title}
          </span>
        ))}
        <Link to={`/knowledge/${project.item_id}`}>프로젝트 상세 보기</Link>
      </div>
    </aside>
  )
}

function projectNote(insight: VisualInsight, projectId: string) {
  const notes: unknown[] = Array.isArray(insight.properties.projectNotes)
    ? insight.properties.projectNotes
    : []
  const note = notes.find((value): value is { projectId: string; note: string } => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const record = value as Record<string, unknown>
    return record.projectId === projectId && typeof record.note === 'string'
  })
  return note?.note ?? null
}

function ProjectComparisonMap({ foundation }: { foundation: VisualRelationshipFoundation }) {
  const insights = foundation.insights.filter((insight) => insight.items.length >= 2)
  const projects = [
    ...new Map(
      insights
        .flatMap((insight) => insight.items)
        .filter((item) => item.node_type_key === 'project')
        .map((item) => [item.item_id, item]),
    ).values(),
  ]
  const [selectedIds, setSelectedIds] = useState(() =>
    projects.slice(0, Math.min(2, projects.length)).map((project) => project.item_id),
  )
  const selectedProjects = projects.filter((project) => selectedIds.includes(project.item_id))
  const comparisonInsights = insights.filter(
    (insight) => insight.items.filter((item) => selectedIds.includes(item.item_id)).length >= 2,
  )
  const dimensions = [...new Set(comparisonInsights.map((insight) => insight.dimension))].slice(
    0,
    5,
  )
  const commonCount = comparisonInsights.filter(
    (insight) => insight.insight_kind !== 'difference',
  ).length
  const differenceCount = comparisonInsights.filter(
    (insight) => insight.insight_kind === 'difference',
  ).length

  return (
    <div className="project-comparison-map" aria-label="프로젝트 비교 지도">
      <div className="comparison-project-picker">
        <div>
          <strong>비교할 프로젝트</strong>
          <span>2~4개 선택</span>
        </div>
        <div className="comparison-project-options">
          {projects.map((project) => {
            const selected = selectedIds.includes(project.item_id)
            return (
              <button
                type="button"
                className={selected ? 'is-selected' : ''}
                aria-pressed={selected}
                disabled={!selected && selectedIds.length >= 4}
                onClick={() =>
                  setSelectedIds((current) =>
                    current.includes(project.item_id)
                      ? current.filter((id) => id !== project.item_id)
                      : [...current, project.item_id],
                  )
                }
                key={project.item_id}
              >
                {project.title}
              </button>
            )
          })}
        </div>
      </div>
      {selectedProjects.length < 2 ? (
        <div className="comparison-empty">
          프로젝트를 2개 이상 선택하면 차이를 한눈에 보여줍니다.
        </div>
      ) : (
        <>
          <div className="comparison-metrics">
            <span>
              <strong>{commonCount}</strong> 공통 연결
            </span>
            <span>
              <strong>{differenceCount}</strong> 차이점
            </span>
            <span>
              <strong>{dimensions.length}</strong> 비교 영역
            </span>
          </div>
          <div className="comparison-board">
            <div
              className="comparison-project-headings"
              style={{ '--comparison-count': selectedProjects.length } as CSSProperties}
            >
              <span>비교 영역</span>
              {selectedProjects.map((project) => (
                <strong key={project.item_id}>{project.title}</strong>
              ))}
            </div>
            {dimensions.map((dimension) => {
              const dimensionInsights = comparisonInsights.filter(
                (insight) => insight.dimension === dimension,
              )
              return (
                <div
                  className="comparison-row"
                  style={{ '--comparison-count': selectedProjects.length } as CSSProperties}
                  key={dimension}
                >
                  <strong>{dimensionLabels[dimension] ?? dimension}</strong>
                  {selectedProjects.map((project) => {
                    const relevant = dimensionInsights.filter((insight) =>
                      insight.items.some((item) => item.item_id === project.item_id),
                    )
                    return (
                      <div key={project.item_id}>
                        {relevant.length ? (
                          relevant.slice(0, 3).map((insight) => (
                            <article
                              className={`comparison-insight ${insight.insight_kind}`}
                              key={insight.id}
                            >
                              <span>{insightMeta[insight.insight_kind].label}</span>
                              <p>{projectNote(insight, project.item_id) ?? insight.title}</p>
                            </article>
                          ))
                        ) : (
                          <small>확인된 연결 없음</small>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </>
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
  const [mode, setMode] = useState<'relationship' | 'comparison'>('relationship')
  const hasVisualInsights = Boolean(
    props.visualFoundation?.insights.some((insight) => insight.items.length >= 2),
  )
  if (hasVisualInsights && props.visualFoundation)
    return (
      <div className="visual-map-experience">
        <div className="visual-map-mode-toggle" role="group" aria-label="지도 보기">
          <button
            type="button"
            className={mode === 'relationship' ? 'is-active' : ''}
            onClick={() => setMode('relationship')}
          >
            관계 지도
          </button>
          <button
            type="button"
            className={mode === 'comparison' ? 'is-active' : ''}
            onClick={() => setMode('comparison')}
          >
            프로젝트 비교
          </button>
        </div>
        {mode === 'relationship' ? (
          <RelationshipMap
            key={props.visualFoundation.insights.map((insight) => insight.id).join(':')}
            foundation={props.visualFoundation}
            activeSourceIds={props.activeSourceIds}
          />
        ) : (
          <ProjectComparisonMap foundation={props.visualFoundation} />
        )}
      </div>
    )
  if (props.graph?.nodes.some((node) => node.node_type_key === 'project'))
    return <ProjectClusterMap graph={props.graph} activeSourceIds={props.activeSourceIds} />
  return <ContextConstellation {...props} />
}
