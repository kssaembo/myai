import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const migration = await readFile(
  resolve(root, 'supabase/migrations/20260829000100_ai_conversations.sql'),
  'utf8',
)
const gateway = await readFile(resolve(root, 'supabase/functions/ai-gateway/index.ts'), 'utf8')
const client = await readFile(resolve(root, 'src/entities/ai/api.ts'), 'utf8')
const dashboard = await readFile(resolve(root, 'src/features/dashboard/DashboardPage.tsx'), 'utf8')

for (const fragment of [
  'ai_conversations',
  'ai_messages',
  'ai_message_sources',
  'enable row level security',
  'save_ai_exchange',
  'auth.uid()',
  "chat_model set default 'gemini-3.7-flash'",
  'revoke all',
]) {
  if (!migration.includes(fragment)) throw new Error(`V2 Step 2 DB contract missing: ${fragment}`)
}

if (/grant\s+insert[^;]+ai_messages/is.test(migration))
  throw new Error('Browser clients must not insert AI messages directly.')

for (const fragment of [
  "body.action !== 'chat'",
  "client.rpc('search_knowledge'",
  "client.rpc('save_ai_exchange'",
  "from('ai_messages')",
  'questionKeywords',
  'sources.map',
  "p_purpose: body.action === 'chat' ? 'chat' : 'connectivity_test'",
]) {
  if (!gateway.includes(fragment))
    throw new Error(`V2 Step 2 gateway contract missing: ${fragment}`)
}

for (const fragment of [
  'listAIConversations',
  'listAIMessages',
  'sendAIMessage',
  'deleteAIConversation',
]) {
  if (!client.includes(fragment)) throw new Error(`V2 Step 2 client contract missing: ${fragment}`)
}

for (const fragment of [
  '오늘, 무엇을 함께 생각할까요?',
  'assistant-messages',
  '진행 중인 프로젝트',
  '생각의 연결',
  'message.sources',
]) {
  if (!dashboard.includes(fragment)) throw new Error(`V2 Step 2 dashboard missing: ${fragment}`)
}

console.log('V2 Step 2 grounded conversation, persistence, RLS, and dashboard contract passed.')
