import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const migration = await readFile(
  resolve(root, 'supabase/migrations/20260827000800_relation_evidence_merge.sql'),
  'utf8',
)
const page = await readFile(resolve(root, 'src/pages/connections/ConnectionsPage.tsx'), 'utf8')

for (const fragment of [
  'get_knowledge_connections',
  'save_relation',
  'archive_relation',
  'merge_knowledge_items',
  'RELATION_SELF_LINK',
  'DUPLICATE_ACTIVE_RELATION',
  'RELATION_ENDPOINT_NOT_OWNED',
  'relation_evidence',
  'item_evidence',
  'canonical_source_item_id',
  'canonical_target_item_id',
  'update public.item_evidence set item_id = p_primary_id',
  'update public.relation_evidence set relation_id = existing_relation_id',
  'merged_into_id = p_primary_id',
  'security invoker',
]) {
  if (!migration.includes(fragment))
    throw new Error(`Step 11 data-preservation contract missing: ${fragment}`)
}

for (const fragment of [
  'Relation 추가',
  'Relation 수정',
  'Evidence',
  '중복 Node 후보',
  '선택 Node 병합',
  'allowed_source_types',
  'allowed_target_types',
]) {
  if (!page.includes(fragment)) throw new Error(`Step 11 UI contract missing: ${fragment}`)
}

for (const forbidden of [
  'delete from public.item_evidence',
  'delete from public.relation_evidence',
  'document_versions set',
  '\n  symmetric boolean;',
  '\n    symmetric :=',
]) {
  if (migration.toLowerCase().includes(forbidden))
    throw new Error(`Step 11 Evidence/original loss risk: ${forbidden}`)
}

console.log('Phase 1 Step 11 Relation, Evidence, and merge contract verification passed.')
