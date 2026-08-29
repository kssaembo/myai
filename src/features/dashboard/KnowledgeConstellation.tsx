import { Link } from 'react-router-dom'

import type { GraphPage } from '@/entities/graph/api'
import type { KnowledgeRecord } from '@/entities/knowledge-item/api'

interface KnowledgeConstellationProps {
  records: KnowledgeRecord[]
  graph: GraphPage | null
  focusText: string
  activeSourceIds: Set<string>
}

interface ConstellationNode {
  id: string
  title: string
  label: string
  color: string
  score: number
  isActive: boolean
}

const positions = [
  { x: 150, y: 95 },
  { x: 360, y: 68 },
  { x: 645, y: 70 },
  { x: 850, y: 105 },
  { x: 160, y: 285 },
  { x: 365, y: 310 },
  { x: 645, y: 306 },
  { x: 845, y: 275 },
]

function keywords(value: string) {
  return [...new Set(value.toLocaleLowerCase().match(/[가-힣a-z0-9_-]{2,}/g) ?? [])].slice(0, 8)
}

export function KnowledgeConstellation({
  records,
  graph,
  focusText,
  activeSourceIds,
}: KnowledgeConstellationProps) {
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
    .slice(0, positions.length)
  const selectedIds = new Set(nodes.map((node) => node.id))
  const nodePosition = new Map(nodes.map((node, index) => [node.id, positions[index]]))
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
          {nodes.map((node, index) => {
            const position = positions[index]
            return (
              <Link
                className={`constellation-node${node.isActive ? ' is-active' : ''}`}
                style={
                  {
                    '--node-color': node.color,
                    left: `${position.x / 10}%`,
                    top: `${position.y / 3.8}%`,
                  } as React.CSSProperties
                }
                to={`/knowledge/${node.id}`}
                key={node.id}
              >
                <span>{node.label}</span>
                <strong>{node.title}</strong>
              </Link>
            )
          })}
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
