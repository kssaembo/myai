# Phase 1 Step 11 — Relation·Evidence Editing and Node Merge

## 구현 완료

- Relation 생성·조회·수정·보관
- Relation Type의 Source·Target 허용 유형 검증
- 대칭 Relation canonical pair와 활성 중복 방지
- Item Evidence 여러 개를 Relation Evidence로 추가
- Evidence 없는 활성 Relation의 `proposed` 자동 유지
- 같은 Node Type의 제목 유사도 기반 중복 후보
- 기준 Node로 Evidence·Tag·Alias·Relation 병합
- Relation 충돌 시 Relation Evidence 통합
- 원본 Document와 불변 Version 미수정

## Gate

Relation 수정 전후와 Node 병합 전후에 `item_evidence` 및 `relation_evidence` 개수와 원문 Section 링크를 대조합니다. 병합된 Node의 Evidence가 기준 Node에 모두 표시되고 중복 활성 Relation이 없어야 합니다.

## 남은 단계

- Step 12: Sigma.js/Graphology Knowledge Graph
- Step 13: Export, Trash, 영구 삭제, 보안 회귀, 20개 REF 최종 검증

별도 이미지·사운드 Asset은 필요하지 않습니다.
