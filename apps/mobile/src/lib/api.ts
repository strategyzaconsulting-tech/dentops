import * as SecureStore from 'expo-secure-store'

export const API_BASE = 'https://dentops-production-9ffe.up.railway.app'

const TOKEN_KEY = 'auth_token'

export interface AuthUser {
  id: string
  practiceId: string
  role: string
  email: string
  firstName: string
  lastName: string
  seasonedEmployee: boolean
}

export interface LoginResult {
  token: string
  requirePasswordChange: boolean
  user: Omit<AuthUser, 'seasonedEmployee'>
}

let _token: string | null = null

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Login failed' }))
    throw new Error(err.error ?? 'Login failed')
  }
  const data: LoginResult = await res.json()
  _token = data.token
  await SecureStore.setItemAsync(TOKEN_KEY, data.token)
  return data
}

export async function logout(): Promise<void> {
  _token = null
  await SecureStore.deleteItemAsync(TOKEN_KEY)
}

export async function getStoredToken(): Promise<string | null> {
  if (_token) return _token
  const stored = await SecureStore.getItemAsync(TOKEN_KEY)
  if (stored) _token = stored
  return stored
}

export async function saveToken(token: string): Promise<void> {
  _token = token
  await SecureStore.setItemAsync(TOKEN_KEY, token)
}

export async function getUser(): Promise<AuthUser> {
  const token = await getStoredToken()
  if (!token) throw new Error('Not authenticated')
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch user')
  return res.json()
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getStoredToken()
  if (!token) throw new Error('Not authenticated')
  const headers = new Headers(init.headers as HeadersInit)
  headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (res.status === 401) {
    _token = null
    await SecureStore.deleteItemAsync(TOKEN_KEY)
  }
  return res
}
