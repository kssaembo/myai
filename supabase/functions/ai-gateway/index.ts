import { createClient } from 'npm:@supabase/supabase-js@2.112.4'

import { createAIProvider } from '../_shared/ai/provider.ts'
import type { AIProviderName } from '../_shared/ai/types.ts'

const MAX_REQUEST_BYTES = 8 * 1024
const connectivityPrompt = '한국어로 정확히 "Gemini 연결 정상"이라고만 답하세요.'

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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) return json(origin, 500, { error: 'SUPABASE_ENV_MISSING' })
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const token = authorization.slice('Bearer '.length)
  const { data: userData, error: userError } = await client.auth.getUser(token)
  if (userError || !userData.user) return json(origin, 401, { error: 'INVALID_SESSION' })

  let body: { action?: unknown }
  try {
    body = (await request.json()) as { action?: unknown }
  } catch {
    return json(origin, 400, { error: 'INVALID_JSON' })
  }
  if (body.action !== 'connectivity_test') return json(origin, 400, { error: 'ACTION_NOT_ALLOWED' })

  const { data: statusData, error: statusError } = await client.rpc('get_ai_status')
  if (statusError || !statusData || typeof statusData !== 'object' || Array.isArray(statusData))
    return json(origin, 500, { error: 'AI_STATUS_UNAVAILABLE' })
  const settings = statusData.settings as Record<string, unknown>
  const providerName = settings.provider as AIProviderName
  const model = String(settings.chat_model ?? '')
  const estimatedTokens = Math.ceil(connectivityPrompt.length / 4)
  const { data: reservation, error: reserveError } = await client.rpc('reserve_ai_request', {
    p_provider: providerName,
    p_model: model,
    p_purpose: 'connectivity_test',
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
      systemInstruction: '당신은 Personal AI Knowledge OS의 안전한 연결 점검 도우미입니다.',
      prompt: connectivityPrompt,
      maxOutputTokens: 30,
    })
    await client.rpc('complete_ai_request', {
      p_run_id: runId,
      p_status: 'completed',
      p_input_tokens: result.inputTokens,
      p_output_tokens: result.outputTokens,
      p_duration_ms: Math.round(performance.now() - startedAt),
      p_error_code: null,
    })
    return json(origin, 200, {
      ok: true,
      provider: provider.name,
      model,
      message: result.text.trim(),
      usage: reservation,
    })
  } catch (caught) {
    const code = caught instanceof Error ? caught.message.split(':')[0] : 'AI_PROVIDER_ERROR'
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
