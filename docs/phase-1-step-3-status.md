# Phase 1 Step 3 — App Shell과 Auth UI 상태

## 구현 완료

- 공개 회원가입 링크가 없는 이메일·비밀번호 로그인
- 로그인 실패 시 계정 존재 여부를 노출하지 않는 일반 오류 문구
- 비밀번호 재설정 메일 요청과 새 비밀번호 설정 화면
- Supabase `INITIAL_SESSION` 기반 세션 복구
- 비로그인 사용자의 내부 Route 차단과 원래 경로 복귀
- 로그아웃과 실패 상태 안내
- Dashboard, Knowledge, Projects, Graph, Imports, Settings 탐색 구조
- 데스크톱 Sidebar와 모바일 Drawer
- Loading, Empty, Error 공통 상태 컴포넌트
- Dashboard의 명시적인 빈 상태
- Vercel SPA Route fallback

## 의도적으로 미구현

- 회원가입
- Dashboard 실제 집계 쿼리
- Knowledge·Category·Tag CRUD
- 업로드, 파싱, 검색, Graph 데이터 시각화
- AI, RAG, Memory

상단 검색·업로드·새 문서 버튼은 향후 기능을 오해하지 않도록 비활성 상태로 표시합니다.

## Step 3 승인 Gate

- [ ] Supabase에서 본인 사용자를 관리자 방식으로 생성
- [ ] Vercel 주소를 Supabase Site URL과 Redirect URLs에 등록
- [ ] 비로그인 상태에서 `/` 접근 시 `/login` 이동
- [ ] 실제 계정 로그인 후 Dashboard 이동
- [ ] 새로고침 후 로그인 세션 유지
- [ ] 로그아웃 후 `/login` 이동
- [ ] 비밀번호 재설정 메일 링크가 `/login?mode=recovery`로 복귀

Gate 완료 후 Phase 1 Step 4 — Taxonomy와 Knowledge Item CRUD로 진행합니다.
