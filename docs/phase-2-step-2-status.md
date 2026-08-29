# Phase 2 Step 2 — 개인화 대화 MVP

## 완료 범위

- Home 중심의 간결한 개인 AI 화면
- 질문 핵심어 기반 Knowledge·Section 검색
- 최근 대화 최대 8개 메시지 맥락 유지
- Gemini 답변과 Knowledge 출처 링크
- 대화·메시지·출처 사용자별 저장
- 대화 선택·새 대화·삭제
- 진행 중 프로젝트와 최근 지식 요약
- Gemini 3.7 Flash 기본 모델 반영

## 의도적으로 다음 단계에 남긴 범위

- Embedding 생성과 Vector 유사도 검색
- 자동 추천·이슈 감지·일일 브리핑
- 스트리밍 답변
- 복잡한 그래프 시각화 재설계

## 적용 순서

1. `supabase/migrations/20260829000100_ai_conversations.sql` 실행
2. 최신 소스를 GitHub에 반영하고 Vercel 재배포
3. `npx supabase functions deploy ai-gateway --no-verify-jwt` 실행
4. Home에서 새 질문을 보내고 답변의 출처 링크 확인
