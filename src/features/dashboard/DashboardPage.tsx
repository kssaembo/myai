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
import { getKnowledgeGraph, type GraphPage } from '@/entities/graph/api'
import { listKnowledge, type KnowledgeRecord } from '@/entities/knowledge-item/api'
import { formatDate, friendlyDataError } from '@/shared/lib/display'

import { KnowledgeConstellation } from './KnowledgeConstellation'

export function DashboardPage() {
  const [records, setRecords] = useState<KnowledgeRecord[]>([])
  const [graph, setGraph] = useState<GraphPage | null>(null)
  const [conversations, setConversations] = useState<AIConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [question, setQuestion] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const messageEndRef = useRef<HTMLDivElement>(null)

  const loadWorkspace = useCallback(async () => {
    try {
      const [knowledge, chatList, knowledgeGraph] = await Promise.all([
        listKnowledge(),
        listAIConversations(),
        getKnowledgeGraph(null).catch(() => null),
      ])
      setRecords(knowledge)
      setConversations(chatList)
      setGraph(knowledgeGraph)
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
  const thoughtRecords = records
    .filter((item) => ['idea', 'question', 'problem', 'lesson'].includes(item.nodeType.key))
    .slice(0, 3)
  const recentRecords = records.filter((item) => item.nodeType.key !== 'project').slice(0, 3)
  const latestUserQuestion = [...messages]
    .reverse()
    .find((message) => message.role === 'user')?.content
  const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant')
  const activeSourceIds = new Set(latestAssistant?.sources.map((source) => source.itemId) ?? [])
  const trimmedQuestion = question.trim()
  const focusText = trimmedQuestion ? trimmedQuestion : (latestUserQuestion ?? '')
  const suggestedQuestions = [
    projects[0] ? `${projects[0].title}에서 지금 가장 먼저 해결할 문제는 무엇일까?` : null,
    thoughtRecords[0] ? `${thoughtRecords[0].title}을 더 구체적인 실행안으로 발전시켜줘.` : null,
    records.length ? '내 기록에서 반복되는 설계 원칙 세 가지를 찾아줘.' : null,
  ].filter((value): value is string => Boolean(value))

  return (
    <section className="dashboard jarvis-dashboard" aria-labelledby="dashboard-title">
      <header className="jarvis-heading">
        <div>
          <p className="eyebrow">Personal Intelligence</p>
          <h1 id="dashboard-title">오늘, 무엇을 함께 생각할까요?</h1>
          <p>질문 하나로 내 프로젝트와 기록을 연결하고 다음 생각까지 이어갑니다.</p>
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

        <aside className="content-card focus-card intelligence-rail">
          <header className="focus-card-heading">
            <div>
              <p className="eyebrow">For You</p>
              <h2>지금의 맥락</h2>
            </div>
            <span className="live-context-badge">LIVE</span>
          </header>
          <div className="intelligence-section">
            <div className="intelligence-section-title">
              <strong>진행 중인 프로젝트</strong>
              <Link to="/projects">전체</Link>
            </div>
            <div className="focus-list compact">
              {projects.length ? (
                projects.slice(0, 3).map((project) => (
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
                <p className="compact-empty">프로젝트를 추가하면 현재 작업이 표시됩니다.</p>
              )}
            </div>
          </div>
          <div className="intelligence-section suggestion-section">
            <div className="intelligence-section-title">
              <strong>다음 질문 추천</strong>
              <span>내 기록 기반</span>
            </div>
            <div className="suggestion-list">
              {suggestedQuestions.length ? (
                suggestedQuestions.map((suggestion) => (
                  <button type="button" key={suggestion} onClick={() => setQuestion(suggestion)}>
                    <span>↗</span>
                    {suggestion}
                  </button>
                ))
              ) : (
                <p className="compact-empty">지식을 추가하면 이어서 물어볼 질문을 제안합니다.</p>
              )}
            </div>
          </div>
          <div className="intelligence-section recent-flow-section">
            <div className="intelligence-section-title">
              <strong>최근 흐름</strong>
              <span>{records.length}개 지식</span>
            </div>
            <div className="recent-flow-list">
              {recentRecords.map((record) => (
                <Link to={`/knowledge/${record.id}`} key={record.id}>
                  <span>{record.nodeType.label_ko}</span>
                  <strong>{record.title}</strong>
                  <time>{formatDate(record.updated_at)}</time>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <article className="content-card knowledge-landscape constellation-card">
        <header className="focus-card-heading">
          <div>
            <p className="eyebrow">Thought Map</p>
            <h2>생각의 연결</h2>
            <p className="constellation-description">
              질문을 입력하거나 답변을 받으면 관련 지식과 실제 Relation이 활성화됩니다.
            </p>
          </div>
          <Link className="text-action" to="/knowledge">
            지식 관리
          </Link>
        </header>
        <KnowledgeConstellation
          records={records}
          graph={graph}
          focusText={focusText}
          activeSourceIds={activeSourceIds}
        />
      </article>
    </section>
  )
}
