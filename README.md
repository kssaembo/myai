# Personal AI Knowledge OS

Current checkpoint: **Phase 1 Step 12 — Knowledge Graph**.

개인이 장기간 축적하는 문서, 프로젝트, 아이디어와 그 근거를 관리하기 위한 Personal AI Knowledge OS입니다.

현재는 로그인부터 Project 집계까지의 기능에 더해 Relation·Evidence 편집, Node 병합과 Project 중심 Knowledge Graph까지 구성했습니다.

AI/RAG와 Memory 기능은 아직 구현하지 않았습니다.

## 요구 환경

- Node.js 24.x (`.nvmrc`: 24.19.0)
- npm 10 이상

`.nvmrc`를 사용하는 환경에서는 `nvm use`로 기준 Node.js 버전을 선택할 수 있습니다.

## 시작하기

```bash
npm ci
cp .env.example .env.local
npm run dev
```

## 명령

| 명령                      | 역할                                         |
| ------------------------- | -------------------------------------------- |
| `npm run dev`             | 로컬 개발 서버 실행                          |
| `npm run typecheck`       | TypeScript 정적 검사                         |
| `npm run lint`            | ESLint 검사, 경고도 실패 처리                |
| `npm run format`          | Prettier 자동 포맷                           |
| `npm run format:check`    | 포맷 변경 없이 검사                          |
| `npm run test`            | Vitest 일회 실행                             |
| `npm run test:watch`      | Vitest 감시 모드                             |
| `npm run build`           | 타입 검사 후 production build                |
| `npm run supabase:start`  | 로컬 Supabase 시작(Docker 필요)              |
| `npm run db:reset`        | 로컬 DB migration 재적용                     |
| `npm run db:push`         | 연결된 원격 프로젝트에 migration 적용        |
| `npm run db:test`         | pgTAP DB 계약·보안 검사                      |
| `npm run db:types`        | 실제 DB에서 TypeScript 타입 재생성           |
| `npm run verify:supabase` | 원격 anon·교차 사용자 DB/Storage 차단 검사   |
| `npm run evaluate:search` | 실제 REF 데이터로 Step 9 검색 평가 세트 실행 |
| `npm run check`           | 전체 품질 Gate 실행                          |

## 현재 품질 Gate

다음 명령이 모두 통과해야 다음 단계로 진행합니다.

```bash
npm ci
npm run check
```

세부 규칙은 [CONTRIBUTING.md](./CONTRIBUTING.md), [Supabase 설정 가이드](./docs/supabase-setup.md), [저장소 구조 문서](./docs/repository-structure.md)를 참고합니다.

## 다음 단계 경계

Step 12 Gate는 검토된 Relation을 Project 중심 그래프에서 검색·필터·선택하며 탐색할 수 있는지 확인하는 것입니다. 다음은 Phase 1 최종 Step 13의 Export·휴지통·보안 강화·20개 REF 검증이며, AI 분석과 Vector Search는 V2에서 진행합니다.
