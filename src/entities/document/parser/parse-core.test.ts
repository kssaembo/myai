import { describe, expect, it } from 'vitest'

import {
  buildParserSections,
  estimateTokens,
  parseMarkdownBlocks,
  parseTextBlocks,
} from './parse-core'

describe('document parser core', () => {
  it('keeps Markdown heading hierarchy and line locators', async () => {
    const markdown =
      '# 게임 규칙\n\n첫 설명입니다.\n\n## 준비\n\n카드를 준비합니다.\n\n### 교실판\n\n학생용 규칙입니다.'
    const blocks = parseMarkdownBlocks(markdown)
    const sections = await buildParserSections(blocks)

    expect(sections).toHaveLength(3)
    expect(sections[2].headingPath).toEqual(['게임 규칙', '준비', '교실판'])
    expect(sections[2].parentOrdinal).toBe(1)
    expect(sections[0].locator).toMatchObject({ line_start: 2, line_end: 4 })
    expect(sections.every((section) => section.contentHash.length === 64)).toBe(true)
  })

  it('splits oversized text into bounded overlapping sections', async () => {
    const text = Array.from({ length: 32 }, (_, index) => `${index}-` + '가'.repeat(270)).join(
      '\n\n',
    )
    const sections = await buildParserSections(parseTextBlocks(text))

    expect(sections.length).toBeGreaterThan(1)
    expect(Math.max(...sections.map((section) => section.tokenEstimate))).toBeLessThanOrEqual(1000)
    expect(sections.map((section) => section.ordinal)).toEqual(sections.map((_, index) => index))
  })

  it('uses the documented lightweight token estimate', () => {
    expect(estimateTokens('가'.repeat(2100))).toBe(700)
  })
})
