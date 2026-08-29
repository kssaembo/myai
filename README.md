# Personal AI Knowledge OS

Current checkpoint: **Phase 2 Step 3 — Embedding Hybrid RAG**.

개인이 장기간 축적하는 문서, 프로젝트, 아이디어와 그 근거를 관리하기 위한 Personal AI Knowledge OS입니다.

V1 지식 저장·검색·Graph·Export 기반 위에 Gemini 서버 Gateway, 근거 기반 대화, 대화 기록,
문서 Section 임베딩과 키워드·의미 혼합 검색을 추가했습니다. 문서별 AI 사용 동의가 켜진
자료만 임베딩과 RAG에 사용됩니다.

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

## 현재 단계 경계

V2 Step 3 Gate는 허용된 문서의 active version Section만 768차원 벡터로 색인하고, 대화에서
키워드 검색과 의미 검색을 결합해 출처를 저장하는 것입니다. 자동 추천·일일 브리핑·장기 Memory는
후속 단계 범위입니다. 배포 절차는 [V2 Step 3 가이드](./docs/v2-step3-deployment.md)를 참고합니다.
