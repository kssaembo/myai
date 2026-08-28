# Phase 1 Step 13 — Export, Trash, Hardening, Final Verification

## 구현 범위

- Knowledge Item 전체 스냅샷 JSON Export
- 사용자 입력의 HTML을 이스케이프한 Markdown Export
- Document Version별 Private Storage 원본 다운로드
- Relation 상태를 함께 보존하는 휴지통 이동·복원
- 제목 재입력 확인 후 DB 연쇄 삭제와 Storage 원본 영구 삭제
- 50MiB 파일 제한, MIME·파일 서명 검사
- ZIP 경로 순회·중첩 ZIP·암호화·심볼릭 링크·중복 영역·확장 크기 공격 방어
- Export filename과 Markdown XSS 회귀 테스트
- 20개 이상 REF Markdown corpus 구조 검증 명령
- Step 13 RPC의 anon 차단·authenticated 실행 권한 pgTAP 검사

## 완료 Gate

로컬 품질 Gate와 원격 RLS/Storage 검사를 통과하고, 실제 20개 REF 문서를 일괄 Import·파싱·구조화·검색·Graph 탐색한 뒤 Export와 휴지통 복원을 확인해야 V1 운영 검증이 완료됩니다.

코드 Gate와 실제 데이터 Gate는 구분합니다. 저장소에 전체 20개 REF corpus가 없으면 `verify:ref-corpus`는 사용자가 corpus 경로를 지정해 별도로 실행합니다.
