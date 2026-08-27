import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { ErrorState, LoadingState } from '@/shared/ui/States'

import { useAuth } from './auth-context'

export function ProtectedRoute() {
  const { status, retrySession } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <LoadingState fullPage label="개인 지식 공간을 확인하고 있습니다" />
  }

  if (status === 'error') {
    return (
      <ErrorState
        fullPage
        title="로그인 상태를 확인하지 못했습니다"
        description="네트워크 연결을 확인한 뒤 다시 시도해 주세요."
        actionLabel="다시 시도"
        onAction={() => void retrySession()}
      />
    )
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
