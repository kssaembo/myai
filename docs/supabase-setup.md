# Supabase Foundation 적용 가이드

이 문서는 Phase 1 Step 2를 호스팅된 Supabase 프로젝트에 안전하게 반영하는 절차입니다. 클라이언트에는 Project URL과 **publishable key**만 사용합니다. secret key, legacy `service_role` key와 Database password는 `.env.local`에 넣지 않습니다.

## Step 7 추가 Migration

Step 6까지 적용했다면 SQL Editor에서 다음 파일을 전체 실행합니다.

```text
supabase/migrations/20260827000400_batch_imports.sql
```

이 Migration은 Import Job/Entry 생성, 파일별 결과 기록, 집계 갱신, 취소를 위한 RLS-aware RPC를 추가합니다. 기존 테이블의 RLS와 Private Storage 정책은 유지됩니다.

## Step 6 추가 Migration

Step 5까지 적용했다면 SQL Editor에서 다음 파일을 전체 실행합니다.

```text
supabase/migrations/20260827000300_parser_sections.sql
```

이 Migration은 로그인 사용자가 자신의 Document Version 파싱 결과와 Section을 한 트랜잭션으로 교체 저장하는 `commit_document_parse` 함수만 추가합니다. 기존 RLS와 Private Storage 정책은 유지됩니다.

## Step 5 추가 Migration

Foundation SQL을 이미 적용했다면 SQL Editor에서 다음 파일을 전체 실행합니다.

```text
supabase/migrations/20260827000200_document_uploads.sql
```

이 Migration은 Document 업로드 메타데이터를 트랜잭션으로 기록하는 함수와 사용자별
SHA-256 조회 인덱스만 추가합니다. 기존 RLS와 Private Storage 정책은 유지됩니다.

## 1. 환경변수 연결

프로젝트 루트에서 예시 파일을 복사합니다.

```bash
cp .env.example .env.local
```

Supabase Dashboard의 **Project Settings → API**에서 값을 확인해 아래 두 항목만 바꿉니다.

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

`VITE_*` 값은 production build에도 포함되어 브라우저에서 볼 수 있습니다. 데이터 보호는 키 은닉이 아니라 RLS로 보장해야 합니다.

## 2. 공개 가입 차단과 개인 계정 생성

Dashboard에서 다음을 확인합니다.

1. **Authentication → Sign In / Providers → Email**에서 신규 사용자 가입을 끕니다.
2. Anonymous Sign-ins가 꺼져 있는지 확인합니다.
3. **Authentication → Users → Add user**에서 본인이 사용할 계정을 관리자 방식으로 생성합니다.
4. 원격 보안 Gate를 위해 임시 테스트 계정 A와 B를 추가로 만듭니다. 검증 후 두 계정은 삭제할 수 있습니다.

로컬 `supabase/config.toml`도 `enable_signup = false`, `enable_anonymous_sign_ins = false`, 최소 비밀번호 길이 12로 맞춰 두었습니다. 다만 이 파일만으로 이미 만든 호스팅 프로젝트의 Auth 설정이 자동 변경되지는 않으므로 Dashboard 확인이 필요합니다.

## 3. Migration 적용

### 권장: Supabase CLI

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npm run db:push
```

CLI 로그인 토큰과 DB password는 CLI 프롬프트 또는 운영체제의 안전한 자격 증명 흐름에서만 입력합니다. 파일에 기록하지 않습니다.

### 대안: Dashboard SQL Editor

CLI 연결이 어려우면 Dashboard의 **SQL Editor**에서 아래 파일 전체를 새 Query로 실행합니다.

```text
supabase/migrations/20260827000100_foundation.sql
```

성공 후 다음을 확인합니다.

- Table Editor의 `public` schema에 19개 테이블
- `node_types`의 시스템 행 11개
- `relation_types`의 시스템 행 13개
- 본인 계정의 `categories` 9개와 `user_settings` 1개
- Storage의 private `knowledge-originals` bucket
- Database/Linter 또는 Security Advisor에 RLS 미적용 경고가 없는지

Migration이 이미 존재하는 프로젝트에 같은 SQL을 반복 실행하지 않습니다. 수정이 필요하면 새 migration을 추가합니다.

## 4. DB 타입을 실제 schema와 동기화

Migration 반영 후 실제 원격 DB에서 타입을 다시 생성합니다.

macOS/Linux:

```bash
SUPABASE_PROJECT_REF=<project-ref> npm run db:types
```

PowerShell:

```powershell
$env:SUPABASE_PROJECT_REF = "<project-ref>"
npm run db:types
```

그 다음 `npm run check`를 실행합니다. 저장소에 포함된 `database.types.ts`는 migration 기준 초기 타입이며, 원격 생성 결과가 최종 기준입니다.

## 5. 원격 보안 Gate 실행

`.env.verification.example`을 `.env.verification.local`로 복사하고 임시 계정 A/B의 이메일과 비밀번호를 입력합니다.

```bash
cp .env.verification.example .env.verification.local
npm run verify:supabase
```

검사는 다음을 실제 publishable key로 확인합니다.

- 비로그인 DB 조회 차단
- 사용자 A의 정상 INSERT/DELETE
- 사용자 B가 A의 행을 읽거나 쓸 수 없음
- 사용자 A의 private Storage 업로드/삭제
- 비로그인 사용자와 사용자 B의 A 파일 다운로드 차단

성공 메시지를 확인한 뒤 `.env.verification.local`을 삭제하고 임시 계정을 제거합니다. 검증 스크립트가 만든 DB 행과 파일은 정상 실행 시 자동 삭제됩니다.

## 6. 로컬 DB 테스트(선택이지만 권장)

Docker가 설치된 환경에서는 migration을 깨끗한 DB에 재적용하고 pgTAP 검사를 실행할 수 있습니다.

```bash
npm run supabase:start
npm run db:reset
npm run db:lint
npm run db:test
npm run supabase:stop
```

`db:reset`은 로컬 Supabase DB를 다시 만드는 명령입니다. 호스팅된 production 데이터베이스를 대상으로 사용하지 않습니다.

## Step 2 완료 조건

- [ ] 호스팅 프로젝트에 migration 적용
- [ ] 공개 가입과 anonymous sign-in 비활성 확인
- [ ] 19개 테이블, 11/13 사전, 9개 기본 Category 확인
- [ ] `knowledge-originals`가 private인지 확인
- [ ] 실제 DB 타입 재생성 후 `npm run check` 통과
- [ ] `npm run verify:supabase` 통과

모든 항목이 끝난 뒤에만 Phase 1 Step 3 — App Shell과 Auth UI로 진행합니다.

## Step 3 Auth URL 설정

로그인 UI를 Vercel에 배포한 뒤 Supabase Dashboard의 **Authentication → URL Configuration**에서 다음을 설정합니다.

- Site URL: 실제 Vercel production 주소
- Redirect URLs: `https://<실제-도메인>/login?mode=recovery`
- 로컬 개발도 사용할 경우: `http://localhost:5173/login?mode=recovery`

비밀번호 재설정 메일이 올바른 서비스로 돌아오기 위해 필요합니다. Vercel 환경변수 저장 후에는 새 deployment를 실행해야 합니다.
