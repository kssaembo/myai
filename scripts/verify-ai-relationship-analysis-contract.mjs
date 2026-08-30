import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const migration = await readFile(
  resolve(root, 'supabase/migrations/20260830000300_ai_relationship_analysis.sql'),
  'utf8',
)
const gateway = await readFile(resolve(root, 'supabase/functions/ai-gateway/index.ts'), 'utf8')
const api = await readFile(resolve(root, 'src/entities/visual-analysis/api.ts'), 'utf8')
const dashboard = await readFile(resolve(root, 'src/features/dashboard/DashboardPage.tsx'), 'utf8')

for (const fragment of [
  'get_relationship_analysis_context',
  'begin_visual_relationship_analysis',
  'complete_visual_relationship_analysis',
  'fail_visual_relationship_analysis',
  'review_visual_insight',
  'AI_DAILY_RELATIONSHIP_ANALYSIS_LIMIT',
  'document.ai_allowed',
  'document.active_version_id = evidence.version_id',
  'VISUAL_INSIGHT_MULTI_PROJECT_EVIDENCE_REQUIRED',
  "'relationship_analysis'",
]) {
  if (!migration.includes(fragment))
    throw new Error(`AI relationship database contract missing: ${fragment}`)
}

for (const fragment of [
  "body.action === 'relationship_analysis'",
  'parseRelationshipInsights',
  'visual-relations-v1',
  'sourceProjects',
  'coveredProjects.size < 2',
  "responseMimeType = 'application/json'",
  'begin_visual_relationship_analysis',
  'complete_visual_relationship_analysis',
]) {
  if (!gateway.includes(fragment))
    throw new Error(`AI relationship gateway contract missing: ${fragment}`)
}

for (const fragment of [
  'runRelationshipAnalysis',
  'getLatestRelationshipAnalysisRun',
  "action: 'relationship_analysis'",
  'AI_RELATIONSHIP_ANALYSIS_TIMEOUT',
]) {
  if (!api.includes(fragment)) throw new Error(`AI relationship client missing: ${fragment}`)
}

for (const fragment of [
  '관계 분석',
  'analyzeRelationships',
  'analysisProjects.map',
  'relationshipNotice',
]) {
  if (!dashboard.includes(fragment))
    throw new Error(`AI relationship dashboard trigger missing: ${fragment}`)
}

for (const forbidden of ['google_search', 'webSearch', 'drop table public.relations']) {
  if (`${migration}\n${gateway}`.includes(forbidden))
    throw new Error(`Out-of-scope relationship behavior detected: ${forbidden}`)
}

console.log('AI relationship evidence, caching, quota, storage, and dashboard contract passed.')
