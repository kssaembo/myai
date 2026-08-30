import { describe, expect, it } from 'vitest'

import { getInitialTheme } from './theme'

describe('getInitialTheme', () => {
  it('keeps an explicit saved theme', () => {
    expect(getInitialTheme('dark', false)).toBe('dark')
    expect(getInitialTheme('light', true)).toBe('light')
  })

  it('falls back to the system preference', () => {
    expect(getInitialTheme(null, true)).toBe('dark')
    expect(getInitialTheme('unknown', false)).toBe('light')
  })
})
