import { createClient } from 'npm:@supabase/supabase-js@2.112.4'

import { createAIProvider } from '../_shared/ai/provider.ts'
import type { AIProviderName } from '../_shared/ai/types.ts'

const MAX_REQUEST_BYTES = 16 * 1024
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
  const ranked = new Map<string, KnowledgeSource>()
  for (const response of responses) {
    if (response.error) continue
    for (const row of (response.data ?? []) as KnowledgeSource[]) {
      const key = `${row.item_id}:${row.section_id ?? ''}`
      const previous = ranked.get(key)
      if (!previous || Number(row.score) > Number(previous.score)) ranked.set(key, row)
    }
  }
  if (!ranked.size) {
    const fallback = await client.rpc('search_knowledge', {
      p_query: '',
      p_page: 1,
      p_page_size: 4,
    })
    if (!fallback.error) {
      for (const row of (fallback.data ?? []) as KnowledgeSource[])
        ranked.set(`${row.item_id}:${row.section_id ?? ''}`, row)
    }
  }
  return [...ranked.values()]
    .sort((left, right) => Number(right.score) - Number(left.score))
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

  let body: { action?: unknown; question?: unknown; conversationId?: unknown }
  try {
    body = (await request.json()) as {
      action?: unknown
      question?: unknown
      conversationId?: unknown
    }
  } catch {
    return json(origin, 400, { error: 'INVALID_JSON' })
  }
  if (body.action !== 'connectivity_test' && body.action !== 'chat')
    return json(origin, 400, { error: 'ACTION_NOT_ALLOWED' })

  const { data: statusData, error: statusError } = await client.rpc('get_ai_status')
  if (statusError || !statusData || typeof statusData !== 'object' || Array.isArray(statusData))
    return json(origin, 500, { error: 'AI_STATUS_UNAVAILABLE' })
  const settings = statusData.settings as Record<string, unknown>
  const providerName = settings.provider as AIProviderName
  const model = String(settings.chat_model ?? '')
  let prompt = connectivityPrompt
  let systemInstruction = '당신은 Personal AI Knowledge OS의 안전한 연결 점검 도우미입니다.'
  let maxOutputTokens = 30
  let sources: KnowledgeSource[] = []
  let conversationId: string | null = null
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
    sources = await retrieveKnowledge(client, body.question)
    systemInstruction = [
      '당신은 사용자의 개인 지식에 최적화된 한국어 AI 비서입니다.',
      '제공된 개인 지식을 최우선 근거로 사용하세요.',
      '근거를 사용한 문장 끝에는 [1]처럼 출처 번호를 표시하세요.',
      '근거에 없는 사실은 개인 기록에 있다고 단정하지 말고 일반적 제안임을 분명히 하세요.',
      '답변은 먼저 직접적인 결론을 말하고, 필요한 경우에만 짧은 목록을 사용하세요.',
    ].join(' ')
    prompt = `이전 대화:\n${historyPrompt(history)}\n\n개인 지식:\n${contextPrompt(sources)}\n\n현재 질문:\n${body.question.trim()}`
    maxOutputTokens = 900
  }
  const estimatedTokens = Math.ceil((prompt.length + systemInstruction.length) / 4)
  const { data: reservation, error: reserveError } = await client.rpc('reserve_ai_request', {
    p_provider: providerName,
    p_model: model,
    p_purpose: body.action === 'chat' ? 'chat' : 'connectivity_test',
    p_estimated_input_tokens: estimatedTokens,
  })
  if (reserveError || !reservation || typeof reservation !== 'object' || Array.isArray(reservation))
    return json(origin, 429, { error: reserveError?.message ?? 'AI_LIMIT_REACHED' })
  const runId = String(reservation.run_id)
  const startedAt = performance.now()
  try {
    const provider = createAIProvider(providerName)
    const result = await provider.generateText({
      model,
      systemInstruction,
      prompt,
      maxOutputTokens,
    })
    await client.rpc('complete_ai_request', {
      p_run_id: runId,
      p_status: 'completed',
      p_input_tokens: result.inputTokens,
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
        p_input_tokens: result.inputTokens,
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
    return json(origin, 200, {
      ok: true,
      provider: provider.name,
      model,
      message: result.text.trim(),
      usage: reservation,
    })
  } catch (caught) {
    const code = caught instanceof Error ? caught.message.split(':')[0] : 'AI_PROVIDER_ERROR'
    console.error('AI gateway provider failure', code)
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
