import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const migration = await readFile(
  resolve(root, 'supabase/migrations/20260827000400_batch_imports.sql'),
  'utf8',
)
const archive = await readFile(resolve(root, 'src/entities/import-job/archive.ts'), 'utf8')
const processor = await readFile(resolve(root, 'src/entities/import-job/processor.ts'), 'utf8')

for (const fragment of [
  'create_import_job',
  'update_import_entry',
  'refresh_import_job',
  'cancel_import_job',
  'security invoker',
  'IMPORT_ENTRY_COUNT_OUT_OF_RANGE',
]) {
  if (!migration.includes(fragment))
    throw new Error(`Step 7 migration contract missing: ${fragment}`)
}

for (const fragment of [
  'MAX_ARCHIVE_BYTES = 200 * 1024 * 1024',
  'MAX_IMPORT_ENTRIES = 200',
  "'UNSAFE_ZIP_PATH'",
  "'ENCRYPTED_ZIP'",
  "'NESTED_ZIP'",
  "'ZIP_SYMLINK'",
]) {
  if (!archive.includes(fragment)) throw new Error(`Step 7 archive contract missing: ${fragment}`)
}

for (const fragment of [
  "status: 'duplicate'",
  "status: fullyParsed && !refNeedsReview ? 'parsed' : 'partial'",
  "status: documentId && versionId ? 'partial' : 'failed'",
  'continue',
]) {
  if (!processor.includes(fragment))
    throw new Error(`Step 7 processor contract missing: ${fragment}`)
}

console.log('Phase 1 Step 7 batch import contract verification passed.')
