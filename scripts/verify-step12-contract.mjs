import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const migration = await readFile(
  resolve(root, 'supabase/migrations/20260827000900_knowledge_graph.sql'),
  'utf8',
)
const page = await readFile(resolve(root, 'src/pages/graph/GraphPage.tsx'), 'utf8')

for (const fragment of [
  'get_knowledge_graph',
  'with recursive reachable',
  'reachable.depth < 2',
  "relation.status in ('active', 'proposed')",
  'security invoker',
  'auth.uid()',
  'p_offset',
  'p_limit',
  'has_more',
  'evidence_count',
  'grant execute',
]) {
  if (!migration.includes(fragment))
    throw new Error(`Step 12 graph RPC contract missing: ${fragment}`)
}

for (const fragment of [
  'MultiDirectedGraph',
  'new SigmaRenderer',
  'Project 연결 탐색',
  'nodeType',
  'relationType',
  'relationStatus',
  "renderer.on('clickNode'",
  "renderer.on('clickEdge'",
  'appendPage(nextOffset, false)',
  'Evidence',
  'Relation 관리',
]) {
  if (!page.includes(fragment)) throw new Error(`Step 12 graph UI contract missing: ${fragment}`)
}

for (const forbidden of ['openai', 'gemini', 'embedding', 'vector search', 'ai chat', 'memory']) {
  if (page.toLowerCase().includes(forbidden))
    throw new Error(`Step 12 crossed the V1 AI boundary: ${forbidden}`)
}

console.log('Phase 1 Step 12 Knowledge Graph contract verification passed.')
