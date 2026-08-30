import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const migration = await readFile(
  resolve(root, 'supabase/migrations/20260830000200_visual_relationship_foundation.sql'),
  'utf8',
)
const types = await readFile(resolve(root, 'src/shared/lib/supabase/database.types.ts'), 'utf8')
const api = await readFile(resolve(root, 'src/entities/visual-analysis/api.ts'), 'utf8')

for (const fragment of [
  'visual_analysis_runs',
  'visual_analysis_scope',
  'visual_insights',
  'visual_insight_items',
  'visual_insight_evidence',
  "'commonality'",
  "'difference'",
  "'technical_link'",
  "'reusable_component'",
  "'recurring_problem'",
  "'solution_pattern'",
  "'development_pattern'",
  "'educational_link'",
  'promoted_relation_id',
  'get_visual_relationship_foundation',
  "'visual-relations-v1'",
]) {
  if (!migration.includes(fragment))
    throw new Error(`Visual relationship foundation missing: ${fragment}`)
}

for (const table of [
  'visual_analysis_runs',
  'visual_analysis_scope',
  'visual_insights',
  'visual_insight_items',
  'visual_insight_evidence',
]) {
  if (!migration.includes(`alter table public.${table} enable row level security`))
    throw new Error(`Visual relationship RLS missing: ${table}`)
}

for (const preserved of [
  'references public.knowledge_items(id, owner_id)',
  'references public.relations(id, owner_id)',
  'references public.document_sections(id, version_id, document_id, owner_id)',
  "relation.status in ('active', 'proposed')",
]) {
  if (!migration.includes(preserved))
    throw new Error(`V1 compatibility bridge missing: ${preserved}`)
}

for (const forbidden of [
  'drop table public.relations',
  'drop table public.knowledge_items',
  'delete from public.relations',
  'update public.relations',
]) {
  if (migration.toLowerCase().includes(forbidden))
    throw new Error(`Destructive V1 relation change detected: ${forbidden}`)
}

for (const fragment of [
  'VisualInsightKind',
  'VisualAnalysisKind',
  'visual_insights:',
  'get_visual_relationship_foundation',
]) {
  if (!types.includes(fragment)) throw new Error(`Visual relationship type missing: ${fragment}`)
}

for (const fragment of [
  'getVisualRelationshipFoundation',
  'VisualRelationshipFoundation',
  'existing_relations',
  'insights',
  'dimensions',
]) {
  if (!api.includes(fragment)) throw new Error(`Visual relationship API missing: ${fragment}`)
}

console.log('Visual relationship data model, V1 bridge, RLS, and read contract passed.')
