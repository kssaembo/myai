import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/app/layout/AppShell'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { LoginPage } from '@/features/auth/LoginPage'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { GraphPage } from '@/pages/graph/GraphPage'
import { ImportsPage } from '@/pages/imports/ImportsPage'
import { ConnectionsPage } from '@/pages/connections/ConnectionsPage'
import {
  KnowledgeDetailPage,
  KnowledgeFormPage,
  KnowledgeListPage,
} from '@/pages/knowledge/KnowledgePages'
import { RefReviewPage } from '@/pages/ref-review/RefReviewPage'
import { SearchPage } from '@/pages/search/SearchPage'
import { TaxonomyPage } from '@/pages/settings/TaxonomyPage'
import { TrashPage } from '@/pages/trash/TrashPage'
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
              <Route path="knowledge" element={<KnowledgeListPage />} />
              <Route path="knowledge/new" element={<KnowledgeFormPage />} />
              <Route path="knowledge/:itemId/ref-review" element={<RefReviewPage />} />
              <Route path="knowledge/:itemId/connections" element={<ConnectionsPage />} />
              <Route path="knowledge/:itemId" element={<KnowledgeDetailPage />} />
              <Route path="knowledge/:itemId/edit" element={<KnowledgeFormPage />} />
              <Route path="projects" element={<KnowledgeListPage projectOnly />} />
              <Route path="projects/:itemId" element={<KnowledgeDetailPage />} />
              <Route path="graph" element={<GraphPage />} />
              <Route path="imports" element={<ImportsPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="settings/taxonomy" element={<TaxonomyPage />} />
              <Route path="trash" element={<TrashPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
