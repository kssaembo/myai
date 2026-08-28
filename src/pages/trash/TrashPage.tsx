import { useCallback, useEffect, useState } from 'react'

import { exportKnowledgeAsJson } from '@/entities/export/api'
import { listTrash, type KnowledgeRecord } from '@/entities/knowledge-item/api'
import { permanentlyDeleteKnowledge, restoreKnowledgeFromTrash } from '@/entities/trash/api'
import { formatDate, friendlyDataError } from '@/shared/lib/display'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/States'

export function TrashPage() {
  const [records, setRecords] = useState<KnowledgeRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<KnowledgeRecord | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [workingId, setWorkingId] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      setRecords(await listTrash())
    } catch (caught) {
      setError(friendlyDataError(caught))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  const run = async (id: string, operation: () => Promise<void>) => {
    setWorkingId(id)
    setError('')
    try {
      await operation()
      await load()
    } catch (caught) {
      setError(friendlyDataError(caught))
    } finally {
      setWorkingId('')
    }
  }

  if (isLoading && !records.length) return <LoadingState label="휴지통을 불러오는 중입니다" />
  if (error && !records.length)
    return (
      <ErrorState
        title="휴지통을 열 수 없습니다"
        description={error}
        actionLabel="다시 시도"
        onAction={() => void load()}
      />
    )

  return (
    <section className="page-section trash-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Recovery & deletion</p>
          <h1>휴지통</h1>
          <p>복원하거나 JSON으로 백업한 뒤 영구 삭제할 수 있습니다.</p>
        </div>
        <span className="result-count">{records.length}개 항목</span>
      </header>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {records.length ? (
        <div className="trash-list">
          {records.map((record) => (
            <article className="content-card trash-card" key={record.id}>
              <div>
                <span
                  className="type-badge"
                  style={{ '--badge-color': record.nodeType.color } as React.CSSProperties}
                >
                  {record.nodeType.label_ko}
                </span>
                <h2>{record.title}</h2>
                <p>{record.summary ?? '요약 없음'}</p>
                <small>{formatDate(record.deleted_at ?? record.updated_at)} 휴지통 이동</small>
              </div>
              <div className="trash-actions">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={workingId === record.id}
                  onClick={() =>
                    void run(record.id, () => exportKnowledgeAsJson(record.id, record.title))
                  }
                >
                  JSON 백업
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={workingId === record.id}
                  onClick={() => void run(record.id, () => restoreKnowledgeFromTrash(record.id))}
                >
                  복원
                </button>
                <button
                  className="secondary-button danger-outline"
                  type="button"
                  disabled={workingId === record.id}
                  onClick={() => {
                    setConfirmation('')
                    setPendingDelete(record)
                  }}
                >
                  영구 삭제
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="휴지통이 비어 있습니다" description="삭제한 지식 항목이 없습니다." />
      )}
      {pendingDelete && (
        <div className="modal-backdrop">
          <div className="confirm-modal" role="dialog" aria-modal="true">
            <h2>영구 삭제는 되돌릴 수 없습니다</h2>
            <p>DB의 Node·Version·Evidence·Relation과 Storage 원본이 모두 삭제됩니다.</p>
            <label>
              확인을 위해 제목 입력
              <input
                autoFocus
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={pendingDelete.title}
              />
            </label>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setPendingDelete(null)}
              >
                취소
              </button>
              <button
                className="primary-button danger-button"
                type="button"
                disabled={confirmation !== pendingDelete.title || workingId === pendingDelete.id}
                onClick={() =>
                  void run(pendingDelete.id, async () => {
                    await permanentlyDeleteKnowledge(pendingDelete.id)
                    setPendingDelete(null)
                  })
                }
              >
                영구 삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
