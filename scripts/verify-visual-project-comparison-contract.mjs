import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const shell = await readFile(resolve(root, 'src/app/layout/AppShell.tsx'), 'utf8')
const map = await readFile(
  resolve(root, 'src/features/dashboard/KnowledgeConstellation.tsx'),
  'utf8',
)
const dashboard = await readFile(resolve(root, 'src/features/dashboard/DashboardPage.tsx'), 'utf8')
const styles = await readFile(resolve(root, 'src/styles/global.css'), 'utf8')

for (const fragment of ['THEME_STORAGE_KEY', '다크모드로 전환', 'applyTheme']) {
  if (!shell.includes(fragment)) throw new Error(`Persistent theme control missing: ${fragment}`)
}

for (const fragment of [
  'ProjectComparisonMap',
  '프로젝트 비교',
  'relationship-map-world',
  'map-controls',
  'activeNodeIds',
  'startNodeDrag',
  'projectNote',
]) {
  if (!map.includes(fragment)) throw new Error(`Interactive comparison map missing: ${fragment}`)
}

for (const fragment of ['analysisProjectIds', '분석 대상', '한 번에 2~4개를 비교합니다.']) {
  if (!dashboard.includes(fragment)) throw new Error(`Analysis project picker missing: ${fragment}`)
}

for (const fragment of [
  ":root[data-theme='dark']",
  '.project-comparison-map',
  '.relationship-map-node.is-dimmed',
  '.map-controls',
]) {
  if (!styles.includes(fragment)) throw new Error(`Interactive map styling missing: ${fragment}`)
}

console.log('Interactive relationship map, project comparison, and dark theme contract passed.')
