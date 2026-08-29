import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const migration = await readFile(
  resolve(root, 'supabase/migrations/20260829000200_vector_rag.sql'),
  'utf8',
)
const gateway = await readFile(resolve(root, 'supabase/functions/ai-gateway/index.ts'), 'utf8')
const gemini = await readFile(resolve(root, 'supabase/functions/_shared/ai/gemini.ts'), 'utf8')
const client = await readFile(resolve(root, 'src/entities/ai/api.ts'), 'utf8')
const settings = await readFile(resolve(root, 'src/pages/settings/AISettingsPage.tsx'), 'utf8')
const documentApi = await readFile(resolve(root, 'src/entities/document/api.ts'), 'utf8')

for (const fragment of [
  'extensions.vector(768)',
  'document_sections_embedding_hnsw_idx',
  'extensions.vector_cosine_ops',
  'get_embedding_status',
  'get_pending_embedding_sections',
  'save_section_embeddings',
  'match_document_sections',
  'document.ai_allowed',
  'auth.uid()',
  'revoke all',
]) {
  if (!migration.includes(fragment)) throw new Error(`V2 Step 3 DB contract missing: ${fragment}`)
}

for (const fragment of [
  "body.action !== 'embed_pending'",
  "client.rpc('get_pending_embedding_sections'",
  "client.rpc('save_section_embeddings'",
  "client.rpc('match_document_sections'",
  "taskType: 'RETRIEVAL_QUERY'",
  'semanticSources',
]) {
  if (!gateway.includes(fragment))
    throw new Error(`V2 Step 3 gateway contract missing: ${fragment}`)
}

for (const fragment of [
  ':batchEmbedContents',
  'outputDimensionality: request.dimensions',
  'normalizeEmbedding',
]) {
  if (!gemini.includes(fragment))
    throw new Error(`V2 Step 3 Gemini embedding contract missing: ${fragment}`)
}

for (const fragment of ['getEmbeddingStatus', 'embedPendingSections']) {
  if (!client.includes(fragment)) throw new Error(`V2 Step 3 client contract missing: ${fragment}`)
}

for (const fragment of ['의미 검색 색인', '다음 12개 Section 색인', 'AI 허용 Section']) {
  if (!settings.includes(fragment)) throw new Error(`V2 Step 3 UI contract missing: ${fragment}`)
}

if (!documentApi.includes('setDocumentAIAllowed'))
  throw new Error('V2 Step 3 must provide an explicit per-document AI consent control.')

console.log('V2 Step 3 vector, consent, hybrid retrieval, and embedding workflow contract passed.')
