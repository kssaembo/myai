# Personal AI Knowledge OS

개인이 장기간 축적하는 문서, 프로젝트, 아이디어와 그 근거를 관리하기 위한 Personal AI Knowledge OS입니다.

현재 상태는 **Phase 1 Step 2 — Supabase Foundation**입니다. 19개 테이블 migration, 시스템 사전 seed, RLS, Private Storage, Supabase 클라이언트와 DB 타입 기반을 구성했습니다. 호스팅 프로젝트에 migration을 적용하고 원격 보안 Gate를 통과하면 Step 2가 최종 완료됩니다.

로그인 화면과 실제 Knowledge CRUD, 파일 업로드·파싱, 검색, Graph, AI/RAG, Memory 기능은 아직 구현하지 않았습니다.

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

| 명령                      | 역할                                       |
| ------------------------- | ------------------------------------------ |
| `npm run dev`             | 로컬 개발 서버 실행                        |
| `npm run typecheck`       | TypeScript 정적 검사                       |
| `npm run lint`            | ESLint 검사, 경고도 실패 처리              |
| `npm run format`          | Prettier 자동 포맷                         |
| `npm run format:check`    | 포맷 변경 없이 검사                        |
| `npm run test`            | Vitest 일회 실행                           |
| `npm run test:watch`      | Vitest 감시 모드                           |
| `npm run build`           | 타입 검사 후 production build              |
| `npm run supabase:start`  | 로컬 Supabase 시작(Docker 필요)            |
| `npm run db:reset`        | 로컬 DB migration 재적용                   |
| `npm run db:push`         | 연결된 원격 프로젝트에 migration 적용      |
| `npm run db:test`         | pgTAP DB 계약·보안 검사                    |
| `npm run db:types`        | 실제 DB에서 TypeScript 타입 재생성         |
| `npm run verify:supabase` | 원격 anon·교차 사용자 DB/Storage 차단 검사 |
| `npm run check`           | 전체 품질 Gate 실행                        |

## 현재 품질 Gate

다음 명령이 모두 통과해야 다음 단계로 진행합니다.

```bash
npm ci
npm run check
```

세부 규칙은 [CONTRIBUTING.md](./CONTRIBUTING.md), [Supabase 설정 가이드](./docs/supabase-setup.md), [저장소 구조 문서](./docs/repository-structure.md)를 참고합니다.

## 다음 단계 경계

Step 2가 원격 보안 Gate를 통과하기 전에는 Step 3의 로그인 UI와 App Shell을 시작하지 않습니다. 이후 단계의 Knowledge CRUD, 업로드·파싱, 검색, Graph, AI/RAG, Memory도 현재 범위에 포함하지 않습니다.
