import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'

const requiredVariables = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_TEST_USER_A_EMAIL',
  'SUPABASE_TEST_USER_A_PASSWORD',
  'SUPABASE_TEST_USER_B_EMAIL',
  'SUPABASE_TEST_USER_B_PASSWORD',
]

for (const variable of requiredVariables) {
  if (!process.env[variable]) {
    throw new Error(`Missing environment variable: ${variable}`)
  }
}

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const clientOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
}

const anonymousClient = createClient(url, key, clientOptions)
const userAClient = createClient(url, key, clientOptions)
const userBClient = createClient(url, key, clientOptions)

const anonymousResult = await anonymousClient.from('node_types').select('id').limit(1)
if (!anonymousResult.error) {
  throw new Error('Anonymous database access was not blocked')
}

async function signIn(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    throw new Error(`Test sign-in failed for ${email}: ${error?.message ?? 'no user'}`)
  }
  return data.user
}

const userA = await signIn(
  userAClient,
  process.env.SUPABASE_TEST_USER_A_EMAIL,
  process.env.SUPABASE_TEST_USER_A_PASSWORD,
)
await signIn(
  userBClient,
  process.env.SUPABASE_TEST_USER_B_EMAIL,
  process.env.SUPABASE_TEST_USER_B_PASSWORD,
)

const { data: conceptType, error: conceptTypeError } = await userAClient
  .from('node_types')
  .select('id')
  .eq('key', 'concept')
  .is('owner_id', null)
  .single()

if (conceptTypeError || !conceptType) {
  throw new Error(`System node type lookup failed: ${conceptTypeError?.message ?? 'not found'}`)
}

const verificationTitle = `RLS verification ${randomUUID()}`
const { data: insertedItem, error: insertError } = await userAClient
  .from('knowledge_items')
  .insert({
    owner_id: userA.id,
    node_type_id: conceptType.id,
    title: verificationTitle,
    status: 'draft',
    origin: 'user',
    verification_status: 'confirmed',
  })
  .select('id')
  .single()

if (insertError || !insertedItem) {
  throw new Error(`Owner insert failed: ${insertError?.message ?? 'no row returned'}`)
}

let crossUserVerificationError

try {
  const { data: crossUserRows, error: crossUserError } = await userBClient
    .from('knowledge_items')
    .select('id')
    .eq('id', insertedItem.id)

  if (crossUserError) {
    throw new Error(`Cross-user read check failed unexpectedly: ${crossUserError.message}`)
  }

  if (crossUserRows.length !== 0) {
    throw new Error("Cross-user read exposed another owner's row")
  }

  const { error: crossUserWriteError } = await userBClient.from('knowledge_items').insert({
    owner_id: userA.id,
    node_type_id: conceptType.id,
    title: `Forbidden cross-user write ${randomUUID()}`,
  })

  if (!crossUserWriteError) {
    throw new Error('Cross-user write was not blocked')
  }
} catch (error) {
  crossUserVerificationError = error
}

const { error: cleanupError } = await userAClient
  .from('knowledge_items')
  .delete()
  .eq('id', insertedItem.id)

if (cleanupError) {
  throw new Error(`Verification cleanup failed: ${cleanupError.message}`)
}

if (crossUserVerificationError) {
  throw crossUserVerificationError
}

const storagePath = `${userA.id}/${randomUUID()}/${randomUUID()}/original.txt`
const storagePayload = new TextEncoder().encode('Supabase Foundation RLS verification')
const { error: ownerUploadError } = await userAClient.storage
  .from('knowledge-originals')
  .upload(storagePath, storagePayload, { contentType: 'text/plain' })

if (ownerUploadError) {
  throw new Error(`Owner storage upload failed: ${ownerUploadError.message}`)
}

let storageVerificationError

try {
  const { error: anonymousDownloadError } = await anonymousClient.storage
    .from('knowledge-originals')
    .download(storagePath)

  if (!anonymousDownloadError) {
    throw new Error('Anonymous storage download was not blocked')
  }

  const { error: crossUserDownloadError } = await userBClient.storage
    .from('knowledge-originals')
    .download(storagePath)

  if (!crossUserDownloadError) {
    throw new Error('Cross-user storage download was not blocked')
  }
} catch (error) {
  storageVerificationError = error
}

const { error: storageCleanupError } = await userAClient.storage
  .from('knowledge-originals')
  .remove([storagePath])

if (storageCleanupError) {
  throw new Error(`Storage verification cleanup failed: ${storageCleanupError.message}`)
}

if (storageVerificationError) {
  throw storageVerificationError
}

process.stdout.write('Supabase Foundation verification passed.\n')
