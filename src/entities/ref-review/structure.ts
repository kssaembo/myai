import type { Tables } from '@/shared/lib/supabase'
import type {
  EvidenceRole,
  ProjectKind,
  ProjectLifecycleStatus,
  RelationStatus,
  VerificationStatus,
} from '@/shared/lib/supabase/database.types'

type DocumentSection = Tables<'document_sections'>

export type CanonicalRefSection =
  | 'overview'
  | 'tech_stack'
  | 'problems'
  | 'change_history'
  | 'reusable_patterns'
  | 'anti_patterns'
  | 'classroom_lessons'
  | 'final_status'

export const refSectionAliases: Record<CanonicalRefSection, string[]> = {
  overview: ['service overview', 'overview', '서비스 개요', '프로젝트 개요'],
  tech_stack: ['tech stack', 'technology stack', '기술 스택', '사용 기술'],
  problems: ['problems encountered', 'problems', 'issues', '발생 문제', '문제와 해결'],
  change_history: ['important change history', 'change history', '변경 이력', '주요 변경'],
  reusable_patterns: ['reusable patterns', 'patterns', '재사용 패턴', '공통 패턴'],
  anti_patterns: ['do not repeat', 'anti patterns', 'anti-patterns', '반복 금지', '위험 패턴'],
  classroom_lessons: [
    'classroom real world lessons',
    'classroom lessons',
    'real world lessons',
    '교실 현장 교훈',
    '현장 교훈',
  ],
  final_status: ['final implementation status', 'final status', '구현 상태', '최종 상태'],
}

export interface RefNodeProposal {
  localId: string
  nodeTypeKey:
    | 'project'
    | 'technology'
    | 'problem'
    | 'solution'
    | 'decision'
    | 'pattern'
    | 'anti_pattern'
    | 'lesson'
  title: string
  summary: string
  sectionId: string
  evidenceText: string
  evidenceRole: EvidenceRole
  verificationStatus: VerificationStatus
  selected: boolean
  projectKind?: ProjectKind
  lifecycleStatus?: ProjectLifecycleStatus
}

export interface RefRelationProposal {
  localId: string
  sourceRef: string
  targetRef: string
  relationTypeKey: string
  sectionId: string
  evidenceText: string
  status: RelationStatus
  selected: boolean
}

export interface RefStructureResult {
  profile: 'ref_v1' | 'ref_probable' | 'not_ref'
  coverage: number
  matchedKeys: CanonicalRefSection[]
  sectionAliases: { sectionId: string; canonicalKey: CanonicalRefSection }[]
  nodes: RefNodeProposal[]
  relations: RefRelationProposal[]
  warnings: string[]
}

