import { describe, expect, it } from 'vitest'

import type { Tables } from '@/shared/lib/supabase'

import { structureRefDocument } from './structure'

type Section = Tables<'document_sections'>

function section(
  ordinal: number,
  heading: string,
  headingLevel: number,
  headingPath: string[],
  content: string,
): Section {
  return {
    id: `00000000-0000-4000-8000-${String(ordinal + 1).padStart(12, '0')}`,
    owner_id: 'owner',
    document_id: 'document',
    version_id: 'version',
    parent_section_id: null,
    ordinal,
    canonical_section_key: null,
    heading,
    heading_level: headingLevel,
    heading_path: headingPath,
    content,
    chunk_kind: 'section',
    locator: {},
    content_hash: 'a'.repeat(64),
    token_estimate: 10,
    embedding: null,
    embedding_model: null,
    embedded_at: null,
    created_at: '2026-08-27T00:00:00Z',
  }
}

describe('REF rule structuring', () => {
  const sections = [
    section(
      0,
      '1. SERVICE OVERVIEW',
      2,
      ['1. SERVICE OVERVIEW'],
      '- **서비스명:** 비밀 숫자\n- **목적:** 수학 추론 게임',
    ),
    section(
      1,
      '4. TECH STACK',
      2,
      ['4. TECH STACK'],
      '| 기술 | 용도 | 상태 |\n|---|---|---|\n| React 19 | UI | CODE-CONFIRMED |\n| Firebase | DB | NOT USED |',
    ),
    section(2, '11. PROBLEMS ENCOUNTERED', 2, ['11. PROBLEMS ENCOUNTERED'], '문제 기록'),
    section(
      3,
      'Problem 1 — 연결 끊김',
      3,
      ['11. PROBLEMS ENCOUNTERED', 'Problem 1 — 연결 끊김'],
      '- **문제 현상:** 좌석이 남음\n- **최종 해결 방법:** 연결 초기화 버튼 추가',
    ),
    section(4, '12. IMPORTANT CHANGE HISTORY', 2, ['12. IMPORTANT CHANGE HISTORY'], '변경 기록'),
    section(
      5,
      'Change 1 — React 전환',
      3,
      ['12. IMPORTANT CHANGE HISTORY', 'Change 1 — React 전환'],
      '- **Initial:** HTML\n- **Changed To:** React',
    ),
    section(6, '13. REUSABLE PATTERNS', 2, ['13. REUSABLE PATTERNS'], '패턴 기록'),
    section(
      7,
      'Teacher Host Pattern',
      3,
      ['13. REUSABLE PATTERNS', 'Teacher Host Pattern'],
      '- 목적: 교사가 기준 상태 관리',
    ),
    section(
      8,
      '15. DO NOT REPEAT',
      2,
      ['15. DO NOT REPEAT'],
      '- **거대한 HTML을 유지하지 않는다.** 회귀 위험이 커진다.',
    ),
    section(
      9,
      '16. CLASSROOM / REAL-WORLD LESSONS',
      2,
      ['16. CLASSROOM / REAL-WORLD LESSONS'],
      '- 교실에서는 복구 버튼이 필요하다.',
    ),
    section(
      10,
      '18. FINAL IMPLEMENTATION STATUS',
      2,
      ['18. FINAL IMPLEMENTATION STATUS'],
      '### 정상 구현됨\n- Vercel 배포 존재',
    ),
  ]

  it('detects the canonical REF profile and coverage', () => {
    const result = structureRefDocument('REF_SECRET.md', 'REF Secret', sections)
    expect(result.profile).toBe('ref_v1')
    expect(result.coverage).toBe(100)
    expect(result.matchedKeys).toContain('anti_patterns')
  })

  it('creates evidence-backed project, problem, solution and pattern proposals', () => {
    const result = structureRefDocument('REF_SECRET.md', 'REF Secret', sections)
    expect(
      result.nodes.some((node) => node.nodeTypeKey === 'project' && node.title === '비밀 숫자'),
    ).toBe(true)
    expect(
      result.nodes.some((node) => node.nodeTypeKey === 'problem' && node.title === '연결 끊김'),
    ).toBe(true)
    expect(result.nodes.some((node) => node.nodeTypeKey === 'solution')).toBe(true)
    expect(result.nodes.every((node) => node.evidenceText.length > 0)).toBe(true)
    expect(
      result.relations.some(
        (relation) => relation.relationTypeKey === 'RESOLVED_BY' && relation.status === 'active',
      ),
    ).toBe(true)
  })

  it('includes only technologies confirmed as used', () => {
    const result = structureRefDocument('REF_SECRET.md', 'REF Secret', sections)
    const technologies = result.nodes.filter((node) => node.nodeTypeKey === 'technology')
    expect(technologies.map((node) => node.title)).toEqual(['React 19'])
  })

  it('turns raw Markdown and code expressions into short plain-language labels', () => {
    const difficultSections = [
      ...sections,
      section(
        11,
        '15. DO NOT REPEAT',
        2,
        ['15. DO NOT REPEAT'],
        '- **`localStorage.clear()`로 전체 origin 데이터를 지우지 않는다.** 다른 앱 데이터도 사라진다.\n- **`sort(() => Math.random() - 0.5)`를 사용하지 않는다.** 결과가 편향될 수 있다.',
      ),
    ]
    const result = structureRefDocument('REF_SECRET.md', 'REF Secret', difficultSections)
    const antiPatterns = result.nodes
      .filter((node) => node.nodeTypeKey === 'anti_pattern')
      .map((node) => node.title)

    expect(antiPatterns).toContain('전체 브라우저 저장소 삭제')
    expect(antiPatterns).toContain('무작위 정렬 사용')
    expect(antiPatterns.every((title) => !title.includes('**') && !title.includes('`'))).toBe(true)
  })

  it('uses the pattern content when a child heading contains only a number', () => {
    const numberedPatternSections = sections.map((item) =>
      item.heading === 'Teacher Host Pattern'
        ? { ...item, heading: '1.', heading_path: ['13. REUSABLE PATTERNS', '1.'] }
        : item,
    )
    const result = structureRefDocument('REF_SECRET.md', 'REF Secret', numberedPatternSections)
    const pattern = result.nodes.find((node) => node.nodeTypeKey === 'pattern')

    expect(pattern?.title).toBe('목적: 교사가 기준 상태 관리')
    expect(pattern?.title).not.toBe('1.')
  })
})
