import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

for (const variable of [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_TEST_USER_A_EMAIL',
  'SUPABASE_TEST_USER_A_PASSWORD',
]) {
  if (!process.env[variable]) throw new Error(`Missing environment variable: ${variable}`)
}

const client = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  },
)

const { error: signInError } = await client.auth.signInWithPassword({
  email: process.env.SUPABASE_TEST_USER_A_EMAIL,
  password: process.env.SUPABASE_TEST_USER_A_PASSWORD,
})
if (signInError) throw new Error(`Search evaluator sign-in failed: ${signInError.message}`)

const cases = JSON.parse(
  await readFile(resolve(import.meta.dirname, '../docs/search-evaluation-set.json'), 'utf8'),
)
const failures = []

for (const testCase of cases) {
  const { data, error } = await client.rpc('search_knowledge', {
    p_query: testCase.query,
    p_page: 1,
    p_page_size: 10,
  })
  if (error) {
    failures.push(`${testCase.id}: RPC 오류 (${error.message})`)
    continue
  }

  const resultText = JSON.stringify(data ?? []).toLocaleLowerCase('ko-KR')
  const found = testCase.expected_any.some((expected) =>
    resultText.includes(expected.toLocaleLowerCase('ko-KR')),
  )
  if (!data?.length || !found) failures.push(`${testCase.id}: 관련 결과 없음`)
  else process.stdout.write(`PASS ${testCase.group}: ${testCase.query}\n`)
}

await client.auth.signOut()

if (failures.length) {
  throw new Error(`Search evaluation failed:\n- ${failures.join('\n- ')}`)
}

process.stdout.write(`Search evaluation passed (${cases.length}/${cases.length}).\n`)