export function structureRefDocument(
  filename: string,
  documentTitle: string,
  sections: DocumentSection[],
): RefStructureResult {
  const aliasBySection = sections.flatMap((section) => {
    const canonicalKey = detectCanonicalSection(section.heading_path)
    return canonicalKey ? [{ sectionId: section.id, canonicalKey }] : []
  })
  const matchedKeys = [...new Set(aliasBySection.map((alias) => alias.canonicalKey))]
  const coverage = Math.round((matchedKeys.length / Object.keys(refSectionAliases).length) * 100)
  const filenameLooksRef = filename.toLocaleUpperCase('en-US').startsWith('REF_')
  const profile =
    matchedKeys.length >= 5 && filenameLooksRef
      ? 'ref_v1'
      : matchedKeys.length >= 3
        ? 'ref_probable'
        : 'not_ref'
  const canonicalById = new Map(
    aliasBySection.map((alias) => [alias.sectionId, alias.canonicalKey]),
  )
  const grouped = new Map<CanonicalRefSection, DocumentSection[]>()
  for (const section of sections) {
    const key = canonicalById.get(section.id)
    if (key) grouped.set(key, [...(grouped.get(key) ?? []), section])
  }

  const nodes: RefNodeProposal[] = []
  const relations: RefRelationProposal[] = []
  const warnings: string[] = []
  const overview = grouped.get('overview') ?? []
  const overviewEvidence = overview[0]
  const projectTitle =
    extractField(overview.map((section) => section.content).join('\n'), '서비스명') ??
    documentTitle.replace(/^REF[_\s-]*/i, '').replaceAll('_', ' ')
  let projectId: string | null = null

  if (overviewEvidence) {
    const finalText = (grouped.get('final_status') ?? [])
      .map((section) => `${section.heading ?? ''}\n${section.content}`)
      .join('\n')
    projectId = crypto.randomUUID()
    nodes.push({
      localId: projectId,
      nodeTypeKey: 'project',
      title: projectTitle,
      summary:
        extractField(overviewEvidence.content, '목적') ?? firstUsefulLine(overviewEvidence.content),
      sectionId: overviewEvidence.id,
      evidenceText: clippedEvidence(overviewEvidence.content),
      evidenceRole: 'definition',
      verificationStatus: verificationFromText(finalText),
      selected: true,
      projectKind: 'service',
      lifecycleStatus: lifecycleFromText(finalText),
    })
    relations.push({
      localId: crypto.randomUUID(),
      sourceRef: 'document',
      targetRef: projectId,
      relationTypeKey: 'DOCUMENTS',
      sectionId: overviewEvidence.id,
      evidenceText: clippedEvidence(overviewEvidence.content),
      status: 'active',
      selected: true,
    })
  } else {
    warnings.push('Overview 근거가 없어 Project를 제안하지 않았습니다.')
  }

  if (projectId) {
    for (const technology of extractTechnologies(grouped.get('tech_stack') ?? [])) {
      const node = proposal('technology', technology.title, technology.summary, technology.section)
      nodes.push(node)
      relations.push(relation(projectId, node.localId, 'USES', technology.section, 'proposed'))
    }

    for (const section of childSections(grouped.get('problems') ?? [], /^problem\s*\d+/i)) {
      const title = cleanNumberedHeading(section.heading ?? '문제')
      const problem = proposal('problem', title, firstUsefulLine(section.content), section)
      nodes.push(problem)
      relations.push(relation(projectId, problem.localId, 'HAS_PROBLEM', section, 'active'))
      const solutionText = extractField(section.content, '최종 해결 방법')
      if (solutionText) {
        const solution = proposal('solution', `${title} 해결`, solutionText, section)
        nodes.push(solution)
        relations.push(
          relation(problem.localId, solution.localId, 'RESOLVED_BY', section, 'active'),
        )
      }
    }

    for (const section of childSections(grouped.get('change_history') ?? [], /^change\s*\d+/i)) {
      const node = proposal(
        'decision',
        cleanNumberedHeading(section.heading ?? '변경 결정'),
        firstUsefulLine(section.content),
        section,
      )
      nodes.push(node)
      relations.push(relation(projectId, node.localId, 'MADE_DECISION', section, 'proposed'))
    }

    for (const section of childSections(grouped.get('reusable_patterns') ?? [])) {
      const node = proposal(
        'pattern',
        cleanNumberedHeading(section.heading ?? '재사용 패턴'),
        firstUsefulLine(section.content),
        section,
      )
      nodes.push(node)
      relations.push(relation(projectId, node.localId, 'REUSES_PATTERN', section, 'proposed'))
    }

    for (const item of extractBoldBullets(grouped.get('anti_patterns') ?? [])) {
      const node = proposal('anti_pattern', item.title, item.summary, item.section)
      nodes.push(node)
      relations.push(relation(projectId, node.localId, 'AVOIDS', item.section, 'proposed'))
    }

    for (const item of extractBullets(grouped.get('classroom_lessons') ?? [])) {
      nodes.push(proposal('lesson', item.title, item.summary, item.section))
    }
  }

  if (profile === 'not_ref')
    warnings.push('필수 REF 섹션이 3개 미만이라 자동 구조화를 권장하지 않습니다.')
  if (!grouped.get('final_status')?.length)
    warnings.push('Final Status가 없어 구현·검증 상태는 UNCONFIRMED로 유지합니다.')

  return {
    profile,
    coverage,
    matchedKeys,
    sectionAliases: aliasBySection,
    nodes,
    relations,
    warnings,
  }
}

