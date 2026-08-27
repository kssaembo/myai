import { describe, expect, it } from 'vitest'

import { readSupabaseEnvironment } from './env'

describe('readSupabaseEnvironment', () => {
  it('accepts a hosted project URL and publishable key', () => {
    expect(
      readSupabaseEnvironment({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      }),
    ).toEqual({
      url: 'https://example.supabase.co',
      publishableKey: 'sb_publishable_example',
    })
  })

  it('rejects placeholder configuration', () => {
    expect(() =>
      readSupabaseEnvironment({
        VITE_SUPABASE_URL: 'https://your-project-ref.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_replace_me',
      }),
    ).toThrow('Missing required environment variable')
  })

  it('rejects insecure hosted URLs', () => {
    expect(() =>
      readSupabaseEnvironment({
        VITE_SUPABASE_URL: 'http://example.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      }),
    ).toThrow('Supabase URL must use HTTPS')
  })
})
