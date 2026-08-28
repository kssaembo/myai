import { describe, expect, it } from 'vitest'

import { buildKnowledgeMarkdown, safeDownloadFilename } from './format'

describe('knowledge export hardening', () => {
  it('removes traversal, control, and reserved filename characters', () => {
    expect(safeDownloadFilename('../비밀:숫자\u0000', 'json')).toBe('.._비밀_숫자_.json')
  })

  it('escapes active HTML from user-authored Markdown exports', () => {
    const markdown = buildKnowledgeMarkdown({
      schema_version: 1,
      exported_at: '2026-08-28T00:00:00Z',
      item: { title: '<script>alert(1)</script>', summary: '<img src=x onerror=alert(1)>' },
      tags: [],
      item_evidence: [],
      relations: [],
    })
    expect(markdown).not.toContain('<script>')
    expect(markdown).not.toContain('<img')
    expect(markdown).toContain('&lt;script&gt;')
  })
})
