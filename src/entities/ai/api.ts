import { supabase } from '@/shared/lib/supabase'

const AI_GATEWAY_TIMEOUT_MS = 35_000

export interface AIStatus {
  settings: {
    provider: string
    chat_model: string
    embedding_model: string
    daily_request_limit: number
    daily_input_token_limit: number
    is_enabled: boolean
  }
  usage: {
    usage_date: string
    request_count: number
    input_tokens: number
    output_tokens: number
  }
}

export interface AIConnectivityResult {
  ok: boolean
  provider: string
  model: string
  message: string
}

export interface EmbeddingStatus {
  model: string
  dimensions: number
  eligible_count: number
  embedded_count: number
  pending_count: number
}

export interface EmbeddingRunResult {
  ok: boolean
  processed: number
  status: EmbeddingStatus
}

export interface AIConversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface AIMessageSource {
  id: string
  itemId: string
  sectionId: string | null
  rank: number
  snippet: string
  title: string
}

export interface AIMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  model: string | null
  created_at: string
  sources: AIMessageSource[]
}

export interface AIChatResult {
  ok: boolean
  provider: string
  model: string
  message: string
  conversationId: string
  messageId: string
  sources: {
    rank: number
    itemId: string
    sectionId: string | null
    title: string
    headingPath: string[]
    snippet: string
  }[]
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

async function throwIfFunctionError(error: { message: string; context?: unknown } | null) {
  if (!error) return
  if (error.context instanceof Response) {
    try {
      const payload = (await error.context.clone().json()) as { error?: unknown }
      if (typeof payload.error === 'string') throw new Error(payload.error)
    } catch (caught) {
      if (caught instanceof Error && caught.message !== 'Unexpected end of JSON input') throw caught
    }
  }
  throw new Error(error.message)
}

async function invokeAIGateway<T>(body: Record<string, unknown>) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return (await Promise.race([
      supabase.functions.invoke<T>('ai-gateway', { body }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('AI_GATEWAY_TIMEOUT')), AI_GATEWAY_TIMEOUT_MS)
      }),
    ])) as unknown as { data: T | null; error: { message: string } | null }
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export async function getAIStatus() {
  const { data, error } = await supabase.rpc('get_ai_status')
  throwIfError(error)
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('AI_STATUS_INVALID')
  return data as unknown as AIStatus
}

export async function testAIConnection() {
  const response = await invokeAIGateway<AIConnectivityResult>({ action: 'connectivity_test' })
  await throwIfFunctionError(response.error)
  if (!response.data?.ok) throw new Error('AI_CONNECTIVITY_TEST_FAILED')
  return response.data
}

export async function getEmbeddingStatus() {
  const { data, error } = await supabase.rpc('get_embedding_status')
  throwIfError(error)
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('EMBEDDING_STATUS_INVALID')
  return data as unknown as EmbeddingStatus
}

export async function embedPendingSections() {
  const response = await invokeAIGateway<EmbeddingRunResult>({ action: 'embed_pending' })
  await throwIfFunctionError(response.error)
  if (!response.data?.ok) throw new Error('EMBEDDING_RUN_FAILED')
  return response.data
}

export async function listAIConversations() {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('id,title,created_at,updated_at')
    .order('updated_at', { ascending: false })
    .limit(20)
  throwIfError(error)
  return (data ?? []) as AIConversation[]
}

export async function listAIMessages(conversationId: string) {
  const { data: messages, error: messageError } = await supabase
    .from('ai_messages')
    .select('id,conversation_id,role,content,model,created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  throwIfError(messageError)
  const assistantIds = (messages ?? [])
    .filter((message) => message.role === 'assistant')
    .map((message) => message.id)
  if (!assistantIds.length)
    return (messages ?? []).map((message) => ({
      ...message,
      sources: [],
    })) as AIMessage[]

  const { data: sources, error: sourceError } = await supabase
    .from('ai_message_sources')
    .select('id,message_id,item_id,section_id,rank,snippet')
    .in('message_id', assistantIds)
    .order('rank', { ascending: true })
  throwIfError(sourceError)
  const itemIds = [...new Set((sources ?? []).map((source) => source.item_id))]
  const { data: items, error: itemError } = itemIds.length
    ? await supabase.from('knowledge_items').select('id,title').in('id', itemIds)
    : { data: [], error: null }
  throwIfError(itemError)
  const titles = new Map((items ?? []).map((item) => [item.id, item.title]))
  return (messages ?? []).map((message) => ({
    ...message,
    sources: (sources ?? [])
      .filter((source) => source.message_id === message.id)
      .map((source) => ({
        id: source.id,
        itemId: source.item_id,
        sectionId: source.section_id,
        rank: source.rank,
        snippet: source.snippet,
        title: titles.get(source.item_id) ?? 'Knowledge',
      })),
  })) as AIMessage[]
}

export async function sendAIMessage(question: string, conversationId: string | null) {
  const response = await invokeAIGateway<AIChatResult>({ action: 'chat', question, conversationId })
  await throwIfFunctionError(response.error)
  if (!response.data?.ok) throw new Error('AI_CHAT_FAILED')
  return response.data
}

export async function deleteAIConversation(conversationId: string) {
  const { error } = await supabase.from('ai_conversations').delete().eq('id', conversationId)
  throwIfError(error)
}
