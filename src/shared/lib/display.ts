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
  if (message.includes('commit_document_parse'))
    return 'Step 6 SQL Migration을 먼저 Supabase에 적용해 주세요.'
  if (
    message.includes('create_import_job') ||
    message.includes('update_import_entry') ||
    message.includes('refresh_import_job') ||
    message.includes('cancel_import_job')
  )
    return 'Step 7 SQL Migration을 먼저 Supabase에 적용해 주세요.'
  if (message.includes('mark_ref_profile') || message.includes('commit_ref_review'))
    return 'Step 8 SQL Migration을 먼저 Supabase에 적용해 주세요.'
  if (message.includes('search_knowledge'))
    return 'Step 9 SQL Migration을 먼저 Supabase에 적용해 주세요.'
  if (message.includes('get_project_aggregate'))
    return 'Step 10 SQL Migration을 먼저 Supabase에 적용해 주세요.'
  if (
    message.includes('get_knowledge_connections') ||
    message.includes('save_relation') ||
    message.includes('archive_relation') ||
    message.includes('merge_knowledge_items')
  )
    return 'Step 11 SQL Migration을 먼저 Supabase에 적용해 주세요.'
  if (message.includes('get_knowledge_graph'))
    return 'Step 12 SQL Migration을 먼저 Supabase에 적용해 주세요.'
  if (
    message.includes('export_knowledge_item') ||
    message.includes('trash_knowledge_item') ||
    message.includes('restore_knowledge_item') ||
    message.includes('permanently_delete_knowledge_item')
  )
    return 'Step 13 SQL Migration을 먼저 Supabase에 적용해 주세요.'
  if (
    message.includes('get_ai_status') ||
    message.includes('reserve_ai_request') ||
    message.includes('complete_ai_request')
  )
    return 'V2 Step 1 SQL Migration을 먼저 Supabase에 적용해 주세요.'
  if (message.includes('AI_DAILY_REQUEST_LIMIT'))
    return '오늘의 AI 요청 한도에 도달했습니다. 내일 다시 사용할 수 있습니다.'
  if (message.includes('AI_DAILY_TOKEN_LIMIT')) return '오늘의 AI 입력 Token 한도에 도달했습니다.'
  if (message.includes('GEMINI_API_KEY_NOT_CONFIGURED'))
    return 'Supabase Edge Function Secret에 GEMINI_API_KEY를 등록해 주세요.'
  if (message.includes('FunctionsHttpError') || message.includes('AI_CONNECTIVITY_TEST_FAILED'))
    return 'AI 서버 연결에 실패했습니다. Edge Function 배포와 Secret 설정을 확인해 주세요.'
  if (message.includes('DUPLICATE_ACTIVE_RELATION')) return '같은 활성 Relation이 이미 있습니다.'
  if (
    message.includes('RELATION_SOURCE_TYPE_NOT_ALLOWED') ||
    message.includes('RELATION_TARGET_TYPE_NOT_ALLOWED')
  )
    return '선택한 Relation 유형에서 허용하지 않는 Node 조합입니다.'
  if (message.includes('PARSER_TIMEOUT'))
    return '문서 처리 시간이 2분을 초과했습니다. 더 작은 파일로 다시 시도해 주세요.'
  if (message.includes('PARSER_WORKER_FAILED'))
    return '브라우저 문서 파서를 시작하지 못했습니다. 새로고침 후 다시 시도해 주세요.'
  if (message.includes('duplicate key') || message.includes('unique constraint'))
    return '같은 이름의 항목이 이미 있습니다.'
  if (message.includes('category depth'))
    return '카테고리는 최상위와 하위, 두 단계까지만 만들 수 있습니다.'
  if (message.includes('violates foreign key')) return '사용 중인 항목이라 작업할 수 없습니다.'
  return '작업을 완료하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.'
}
