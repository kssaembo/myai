import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { getAIStatus, testAIConnection, type AIStatus } from '@/entities/ai/api'
import { friendlyDataError } from '@/shared/lib/display'
import { ErrorState, LoadingState } from '@/shared/ui/States'

export function AISettingsPage() {
  const [status, setStatus] = useState<AIStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTesting, setIsTesting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      setStatus(await getAIStatus())
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

  const testConnection = async () => {
    setIsTesting(true)
    setError('')
    setMessage('')
    try {
      const result = await testAIConnection()
      setMessage(`${result.message} · ${result.model}`)
      await load()
    } catch (caught) {
      setError(friendlyDataError(caught))
    } finally {
      setIsTesting(false)
    }
  }

  if (isLoading && !status) return <LoadingState label="AI 설정을 확인하는 중입니다" />
  if (!status)
    return (
      <ErrorState
        title="AI 설정을 불러오지 못했습니다"
        description={error}
        actionLabel="다시 시도"
        onAction={() => void load()}
      />
    )

  const requestPercent = Math.min(
    100,
    Math.round((status.usage.request_count / status.settings.daily_request_limit) * 100),
  )
  const tokenPercent = Math.min(
    100,
    Math.round((status.usage.input_tokens / status.settings.daily_input_token_limit) * 100),
  )

  return (
    <section className="page-section ai-settings-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">V2 AI Foundation</p>
          <h1>AI 연결</h1>
          <p>API 키는 브라우저가 아니라 Supabase Edge Function Secret에서만 사용합니다.</p>
        </div>
        <Link className="secondary-button" to="/settings/taxonomy">
          고급 분류 설정
        </Link>
      </header>
      <div className="ai-settings-grid">
        <article className="content-card ai-provider-card">
          <p className="eyebrow">Provider</p>
          <h2>Gemini</h2>
          <dl className="metadata-list">
            <div>
              <dt>대화 모델</dt>
              <dd>{status.settings.chat_model}</dd>
            </div>
            <div>
              <dt>Embedding 모델</dt>
              <dd>{status.settings.embedding_model}</dd>
            </div>
            <div>
              <dt>상태</dt>
              <dd>{status.settings.is_enabled ? '활성' : '중지'}</dd>
            </div>
          </dl>
          <button
            className="primary-button"
            disabled={isTesting || !status.settings.is_enabled}
            type="button"
            onClick={() => void testConnection()}
          >
            {isTesting ? '연결 확인 중…' : 'Gemini 연결 테스트'}
          </button>
        </article>
        <article className="content-card ai-usage-card">
          <p className="eyebrow">Free usage guard</p>
          <h2>오늘의 앱 내부 한도</h2>
          <label>
            <span>
              요청 {status.usage.request_count}/{status.settings.daily_request_limit}
            </span>
            <progress max="100" value={requestPercent} />
          </label>
          <label>
            <span>
              입력 Token {status.usage.input_tokens.toLocaleString()}/
              {status.settings.daily_input_token_limit.toLocaleString()}
            </span>
            <progress max="100" value={tokenPercent} />
          </label>
          <p className="privacy-note">
            이 한도는 예상치 못한 과다 호출을 막는 앱 내부 제한입니다. Google의 실제 무료 Quota가
            우선하며, 무료 티어 콘텐츠는 제품 개선에 사용될 수 있습니다.
          </p>
        </article>
      </div>
      {message && (
        <p className="inline-success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
