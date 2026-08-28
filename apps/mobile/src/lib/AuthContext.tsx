import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getUser, type AuthUser } from './api'

interface AuthCtxValue { user: AuthUser | null; loading: boolean }
const AuthCtx = createContext<AuthCtxValue>({ user: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUser().then(setUser).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return <AuthCtx.Provider value={{ user, loading }}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  return useContext(AuthCtx)
}
