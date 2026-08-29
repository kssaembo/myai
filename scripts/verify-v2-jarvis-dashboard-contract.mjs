import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const shell = await readFile(resolve(root, 'src/app/layout/AppShell.tsx'), 'utf8')
const dashboard = await readFile(resolve(root, 'src/features/dashboard/DashboardPage.tsx'), 'utf8')
const constellation = await readFile(
  resolve(root, 'src/features/dashboard/KnowledgeConstellation.tsx'),
  'utf8',
)
const styles = await readFile(resolve(root, 'src/styles/global.css'), 'utf8')

for (const fragment of ['isHome', 'header-brand', '지식 가져오기', 'isSidebarOpen', 'MY AI']) {
  if (!shell.includes(fragment)) throw new Error(`Unified shell contract missing: ${fragment}`)
}

for (const fragment of [
  'KnowledgeConstellation',
  '다음 질문 추천',
  '최근 흐름',
  '진행 중인 프로젝트',
  'activeSourceIds',
  'getKnowledgeGraph(null)',
]) {
  if (!dashboard.includes(fragment))
    throw new Error(`Jarvis dashboard contract missing: ${fragment}`)
}

for (const fragment of [
  'graph?.edges',
  'activeSourceIds',
  'focusText',
  'CURRENT THOUGHT',
  'constellation-focus-line',
]) {
  if (!constellation.includes(fragment))
    throw new Error(`Knowledge constellation contract missing: ${fragment}`)
}

for (const fragment of [
  '.constellation-canvas',
  '.intelligence-section',
  '.suggestion-list',
  '.sidebar.is-open',
  'transform: translateX(-105%)',
]) {
  if (!styles.includes(fragment)) throw new Error(`Jarvis visual contract missing: ${fragment}`)
}

console.log('V2 unified Jarvis dashboard, context rail, and thought map contract passed.')
