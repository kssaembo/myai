import { MultiDirectedGraph } from 'graphology'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type Sigma from 'sigma'

import { getKnowledgeGraph, type GraphEdgeRecord, type GraphNodeRecord } from '@/entities/graph/api'
import { listKnowledge, type KnowledgeRecord } from '@/entities/knowledge-item/api'
import { friendlyDataError, verificationLabels } from '@/shared/lib/display'
import { EmptyState } from '@/shared/ui/States'

interface NodeAttributes extends Record<string, unknown> {
  x: number
  y: number
  size: number
  label: string
  color: string
  hidden: boolean
  record: GraphNodeRecord
}

interface EdgeAttributes extends Record<string, unknown> {
  label: string
  color: string
  size: number
  hidden: boolean
  type: 'arrow'
  record: GraphEdgeRecord
}

function positionFor(id: string, center: boolean) {
  if (center) return { x: 0, y: 0 }
  let hash = 0
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  const angle = ((hash % 360) * Math.PI) / 180
  const radius = 8 + ((hash >>> 8) % 10)
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
}

export function GraphPage() {
  const [params, setParams] = useSearchParams()
  const projectId = params.get('project') ?? null
  const containerRef = useRef<HTMLDivElement>(null)
  const graph = useMemo(() => new MultiDirectedGraph<NodeAttributes, EdgeAttributes>(), [])
  const rendererRef = useRef<Sigma<NodeAttributes, EdgeAttributes> | null>(null)
  const [projects, setProjects] = useState<KnowledgeRecord[]>([])
  const [nodes, setNodes] = useState(new Map<string, GraphNodeRecord>())
  const [edges, setEdges] = useState(new Map<string, GraphEdgeRecord>())
  const [nextOffset, setNextOffset] = useState(0)
  const [totalEdges, setTotalEdges] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [nodeType, setNodeType] = useState('')
  const [relationType, setRelationType] = useState('')
  const [relationStatus, setRelationStatus] = useState('active')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void listKnowledge({ projectOnly: true })
      .then((nextProjects) => {
        if (!active) return
        setProjects(nextProjects)
        if (!projectId && nextProjects[0])
          setParams({ project: nextProjects[0].id }, { replace: true })
      })
      .catch((caught: unknown) => active && setError(friendlyDataError(caught)))
    return () => {
      active = false
    }
  }, [projectId, setParams])

  useEffect(() => {
    if (!containerRef.current) return
    let active = true
    let renderer: Sigma<NodeAttributes, EdgeAttributes> | null = null
    const container = containerRef.current
    void import('sigma').then(({ default: SigmaRenderer }) => {
      if (!active) return
      renderer = new SigmaRenderer(graph, container, {
        renderEdgeLabels: true,
        labelDensity: 0.08,
        labelGridCellSize: 90,
        defaultEdgeType: 'arrow',
      })
      renderer.on('clickNode', ({ node }) => {
        setSelectedNodeId(node)
        setSelectedEdgeId(null)
      })
      renderer.on('clickEdge', ({ edge }) => {
        setSelectedEdgeId(edge)
        setSelectedNodeId(null)
      })
      renderer.on('clickStage', () => {
        setSelectedNodeId(null)
        setSelectedEdgeId(null)
      })
      rendererRef.current = renderer
    })
    return () => {
      active = false
      renderer?.kill()
      rendererRef.current = null
    }
  }, [graph])

  const appendPage = useCallback(
    async (offset: number, reset: boolean) => {
      if (!projectId) {
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      setError('')
      try {
        const page = await getKnowledgeGraph(projectId, offset)
        if (reset) graph.clear()
        for (const node of page.nodes) {
          const position = positionFor(node.id, node.is_center)
          if (!graph.hasNode(node.id))
            graph.addNode(node.id, {
              ...position,
              label: node.title,
              color: node.color,
              size: node.is_center ? 15 : 7 + node.importance,
              hidden: false,
              record: node,
            })
        }
        for (const edge of page.edges) {
          if (
            !graph.hasNode(edge.source_item_id) ||
            !graph.hasNode(edge.target_item_id) ||
            graph.hasEdge(edge.id)
          )
            continue
          graph.addDirectedEdgeWithKey(edge.id, edge.source_item_id, edge.target_item_id, {
            label: edge.relation_type_label,
            color: edge.color,
            size: edge.status === 'active' ? 2 : 1,
            hidden: false,
            type: 'arrow',
            record: edge,
          })
        }
        setNodes(
          (current) =>
            new Map([
              ...(reset ? [] : current),
              ...page.nodes.map((node) => [node.id, node] as const),
            ]),
        )
        setEdges(
          (current) =>
            new Map([
              ...(reset ? [] : current),
              ...page.edges.map((edge) => [edge.id, edge] as const),
            ]),
        )
        setNextOffset(page.next_offset)
        setTotalEdges(page.total_edges)
        setHasMore(page.has_more)
        rendererRef.current?.refresh()
      } catch (caught) {
        setError(friendlyDataError(caught))
      } finally {
        setIsLoading(false)
      }
    },
    [graph, projectId],
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSelectedNodeId(null)
      setSelectedEdgeId(null)
      setNextOffset(0)
      void appendPage(0, true)
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [appendPage, projectId])

  useEffect(() => {
    const needle = query.trim().toLocaleLowerCase('ko-KR')
    graph.forEachNode((id, attributes) => {
      const record = attributes.record
      const hidden = Boolean(
        (needle &&
          !`${record.title} ${record.summary ?? ''}`.toLocaleLowerCase('ko-KR').includes(needle)) ||
        (nodeType && record.node_type_key !== nodeType),
      )
      graph.setNodeAttribute(id, 'hidden', hidden)
    })
    graph.forEachEdge((id, attributes, source, target) => {
      const record = attributes.record
      const hidden =
        graph.getNodeAttribute(source, 'hidden') ||
        graph.getNodeAttribute(target, 'hidden') ||
        (relationType && record.relation_type_key !== relationType) ||
        (relationStatus !== 'all' && record.status !== relationStatus)
      graph.setEdgeAttribute(id, 'hidden', hidden)
    })
    rendererRef.current?.refresh()
  }, [edges, graph, nodeType, query, relationStatus, relationType])

  const nodeTypes = [
    ...new Map(
      [...nodes.values()].map((node) => [node.node_type_key, node.node_type_label]),
    ).entries(),
  ]
  const relationTypes = [
    ...new Map(
      [...edges.values()].map((edge) => [edge.relation_type_key, edge.relation_type_label]),
    ).entries(),
  ]
  const selectedNode = selectedNodeId ? nodes.get(selectedNodeId) : null
  const selectedEdge = selectedEdgeId ? edges.get(selectedEdgeId) : null

  return (
    <section className="page-section graph-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Knowledge Graph</p>
          <h1>Project 연결 탐색</h1>
          <p>평가된 Relation을 Project 중심으로 최대 2단계까지 시각화합니다.</p>
        </div>
        <span className="graph-count">
          Node {nodes.size} · Relation {edges.size}/{totalEdges}
        </span>
      </header>
      <div className="graph-toolbar content-card">
        <label>
          Project
          <select
            value={projectId ?? ''}
            onChange={(event) =>
              setParams(event.target.value ? { project: event.target.value } : {})
            }
          >
            <option value="">Project 선택</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          검색
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Node 제목·요약"
          />
        </label>
        <label>
          Node 유형
          <select value={nodeType} onChange={(event) => setNodeType(event.target.value)}>
            <option value="">전체</option>
            {nodeTypes.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Relation
          <select value={relationType} onChange={(event) => setRelationType(event.target.value)}>
            <option value="">전체</option>
            {relationTypes.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          상태
          <select
            value={relationStatus}
            onChange={(event) => setRelationStatus(event.target.value)}
          >
            <option value="active">활성</option>
            <option value="proposed">제안</option>
            <option value="all">모두</option>
          </select>
        </label>
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            void rendererRef.current?.getCamera().animatedReset()
          }}
        >
          화면 맞춤
        </button>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="graph-workspace content-card">
        <div className="sigma-container" ref={containerRef}>
          {!projectId && (
            <EmptyState
              title="Project를 선택하세요"
              description="Project 주변의 지식 연결을 불러옵니다."
            />
          )}
        </div>
        <aside className="graph-inspector">
          {selectedNode ? (
            <>
              <p className="eyebrow">Selected Node</p>
              <span
                className="type-badge"
                style={{ '--badge-color': selectedNode.color } as React.CSSProperties}
              >
                {selectedNode.node_type_label}
              </span>
              <h2>{selectedNode.title}</h2>
              <p>{selectedNode.summary ?? '요약 없음'}</p>
              <dl>
                <div>
                  <dt>확인 상태</dt>
                  <dd>{verificationLabels[selectedNode.verification_status]}</dd>
                </div>
                <div>
                  <dt>Evidence</dt>
                  <dd>{selectedNode.evidence_count}개</dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>{selectedNode.category_name ?? '미분류'}</dd>
                </div>
              </dl>
              <Link className="primary-button" to={`/knowledge/${selectedNode.id}`}>
                상세 열기
              </Link>
            </>
          ) : selectedEdge ? (
            <>
              <p className="eyebrow">Selected Relation</p>
              <h2>{selectedEdge.relation_type_label}</h2>
              <p>{selectedEdge.rationale ?? '판단 근거 미기록'}</p>
              <dl>
                <div>
                  <dt>상태</dt>
                  <dd>{selectedEdge.status}</dd>
                </div>
                <div>
                  <dt>Evidence</dt>
                  <dd>{selectedEdge.evidence_count}개</dd>
                </div>
              </dl>
              <Link
                className="secondary-button"
                to={`/knowledge/${selectedEdge.source_item_id}/connections`}
              >
                Relation 관리
              </Link>
            </>
          ) : (
            <div className="quiet-empty compact">
              <strong>Node 또는 Relation을 선택하세요</strong>
              <p>선택한 요소의 요약과 Evidence 상태를 확인할 수 있습니다.</p>
            </div>
          )}
        </aside>
      </div>
      {hasMore && (
        <div className="graph-load-more">
          <button
            className="secondary-button"
            type="button"
            disabled={isLoading}
            onClick={() => {
              void appendPage(nextOffset, false)
            }}
          >
            {isLoading ? '불러오는 중…' : 'Relation 100개 더 불러오기'}
          </button>
        </div>
      )}
    </section>
  )
}
