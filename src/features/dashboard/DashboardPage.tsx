import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  deleteAIConversation,
  listAIConversations,
  listAIMessages,
  sendAIMessage,
  type AIConversation,
  type AIMessage,
} from '@/entities/ai/api'
import { listKnowledge, type KnowledgeRecord } from '@/entities/knowledge-item/api'
import { formatDate, friendlyDataError } from '@/shared/lib/display'

export function DashboardPage() {
  const [records, setRecords] = useState<KnowledgeRecord[]>([])
  const [conversations, setConversations] = useState<AIConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [question, setQuestion] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const messageEndRef = useRef<HTMLDivElement>(null)

  const loadWorkspace = useCallback(async () => {
    try {
      const [knowledge, chatList] = await Promise.all([listKnowledge(), listAIConversations()])
      setRecords(knowledge)
      setConversations(chatList)
    } catch (caught) {
      setError(friendlyDataError(caught))
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadWorkspace(), 0)
    return () => window.clearTimeout(timeout)
  }, [loadWorkspace])

  useEffect(() => {
    if (!activeConversationId) return
    void listAIMessages(activeConversationId)
      .then(setMessages)
      .catch((caught: unknown) => setError(friendlyDataError(caught)))
  }, [activeConversationId])

  useEffect(() => {
    if (typeof messageEndRef.current?.scrollIntoView === 'function')
      messageEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, isSending])

  const send = async () => {
    const trimmed = question.trim()
    if (!trimmed || isSending) return
    setQuestion('')
    setError('')
    setIsSending(true)
    const optimistic: AIMessage = {
      id: `pending-${Date.now()}`,
      conversation_id: activeConversationId ?? '',
      role: 'user',
      content: trimmed,
      model: null,
      created_at: new Date().toISOString(),
      sources: [],
    }
    setMessages((current) => [...current, optimistic])
    try {
      const result = await sendAIMessage(trimmed, activeConversationId)
      setActiveConversationId(result.conversationId)
      setMessages((current) => [
        ...current,
        {
          id: result.messageId,
          conversation_id: result.conversationId,
          role: 'assistant',
          content: result.message,
          model: result.model,
          created_at: new Date().toISOString(),
          sources: result.sources.map((source) => ({
            id: `${result.messageId}-${source.rank}`,
            itemId: source.itemId,
            sectionId: source.sectionId,
            rank: source.rank,
            snippet: source.snippet,
            title: source.title,
          })),
        },
      ])
      await loadWorkspace()
    } catch (caught) {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id))
      setQuestion(trimmed)
      setError(friendlyDataError(caught))
    } finally {
      setIsSending(false)
    }
  }

  const removeConversation = async () => {
    if (!activeConversationId) return
    try {
      await deleteAIConversation(activeConversationId)
      setActiveConversationId(null)
      setMessages([])
      await loadWorkspace()
    } catch (caught) {
      setError(friendlyDataError(caught))
    }
  }

  const projects = records.filter((item) => item.nodeType.key === 'project').slice(0, 4)
  const recentKnowledge = records.slice(0, 8)

  return (
    <section className="dashboard jarvis-dashboard" aria-labelledby="dashboard-title">
      <header className="jarvis-heading">
        <div>
          <p className="eyebrow">Personal Intelligence</p>
          <h1 id="dashboard-title">무엇을 함께 생각해 볼까요?</h1>
          <p>내가 저장한 프로젝트와 기록을 바탕으로 질문하고, 아이디어를 구체화하세요.</p>
        </div>
        <Link className="secondary-button" to="/imports">
          지식 추가
        </Link>
      </header>

      <div className="jarvis-primary-grid">
        <article className="content-card assistant-card">
          <header className="assistant-toolbar">
            <div>
              <span className="assistant-status-dot" />
              <strong>개인 AI 비서</strong>
            </div>
            <div className="assistant-toolbar-actions">
              <select
                aria-label="이전 대화"
                value={activeConversationId ?? ''}
                onChange={(event) => {
                  const nextId = event.target.value.trim() ? event.target.value : null
                  setActiveConversationId(nextId)
                  if (!nextId) setMessages([])
                }}
              >
                <option value="">새 대화</option>
                {conversations.map((conversation) => (
                  <option key={conversation.id} value={conversation.id}>
                    {conversation.title}
                  </option>
                ))}
              </select>
              {activeConversationId && (
                <button
                  className="text-action"
                  type="button"
                  onClick={() => void removeConversation()}
                >
                  삭제
                </button>
              )}
            </div>
          </header>

          <div className="assistant-messages" aria-live="polite">
            {!messages.length && (
              <div className="assistant-welcome">
                <span>AI</span>
                <div>
                  <h2>당신의 기록에서 답을 찾습니다.</h2>
                  <p>“내가 개발한 게임들의 공통 설계 원칙을 정리해줘”처럼 질문해 보세요.</p>
                </div>
              </div>
            )}
            {messages.map((message) => (
              <div className={`chat-message ${message.role}`} key={message.id}>
                <span className="chat-role">{message.role === 'user' ? '나' : 'AI'}</span>
                <div>
                  <p>{message.content}</p>
                  {!!message.sources.length && (
                    <div className="chat-sources">
                      {message.sources.map((source) => (
                        <Link to={`/knowledge/${source.itemId}`} key={source.id}>
                          [{source.rank}] {source.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="chat-message assistant pending">
                <span className="chat-role">AI</span>
                <p>개인 지식과 Gemini 답변을 준비하는 중…</p>
              </div>
            )}
            <div ref={messageEndRef} />
          </div>

          <form
            className="assistant-composer"
            onSubmit={(event) => {
              event.preventDefault()
              void send()
            }}
          >
            <textarea
              aria-label="AI에게 질문"
              maxLength={4000}
              placeholder="내 프로젝트, 아이디어, 관심사에 대해 질문하세요"
              rows={2}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void send()
                }
              }}
            />
            <button
              className="assistant-send-button"
              disabled={!question.trim() || isSending}
              type="submit"
            >
              전송
            </button>
          </form>
          {error && <p className="assistant-error">{error}</p>}
        </article>

        <aside className="content-card focus-card">
          <header className="focus-card-heading">
            <div>
              <p className="eyebrow">Current Focus</p>
              <h2>진행 중인 프로젝트</h2>
            </div>
            <Link className="text-action" to="/projects">
              전체 보기
            </Link>
          </header>
          <div className="focus-list">
            {projects.length ? (
              projects.map((project) => (
                <Link to={`/projects/${project.id}`} key={project.id}>
                  <span style={{ background: project.nodeType.color }} />
                  <div>
                    <strong>{project.title}</strong>
                    <small>
                      {project.summary?.trim()
                        ? project.summary
                        : `${formatDate(project.updated_at)} 업데이트`}
                    </small>
                  </div>
                </Link>
              ))
            ) : (
              <p className="compact-empty">프로젝트를 추가하면 최근 작업이 이곳에 표시됩니다.</p>
            )}
          </div>
          <div className="focus-note">
            <strong>{records.length}개의 개인 지식</strong>
            <span>대화할 때 관련 기록을 자동으로 찾아 근거로 사용합니다.</span>
          </div>
        </aside>
      </div>

      <article className="content-card knowledge-landscape">
        <header className="focus-card-heading">
          <div>
            <p className="eyebrow">Knowledge Landscape</p>
            <h2>최근 축적된 지식</h2>
          </div>
          <Link className="text-action" to="/knowledge">
            지식 관리
          </Link>
        </header>
        <div className="knowledge-orbit">
          {recentKnowledge.length ? (
            recentKnowledge.map((item, index) => (
              <Link
                className={`knowledge-orbit-node size-${(index % 3) + 1}`}
                style={{ '--node-color': item.nodeType.color } as React.CSSProperties}
                to={`/knowledge/${item.id}`}
                key={item.id}
              >
                <span>{item.nodeType.label_ko}</span>
                <strong>{item.title}</strong>
              </Link>
            ))
          ) : (
            <p className="compact-empty">오른쪽 위 ‘지식 추가’에서 첫 문서를 가져오세요.</p>
          )}
        </div>
      </article>
    </section>
  )
}
