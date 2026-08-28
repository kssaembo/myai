import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { exportKnowledgeAsJson, exportKnowledgeAsMarkdown } from '@/entities/export/api'
import type { KnowledgeRecord } from '@/entities/knowledge-item/api'
import { moveKnowledgeToTrash } from '@/entities/trash/api'
import { friendlyDataError } from '@/shared/lib/display'

export function KnowledgeUtilityBar({ record }: { record: KnowledgeRecord }) {
  const navigate = useNavigate()
  const [showTrash, setShowTrash] = useState(false)
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState('')

  const run = async (operation: () => Promise<void>) => {
    setIsWorking(true)
    setError('')
    try {
      await operation()
    } catch (caught) {
      setError(friendlyDataError(caught))
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <>
      <div className="knowledge-utility-bar content-card">
        <div>
          <strong>내보내기·보존</strong>
          <span>원본은 문서 Version 영역에서 내려받을 수 있습니다.</span>
        </div>
        <div>
          <button
            className="secondary-button"
            disabled={isWorking}
            type="button"
            onClick={() => void run(() => exportKnowledgeAsMarkdown(record.id, record.title))}
          >
            Markdown
          </button>
          <button
            className="secondary-button"
            disabled={isWorking}
            type="button"
            onClick={() => void run(() => exportKnowledgeAsJson(record.id, record.title))}
          >
            JSON
          </button>
          <button
            className="secondary-button danger-outline"
            disabled={isWorking}
            type="button"
            onClick={() => setShowTrash(true)}
          >
            휴지통으로 이동
          </button>
        </div>
      </div>
      {error && (
        <p className="inline-error utility-error" role="alert">
          {error}
        </p>
      )}
      {showTrash && (
        <div className="modal-backdrop">
          <div className="confirm-modal" role="dialog" aria-modal="true">
            <h2>휴지통으로 이동할까요?</h2>
            <p>연결된 Relation도 숨겨지며 휴지통에서 다시 복원할 수 있습니다.</p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setShowTrash(false)}
              >
                취소
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={isWorking}
                onClick={() =>
                  void run(async () => {
                    await moveKnowledgeToTrash(record.id)
                    setShowTrash(false)
                    void navigate('/trash')
                  })
                }
              >
                이동
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
