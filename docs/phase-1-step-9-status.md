# Phase 1 Step 9 — Integrated Search

## 구현 완료

- `search_knowledge` 단일 RPC와 사용자별 RLS 경계
- 한글·영문 부분 검색 및 `pg_trgm` 유사도 보조 순위
- 제목, 요약, 별칭, Category, Tag, REF Node, 원문 Section 통합 검색
- Node 유형, Category, Tag, Project, 원본 형식, 확인 상태, 항목 상태, 수정일 필터
- 점수, 일치 이유, 원문 snippet, heading path, locator 반환
- 검색어 강조와 원문 Version·Section 위치 이동
- URL 기반 검색 조건과 20개 단위 페이지 이동
- 상단 검색 및 `Ctrl/⌘ + K`, 모바일 Search 메뉴

## Search Gate

Step 9 migration을 적용하고 비밀숫자 REF를 파싱·구조화한 계정으로 실행합니다.

```bash
npm run evaluate:search
```

평가 세트는 서비스명, 기술명, 문제 증상, 교실 운영 표현, 재사용 Pattern, 복구 표현을 포함합니다. 6개 검색이 모두 관련 REF 또는 Evidence를 반환해야 통과합니다.

## 제외 경계

- AI Chat과 외부 모델 호출 없음
- Embedding 생성과 Vector Search 없음
- 자동 Tag와 자동 Relation 추천 없음
- Memory 추론 없음

검색은 V1의 PostgreSQL 키워드·부분·유사도 검색만 사용합니다.
