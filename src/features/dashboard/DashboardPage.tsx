import { EmptyState } from '@/shared/ui/States'

const stats = [
  { label: 'Documents', value: 0, detail: '저장된 문서' },
  { label: 'Projects', value: 0, detail: '진행 중 프로젝트' },
  { label: 'Nodes', value: 0, detail: '연결 가능한 지식' },
  { label: 'Relations', value: 0, detail: '확인된 관계' },
]

export function DashboardPage() {
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
          Foundation connected
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
            <span className="phase-badge">Step 4 예정</span>
          </header>
          <EmptyState
            title="아직 저장된 지식이 없습니다"
            description="다음 단계에서 첫 Project, Idea 또는 Concept를 직접 만들 수 있습니다."
          />
        </article>

        <aside className="content-card next-step-card">
          <p className="eyebrow">Next Milestone</p>
          <h2>Knowledge를 쌓을 준비가 되었습니다</h2>
          <p>
            인증과 개인 작업 공간이 연결되었습니다. 다음 단계에서는 파일 없이도 지식 Node를 만들고
            분류할 수 있습니다.
          </p>
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
            <li>
              <span>3</span>
              <div>
                <strong>Knowledge creation</strong>
                <small>Node, Category, Tag 관리</small>
              </div>
            </li>
          </ol>
        </aside>
      </div>
    </section>
  )
}
