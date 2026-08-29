# V2 Step 3 — Embedding Hybrid RAG 적용

이번 단계는 문서 Section을 Gemini embedding으로 변환해 Supabase `pgvector`에 저장하고,
Dashboard 대화에서 키워드 검색과 의미 검색을 함께 사용합니다.

## 1. SQL 적용

Supabase SQL Editor에서 다음 파일 전체를 한 번 실행합니다.

```text
supabase/migrations/20260829000200_vector_rag.sql
```

이 migration은 기존 V1의 embedding 금지 제약을 제거하고 768차원 vector, HNSW index와
사용자별 RPC를 추가합니다. 기존 Section 본문이나 원본 파일은 삭제하지 않습니다.

## 2. 소스 배포

최신 소스를 GitHub에 업로드합니다. 다음 항목은 업로드하지 않습니다.

```text
node_modules/
.env.local
dist/
```

Vercel 배포가 완료되면 Supabase Edge Function을 다시 배포합니다.

```powershell
npx supabase functions deploy ai-gateway
```

기존 `GEMINI_API_KEY`, `APP_ORIGINS` Secret은 그대로 사용하므로 새 Secret은 필요 없습니다.

## 3. 문서 허용 및 색인

1. Knowledge에서 사용할 문서를 엽니다.
2. 문서 정보의 **AI 허용 안 함 · 켜기**를 누릅니다.
3. Settings → AI 연결에서 **다음 12개 Section 색인**을 누릅니다.
4. 남은 Section이 0이 될 때까지 반복합니다.

색인은 Gemini 요청과 입력 token을 사용하므로 앱의 일일 무료 사용 보호 한도 안에서 실행됩니다.
한도에 도달하면 다음 UTC 날짜에 이어서 실행할 수 있습니다.

## 4. 동작 확인

Dashboard에서 문서의 정확한 단어를 쓰지 않고 의미가 비슷한 질문을 합니다. 답변 아래에 실제
개인 문서 출처가 표시되면 정상입니다. 의미 검색이 실패해도 기존 키워드 검색으로 자동 전환됩니다.

문서의 AI 허용을 끄면 기존 embedding을 즉시 검색 대상에서 제외합니다. 문서를 다시 파싱하면 새
Section은 미색인 상태가 되므로 AI 설정에서 다시 색인해야 합니다.
