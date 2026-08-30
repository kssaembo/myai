import { createClient } from 'npm:@supabase/supabase-js@2.112.4'

import { createAIProvider } from '../_shared/ai/provider.ts'
import type { AIProviderName } from '../_shared/ai/types.ts'

const MAX_REQUEST_BYTES = 16 * 1024
const EMBEDDING_DIMENSIONS = 768
const EMBEDDING_BATCH_SIZE = 12
const connectivityPrompt = '한국어로 정확히 "Gemini 연결 정상"이라고만 답하세요.'
const questionStopWords = new Set([
  '그리고',
  '그러면',
  '그런데',
  '대한',
  '대해서',
  '무엇',
  '어떻게',
  '있는',
  '있어',
  '알려줘',
  '설명해줘',
  '정리해줘',
  '해줘',
  '나는',
  '내가',
  '나의',
  '우리',
  '관련',
])

interface KnowledgeSource {
  item_id: string
  section_id: string | null
  title: string
  node_type_label: string
  heading_path: string[]
  snippet: string
  score: number
}

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

interface EmbeddingStatus {
  model: string
  dimensions: number
  eligible_count: number
  embedded_count: number
  pending_count: number
}

interface PendingEmbeddingSection {
  section_id: string
  title: string
  heading: string | null
  content: string
  token_estimate: number
}

interface BriefingKnowledgeItem {
  id: string
  title: string
  summary: string | null
  status: string
  importance: number
  updated_at: string
  node_types: { key: string; label_ko: string } | { key: string; label_ko: string }[]
}

interface BriefingRecommendation {
  kind: 'project' | 'idea' | 'issue'
  title: string
  detail: string
  question: string
  sourceIds: string[]
}

interface BriefingPayload {
  summary: string
  recommendations: BriefingRecommendation[]
}

function allowedOrigin(request: Request) {
  const origin = request.headers.get('origin') ?? ''
  const allowed = (Deno.env.get('APP_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return !origin || allowed.includes(origin) ? origin : null
}

function headers(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
  }
}

function json(origin: string, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) })
}

function logStage(requestId: string, action: string, stage: string) {
  console.log('AI gateway stage', { requestId, action, stage })
}

function findPublishableKey(value: unknown): string | null {
  if (typeof value === 'string' && (value.startsWith('sb_publishable_') || value.startsWith('eyJ')))
    return value
  if (Array.isArray(value)) {
    for (const entry of value) {
      const key = findPublishableKey(entry)
      if (key) return key
    }
  }
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) {
      const key = findPublishableKey(entry)
      if (key) return key
    }
  }
  return null
}

function supabasePublishableKey() {
  const legacyKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (legacyKey) return legacyKey
  const currentKeys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
  if (!currentKeys) return null
  try {
    return findPublishableKey(JSON.parse(currentKeys))
  } catch {
    return null
  }
}

function questionKeywords(question: string) {
  return [...new Set(question.toLocaleLowerCase().match(/[가-힣a-z0-9_-]{2,}/g) ?? [])]
    .filter((value) => !questionStopWords.has(value))
    .sort((left, right) => right.length - left.length)
    .slice(0, 5)
}

