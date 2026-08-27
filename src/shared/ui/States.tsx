interface StateProps {
  title: string
  description: string
  fullPage?: boolean
}

interface ErrorStateProps extends StateProps {
  actionLabel: string
  onAction: () => void
}

export function LoadingState({ label, fullPage = false }: { label: string; fullPage?: boolean }) {
  return (
    <div className={`state-view loading-state${fullPage ? ' full-page-state' : ''}`} role="status">
      <span className="loading-orbit" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

export function EmptyState({ title, description }: StateProps) {
  return (
    <div className="state-view empty-state">
      <div className="empty-state-visual" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}

export function ErrorState({
  title,
  description,
  actionLabel,
  onAction,
  fullPage = false,
}: ErrorStateProps) {
  return (
    <div className={`state-view error-state${fullPage ? ' full-page-state' : ''}`} role="alert">
      <div className="error-state-mark" aria-hidden="true">
        !
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      <button className="secondary-button" type="button" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  )
}
