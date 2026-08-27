import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const migration = await readFile(
  resolve(root, 'supabase/migrations/20260827000500_ref_structuring.sql'),
  'utf8',
)
const structure = await readFile(resolve(root, 'src/entities/ref-review/structure.ts'), 'utf8')

for (const fragment of [
  'mark_ref_profile',
  'commit_ref_review',
  'REF_NODE_REQUIRES_EVIDENCE',
  'REF_RELATION_REQUIRES_EVIDENCE',
  "'rule_import'",
  'security invoker',
]) {
  if (!migration.includes(fragment))
    throw new Error(`Step 8 migration contract missing: ${fragment}`)
}

for (const fragment of [
  'overview',
  'tech_stack',
  'problems',
  'change_history',
  'reusable_patterns',
  'anti_patterns',
  'classroom_lessons',
  'final_status',
  "'DOCUMENTS'",
  "'HAS_PROBLEM'",
  "'RESOLVED_BY'",
  "'REUSES_PATTERN'",
  "'AVOIDS'",
]) {
  if (!structure.includes(fragment))
    throw new Error(`Step 8 REF rule contract missing: ${fragment}`)
}

for (const forbidden of ['openai', 'embedding', 'vector search', 'ai chat']) {
  if (structure.toLowerCase().includes(forbidden))
    throw new Error(`Step 8 forbidden AI boundary crossed: ${forbidden}`)
}

console.log('Phase 1 Step 8 REF structuring contract verification passed.')