async function retrieveKnowledge(
  client: ReturnType<typeof createClient>,
  question: string,
  semanticSources: KnowledgeSource[],
): Promise<KnowledgeSource[]> {
  const queries = [question.trim(), ...questionKeywords(question)].filter(Boolean)
  const responses = await Promise.all(
    queries.map((query) =>
      client.rpc('search_knowledge', {
        p_query: query,
        p_page: 1,
        p_page_size: 6,
      }),
    ),
  )
  const keywordSources = new Map<string, KnowledgeSource>()
  for (const response of responses) {
    if (response.error) continue
    for (const row of (response.data ?? []) as KnowledgeSource[]) {
      const key = `${row.item_id}:${row.section_id ?? ''}`
      const previous = keywordSources.get(key)
      if (!previous || Number(row.score) > Number(previous.score)) keywordSources.set(key, row)
    }
  }
  if (!keywordSources.size && !semanticSources.length) {
    const fallback = await client.rpc('search_knowledge', {
      p_query: '',
      p_page: 1,
      p_page_size: 4,
    })
    if (!fallback.error) {
      for (const row of (fallback.data ?? []) as KnowledgeSource[])
        keywordSources.set(`${row.item_id}:${row.section_id ?? ''}`, row)
    }
  }
  const fused = new Map<string, { source: KnowledgeSource; score: number }>()
  const addRanked = (sources: KnowledgeSource[], weight: number) => {
    sources.forEach((source, index) => {
      const key = `${source.item_id}:${source.section_id ?? ''}`
      const previous = fused.get(key)
      fused.set(key, {
        source: previous?.source ?? source,
        score: (previous?.score ?? 0) + weight / (40 + index + 1),
      })
    })
  }
  addRanked(
    [...keywordSources.values()].sort((left, right) => Number(right.score) - Number(left.score)),
    1,
  )
  addRanked(semanticSources, 1.25)
  return [...fused.values()]
    .sort((left, right) => right.score - left.score)
    .map(({ source, score }) => ({ ...source, score }))
    .slice(0, 6)
}

function contextPrompt(sources: KnowledgeSource[]) {
  if (!sources.length) return '검색된 개인 지식이 없습니다.'
  return sources
    .map((source, index) => {
      const heading = source.heading_path?.length ? ` / ${source.heading_path.join(' > ')}` : ''
      return `[${index + 1}] ${source.title}${heading}\n${source.snippet.slice(0, 1200)}`
    })
    .join('\n\n')
}

function historyPrompt(messages: ConversationMessage[]) {
  if (!messages.length) return '이전 대화 없음'
  return messages
    .map((message) => `${message.role === 'user' ? '사용자' : '비서'}: ${message.content}`)
    .join('\n')
}

function parseBriefing(text: string, availableIds: Set<string>): BriefingPayload {
  const normalized = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  let candidate: unknown
  try {
    candidate = JSON.parse(normalized)
  } catch {
    throw new Error('AI_BRIEFING_JSON_INVALID')
  }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate))
    throw new Error('AI_BRIEFING_JSON_INVALID')
  const input = candidate as Record<string, unknown>
  const summary = typeof input.summary === 'string' ? input.summary.trim().slice(0, 1200) : ''
  if (!summary) throw new Error('AI_BRIEFING_SUMMARY_INVALID')
  const recommendations = Array.isArray(input.recommendations)
    ? input.recommendations
        .slice(0, 3)
        .map((entry): BriefingRecommendation | null => {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
          const value = entry as Record<string, unknown>
          const kind = ['project', 'idea', 'issue'].includes(String(value.kind))
            ? (String(value.kind) as BriefingRecommendation['kind'])
            : 'idea'
          const title = typeof value.title === 'string' ? value.title.trim().slice(0, 120) : ''
          const detail = typeof value.detail === 'string' ? value.detail.trim().slice(0, 360) : ''
          const question =
            typeof value.question === 'string' ? value.question.trim().slice(0, 300) : ''
          const sourceIds = Array.isArray(value.sourceIds)
            ? [...new Set(value.sourceIds.filter((id): id is string => typeof id === 'string'))]
                .filter((id) => availableIds.has(id))
                .slice(0, 3)
            : []
          return title && detail && question && sourceIds.length
            ? { kind, title, detail, question, sourceIds }
            : null
        })
        .filter((value): value is BriefingRecommendation => value !== null)
    : []
  if (!recommendations.length) throw new Error('AI_BRIEFING_RECOMMENDATIONS_INVALID')
  return { summary, recommendations }
}

function briefingRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    briefingDate: row.briefing_date,
    model: row.model,
    summary: row.summary,
    recommendations: row.recommendations,
    sourceItems: row.source_items,
    generatedAt: row.generated_at,
  }
}

