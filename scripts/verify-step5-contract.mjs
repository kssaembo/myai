import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const migration = await readFile(
  resolve(root, 'supabase/migrations/20260827000200_document_uploads.sql'),
  'utf8',
)
const validator = await readFile(resolve(root, 'src/entities/document/file-validation.ts'), 'utf8')

const requiredMigrationFragments = [
  'create_document_upload',
  'add_document_version',
  'document_versions_owner_hash_idx',
  'DUPLICATE_DOCUMENT_HASH',
  'set active_version_id = p_version_id',
  'security invoker',
  'to authenticated',
]
const requiredValidationFragments = [
  '50 * 1024 * 1024',
  "format === 'pdf'",
  "format === 'docx'",
  "new TextDecoder('utf-8', { fatal: true })",
  "crypto.subtle.digest('SHA-256'",
]

for (const fragment of requiredMigrationFragments) {
  if (!migration.includes(fragment))
    throw new Error(`Step 5 migration contract missing: ${fragment}`)
}
for (const fragment of requiredValidationFragments) {
  if (!validator.includes(fragment))
    throw new Error(`Step 5 validation contract missing: ${fragment}`)
}

console.log('Phase 1 Step 5 upload/version contract verification passed.')
