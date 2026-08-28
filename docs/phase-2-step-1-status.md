# Phase 2 Step 1 — AI Provider Foundation

## 구현 범위

- 교체 가능한 AI Provider 인터페이스와 Gemini 구현
- `GEMINI_API_KEY`를 브라우저에 노출하지 않는 Supabase Edge Function
- Edge Function 내부 사용자 JWT 재검증과 허용 Origin 검사
- Provider·모델·호출 목적·Token·오류 코드만 저장하는 최소 AI 실행 로그
- 하루 15회, 입력 100,000 Token의 앱 내부 무료 사용 보호 한도
- AI Settings의 Provider·모델·오늘 사용량·연결 테스트
- OpenAI Provider 추가 시 프런트 호출 경로를 바꾸지 않는 Gateway 구조

## 의도적 제외

이번 단계는 연결 기반만 제공합니다. 실제 Jarvis 대화, RAG, Embedding, 자동 요약·Node 추천은 다음 단계에서 구현합니다. 연결 테스트는 고정된 짧은 문장만 Gemini에 전송합니다.

무료 티어의 실제 Quota는 Google 정책이 우선합니다. 앱 내부 한도는 과다 호출 방지를 위한 추가 장치이며 결제 차단 장치 자체는 아닙니다. 무료 티어에서는 제품 개선에 콘텐츠가 사용될 수 있으므로 실제 문서 전송은 아직 활성화하지 않습니다.
