import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { supabase } from '@/shared/lib/supabase'

import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context'

function getStatus(session: Session | null): AuthStatus {
  return session ? 'authenticated' : 'anonymous'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  const readSession = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      setSession(null)
      setStatus('error')
      return
    }

    setSession(data.session)
    setStatus(getStatus(data.session))
  }, [])

  useEffect(() => {
    let isMounted = true

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return

      setSession(nextSession)
      setStatus(getStatus(nextSession))
      setIsPasswordRecovery(event === 'PASSWORD_RECOVERY')
    })

    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [readSession])

  const retrySession = useCallback(async () => {
    setStatus('loading')
    await readSession()
  }, [readSession])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const sendPasswordReset = useCallback(async (email: string) => {
    const redirectTo = `${window.location.origin}/login?mode=recovery`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    setIsPasswordRecovery(false)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      isPasswordRecovery,
      signIn,
      signOut,
      sendPasswordReset,
      updatePassword,
      retrySession,
    }),
    [
      isPasswordRecovery,
      retrySession,
      sendPasswordReset,
      session,
      signIn,
      signOut,
      status,
      updatePassword,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
