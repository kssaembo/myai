# Gemini Edge Function 적용

## 1. SQL 적용

Supabase SQL Editor에서 다음 파일 전체를 실행합니다.

```text
supabase/migrations/20260828000200_ai_provider_foundation.sql
```

## 2. Secret 등록

API 키는 저장소, `.env.local`, Vercel의 `VITE_*`에 넣지 않습니다. Supabase CLI를 연결한 환경에서 다음 명령을 실행합니다.

```bash
npx supabase secrets set GEMINI_API_KEY="실제_API_키"
npx supabase secrets set APP_ORIGINS="https://실제주소.vercel.app,http://localhost:5173"
```

Dashboard의 Edge Functions Secret 관리 화면에서도 같은 이름으로 등록할 수 있습니다. `APP_ORIGINS`는 쉼표로 구분한 정확한 Origin 목록입니다.

- 운영 주소만 사용할 경우: `https://실제주소.vercel.app`
- 로컬 개발도 허용할 경우: `https://실제주소.vercel.app,http://localhost:5173`
- 경로와 마지막 `/`는 넣지 않습니다.

## 3. Function 배포

```bash
npx supabase login
npx supabase link --project-ref 실제_PROJECT_REF
npx supabase functions deploy ai-gateway --no-verify-jwt
```

`--no-verify-jwt`는 인증을 끄고 공개한다는 뜻이 아닙니다. 새 publishable/auth key 형식과 호환되도록 Gateway 코드가 Bearer Token을 받아 `auth.getUser`로 직접 검증합니다. Origin과 로그인 세션을 모두 통과해야 Gemini 호출이 가능합니다.

## 4. 프런트 재배포 및 확인

Step 1 소스를 GitHub에 반영하고 Vercel 재배포 후 `Settings → AI 연결 → Gemini 연결 테스트`를 실행합니다. 성공 시 오늘 요청 횟수가 1 증가합니다.

키를 대화나 오류 화면에 붙여 넣지 않습니다. 오류가 발생하면 키를 제외한 오류 코드만 공유합니다.
