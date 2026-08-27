import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/app/layout/AppShell'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { LoginPage } from '@/features/auth/LoginPage'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { SectionPlaceholderPage } from '@/shared/ui/SectionPlaceholderPage'
import '@/styles/global.css'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route
                path="knowledge"
                element={
                  <SectionPlaceholderPage
                    eyebrow="Knowledge"
                    title="지식 라이브러리"
                    description="문서와 아이디어를 생성하고 분류하는 기능은 Phase 1 Step 4에서 연결됩니다."
                  />
                }
              />
              <Route
                path="projects"
                element={
                  <SectionPlaceholderPage
                    eyebrow="Projects"
                    title="프로젝트"
                    description="프로젝트 생성과 Knowledge 연결은 Phase 1 Step 4에서 연결됩니다."
                  />
                }
              />
              <Route
                path="graph"
                element={
                  <SectionPlaceholderPage
                    eyebrow="Graph"
                    title="Knowledge Graph"
                    description="Node와 Relation을 탐색하는 Graph는 V1 후반 단계에서 구현됩니다."
                  />
                }
              />
              <Route
                path="imports"
                element={
                  <SectionPlaceholderPage
                    eyebrow="Imports"
                    title="가져오기"
                    description="MD·TXT·PDF·DOCX 업로드와 파싱은 Phase 1 Step 5 이후에 연결됩니다."
                  />
                }
              />
              <Route
                path="settings/taxonomy"
                element={
                  <SectionPlaceholderPage
                    eyebrow="Settings"
                    title="분류 체계 설정"
                    description="Node Type과 Relation Type을 확인하는 설정 화면은 다음 단계에서 연결됩니다."
                  />
                }
              />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