Deno.serve(async (request) => {
  const origin = allowedOrigin(request)
  if (origin === null) return new Response('Origin forbidden', { status: 403 })
  if (request.method === 'OPTIONS') return new Response('ok', { headers: headers(origin) })
  if (request.method !== 'POST') return json(origin, 405, { error: 'METHOD_NOT_ALLOWED' })
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_REQUEST_BYTES) return json(origin, 413, { error: 'REQUEST_TOO_LARGE' })

  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer '))
    return json(origin, 401, { error: 'AUTHENTICATION_REQUIRED' })
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const publishableKey = supabasePublishableKey()
  if (!supabaseUrl || !publishableKey) return json(origin, 500, { error: 'SUPABASE_ENV_MISSING' })
  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const token = authorization.slice('Bearer '.length)
  const { data: userData, error: userError } = await client.auth.getUser(token)
  if (userError || !userData.user) return json(origin, 401, { error: 'INVALID_SESSION' })

  let body: { action?: unknown; question?: unknown; conversationId?: unknown; force?: unknown }
  try {
    body = (await request.json()) as {
      action?: unknown
      question?: unknown
      conversationId?: unknown
      force?: unknown
    }
  } catch {
    return json(origin, 400, { error: 'INVALID_JSON' })
  }
  if (
    body.action !== 'connectivity_test' &&
    body.action !== 'chat' &&
    body.action !== 'embed_pending' &&
    body.action !== 'briefing'
  )
    return json(origin, 400, { error: 'ACTION_NOT_ALLOWED' })
  const action = body.action
  const requestId = crypto.randomUUID().slice(0, 8)
  logStage(requestId, action, 'request_accepted')

  const { data: statusData, error: statusError } = await client.rpc('get_ai_status')
  if (statusError || !statusData || typeof statusData !== 'object' || Array.isArray(statusData))
    return json(origin, 500, { error: 'AI_STATUS_UNAVAILABLE' })
  const settings = statusData.settings as Record<string, unknown>
  const providerName = settings.provider as AIProviderName
  const model = String(settings.chat_model ?? '')
  const embeddingModel = String(settings.embedding_model ?? '')
  const provider = createAIProvider(providerName)
  logStage(requestId, action, 'status_loaded')

  if (body.action === 'briefing' && body.force !== true) {
    const cached = await client
      .from('ai_briefings')
      .select('id,briefing_date,model,summary,recommendations,source_items,generated_at')
      .eq('briefing_date', new Date().toISOString().slice(0, 10))
      .maybeSingle()
    if (!cached.error && cached.data)
      return json(origin, 200, { ok: true, cached: true, ...briefingRow(cached.data) })
  }

  if (body.action === 'embed_pending') {
    logStage(requestId, action, 'embedding_queue_started')
    const pendingResult = await client.rpc('get_pending_embedding_sections', {
      p_limit: EMBEDDING_BATCH_SIZE,
    })
    if (pendingResult.error) return json(origin, 500, { error: 'EMBEDDING_QUEUE_UNAVAILABLE' })
    const pending = (pendingResult.data ?? []) as PendingEmbeddingSection[]
    logStage(requestId, action, 'embedding_queue_completed')
    if (!pending.length) {
      const current = await client.rpc('get_embedding_status')
      return json(origin, 200, { ok: true, processed: 0, status: current.data })
    }
    const texts = pending.map((section) =>
      [`문서: ${section.title}`, section.heading ? `구역: ${section.heading}` : '', section.content]
        .filter(Boolean)
        .join('\n'),
    )
    const estimatedTokens = pending.reduce(
      (sum, section) => sum + Math.max(section.token_estimate ?? 0, 1),
      0,
    )
    const reservationResult = await client.rpc('reserve_ai_request', {
      p_provider: providerName,
      p_model: embeddingModel,
      p_purpose: 'embed',
      p_estimated_input_tokens: estimatedTokens,
    })
    if (reservationResult.error || !reservationResult.data)
      return json(origin, 429, {
        error: reservationResult.error?.message ?? 'AI_LIMIT_REACHED',
      })
    const reservation = reservationResult.data as Record<string, unknown>
    const runId = String(reservation.run_id)
    const startedAt = performance.now()
    try {
      logStage(requestId, action, 'provider_request_started')
      const result = await provider.embedTexts({
        model: embeddingModel,
        texts,
        taskType: 'RETRIEVAL_DOCUMENT',
        dimensions: EMBEDDING_DIMENSIONS,
      })
      logStage(requestId, action, 'provider_request_completed')
      const saved = await client.rpc('save_section_embeddings', {
        p_model: embeddingModel,
        p_embeddings: pending.map((section, index) => ({
          section_id: section.section_id,
          embedding: result.embeddings[index],
        })),
      })
      if (saved.error) throw new Error('EMBEDDING_SAVE_FAILED')
      await client.rpc('complete_ai_request', {
        p_run_id: runId,
        p_status: 'completed',
        p_input_tokens: result.inputTokens,
        p_output_tokens: 0,
        p_duration_ms: Math.round(performance.now() - startedAt),
        p_error_code: null,
      })
      const current = await client.rpc('get_embedding_status')
      return json(origin, 200, {
        ok: true,
        processed: Number(saved.data ?? 0),
        status: current.data,
        usage: reservation,
      })
    } catch (caught) {
      const code = caught instanceof Error ? caught.message.split(':')[0] : 'EMBEDDING_FAILED'
      console.error('AI gateway failure', { requestId, action, code })
      await client.rpc('complete_ai_request', {
        p_run_id: runId,
        p_status: 'failed',
        p_input_tokens: 0,
        p_output_tokens: 0,
        p_duration_ms: Math.round(performance.now() - startedAt),
        p_error_code: code,
      })
      return json(origin, 502, { error: code })
    }
  }

  let prompt = connectivityPrompt
  let systemInstruction = '당신은 Personal AI Knowledge OS의 안전한 연결 점검 도우미입니다.'
  let maxOutputTokens = 30
  let sources: KnowledgeSource[] = []
  let semanticInputTokens = 0
  let conversationId: string | null = null
  let briefingItems: BriefingKnowledgeItem[] = []
  let responseMimeType: 'application/json' | undefined
  if (body.action === 'chat') {
    if (typeof body.question !== 'string' || body.question.trim().length < 1)
      return json(origin, 400, { error: 'QUESTION_REQUIRED' })
    if (body.question.trim().length > 4000) return json(origin, 400, { error: 'QUESTION_TOO_LONG' })
    if (body.conversationId !== undefined && body.conversationId !== null) {
      if (typeof body.conversationId !== 'string')
        return json(origin, 400, { error: 'CONVERSATION_ID_INVALID' })
      conversationId = body.conversationId
    }
    let history: ConversationMessage[] = []
    if (conversationId) {
      const conversation = await client
        .from('ai_conversations')
        .select('id')
        .eq('id', conversationId)
        .maybeSingle()
      if (conversation.error || !conversation.data)
        return json(origin, 404, { error: 'CONVERSATION_NOT_FOUND' })
      const historyResult = await client
        .from('ai_messages')
        .select('role,content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(8)
      if (!historyResult.error) history = (historyResult.data as ConversationMessage[]).reverse()
    }
    let semanticSources: KnowledgeSource[] = []
    const embeddingStatusResult = await client.rpc('get_embedding_status')
    const embeddingStatus = embeddingStatusResult.data as EmbeddingStatus | null
    if (!embeddingStatusResult.error && Number(embeddingStatus?.embedded_count ?? 0) > 0) {
      try {
        logStage(requestId, action, 'semantic_retrieval_started')
        const queryEmbedding = await provider.embedTexts({
          model: embeddingModel,
          texts: [body.question.trim()],
          taskType: 'RETRIEVAL_QUERY',
          dimensions: EMBEDDING_DIMENSIONS,
        })
        semanticInputTokens = queryEmbedding.inputTokens
        const semanticResult = await client.rpc('match_document_sections', {
          p_query_embedding: `[${queryEmbedding.embeddings[0].join(',')}]`,
          p_match_count: 8,
          p_min_similarity: 0.25,
        })
        if (!semanticResult.error)
          semanticSources = (semanticResult.data ?? []) as KnowledgeSource[]
        logStage(requestId, action, 'semantic_retrieval_completed')
      } catch (caught) {
        console.error('Semantic retrieval fallback', {
          requestId,
          action,
          code: caught instanceof Error ? caught.message.split(':')[0] : 'UNKNOWN',
        })
      }
    }
    logStage(requestId, action, 'knowledge_retrieval_started')
    sources = await retrieveKnowledge(client, body.question, semanticSources)
    logStage(requestId, action, 'knowledge_retrieval_completed')
    systemInstruction = [
      '당신은 사용자의 개인 지식에 최적화된 한국어 AI 비서입니다.',
      '제공된 개인 지식을 최우선 근거로 사용하세요.',
      '근거를 사용한 문장 끝에는 [1]처럼 출처 번호를 표시하세요.',
      '근거에 없는 사실은 개인 기록에 있다고 단정하지 말고 일반적 제안임을 분명히 하세요.',
      '답변은 먼저 직접적인 결론을 말하고, 필요한 경우에만 짧은 목록을 사용하세요.',
    ].join(' ')
    prompt = `이전 대화:\n${historyPrompt(history)}\n\n개인 지식:\n${contextPrompt(sources)}\n\n현재 질문:\n${body.question.trim()}`
    maxOutputTokens = 900
  } else if (body.action === 'briefing') {
    const knowledgeResult = await client
      .from('knowledge_items')
      .select('id,title,summary,status,importance,updated_at,node_types!inner(key,label_ko)')
      .is('deleted_at', null)
      .neq('status', 'archived')
      .order('importance', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(12)
    if (knowledgeResult.error)
      return json(origin, 500, { error: 'AI_BRIEFING_CONTEXT_UNAVAILABLE' })
    briefingItems = (knowledgeResult.data ?? []) as unknown as BriefingKnowledgeItem[]
    if (!briefingItems.length) return json(origin, 422, { error: 'AI_BRIEFING_KNOWLEDGE_REQUIRED' })
    const context = briefingItems.map((item) => {
      const nodeType = Array.isArray(item.node_types) ? item.node_types[0] : item.node_types
      return {
        id: item.id,
        type: nodeType?.key ?? 'knowledge',
        title: item.title,
        summary: item.summary?.slice(0, 500) ?? '',
        status: item.status,
        importance: item.importance,
        updatedAt: item.updated_at,
      }
    })
    systemInstruction = [
      '당신은 사용자의 개인 지식만을 분석하는 한국어 개인 비서입니다.',
      '제공된 기록에 없는 사실을 만들지 마세요.',
      '오늘 주목할 맥락을 한 문장으로 요약하고 실행 가치가 높은 추천을 최대 3개 작성하세요.',
      '각 추천은 반드시 실제 근거 ID를 1개 이상 sourceIds에 포함해야 합니다.',
      '출력은 마크다운 없이 지정된 JSON 객체 하나만 반환하세요.',
    ].join(' ')
    prompt = [
      '개인 기록:',
      JSON.stringify(context),
      '',
      '출력 형식:',
      '{"summary":"한 문장","recommendations":[{"kind":"project|idea|issue","title":"짧은 제목","detail":"추천 이유와 다음 행동","question":"AI에게 이어서 물어볼 질문","sourceIds":["실제 ID"]}]}',
    ].join('\n')
    maxOutputTokens = 700
    responseMimeType = 'application/json'
  }
  const estimatedTokens =
    Math.ceil((prompt.length + systemInstruction.length) / 4) + semanticInputTokens
  const { data: reservation, error: reserveError } = await client.rpc('reserve_ai_request', {
    p_provider: providerName,
    p_model: model,
    p_purpose:
      body.action === 'chat'
        ? 'chat'
        : body.action === 'briefing'
          ? 'briefing'
          : 'connectivity_test',
    p_estimated_input_tokens: estimatedTokens,
  })
  if (reserveError || !reservation || typeof reservation !== 'object' || Array.isArray(reservation))
    return json(origin, 429, { error: reserveError?.message ?? 'AI_LIMIT_REACHED' })
  const runId = String(reservation.run_id)
  const startedAt = performance.now()
  try {
    logStage(requestId, action, 'provider_request_started')
    const result = await provider.generateText({
      model,
      systemInstruction,
      prompt,
      maxOutputTokens,
      responseMimeType,
    })
    logStage(requestId, action, 'provider_request_completed')
    await client.rpc('complete_ai_request', {
      p_run_id: runId,
      p_status: 'completed',
      p_input_tokens: result.inputTokens + semanticInputTokens,
      p_output_tokens: result.outputTokens,
      p_duration_ms: Math.round(performance.now() - startedAt),
      p_error_code: null,
    })
    if (body.action === 'chat') {
      const saved = await client.rpc('save_ai_exchange', {
        p_conversation_id: conversationId,
        p_question: String(body.question).trim(),
        p_answer: result.text.trim(),
        p_model: model,
        p_input_tokens: result.inputTokens + semanticInputTokens,
        p_output_tokens: result.outputTokens,
        p_sources: sources.map((source, index) => ({
          item_id: source.item_id,
          section_id: source.section_id,
          rank: index + 1,
          snippet: source.snippet,
        })),
      })
      if (saved.error || !saved.data)
        return json(origin, 500, { error: 'AI_CONVERSATION_SAVE_FAILED' })
      const savedIds = saved.data as Record<string, unknown>
      return json(origin, 200, {
        ok: true,
        provider: provider.name,
        model,
        message: result.text.trim(),
        conversationId: savedIds.conversation_id,
        messageId: savedIds.assistant_message_id,
        sources: sources.map((source, index) => ({
          rank: index + 1,
          itemId: source.item_id,
          sectionId: source.section_id,
          title: source.title,
          headingPath: source.heading_path,
          snippet: source.snippet,
        })),
        usage: reservation,
      })
    }
    if (body.action === 'briefing') {
      const parsed = parseBriefing(result.text, new Set(briefingItems.map((item) => item.id)))
      const referencedIds = [...new Set(parsed.recommendations.flatMap((item) => item.sourceIds))]
      const sourceItems = briefingItems
        .filter((item) => referencedIds.includes(item.id))
        .map((item) => ({ id: item.id, title: item.title }))
      const saved = await client.rpc('save_ai_briefing', {
        p_model: model,
        p_summary: parsed.summary,
        p_recommendations: parsed.recommendations,
        p_source_items: sourceItems,
      })
      if (saved.error || !saved.data) return json(origin, 500, { error: 'AI_BRIEFING_SAVE_FAILED' })
      return json(origin, 200, { ok: true, cached: false, ...saved.data })
    }
    return json(origin, 200, {
      ok: true,
      provider: provider.name,
      model,
      message: result.text.trim(),
      usage: reservation,
    })
  } catch (caught) {
    const code = caught instanceof Error ? caught.message.split(':')[0] : 'AI_PROVIDER_ERROR'
    console.error('AI gateway failure', { requestId, action, code })
    await client.rpc('complete_ai_request', {
      p_run_id: runId,
      p_status: 'failed',
      p_input_tokens: 0,
      p_output_tokens: 0,
      p_duration_ms: Math.round(performance.now() - startedAt),
      p_error_code: code,
    })
    return json(origin, 502, { error: code })
  }
})
