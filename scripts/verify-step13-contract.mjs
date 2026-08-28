import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const migration = await readFile(
  resolve(root, 'supabase/migrations/20260828000100_export_trash_hardening.sql'),
  'utf8',
)
const trashPage = await readFile(resolve(root, 'src/pages/trash/TrashPage.tsx'), 'utf8')
const exportApi = await readFile(resolve(root, 'src/entities/export/api.ts'), 'utf8')
const exportFormat = await readFile(resolve(root, 'src/entities/export/format.ts'), 'utf8')
const archive = await readFile(resolve(root, 'src/entities/import-job/archive.ts'), 'utf8')

for (const fragment of [
  'export_knowledge_item',
  'trash_knowledge_item',
  'restore_knowledge_item',
  'permanently_delete_knowledge_item',
  'deleted_at is not null',
  "properties - '_trash_previous_status' - '_trash_relations'",
  'auth.uid()',
  'security invoker',
  'revoke all',
]) {
  if (!migration.includes(fragment)) throw new Error(`Step 13 DB contract missing: ${fragment}`)
}

for (const fragment of ['JSON 백업', '복원', '영구 삭제', 'confirmation !== pendingDelete.title']) {
  if (!trashPage.includes(fragment))
    throw new Error(`Step 13 Trash UI contract missing: ${fragment}`)
}

for (const fragment of [
  'safeDownloadFilename',
  'buildKnowledgeMarkdown',
  "replaceAll('<', '&lt;')",
  'application/json',
  'text/markdown',
]) {
  if (!`${exportApi}\n${exportFormat}`.includes(fragment))
    throw new Error(`Step 13 export contract missing: ${fragment}`)
}

for (const fragment of [
  'MAX_ARCHIVE_BYTES',
  'MAX_IMPORT_ENTRIES',
  'MAX_EXPANDED_BYTES',
  'checkOverlappingEntry: true',
  'checkSignature: true',
  'ENCRYPTED_ZIP',
  'NESTED_ZIP',
  'ZIP_SYMLINK',
]) {
  if (!archive.includes(fragment)) throw new Error(`Step 13 archive hardening missing: ${fragment}`)
}

console.log('Phase 1 Step 13 export, trash, and hardening contract verification passed.')
