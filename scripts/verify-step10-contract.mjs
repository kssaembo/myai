import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const migration = await readFile(
  resolve(root, 'supabase/migrations/20260827000700_project_aggregation.sql'),
  'utf8',
)
const page = await readFile(resolve(root, 'src/pages/projects/ProjectDetailView.tsx'), 'utf8')

for (const fragment of [
  'get_project_aggregate',
  'security invoker',
  'auth.uid()',
  'project_documents',
  'related_ids',
  'document_rows',
  'node_rows',
  'relation_rows',
  'evidence_coverage',
  'source_document_id',
  'RESOLVED_BY',
]) {
  if (!migration.includes(fragment))
    throw new Error(`Step 10 Project aggregation contract missing: ${fragment}`)
}

for (const fragment of [
  "'documents'",
  "'problems'",
  "'decisions'",
  "'patterns'",
  "'lessons'",
  '원문 근거 열기',
  '근거 연결률',
  'needs_review',
]) {
  if (!page.includes(fragment))
    throw new Error(`Step 10 Project detail UI contract missing: ${fragment}`)
}

for (const forbidden of ['openai', 'embedding', 'vector search', 'ai chat', 'memory inference']) {
  if (`${migration}\n${page}`.toLowerCase().includes(forbidden))
    throw new Error(`Step 10 forbidden V1 boundary crossed: ${forbidden}`)
}

console.log('Phase 1 Step 10 Project detail aggregation contract verification passed.')
