const placeholderValues = new Set([
  'https://your-project-ref.supabase.co',
  'sb_publishable_replace_me',
])

type SupabaseEnvironment = Pick<
  ImportMetaEnv,
  'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY'
>

function requireEnvironmentValue(environment: SupabaseEnvironment, key: keyof SupabaseEnvironment) {
  const value = environment[key]?.trim()

  if (!value || placeholderValues.has(value)) {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value
}

export function readSupabaseEnvironment(environment: SupabaseEnvironment) {
  const url = requireEnvironmentValue(environment, 'VITE_SUPABASE_URL')
  const publishableKey = requireEnvironmentValue(environment, 'VITE_SUPABASE_PUBLISHABLE_KEY')

  try {
    const parsedUrl = new URL(url)
    if (parsedUrl.protocol !== 'https:' && parsedUrl.hostname !== '127.0.0.1') {
      throw new Error('Supabase URL must use HTTPS outside local development')
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('outside local development')) {
      throw error
    }
    throw new Error('VITE_SUPABASE_URL must be a valid URL', { cause: error })
  }

  return { url, publishableKey } as const
}

export function getSupabaseEnvironment() {
  return readSupabaseEnvironment(import.meta.env)
}
