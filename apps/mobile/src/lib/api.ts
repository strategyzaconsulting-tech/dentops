export const API_BASE = 'http://192.168.0.139:3000'

const USER_EMAIL = 'dan@smile.com'
const USER_PASS  = 'Brisa2026!'

export interface AuthUser {
  id: string
  practiceId: string
  role: string
  email: string
  firstName: string
  lastName: string
}

let _token: string | null = null
let _user: AuthUser | null = null

function decodeJwt(token: string): { userId: string; practiceId: string; role: string; email: string } {
  let b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  return JSON.parse(atob(b64))
}

export async function getToken(): Promise<string> {
  if (_token) return _token
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USER_EMAIL, password: USER_PASS }),
  })
  if (!res.ok) throw new Error('Auth failed')
  const data = await res.json()
  _token = data.token
  return _token!
}

export async function getUser(): Promise<AuthUser> {
  if (_user) return _user
  const token = await getToken()
  const payload = decodeJwt(token)
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch user')
  const me = await res.json()
  _user = {
    id: payload.userId,
    practiceId: payload.practiceId,
    role: payload.role,
    email: payload.email,
    firstName: me.firstName,
    lastName: me.lastName,
  }
  return _user
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken()
  const headers = new Headers(init.headers as HeadersInit)
  headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (res.status === 401) {
    _token = null
    _user = null
    const token2 = await getToken()
    headers.set('Authorization', `Bearer ${token2}`)
    return fetch(`${API_BASE}${path}`, { ...init, headers })
  }
  return res
}
