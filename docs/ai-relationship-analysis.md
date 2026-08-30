# Visual Knowledge OS Step 2 — AI 관계 분석

이 단계는 기존 V1 프로젝트·Relation·REF 근거를 Gemini가 비교하고, 다음 관계 지도에서 사용할
구조화된 인사이트로 저장합니다. 화면에는 복잡한 메뉴 대신 Dashboard의 `관계 분석` 버튼만
추가합니다.

## 분석 범위

- Dashboard에서 최근 프로젝트 최대 4개를 선택 범위로 사용합니다.
- 프로젝트와 직접 연결된 지식의 `item_evidence`를 모읍니다.
- `ai_allowed = true`이고 active version에 속한 Section 근거만 Gemini에 전달합니다.
- 공통점, 차이점, 기술 연결, 재사용 구조, 반복 문제, 해결·개발 패턴, 교육 연관성을 분석합니다.
- 각 결과는 서로 다른 프로젝트 2개 이상과 실제 근거 2개 이상을 참조해야 저장됩니다.
- 결과는 먼저 `proposed` 상태로 저장되며 기존 V1 Relation을 자동 변경하지 않습니다.

## 비용 보호

- 새로운 관계 분석은 사용자별 하루 1회로 제한합니다.
- 프로젝트·모델·근거가 같으면 저장된 결과를 반환하고 Gemini를 다시 호출하지 않습니다.
- 전체 AI 한도 15회/일, 입력 100,000 Token/일도 그대로 적용됩니다.

## 배포 순서

1. `20260830000300_ai_relationship_analysis.sql`을 Supabase SQL Editor에서 전체 실행합니다.
2. 프로젝트 폴더에서 `npx supabase functions deploy ai-gateway`를 실행합니다.
3. 최신 소스를 GitHub에 반영해 Vercel을 다시 배포합니다.
4. AI 사용이 허용된 REF 근거가 있는 프로젝트가 2개 이상인지 확인합니다.
5. Dashboard의 `관계 분석`을 누릅니다.

이번 단계는 관계 데이터를 생성·저장하는 기반입니다. 인사이트를 노드와 연결선으로 탐색하는
관계 지도는 다음 단계에서 구현합니다.
