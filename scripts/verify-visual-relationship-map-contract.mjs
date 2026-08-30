import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dashboard = await readFile(resolve(root, 'src/features/dashboard/DashboardPage.tsx'), 'utf8')
const map = await readFile(
  resolve(root, 'src/features/dashboard/KnowledgeConstellation.tsx'),
  'utf8',
)
const styles = await readFile(resolve(root, 'src/styles/global.css'), 'utf8')

for (const fragment of [
  'getVisualRelationshipFoundation',
  'visualFoundation',
  'KnowledgeConstellation',
]) {
  if (!dashboard.includes(fragment)) throw new Error(`Relationship map load missing: ${fragment}`)
}

for (const fragment of [
  'RelationshipMap',
  'InsightSummary',
  'relationship-insight-line',
  'relationship-project-node',
  'relationship-insight-node',
  '근거 확인',
  'AI 프로젝트 관계 지도',
  'ContextConstellation',
]) {
  if (!map.includes(fragment)) throw new Error(`Relationship map UI missing: ${fragment}`)
}

for (const fragment of [
  '.relationship-map-canvas',
  '.relationship-insight-summary',
  '.relationship-insight-node.is-selected',
  '@media (max-width: 760px)',
]) {
  if (!styles.includes(fragment)) throw new Error(`Relationship map style missing: ${fragment}`)
}

for (const forbidden of ['new Route', 'relationship-map-page', 'sigma-container']) {
  if (map.includes(forbidden)) throw new Error(`Complex map behavior added: ${forbidden}`)
}

console.log('Visual relationship map, progressive disclosure, and dashboard contract passed.')
