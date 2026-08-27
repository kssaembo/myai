# 개발 품질 기준

## 기본 원칙

1. 기능은 `src/features/<feature-name>` 단위로 격리합니다.
2. 여러 기능에서 재사용되는 코드만 `src/shared`로 이동합니다.
3. 앱 초기화, 전역 Provider와 최상위 라우팅만 `src/app`에 둡니다.
4. 테스트는 대상 코드 가까이에 `*.test.ts` 또는 `*.test.tsx`로 둡니다.
5. 클라이언트에 노출되는 `VITE_*` 환경변수에는 비밀값을 저장하지 않습니다.
6. 사용자가 제공한 원본 Knowledge 파일은 수정하지 않고 별도 데이터로 처리합니다.
7. Supabase secret/legacy `service_role` key와 DB password는 저장소·브라우저 코드·이슈에 남기지 않습니다.
8. DB 변경은 Dashboard에서 임의 수정하지 않고 `supabase/migrations`에 먼저 기록합니다.

## 변경 완료 조건

모든 변경은 아래 명령을 통과해야 완료로 간주합니다.

```bash
npm run check
```

이 명령은 포맷, ESLint, TypeScript, 단위 테스트와 production build를 순서대로 검증합니다. ESLint 경고도 실패로 처리합니다.

## 의존성 규칙

- npm과 `package-lock.json`을 기준으로 합니다.
- 의존성은 정확한 버전으로 기록합니다.
- `package-lock.json`을 수동 편집하지 않습니다.
- 목적이 분명하지 않은 패키지는 미리 설치하지 않습니다.
- 의존성 추가 후 `npm ci`와 `npm run check`를 다시 검증합니다.

## 커밋 전 확인

- 요청 범위 밖 기능을 추가하지 않았는가?
- Knowledge와 Memory 책임을 섞지 않았는가?
- 원본 자료와 사용자가 확인하지 않은 추론을 구분했는가?
- 새 환경변수를 `.env.example`에 안전한 예시로 추가했는가?
- 테스트와 production build가 모두 통과하는가?
- 모든 사용자 데이터 테이블에 RLS가 켜져 있고 anon·다른 사용자 접근 검사를 했는가?
