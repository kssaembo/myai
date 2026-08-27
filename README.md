# Personal AI Knowledge OS

Current checkpoint: **Phase 1 Step 4 — Taxonomy and Knowledge Item CRUD**.

개인이 장기간 축적하는 문서, 프로젝트, 아이디어와 그 근거를 관리하기 위한 Personal AI Knowledge OS입니다.

현재 상태는 **Phase 1 Step 3 — App Shell과 Auth UI**입니다. Supabase Foundation 위에 개인 계정 로그인, 비밀번호 재설정, 보호 Route, 세션 복구, 로그아웃, 반응형 App Shell과 Dashboard 빈 상태를 구성했습니다.

실제 Knowledge CRUD, 파일 업로드·파싱, 검색, Graph, AI/RAG, Memory 기능은 아직 구현하지 않았습니다.

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

Step 3 Gate는 실제 Supabase 계정으로 로그인·로그아웃·새로고침 후 세션 복구를 확인해야 완료됩니다. 다음 Step 4에서는 Taxonomy와 Knowledge Item CRUD만 구현합니다.
