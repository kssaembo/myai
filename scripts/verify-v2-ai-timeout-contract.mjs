import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const gateway = await readFile(resolve(root, 'supabase/functions/ai-gateway/index.ts'), 'utf8')
const gemini = await readFile(resolve(root, 'supabase/functions/_shared/ai/gemini.ts'), 'utf8')
const client = await readFile(resolve(root, 'src/entities/ai/api.ts'), 'utf8')
const display = await readFile(resolve(root, 'src/shared/lib/display.ts'), 'utf8')
const dashboard = await readFile(resolve(root, 'src/features/dashboard/DashboardPage.tsx'), 'utf8')

for (const fragment of [
  'GEMINI_TIMEOUT_MS = 25_000',
  'new AbortController()',
  "'GEMINI_TIMEOUT'",
  "'GEMINI_EMBED_TIMEOUT'",
]) {
  if (!gemini.includes(fragment)) throw new Error(`Gemini timeout contract missing: ${fragment}`)
}

for (const fragment of [
  'AI_GATEWAY_TIMEOUT_MS = 35_000',
  "new Error('AI_GATEWAY_TIMEOUT')",
  'throwIfFunctionError',
]) {
  if (!client.includes(fragment)) throw new Error(`Client timeout contract missing: ${fragment}`)
}

for (const fragment of [
  "'request_accepted'",
  "'status_loaded'",
  "'provider_request_started'",
  "'provider_request_completed'",
  "console.error('AI gateway failure', { requestId, action, code })",
]) {
  if (!gateway.includes(fragment)) throw new Error(`Gateway log contract missing: ${fragment}`)
}

if (gateway.includes("console.log('AI gateway stage', { requestId, action, stage, prompt"))
  throw new Error('Gateway logs must never include prompts.')
if (!display.includes('AI_GATEWAY_TIMEOUT') || !display.includes('GEMINI_TIMEOUT'))
  throw new Error('User-facing timeout guidance is missing.')
if (!dashboard.includes('개인 지식과 Gemini 답변을 준비하는 중'))
  throw new Error('Dashboard pending copy must explain the combined answer path.')

console.log('V2 AI Gateway timeout, safe logging, and retry UX contract passed.')
