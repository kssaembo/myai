# V2 AI Gateway 안정화 배포

이 수정은 Gemini 연결 테스트나 대화가 끝나지 않고 무한 대기하는 문제를 막습니다. DB Migration과 Secret 변경은 필요하지 않습니다.

## 배포 순서

1. 최신 소스를 GitHub 저장소에 업로드합니다. `.env.local`, `node_modules`, `dist`는 제외합니다.
2. Vercel의 자동 배포가 완료될 때까지 기다립니다.
3. 연결된 프로젝트 폴더의 PowerShell에서 Edge Function만 다시 배포합니다.

```powershell
npx supabase functions deploy ai-gateway
```

4. 서비스에서 `설정 → AI 연결 → Gemini 연결 테스트`를 실행합니다.
5. Dashboard에서 짧은 질문을 하고 답변이나 35초 이내의 명확한 오류 안내가 표시되는지 확인합니다.

## 정상 로그

Edge Function Logs에는 요청별로 다음 단계가 남습니다.

- `request_accepted`
- `status_loaded`
- `provider_request_started`
- `provider_request_completed`

`provider_request_started`에서 끝난 뒤 `GEMINI_TIMEOUT`이 남으면 Google API 응답 지연입니다. 질문, 문서 본문, API 키는 로그에 남기지 않습니다.
