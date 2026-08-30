# Visual Knowledge OS — 관계 데이터 구조 설계

## 이번 단계의 결론

기존 `knowledge_items`, `relations`, `relation_evidence`는 삭제하거나 대체하지 않습니다.
기존 Relation은 사용자가 확인한 **구체적인 1:1 관계**의 원본으로 유지하고, AI가 여러 프로젝트를
함께 분석해 발견한 공통점·차이점·반복 패턴은 별도의 `visual_insights` 계층에 저장합니다.

이 구분이 없으면 AI의 추론과 사용자가 확인한 사실이 같은 그래프 Edge로 섞여 신뢰도와 화면
가독성이 동시에 떨어집니다.

## 유지하는 구조

| 기존 구조                                    | 유지 이유                                                 |
| -------------------------------------------- | --------------------------------------------------------- |
| `knowledge_items`와 11개 Node Type           | Project·Technology·Problem·Solution·Pattern 표현에 충분함 |
| `relations`와 13개 Relation Type             | 확인된 1:1 관계의 기준 데이터                             |
| `item_evidence`, `relation_evidence`         | 문서·Section 근거 추적                                    |
| `projects`, `documents`, `document_sections` | 프로젝트 상세·원문·RAG와 호환                             |
| Gemini Gateway·Embedding·대화                | 다음 AI 관계 분석 단계에서 그대로 재사용                  |
| 기존 Graph RPC와 화면                        | 새 시각화가 완성될 때까지 현재 기능 유지                  |

## 추가한 구조

| 테이블                    | 역할                                               |
| ------------------------- | -------------------------------------------------- |
| `visual_analysis_runs`    | 관계·비교·패턴 분석의 모델, 버전, 상태 기록        |
| `visual_analysis_scope`   | 분석에 포함된 프로젝트와 지식 범위                 |
| `visual_insights`         | 공통점·차이점·기술 연결·반복 문제 등의 구조화 결과 |
| `visual_insight_items`    | 하나의 인사이트에 여러 프로젝트·문제·해결책을 연결 |
| `visual_insight_evidence` | 인사이트를 뒷받침하는 문서 Section과 근거 문장     |

## 인사이트 종류

- `commonality`: 프로젝트 공통점
- `difference`: 프로젝트 차이점
- `technical_link`: 기술적 연관성
- `reusable_component`: 재사용 가능한 기능·구조
- `recurring_problem`: 반복 문제
- `solution_pattern`: 반복 해결 방법
- `development_pattern`: 개발 패턴
- `educational_link`: 교육적 연관성

`dimension`은 `architecture`, `technology`, `ux`, `operation`, `education`처럼 향후 비교 지도의
축으로 사용할 확장 가능한 키입니다.

## 기존 데이터 호환 방식

기존 데이터를 새 테이블로 복사하지 않습니다. 향후 시각화는
`get_visual_relationship_foundation()`을 통해 다음을 함께 읽습니다.

1. 기존 `relations`의 활성·제안 Edge
2. AI가 생성하고 사용자가 검토할 `visual_insights`
3. 인사이트에 참여한 여러 Knowledge Item
4. 문서 Section 근거와 차원별 집계

AI 인사이트가 사용자의 승인을 받아 실제 1:1 관계로 확정되면 `promoted_relation_id`로 기존
Relation과 연결합니다. 따라서 AI 제안이 확정 사실을 덮어쓰지 않습니다.

## 보안과 변경 경계

- 5개 신규 테이블 모두 사용자별 RLS를 적용했습니다.
- 브라우저는 읽기만 가능하고 직접 삽입·수정할 수 없습니다.
- 다음 AI 분석 단계에서 Edge Function이 검증된 RPC를 통해서만 결과를 저장합니다.
- 기존 데이터에 대한 Backfill, 삭제, 변환은 없습니다.
- 현재 UI는 변경하지 않았습니다.

## 다음 단계

다음은 **AI 관계 분석 구현**입니다. Gemini가 선택된 프로젝트의 허용 문서 Section을 분석하고,
이번 스키마에 맞는 JSON을 생성한 뒤 서버가 항목 소유권·근거·신뢰도를 검증하여 저장합니다.
