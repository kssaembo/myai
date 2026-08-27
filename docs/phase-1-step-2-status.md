# Phase 1 Step 2 — Supabase Foundation 상태

## 구현 완료

- Supabase CLI 프로젝트 구조와 로컬 설정
- Phase 0 계약의 19개 테이블 단일 baseline migration
- 시스템 Node Type 11개와 Relation Type 13개 seed
- 사용자 생성 시 기본 Category 9개와 설정 생성
- 모든 public 테이블의 RLS와 최소 권한
- `knowledge-originals` private bucket과 owner path 정책
- V1에서는 embedding 필드를 NULL로 고정하고 V2 migration에 모델 선택을 유보
- React용 Supabase client, 환경변수 검증과 초기 Database 타입
- schema/권한 pgTAP 검사와 원격 사용자 격리 검사

## 의도적으로 미구현

- 로그인 UI와 보호 Route
- Knowledge/Tag/Category CRUD
- 파일 업로드 UI와 parser
- 검색, Graph, RAG, AI, Memory

## 남은 승인 Gate

현재 저장소만으로 수행되는 lint, typecheck, unit test, 계약 검사와 build는 통과해야 합니다. Step 2의 최종 승인은 사용자의 호스팅 프로젝트에 migration을 적용한 후 `npm run verify:supabase`로 anon 및 교차 사용자 DB/Storage 접근이 차단되는지 확인해야 합니다.

호스팅 자격 증명을 저장소나 대화에 공유하지 않고 [Supabase 적용 가이드](./supabase-setup.md)에 따라 사용자가 직접 실행합니다.
