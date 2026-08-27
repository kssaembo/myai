# Features

각 사용자 기능을 독립된 폴더로 구성합니다. Feature 내부에는 해당 기능의 컴포넌트, 훅, 서비스, 타입과 테스트를 함께 둡니다.

- `auth`: Supabase 인증 상태, 로그인, 비밀번호 재설정과 Route 보호
- `dashboard`: 개인 Knowledge 공간의 시작 화면과 명시적인 빈 상태

Knowledge CRUD, Import, Search와 Graph는 해당 단계가 시작될 때 별도 Feature로 추가합니다.
