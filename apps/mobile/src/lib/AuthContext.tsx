import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { login as apiLogin, logout as apiLogout, getUser, getStoredToken, saveToken, type AuthUser } from './api'

interface AuthCtxValue {
  user: AuthUser | null
  loading: boolean
  requirePasswordChange: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  onPasswordChanged: (token: string) => Promise<void>
}

const AuthCtx = createContext<AuthCtxValue>({
  user: null,
  loading: true,
  requirePasswordChange: false,
  login: async () => {},
  logout: async () => {},
  onPasswordChanged: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [requirePasswordChange, setRequirePasswordChange] = useState(false)

  useEffect(() => {
    getStoredToken().then(async (token) => {
      if (token) {
        try {
          const u = await getUser()
          setUser(u)
          setRequirePasswordChange(u.status === 'invited')
        } catch {
          // stale token — clear silently
        }
      }
    }).finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email, password)
    setRequirePasswordChange(result.requirePasswordChange)
    const u = await getUser()
    setUser(u)
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setUser(null)
    setRequirePasswordChange(false)
  }, [])

  const onPasswordChanged = useCallback(async (token: string) => {
    await saveToken(token)
    const u = await getUser()
    setUser(u)
    setRequirePasswordChange(false)
  }, [])

  return (
    <AuthCtx.Provider value={{ user, loading, requirePasswordChange, login, logout, onPasswordChanged }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  return useContext(AuthCtx)
}
