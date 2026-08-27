import { EmptyState } from './States'

interface SectionPlaceholderPageProps {
  eyebrow: string
  title: string
  description: string
}

export function SectionPlaceholderPage({
  eyebrow,
  title,
  description,
}: SectionPlaceholderPageProps) {
  return (
    <section className="page-section" aria-labelledby="section-page-title">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 id="section-page-title">{title}</h1>
        </div>
        <span className="phase-badge">준비 중</span>
      </header>
      <div className="content-card placeholder-card">
        <EmptyState title="아직 연결된 기능이 없습니다" description={description} />
      </div>
    </section>
  )
}
