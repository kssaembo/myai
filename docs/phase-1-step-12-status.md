# Phase 1 Step 12 — Knowledge Graph

## 구현 범위

- Sigma.js와 Graphology 기반 Project 중심 그래프
- 사용자가 소유한 활성·제안 Relation만 반환하는 RLS-aware RPC
- 중심 Project에서 최대 2-hop 탐색
- Node 유형, Relation 유형, 상태 필터와 제목·요약 검색
- Node·Relation 선택 Inspector와 Evidence 개수 표시
- Relation 100개 단위 점진적 로딩
- Node 상세와 Relation 관리 화면 연결

## 완료 Gate

구조화와 검토가 끝난 Project를 선택했을 때 평가된 Relation이 그래프에 나타나며, 필터·검색·선택 Inspector·상세 이동을 사용할 수 있어야 합니다.

## 의도적 제외

AI Chat, 자동 관계 생성, Embedding, Vector Search와 Memory는 V2 범위입니다. Step 12 그래프는 사용자가 검토해 저장한 관계만 시각화합니다.

별도 이미지나 사운드 자산은 필요하지 않습니다. 그래프 색상은 DB의 Node Type·Relation Type 사전을 사용합니다.
