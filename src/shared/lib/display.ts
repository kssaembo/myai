import type {
  ItemStatus,
  ProjectKind,
  ProjectLifecycleStatus,
  VerificationStatus,
} from '@/shared/lib/supabase/database.types'

export const itemStatusLabels: Record<ItemStatus, string> = {
  draft: '초안',
  active: '진행 중',
  completed: '완료',
  on_hold: '보류',
  archived: '보관',
}

export const verificationLabels: Record<VerificationStatus, string> = {
  confirmed: '확인됨',
  unconfirmed: '확인 필요',
  conflicted: '충돌',
}

export const projectKindLabels: Record<ProjectKind, string> = {
  service: '서비스',
  lesson: '수업',
  research: '연구',
  system: '시스템',
  utility: '유틸리티',
  idea: '아이디어',
  other: '기타',
}

export const lifecycleLabels: Record<ProjectLifecycleStatus, string> = {
  idea: '아이디어',
  planning: '기획',
  developing: '개발',
  testing: '테스트',
  deployed: '배포',
  paused: '중단',
  completed: '완료',
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export function friendlyDataError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('DUPLICATE_DOCUMENT_HASH'))
    return '동일한 SHA-256 원본이 이미 보존되어 있습니다.'
  if (message.includes('create_document_upload') || message.includes('add_document_version'))
    return 'Step 5 SQL Migration을 먼저 Supabase에 적용해 주세요.'
  if (message.includes('duplicate key') || message.includes('unique constraint'))
    return '같은 이름의 항목이 이미 있습니다.'
  if (message.includes('category depth'))
    return '카테고리는 최상위와 하위, 두 단계까지만 만들 수 있습니다.'
  if (message.includes('violates foreign key')) return '사용 중인 항목이라 작업할 수 없습니다.'
  return '작업을 완료하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.'
}
