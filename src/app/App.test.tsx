import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'

type AuthStateCallback = (event: string, session: unknown) => void

const authHarness = vi.hoisted(() => ({
  callback: null as AuthStateCallback | null,
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
}))

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    auth: authHarness,
  },
}))

const fakeSession = {
  access_token: 'test-access-token',
  expires_in: 3600,
  refresh_token: 'test-refresh-token',
  token_type: 'bearer',
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'owner@example.com',
  },
}

describe('authentication shell', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    authHarness.callback = null
    authHarness.getSession.mockReset()
    authHarness.resetPasswordForEmail.mockReset()
    authHarness.signInWithPassword.mockReset()
    authHarness.signOut.mockReset()
    authHarness.updateUser.mockReset()
    authHarness.onAuthStateChange.mockReset()
    authHarness.onAuthStateChange.mockImplementation((callback: AuthStateCallback) => {
      authHarness.callback = callback
      callback('INITIAL_SESSION', null)
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
  })

  it('redirects anonymous visitors to the private login screen', async () => {
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: '다시 만나서 반갑습니다' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /회원가입/ })).not.toBeInTheDocument()
  })

  it('restores an existing session and renders the protected dashboard', async () => {
    authHarness.onAuthStateChange.mockImplementation((callback: AuthStateCallback) => {
      authHarness.callback = callback
      callback('INITIAL_SESSION', fakeSession)
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: '무엇을 함께 생각해 볼까요?' }),
    ).toBeInTheDocument()
    expect(screen.getByText('owner@example.com')).toBeInTheDocument()
  })

  it('signs in with email and password', async () => {
    authHarness.signInWithPassword.mockImplementation(() => {
      authHarness.callback?.('SIGNED_IN', fakeSession)
      return Promise.resolve({ data: { session: fakeSession }, error: null })
    })

    render(<App />)

    fireEvent.change(await screen.findByLabelText('이메일'), {
      target: { value: 'owner@example.com' },
    })
    fireEvent.change(screen.getByLabelText('비밀번호'), {
      target: { value: 'correct-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: '로그인' }))

    expect(
      await screen.findByRole('heading', { name: '무엇을 함께 생각해 볼까요?' }),
    ).toBeInTheDocument()
    expect(authHarness.signInWithPassword).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'correct-password',
    })
  })

  it('requests a password reset without exposing account details', async () => {
    authHarness.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '비밀번호를 잊으셨나요?' }))
    fireEvent.change(screen.getByLabelText('이메일'), {
      target: { value: 'owner@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: '재설정 메일 보내기' }))

    expect(
      await screen.findByText('비밀번호 재설정 메일을 보냈습니다. 받은편지함을 확인해 주세요.'),
    ).toBeInTheDocument()
    expect(authHarness.resetPasswordForEmail).toHaveBeenCalledWith('owner@example.com', {
      redirectTo: 'http://localhost:3000/login?mode=recovery',
    })
  })

  it('logs out and returns to login', async () => {
    authHarness.onAuthStateChange.mockImplementation((callback: AuthStateCallback) => {
      authHarness.callback = callback
      callback('INITIAL_SESSION', fakeSession)
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    authHarness.signOut.mockImplementation(() => {
      authHarness.callback?.('SIGNED_OUT', null)
      return Promise.resolve({ error: null })
    })

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '로그아웃' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '다시 만나서 반갑습니다' })).toBeInTheDocument()
    })
  })
})
