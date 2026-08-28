import { supabase } from '@/shared/lib/supabase'

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

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function getAIStatus() {
  const { data, error } = await supabase.rpc('get_ai_status')
  throwIfError(error)
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('AI_STATUS_INVALID')
  return data as unknown as AIStatus
}

export async function testAIConnection() {
  const response = (await supabase.functions.invoke<AIConnectivityResult>('ai-gateway', {
    body: { action: 'connectivity_test' },
  })) as unknown as { data: AIConnectivityResult | null; error: { message: string } | null }
  throwIfError(response.error)
  if (!response.data?.ok) throw new Error('AI_CONNECTIVITY_TEST_FAILED')
  return response.data
}
