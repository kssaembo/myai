import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const projectRef = process.env.SUPABASE_PROJECT_REF
const args = ['gen', 'types', 'typescript', '--schema', 'public']

if (projectRef) {
  args.push('--project-id', projectRef)
} else {
  args.push('--local')
}

const executable = process.platform === 'win32' ? 'supabase.cmd' : 'supabase'
const result = spawnSync(executable, args, {
  cwd: process.cwd(),
  encoding: 'utf8',
  shell: process.platform === 'win32',
})

if (result.status !== 0) {
  process.stderr.write(result.stderr)
  process.exit(result.status ?? 1)
}

const outputPath = resolve('src/shared/lib/supabase/database.types.ts')
writeFileSync(outputPath, result.stdout, 'utf8')
process.stdout.write(`Database types written to ${outputPath}\n`)