function normalizeHeading(value: string) {
  return value
    .toLocaleLowerCase('en-US')
    .replace(/^\s*\d+(?:\.\d+)*[.)]?\s*/, '')
    .replace(/[/&_–—-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function detectCanonicalSection(headingPath: string[]) {
  for (const heading of headingPath) {
    const normalized = normalizeHeading(heading)
    for (const [key, aliases] of Object.entries(refSectionAliases) as [
      CanonicalRefSection,
      string[],
    ][]) {
      if (aliases.some((alias) => normalizeHeading(alias) === normalized)) return key
    }
  }
  return null
}

function proposal(
  nodeTypeKey: RefNodeProposal['nodeTypeKey'],
  title: string,
  summary: string,
  section: DocumentSection,
): RefNodeProposal {
  return {
    localId: crypto.randomUUID(),
    nodeTypeKey,
    title: humanReadableTitle(title, nodeTypeKey),
    summary: humanReadableSummary(summary),
    sectionId: section.id,
    evidenceText: clippedEvidence(section.content),
    evidenceRole: nodeTypeKey === 'solution' ? 'support' : 'definition',
    verificationStatus: verificationFromText(`${section.heading ?? ''}\n${section.content}`),
    selected: true,
  }
}

function relation(
  sourceRef: string,
  targetRef: string,
  relationTypeKey: string,
  section: DocumentSection,
  status: RelationStatus,
): RefRelationProposal {
  return {
    localId: crypto.randomUUID(),
    sourceRef,
    targetRef,
    relationTypeKey,
    sectionId: section.id,
    evidenceText: clippedEvidence(section.content),
    status,
    selected: true,
  }
}

function childSections(sections: DocumentSection[], pattern?: RegExp) {
  return sections.filter((section) => {
    if ((section.heading_level ?? 0) < 3 || !section.heading) return false
    return pattern ? pattern.test(section.heading) : true
  })
}

function extractField(content: string, field: string) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(
    `(?:^|\\n)\\s*[-*]?\\s*\\*\\*${escaped}:?\\*\\*\\s*:?\\s*(.+)`,
    'i',
  ).exec(content)
  const value = match?.[1]?.replace(/\*\*/g, '').trim()
  return value?.length ? value : null
}

function extractTechnologies(sections: DocumentSection[]) {
  return sections.flatMap((section) =>
    section.content.split('\n').flatMap((line) => {
      if (!line.trim().startsWith('|')) return []
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim())
      if (cells.length < 2 || /^[-: ]+$/.test(cells[0]) || /기술|technology/i.test(cells[0]))
        return []
      const status = cells.at(-1) ?? ''
      if (/not used|removed|미사용|제거/i.test(status)) return []
      if (!/code-confirmed|confirmed|implemented|사용|구현/i.test(status)) return []
      const firstCell = cleanInlineMarkup(cells[0])
      const categoryFirst =
        cells.length >= 4 &&
        /framework|language|runtime|database|storage|styling|build|test|deploy|hosting|통신|상태|프레임워크|언어|배포|저장/i.test(
          firstCell,
        )
      const title = categoryFirst ? cleanInlineMarkup(cells[1]) : firstCell
      const summaryStart = categoryFirst ? 2 : 1
      return [
        {
          title,
          summary: cells.slice(summaryStart, -1).join(' · ').replaceAll('`', ''),
          section,
        },
      ]
    }),
  )
}

function extractBoldBullets(sections: DocumentSection[]) {
  return sections.flatMap((section) =>
    section.content.split('\n').flatMap((line) => {
      const match = /^\s*[-*]\s+\*\*(.+?)\*\*\s*(.*)$/.exec(line)
      if (!match) return []
      return [{ title: match[1].replace(/[:.]$/, ''), summary: match[2].trim(), section }]
    }),
  )
}

