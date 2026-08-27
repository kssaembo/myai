import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const migration = await readFile(
  resolve(root, 'supabase/migrations/20260827000600_search.sql'),
  'utf8',
)
const page = await readFile(resolve(root, 'src/pages/search/SearchPage.tsx'), 'utf8')
const shell = await readFile(resolve(root, 'src/app/layout/AppShell.tsx'), 'utf8')
const evaluation = JSON.parse(
  await readFile(resolve(root, 'docs/search-evaluation-set.json'), 'utf8'),
)

for (const fragment of [
  'search_knowledge',
  'security invoker',
  'auth.uid()',
  'p_node_type_keys',
  'p_category_ids',
  'p_tag_ids',
  'p_project_ids',
  'p_formats',
  'p_verification_statuses',
  'p_statuses',
  'p_date_from',
  'p_date_to',
  'p_page',
  'section_id',
  'heading_path',
  'locator',
  'snippet',
  'match_reason',
  'score',
  'total_count',
]) {
  if (!migration.includes(fragment))
    throw new Error(`Step 9 search migration contract missing: ${fragment}`)
}

for (const fragment of [
  'Integrated Search',
  '원문 위치 열기',
  'verification',
  'project',
  'format',
  'date',
]) {
  if (!page.includes(fragment)) throw new Error(`Step 9 search UI contract missing: ${fragment}`)
}

if (!shell.includes("'/search'")) throw new Error('Global search route is not activated')
if (evaluation.length < 6) throw new Error('Search evaluation set must cover at least six queries')

for (const forbidden of ['embedding <=>', 'vector search', 'openai', 'ai chat']) {
  if (migration.toLowerCase().includes(forbidden))
    throw new Error(`Step 9 forbidden AI boundary crossed: ${forbidden}`)
}

console.log('Phase 1 Step 9 integrated search contract verification passed.')
