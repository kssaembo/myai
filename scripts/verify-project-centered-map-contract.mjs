import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dashboard = await readFile(resolve(root, 'src/features/dashboard/DashboardPage.tsx'), 'utf8')
const map = await readFile(
  resolve(root, 'src/features/dashboard/KnowledgeConstellation.tsx'),
  'utf8',
)
const readiness = await readFile(resolve(root, 'src/entities/ref-review/readiness.ts'), 'utf8')
const settings = await readFile(resolve(root, 'src/pages/settings/AISettingsPage.tsx'), 'utf8')

for (const fragment of [
  'getRefAIReadiness',
  'eligibleProjectIds',
  'REF AI 사용 허용',
  '분석 가능 프로젝트',
]) {
  if (!dashboard.includes(fragment)) throw new Error(`Project readiness UI missing: ${fragment}`)
}

for (const fragment of [
  'ProjectClusterMap',
  '프로젝트 중심 지도',
  'project-cluster-root',
  'project-cluster-child',
]) {
  if (!map.includes(fragment)) throw new Error(`Project cluster map missing: ${fragment}`)
}

for (const fragment of [
  "eq('document_kind', 'ref')",
  "eq('key', 'DOCUMENTS')",
  'active_version_id',
  'item_evidence',
  'allowAllRefDocumentsForAI',
]) {
  if (!readiness.includes(fragment)) throw new Error(`REF readiness contract missing: ${fragment}`)
}

for (const fragment of [
  'https://aistudio.google.com/usage',
  'https://console.cloud.google.com/billing',
  '실제 청구 금액',
]) {
  if (!settings.includes(fragment)) throw new Error(`Billing visibility UI missing: ${fragment}`)
}

console.log('Project-centered map, REF readiness, and billing visibility contract passed.')
