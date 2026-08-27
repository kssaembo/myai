import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { LoadingState } from '@/shared/ui/States'

import { useAuth } from './auth-context'

type LoginView = 'login' | 'request-reset' | 'update-password'

function getInitialView(isPasswordRecovery: boolean): LoginView {
  const recoveryMode = new URLSearchParams(window.location.search).get('mode') === 'recovery'
  return isPasswordRecovery || recoveryMode ? 'update-password' : 'login'
}

export function LoginPage() {
  const { status, isPasswordRecovery, signIn, sendPasswordReset, updatePassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [view, setView] = useState<LoginView>(() => getInitialView(isPasswordRecovery))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const activeView = isPasswordRecovery ? 'update-password' : view

  if (status === 'loading') {
    return <LoadingState fullPage label="로그인 상태를 확인하고 있습니다" />
  }

  if (status === 'authenticated' && activeView !== 'update-password') {
    const destination = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={destination} replace />
  }

  const clearMessages = () => {
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearMessages()
    setIsSubmitting(true)

    try {
      await signIn(email.trim(), password)
      const destination = (location.state as { from?: string } | null)?.from ?? '/'
      void navigate(destination, { replace: true })
    } catch {
      setErrorMessage('이메일 또는 비밀번호를 확인해 주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearMessages()
    setIsSubmitting(true)

    try {
      await sendPasswordReset(email.trim())
      setSuccessMessage('비밀번호 재설정 메일을 보냈습니다. 받은편지함을 확인해 주세요.')
    } catch {
      setErrorMessage('재설정 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePasswordUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearMessages()

    if (password.length < 12) {
      setErrorMessage('새 비밀번호는 12자 이상이어야 합니다.')
      return
    }

    if (password !== passwordConfirmation) {
      setErrorMessage('새 비밀번호가 서로 일치하지 않습니다.')
      return
    }

    setIsSubmitting(true)
    try {
      await updatePassword(password)
      void navigate('/', { replace: true })
    } catch {
      setErrorMessage('비밀번호를 변경하지 못했습니다. 재설정 링크를 다시 요청해 주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const changeView = (nextView: LoginView) => {
    clearMessages()
    setPassword('')
    setPasswordConfirmation('')
    setView(nextView)
  }

  return (
    <main className="login-page">
      <section className="login-intro" aria-labelledby="login-brand-title">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="eyebrow">Personal Intelligence Workspace</p>
        <h1 id="login-brand-title">
          당신의 지식이
          <br />
          연결되는 공간
        </h1>
        <p className="login-intro-copy">
          기록한 문서와 프로젝트를 한곳에 축적하고, 근거와 관계를 중심으로 다시 발견하세요.
        </p>
        <div className="login-trust-note">
          <span className="trust-dot" />
          Private knowledge workspace
        </div>
      </section>

      <section className="login-panel" aria-labelledby="login-form-title">
        <div className="login-card">
          <div className="login-card-heading">
            <p className="eyebrow">Personal AI Knowledge OS</p>
            <h2 id="login-form-title">
              {activeView === 'login' && '다시 만나서 반갑습니다'}
              {activeView === 'request-reset' && '비밀번호 재설정'}
              {activeView === 'update-password' && '새 비밀번호 설정'}
            </h2>
            <p>
              {activeView === 'login' && '관리자가 생성한 개인 계정으로 로그인하세요.'}
              {activeView === 'request-reset' &&
                '가입된 이메일로 안전한 재설정 링크를 보내드립니다.'}
              {activeView === 'update-password' &&
                '앞으로 사용할 12자 이상의 새 비밀번호를 입력하세요.'}
            </p>
          </div>

          {activeView === 'login' && (
            <form className="auth-form" onSubmit={(event) => void handleLogin(event)}>
              <label>
                <span>이메일</span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  required
                />
              </label>
              <label>
                <span>비밀번호</span>
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="비밀번호 입력"
                  required
                />
              </label>
              {errorMessage && (
                <p className="form-message error" role="alert">
                  {errorMessage}
                </p>
              )}
              <button className="primary-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? '로그인 중…' : '로그인'}
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => changeView('request-reset')}
              >
                비밀번호를 잊으셨나요?
              </button>
            </form>
          )}

          {activeView === 'request-reset' && (
            <form className="auth-form" onSubmit={(event) => void handleResetRequest(event)}>
              <label>
                <span>이메일</span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  required
                />
              </label>
              {errorMessage && (
                <p className="form-message error" role="alert">
                  {errorMessage}
                </p>
              )}
              {successMessage && (
                <p className="form-message success" role="status">
                  {successMessage}
                </p>
              )}
              <button className="primary-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? '전송 중…' : '재설정 메일 보내기'}
              </button>
              <button className="text-button" type="button" onClick={() => changeView('login')}>
                로그인으로 돌아가기
              </button>
            </form>
          )}

          {activeView === 'update-password' && (
            <form className="auth-form" onSubmit={(event) => void handlePasswordUpdate(event)}>
              <label>
                <span>새 비밀번호</span>
                <input
                  type="password"
                  name="new-password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="12자 이상 입력"
                  minLength={12}
                  required
                />
              </label>
              <label>
                <span>새 비밀번호 확인</span>
                <input
                  type="password"
                  name="password-confirmation"
                  autoComplete="new-password"
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  placeholder="한 번 더 입력"
                  minLength={12}
                  required
                />
              </label>
              {errorMessage && (
                <p className="form-message error" role="alert">
                  {errorMessage}
                </p>
              )}
              <button className="primary-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? '변경 중…' : '비밀번호 변경'}
              </button>
            </form>
          )}

          <p className="signup-boundary">공개 회원가입은 제공하지 않습니다.</p>
        </div>
      </section>
    </main>
  )
}
