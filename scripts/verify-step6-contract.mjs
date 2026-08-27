import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const migration = await readFile(
  resolve(root, 'supabase/migrations/20260827000300_parser_sections.sql'),
  'utf8',
)
const parser = await readFile(
  resolve(root, 'src/entities/document/parser/parser.worker.ts'),
  'utf8',
)
const core = await readFile(resolve(root, 'src/entities/document/parser/parse-core.ts'), 'utf8')

for (const fragment of [
  'commit_document_parse',
  'security invoker',
  'for update',
  'delete from public.document_sections',
  'jsonb_to_recordset',
  "p_parse_status not in ('parsed', 'partial', 'failed', 'needs_ocr')",
]) {
  if (!migration.includes(fragment))
    throw new Error(`Step 6 migration contract missing: ${fragment}`)
}

for (const fragment of [
  'pdfjs-dist',
  'mammoth',
  "status: 'needs_ocr'",
  'externalFileAccess: false',
]) {
  if (!parser.includes(fragment)) throw new Error(`Step 6 parser contract missing: ${fragment}`)
}

for (const fragment of ['TARGET_TOKENS = 700', 'MAX_TOKENS = 1000', 'OVERLAP_TOKENS = 80']) {
  if (!core.includes(fragment)) throw new Error(`Step 6 chunking contract missing: ${fragment}`)
}

console.log('Phase 1 Step 6 parser/section contract verification passed.')
