import { readFileSync } from 'node:fs'

const migrationPath = 'supabase/migrations/20260827000100_foundation.sql'
const migration = readFileSync(migrationPath, 'utf8')

const expectedTables = [
  'profiles',
  'user_settings',
  'node_types',
  'relation_types',
  'categories',
  'tags',
  'tag_aliases',
  'knowledge_items',
  'item_aliases',
  'item_tags',
  'projects',
  'documents',
  'document_versions',
  'document_sections',
  'item_evidence',
  'relations',
  'relation_evidence',
  'import_jobs',
  'import_entries',
]

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const actualTables = [...migration.matchAll(/^create table public\.([a-z_]+) \(/gm)].map(
  (match) => match[1],
)

assert(actualTables.length === expectedTables.length, 'Foundation migration must create 19 tables')
assert(
  expectedTables.every((table) => actualTables.includes(table)),
  'Foundation migration table list differs from the Phase 0 contract',
)

const nodeSeedBlock = migration.match(
  /insert into public\.node_types[\s\S]*?;\n\ninsert into public\.relation_types/,
)?.[0]
const relationSeedBlock = migration.match(
  /insert into public\.relation_types[\s\S]*?;\n\ncreate or replace function public\.seed_profile_defaults/,
)?.[0]

assert(nodeSeedBlock, 'Node type seed block is missing')
assert(relationSeedBlock, 'Relation type seed block is missing')
assert((nodeSeedBlock.match(/\(null, '[a-z_]+',/g) ?? []).length === 11, 'Expected 11 node types')
assert(
  (relationSeedBlock.match(/\(null, '[A-Z_]+',/g) ?? []).length === 13,
  'Expected 13 relation types',
)

assert(
  migration.includes("'knowledge-originals',\n  'knowledge-originals',\n  false,"),
  'knowledge-originals bucket must remain private',
)
assert(migration.includes('enable row level security'), 'RLS configuration is missing')
assert(
  !migration.includes('grant usage on all types in schema'),
  'PostgreSQL does not support GRANT USAGE ON ALL TYPES IN SCHEMA',
)
assert(
  migration.includes('public.import_entry_status\nto authenticated;'),
  'Authenticated role must receive explicit usage on the V1 enum types',
)
assert(
  migration.includes('revoke all on table public.%I from anon, authenticated'),
  'Owned tables must revoke implicit API grants',
)
assert(
  migration.includes('(storage.foldername(name))[1] = (select auth.uid())::text'),
  'Storage policies must scope paths to the authenticated owner',
)
assert(
  migration.includes(
    'check (embedding is null and embedding_model is null and embedded_at is null)',
  ),
  'V1 must not write embeddings before the V2 model contract is selected',
)

process.stdout.write('Phase 0 ↔ Supabase Foundation contract verification passed.\n')
