import { describe, expect, it } from 'vitest'

import { highlightText } from './highlight'

describe('search result highlighting', () => {
  it('highlights every Korean partial match without changing the source text', () => {
    expect(highlightText('교실 운영과 교실 규칙', '교실')).toEqual([
      { text: '교실', highlighted: true },
      { text: ' 운영과 ', highlighted: false },
      { text: '교실', highlighted: true },
      { text: ' 규칙', highlighted: false },
    ])
  })

  it('matches Latin text without case sensitivity', () => {
    expect(highlightText('Supabase and Vite', 'vite')).toEqual([
      { text: 'Supabase and ', highlighted: false },
      { text: 'Vite', highlighted: true },
    ])
  })

  it('returns a single plain part for an empty query', () => {
    expect(highlightText('원문', '')).toEqual([{ text: '원문', highlighted: false }])
  })
})
