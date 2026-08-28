import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const migration = await readFile(
  resolve(root, 'supabase/migrations/20260828000200_ai_provider_foundation.sql'),
  'utf8',
)
const gateway = await readFile(resolve(root, 'supabase/functions/ai-gateway/index.ts'), 'utf8')
const provider = await readFile(resolve(root, 'supabase/functions/_shared/ai/provider.ts'), 'utf8')
const client = await readFile(resolve(root, 'src/entities/ai/api.ts'), 'utf8')

for (const fragment of [
  'ai_provider_settings',
  'ai_usage_daily',
  'ai_runs',
  'daily_request_limit',
  'daily_input_token_limit',
  'get_ai_status',
  'reserve_ai_request',
  'complete_ai_request',
  'auth.uid()',
  'enable row level security',
  'revoke all',
]) {
  if (!migration.includes(fragment)) throw new Error(`V2 Step 1 DB contract missing: ${fragment}`)
}

for (const fragment of [
  "Deno.env.get('GEMINI_API_KEY')",
  'AI_PROVIDER_NOT_IMPLEMENTED',
  'GeminiProvider',
]) {
  if (!provider.includes(fragment)) throw new Error(`V2 provider contract missing: ${fragment}`)
}

for (const fragment of [
  'client.auth.getUser(token)',
  "body.action !== 'connectivity_test'",
  'MAX_REQUEST_BYTES',
  'APP_ORIGINS',
  "client.rpc('reserve_ai_request'",
  "client.rpc('complete_ai_request'",
]) {
  if (!gateway.includes(fragment)) throw new Error(`V2 gateway security missing: ${fragment}`)
}

if (!client.includes("supabase.functions.invoke<AIConnectivityResult>('ai-gateway'"))
  throw new Error('V2 browser client must call the server-side AI gateway.')

const browserSources = await Promise.all([
  readFile(resolve(root, '.env.example'), 'utf8'),
  readFile(resolve(root, 'src/entities/ai/api.ts'), 'utf8'),
  readFile(resolve(root, 'src/pages/settings/AISettingsPage.tsx'), 'utf8'),
])
if (browserSources.some((source) => source.includes('VITE_GEMINI_API_KEY')))
  throw new Error('Gemini secret must never use a browser-exposed VITE_ variable.')

console.log('V2 Step 1 AI provider, server secret, auth, and free-usage contract passed.')
