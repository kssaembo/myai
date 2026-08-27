import { describe, expect, it } from 'vitest'

import { formatDate, friendlyDataError, itemStatusLabels } from './display'

describe('knowledge display helpers', () => {
  it('uses the confirmed Korean labels for item states', () => {
    expect(itemStatusLabels).toEqual({
      draft: '초안',
      active: '진행 중',
      completed: '완료',
      on_hold: '보류',
      archived: '보관',
    })
  })

  it('turns database constraint messages into safe user guidance', () => {
    expect(friendlyDataError(new Error('duplicate key violates unique constraint'))).toBe(
      '같은 이름의 항목이 이미 있습니다.',
    )
    expect(friendlyDataError(new Error('category depth exceeded'))).toContain('두 단계')
  })

  it('formats stored UTC dates for the Korean interface', () => {
    expect(formatDate('2026-08-27T00:00:00.000Z')).toContain('2026')
  })
})
