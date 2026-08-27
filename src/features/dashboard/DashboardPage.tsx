import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { listKnowledge, type KnowledgeRecord } from '@/entities/knowledge-item/api'
import { formatDate, friendlyDataError } from '@/shared/lib/display'
import { supabase } from '@/shared/lib/supabase'
import { EmptyState } from '@/shared/ui/States'

export function DashboardPage() {
  const [records, setRecords] = useState<KnowledgeRecord[]>([])
  const [relationCount, setRelationCount] = useState(0)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      const items = await listKnowledge()
      const relations = await supabase
        .from('relations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
      if (relations.error) throw relations.error
      setRecords(items)
      setRelationCount(relations.count ?? 0)
    } catch (caught) {
      setError(friendlyDataError(caught))
    }
  }, [])
  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [load])
  const stats = [
    {
      label: 'Documents',
      value: records.filter((item) => item.nodeType.key === 'document').length,
      detail: '저장된 문서',
    },
    {
      label: 'Projects',
      value: records.filter((item) => item.nodeType.key === 'project').length,
      detail: '활성 프로젝트',
    },
    { label: 'Nodes', value: records.length, detail: '연결 가능한 지식' },
    { label: 'Relations', value: relationCount, detail: '확인된 관계' },
  ]
  return (
    <section className="dashboard" aria-labelledby="dashboard-title">
      <header className="dashboard-hero">
        <div>
          <p className="eyebrow">Knowledge Overview</p>
          <h1 id="dashboard-title">좋은 지식은 기록에서 시작됩니다.</h1>
          <p>문서와 프로젝트를 쌓으면 이곳에서 연결 상태와 확인할 작업을 한눈에 볼 수 있습니다.</p>
        </div>
        <span className="foundation-status">
          <span />
          Knowledge CRUD ready
        </span>
      </header>

      <div className="stats-grid">
        {stats.map((stat) => (
          <article className="stat-card" key={stat.label}>
            <div className="stat-card-top">
              <span>{stat.label}</span>
              <span className="stat-pulse" />
            </div>
            <strong>{stat.value}</strong>
            <p>{stat.detail}</p>
          </article>
        ))}
      </div>

      <div className="dashboard-grid">
        <article className="content-card recent-card">
          <header className="card-heading">
            <div>
              <p className="eyebrow">Recent Knowledge</p>
              <h2>최근 지식</h2>
            </div>
            <Link className="text-action" to="/knowledge">
              전체 보기
            </Link>
          </header>
          {error && <p className="inline-error">{error}</p>}
          {records.length ? (
            <div className="recent-list">
              {records.slice(0, 6).map((item) => (
                <Link to={`/knowledge/${item.id}`} key={item.id}>
                  <span style={{ background: item.nodeType.color }} />
                  <div>
                    <strong>{item.title}</strong>
                    <small>
                      {item.nodeType.label_ko} · {formatDate(item.updated_at)}
                    </small>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="아직 저장된 지식이 없습니다"
              description="첫 Project, Idea 또는 Concept를 직접 만들어 보세요."
            />
          )}
        </article>

        <aside className="content-card next-step-card">
          <p className="eyebrow">Quick Start</p>
          <h2>첫 Knowledge를 만들어 보세요</h2>
          <p>파일 없이도 Project, Idea, Concept를 만들고 Category와 Tag로 분류할 수 있습니다.</p>
          <ol className="milestone-list">
            <li className="complete">
              <span>1</span>
              <div>
                <strong>Private database</strong>
                <small>RLS와 개인 데이터 경계</small>
              </div>
            </li>
            <li className="complete">
              <span>2</span>
              <div>
                <strong>Secure workspace</strong>
                <small>로그인과 세션 복구</small>
              </div>
            </li>
            <li className="complete">
              <span>3</span>
              <div>
                <strong>Knowledge creation</strong>
                <small>Node, Category, Tag 관리 가능</small>
              </div>
            </li>
          </ol>
          <div className="quick-actions">
            <Link className="primary-button" to="/knowledge/new">
              새 지식
            </Link>
            <Link className="secondary-button" to="/settings/taxonomy">
              분류 설정
            </Link>
          </div>
        </aside>
      </div>
    </section>
  )
}
