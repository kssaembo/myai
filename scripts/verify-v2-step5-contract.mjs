import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const migration = await readFile(
  resolve(root, 'supabase/migrations/20260830000100_personal_briefings.sql'),
  'utf8',
)
const gateway = await readFile(resolve(root, 'supabase/functions/ai-gateway/index.ts'), 'utf8')
const api = await readFile(resolve(root, 'src/entities/ai/api.ts'), 'utf8')
const dashboard = await readFile(resolve(root, 'src/features/dashboard/DashboardPage.tsx'), 'utf8')

for (const fragment of [
  'create table public.ai_briefings',
  'ai_briefings_owner_select',
  "p_purpose = 'briefing'",
  'AI_DAILY_BRIEFING_LIMIT',
  'save_ai_briefing',
]) {
  if (!migration.includes(fragment))
    throw new Error(`Briefing database contract missing: ${fragment}`)
}

for (const fragment of [
  "body.action === 'briefing'",
  "responseMimeType = 'application/json'",
  'parseBriefing',
  'sourceIds',
  "? 'briefing'",
]) {
  if (!gateway.includes(fragment)) throw new Error(`Briefing gateway contract missing: ${fragment}`)
}

for (const fragment of ['getTodayBriefing', 'generateBriefing', "action: 'briefing'"]) {
  if (!api.includes(fragment)) throw new Error(`Briefing client contract missing: ${fragment}`)
}

for (const fragment of [
  'AI 브리핑',
  'briefing-summary',
  'briefing-recommendation',
  'briefing-sources',
  '새로 분석',
]) {
  if (!dashboard.includes(fragment))
    throw new Error(`Briefing dashboard contract missing: ${fragment}`)
}

console.log('V2 personalized briefing, caching, citations, and daily guard contract passed.')
