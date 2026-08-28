# Repository Structure

```text
personal-ai-knowledge-os/
├── .github/workflows/quality.yml
├── docs/                         # 운영 절차와 단계별 완료 조건
├── scripts/                      # DB 타입 생성과 원격 보안 검증
├── src/
│   ├── app/       # 앱 시작점과 전역 조립
│   ├── entities/  # Document, Taxonomy, Import, REF, Search, Export, Trash 도메인 API
│   ├── features/  # Auth, Dashboard 등 사용자 기능 단위 모듈
│   ├── pages/     # Route 단위 화면
│   ├── shared/    # 공통 코드와 Supabase adapter
│   ├── styles/    # 전역 스타일과 디자인 토큰
│   └── test/      # 공통 테스트 설정
├── supabase/
│   ├── migrations/               # 버전 관리되는 DB 계약
│   ├── tests/database/           # pgTAP schema·security 검사
│   ├── config.toml               # 로컬 Supabase/Auth 설정
│   └── seed.sql                  # 로컬 전용 seed 진입점
├── .env.example
├── vercel.json                  # SPA 보호 Route 새로고침 fallback
├── eslint.config.js
├── vitest.config.ts
└── vite.config.ts
```

## 의존 방향

```text
app → features → shared
```

- `shared`는 `features` 또는 `app`을 import하지 않습니다.
- 하나의 Feature가 다른 Feature 내부 구현을 직접 import하지 않습니다.
- Feature 간 조합은 `app`에서 수행합니다.
- 도메인 구조가 실제 구현으로 확인되기 전에는 불필요한 계층을 추가하지 않습니다.

## Supabase 계층

- `src/shared/lib/supabase/env.ts`: 브라우저 공개 환경변수를 검증합니다.
- `src/shared/lib/supabase/client.ts`: publishable key를 사용하는 단일 브라우저 client입니다.
- `src/shared/lib/supabase/database.types.ts`: migration과 맞춘 초기 타입이며, 원격 반영 후 `npm run db:types`로 실제 schema에서 재생성합니다.
- secret key, `service_role` key와 DB password는 브라우저 코드나 저장소에 두지 않습니다.

## 아직 존재하지 않는 계층

RAG, AI와 Memory 관련 계층은 의도적으로 만들지 않았습니다. 각 계층은 V2에서 책임과 인터페이스가 확정된 뒤 추가합니다. Graph는 검토된 Relation의 읽기 전용 탐색 계층으로 구현되어 있습니다.
