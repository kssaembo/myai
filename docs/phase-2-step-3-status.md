# Phase 2 Step 3 상태

## 완료 범위

- Gemini `gemini-embedding-001` batch embedding
- 768차원 정규화 vector 저장
- `document_sections` HNSW cosine index
- active version과 문서별 `AI 허용`에 따른 색인 경계
- 12개 Section 단위 수동 backfill
- 키워드 검색과 의미 검색의 RRF 기반 결합
- 의미 검색 실패 시 키워드 검색 fallback
- 기존 AI 대화 출처 저장과 연결
- 사용자별 RPC 권한과 anon 접근 차단 계약

## 의도적으로 제외한 범위

- 파일 업로드 직후 자동 background embedding
- 추천 피드와 일일 briefing
- 장기 사용자 memory
- embedding model 자동 migration
- 결제형 대규모 batch 처리

## 적용 Gate

1. `20260829000200_vector_rag.sql` 적용
2. 최신 프런트엔드 Vercel 배포
3. `ai-gateway` Edge Function 재배포
4. 문서별 AI 허용
5. AI 설정에서 pending Section을 0까지 색인
6. 의미가 유사하지만 단어가 다른 질문에서 개인 문서 출처 확인
