import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const migration = await readFile(
  resolve(root, 'supabase/migrations/20260830000400_ref_auto_structuring.sql'),
  'utf8',
)
const api = await readFile(resolve(root, 'src/entities/ref-review/api.ts'), 'utf8')
const processor = await readFile(resolve(root, 'src/entities/import-job/processor.ts'), 'utf8')
const imports = await readFile(resolve(root, 'src/features/imports/BatchImportPanel.tsx'), 'utf8')
const structure = await readFile(resolve(root, 'src/entities/ref-review/structure.ts'), 'utf8')

for (const fragment of [
  'prepare_ref_auto_structure',
  'security invoker',
  'item_evidence',
  'display_style',
  'revoke all on function public.prepare_ref_auto_structure(uuid, uuid, jsonb) from public, anon',
]) {
  if (!migration.includes(fragment))
    throw new Error(`REF automation migration missing: ${fragment}`)
}

for (const fragment of [
  'autoStructureRefDocument',
  'autoStructureExistingRef',
  'listRefAutomationCandidates',
  'prepareRefAutoStructure',
]) {
  if (!api.includes(fragment)) throw new Error(`REF automation API missing: ${fragment}`)
}

for (const fragment of ['쉬운 말로 지식 연결', 'autoStructureRefDocument', "'structuring'"]) {
  if (!processor.includes(fragment)) throw new Error(`Import automation missing: ${fragment}`)
}

for (const fragment of ['기존 REF 전체 정리', '코드·Markdown 제목', 'restructureExistingRefs']) {
  if (!imports.includes(fragment)) throw new Error(`Existing REF recovery UI missing: ${fragment}`)
}

for (const fragment of [
  'humanReadableTitle',
  '전체 브라우저 저장소 삭제',
  '무작위 정렬 사용',
  '프런트엔드 프레임워크',
]) {
  if (!structure.includes(fragment))
    throw new Error(`Plain-language REF label missing: ${fragment}`)
}

for (const forbidden of ['GEMINI_API_KEY', 'generateContent', 'embedContent']) {
  if (`${api}\n${processor}\n${structure}`.includes(forbidden))
    throw new Error(`REF automation unexpectedly calls AI: ${forbidden}`)
}

console.log('REF automatic structuring and plain-language display contract passed.')