function extractBullets(sections: DocumentSection[]) {
  return sections.flatMap((section) =>
    section.content.split('\n').flatMap((line) => {
      const match = /^\s*[-*]\s+(.+)$/.exec(line)
      if (!match) return []
      const clean = match[1].replace(/\*\*/g, '').trim()
      return [{ title: clean.slice(0, 90), summary: clean, section }]
    }),
  )
}

function cleanNumberedHeading(value: string) {
  return value.replace(/^(?:problem|change)\s*\d+\s*[—–:-]?\s*/i, '').trim()
}

function cleanInlineMarkup(value: string) {
  return value
    .replace(/`{1,3}/g, '')
    .replace(/\*\*|__|~~/g, '')
    .replace(/^#+\s*/, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function humanReadableTitle(value: string, nodeTypeKey: RefNodeProposal['nodeTypeKey']) {
  const clean = cleanInlineMarkup(value)
    .replace(/^[-*•]\s*/, '')
    .replace(/^(?:위험|금지|주의|문제|교훈)\s*[:：-]?\s*/i, '')
  const rules: [RegExp, string][] = [
    [/localStorage\.clear|전체.*(?:스토리지|저장소).*삭제/i, '전체 브라우저 저장소 삭제'],
    [/sort\s*\(.*Math\.random|Math\.random.*sort/i, '무작위 정렬 사용'],
    [
      /(?:(?:Client|클라이언트).*(?:Host|호스트)|(?:Host|호스트).*(?:Client|클라이언트)).*(?:직접|접근|조회|접속)/i,
      '클라이언트의 Host 상태 직접 접근',
    ],
    [/(?:4천|수천|거대한|대형|단일).*(?:APP|App|컴포넌트|HTML)/i, '거대 단일 컴포넌트'],
    [/Frontend\s*Framework/i, '프런트엔드 프레임워크'],
    [/Teacher\s*Host\s*Pattern/i, '교사 중심 상태 관리 패턴'],
    [/@ts-nocheck/i, '타입 검사 비활성화'],
    [/file:\/\//i, '로컬 파일 방식의 다중 기기 테스트'],
    [/alert\/?confirm|alert|confirm/i, '브라우저 기본 팝업 의존'],
  ]
  const matched = rules.find(([pattern]) => pattern.test(clean))?.[1]
  if (matched) return matched
  const firstClause = clean.split(/(?<=[.!?。])\s+|[;；]|\s+[—–]\s+/)[0].trim()
  const withoutDirective =
    nodeTypeKey === 'anti_pattern'
      ? firstClause.replace(/(?:하지|쓰지|두지|남기지|사용하지|가정하지)\s*않는다[.]?$/i, '').trim()
      : firstClause
  const fallback = withoutDirective || clean || '핵심 항목'
  return fallback.length > 42 ? `${fallback.slice(0, 39)}…` : fallback
}

function humanReadableSummary(value: string) {
  const clean = cleanInlineMarkup(value).replace(/^[:：-]\s*/, '')
  return clean.length > 360 ? `${clean.slice(0, 357)}…` : clean
}

function firstUsefulLine(content: string) {
  return (
    content
      .split('\n')
      .map((line) =>
        line
          .replace(/^\s*[-*]\s*/, '')
          .replace(/\*\*/g, '')
          .trim(),
      )
      .find((line) => line && !/^\|?\s*[-:]+/.test(line)) ?? '원문 근거를 확인해 주세요.'
  )
}

function clippedEvidence(content: string) {
  const trimmed = content.trim()
  return trimmed.length > 4000 ? `${trimmed.slice(0, 3997)}…` : trimmed
}

function verificationFromText(text: string): VerificationStatus {
  if (/conflict|contradict|불일치|충돌/i.test(text)) return 'conflicted'
  if (/unconfirmed|request-only|확인되지|미확인/i.test(text)) return 'unconfirmed'
  return 'unconfirmed'
}

function lifecycleFromText(text: string): ProjectLifecycleStatus {
  if (/정상 구현됨|deployed|배포.*존재|vercel.*배포/i.test(text)) return 'deployed'
  if (/testing|테스트/i.test(text)) return 'testing'
  if (/developing|개발 중|부분 구현/i.test(text)) return 'developing'
  return 'planning'
}
