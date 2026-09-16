import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export interface AuthUser {
  id: string
  practiceId: string | null
  role: string
  email: string
  firstName: string
  lastName: string
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  loading: boolean
  activePracticeId: string | null
  selectedPracticeName: string | null
  login: (email: string, password: string) => Promise<AuthUser>
  logout: () => void
  selectPractice: (id: string, name: string) => void
  exitPractice: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'))
  const [loading, setLoading] = useState(true)
  const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(
    () => localStorage.getItem('selected_practice_id')
  )
  const [selectedPracticeName, setSelectedPracticeName] = useState<string | null>(
    () => localStorage.getItem('selected_practice_name')
  )

  const activePracticeId =
    user?.role === 'super_admin' ? selectedPracticeId : (user?.practiceId ?? null)

  useEffect(() => {
    if (!token) { setLoading(false); return }
    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setUser(data); else clearAuth() })
      .catch(() => clearAuth())
      .finally(() => setLoading(false))
  }, [])

  function clearAuth() {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('selected_practice_id')
    localStorage.removeItem('selected_practice_name')
    setToken(null)
    setUser(null)
    setSelectedPracticeId(null)
    setSelectedPracticeName(null)
  }

  function selectPractice(id: string, name: string) {
    localStorage.setItem('selected_practice_id', id)
    localStorage.setItem('selected_practice_name', name)
    setSelectedPracticeId(id)
    setSelectedPracticeName(name)
  }

  function exitPractice() {
    localStorage.removeItem('selected_practice_id')
    localStorage.removeItem('selected_practice_name')
    setSelectedPracticeId(null)
    setSelectedPracticeName(null)
  }

  async function login(email: string, password: string): Promise<AuthUser> {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? 'Login failed')
    }
    const data = await res.json()
    localStorage.setItem('auth_token', data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user as AuthUser
  }

  function logout() {
    clearAuth()
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, activePracticeId, selectedPracticeName, login, logout, selectPractice, exitPractice }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
