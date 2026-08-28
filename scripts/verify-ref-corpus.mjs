import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const directory = resolve(process.argv[2] ?? process.env.REF_CORPUS_DIR ?? 'refs')
const names = (await readdir(directory)).filter((name) => /^REF_.*\.md$/i.test(name)).sort()
if (names.length < 20) {
  throw new Error(
    `20개 이상의 REF Markdown이 필요하지만 ${names.length}개만 발견했습니다: ${directory}`,
  )
}

const requiredSections = [
  'SERVICE OVERVIEW',
  'FINAL USER FLOW',
  'TECH STACK',
  'SYSTEM ARCHITECTURE',
]
const failures = []
for (const name of names) {
  const contents = await readFile(resolve(directory, name), 'utf8')
  const missing = requiredSections.filter((section) => !contents.includes(section))
  if (contents.length < 1000) missing.push('MINIMUM_CONTENT_LENGTH')
  if (missing.length) failures.push(`${name}: ${missing.join(', ')}`)
}
if (failures.length) throw new Error(`REF corpus 검증 실패\n${failures.join('\n')}`)
console.log(`${names.length}개 REF Markdown corpus structure verification passed.`)
